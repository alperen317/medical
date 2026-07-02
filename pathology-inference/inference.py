"""MONAI pathology tumor detection (Camelyon-16) — WSI inference core.

Loads the `pathology_tumor_detection` bundle weights into a TorchVisionFCModel
(ResNet18, final FC replaced by a 1x1 conv, num_classes=1 — see bundle
configs/inference.json `network_def`) and runs patch-level tumor-probability
inference across a whole-slide image (WSI).

Pipeline (matches the bundle's own inference.json approach, reimplemented here
as a plain function so it's callable from FastAPI and returns JSON/PNG instead
of writing files to disk):
  1. Build a tissue mask from a low-resolution thumbnail (HSV saturation +
     Otsu threshold — stained tissue is saturated, background slide is not).
  2. Grid the slide into 224x224 patches at level 0 (native resolution — the
     bundle was trained on level-0 patches, see `spatial_shape` in
     configs/metadata.json) and keep only patches whose corresponding tissue
     mask cell has enough tissue.
  3. Cap the patch count (MAX_PATCHES) and evenly subsample if there are more
     tissue patches than the budget — CPU inference of an entire 40x slide is
     hours-scale, this keeps a single request in the minutes range.
  4. Run patches through the model in batches, sigmoid -> per-patch
     tumor probability.
  5. Render a colored probability heatmap over the slide thumbnail + summary
     metrics.
"""

from __future__ import annotations

import base64
import io
import os
import time
from dataclasses import dataclass

import matplotlib

matplotlib.use("Agg")  # headless — no display in container
import matplotlib.pyplot as plt
import numpy as np
import openslide
import torch
from monai.bundle import download
from monai.networks.nets import TorchVisionFCModel
from skimage.color import rgb2hsv
from skimage.filters import threshold_otsu

# ── Config ────────────────────────────────────────────────────────────────────

BUNDLE_NAME = "pathology_tumor_detection"
BUNDLE_DIR = os.environ.get("BUNDLE_DIR", os.path.join(os.path.dirname(__file__), "bundles"))

PATCH_SIZE = 224  # bundle's trained patch size (configs/metadata.json spatial_shape)
# Target downsample for the tissue-mask thumbnail (bundle uses mask_level=6, i.e. ~64x
# downsample on a standard Camelyon pyramid). We pick the slide level closest to this
# downsample instead of a hardcoded level index, since level counts vary by scanner.
MASK_TARGET_DOWNSAMPLE = float(os.environ.get("MASK_TARGET_DOWNSAMPLE", "64"))
TISSUE_FRACTION_MIN = 0.1  # a grid cell needs >=10% tissue pixels to be sampled

# Compute budget knobs — CPU inference of a full 40x WSI is hours-scale, so we cap
# the number of patches evaluated per request. Override for GPU deployments.
MAX_PATCHES = int(os.environ.get("MAX_PATCHES", "300"))
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "8"))

TUMOR_PROB_THRESHOLD = 0.5

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

_model: TorchVisionFCModel | None = None


@dataclass
class DetectionResult:
    heatmap_png_b64: str
    thumbnail_png_b64: str
    metrics: dict[str, float]  # {"maxProb", "tumorAreaPct", "patchesAnalyzed"}
    elapsed_ms: int
    device: str


# ── Model ─────────────────────────────────────────────────────────────────────

def load_model() -> TorchVisionFCModel:
    """Download the bundle weights (once) and load them into a TorchVisionFCModel.

    Idempotent: subsequent calls return the cached model.
    """
    global _model
    if _model is not None:
        return _model

    os.makedirs(BUNDLE_DIR, exist_ok=True)
    download(name=BUNDLE_NAME, bundle_dir=BUNDLE_DIR)

    weights_path = os.path.join(BUNDLE_DIR, BUNDLE_NAME, "models", "model.pt")
    state = torch.load(weights_path, map_location=DEVICE)
    if isinstance(state, dict) and "model" in state:
        state = state["model"]

    # Matches bundle configs/inference.json network_def exactly (pretrained=False
    # here since we immediately overwrite with the bundle's own trained weights).
    net = TorchVisionFCModel(model_name="resnet18", num_classes=1, use_conv=True, pretrained=False)
    net.load_state_dict(state)
    net.to(DEVICE).eval()
    _model = net
    return net


def is_model_loaded() -> bool:
    return _model is not None


# ── Tissue mask + patch grid ─────────────────────────────────────────────────

def _pick_mask_level(slide: openslide.OpenSlide) -> int:
    """Pick the pyramid level whose downsample is closest to MASK_TARGET_DOWNSAMPLE."""
    downsamples = slide.level_downsamples
    diffs = [abs(d - MASK_TARGET_DOWNSAMPLE) for d in downsamples]
    return int(np.argmin(diffs))


def _tissue_mask(thumb_rgb: np.ndarray) -> np.ndarray:
    """Binary tissue mask from an RGB thumbnail via HSV saturation + Otsu.

    Stained tissue is saturated; the empty glass/background is near-white
    (low saturation) — far more robust than grayscale intensity for H&E slides.
    """
    sat = rgb2hsv(thumb_rgb)[:, :, 1]
    if sat.max() <= sat.min():
        return np.zeros(sat.shape, dtype=bool)
    thresh = threshold_otsu(sat)
    return sat > thresh


def _patch_coords(slide: openslide.OpenSlide, mask: np.ndarray, mask_downsample: float) -> list[tuple[int, int]]:
    """Level-0 (x, y) top-left coords of PATCH_SIZE tissue patches, capped to MAX_PATCHES."""
    width0, height0 = slide.level_dimensions[0]
    coords: list[tuple[int, int]] = []
    mask_h, mask_w = mask.shape
    step_mask = PATCH_SIZE / mask_downsample  # patch footprint size in mask-pixel units

    y0 = 0
    while y0 + PATCH_SIZE <= height0:
        x0 = 0
        my0 = int(y0 / mask_downsample)
        my1 = min(mask_h, int(my0 + step_mask) + 1)
        while x0 + PATCH_SIZE <= width0:
            mx0 = int(x0 / mask_downsample)
            mx1 = min(mask_w, int(mx0 + step_mask) + 1)
            cell = mask[my0:my1, mx0:mx1]
            if cell.size > 0 and cell.mean() >= TISSUE_FRACTION_MIN:
                coords.append((x0, y0))
            x0 += PATCH_SIZE
        y0 += PATCH_SIZE

    if len(coords) > MAX_PATCHES:
        picks = np.linspace(0, len(coords) - 1, MAX_PATCHES).round().astype(int)
        coords = [coords[i] for i in sorted(set(picks.tolist()))]
    return coords


# ── Inference ─────────────────────────────────────────────────────────────────

def _read_patch_rgb(slide: openslide.OpenSlide, x0: int, y0: int) -> np.ndarray:
    tile = slide.read_region((x0, y0), 0, (PATCH_SIZE, PATCH_SIZE)).convert("RGB")
    return np.asarray(tile, dtype=np.uint8)  # (H, W, 3)


def _predict_patches(slide: openslide.OpenSlide, coords: list[tuple[int, int]]) -> list[float]:
    """Run patches through the model in batches. Returns tumor probability per coord."""
    if not coords:
        return []
    model = load_model()
    scores: list[float] = []
    with torch.no_grad():
        for i in range(0, len(coords), BATCH_SIZE):
            batch_coords = coords[i : i + BATCH_SIZE]
            patches = np.stack([_read_patch_rgb(slide, x, y) for x, y in batch_coords])  # (B, H, W, 3)
            # Bundle preprocessing: CastToTyped(float32) -> ScaleIntensityRanged(0..255 -> -1..1).
            x = patches.astype(np.float32) / 255.0 * 2.0 - 1.0
            x = np.moveaxis(x, -1, 1)  # (B, 3, H, W)
            tensor = torch.from_numpy(x).to(DEVICE)
            logits = model(tensor)
            probs = torch.sigmoid(logits).view(-1).cpu().numpy()
            scores.extend(float(p) for p in probs)
    return scores


# ── Visualization ─────────────────────────────────────────────────────────────

def _thumbnail(slide: openslide.OpenSlide, max_dim: int = 1024) -> np.ndarray:
    width0, height0 = slide.level_dimensions[0]
    scale = max_dim / max(width0, height0)
    size = (max(1, int(width0 * scale)), max(1, int(height0 * scale)))
    thumb = slide.get_thumbnail(size).convert("RGB")
    return np.asarray(thumb, dtype=np.uint8)


def _encode_png(fig) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", pad_inches=0.05, dpi=110)
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _build_thumbnail_png(thumb_rgb: np.ndarray) -> str:
    fig, ax = plt.subplots(figsize=(6, 6 * thumb_rgb.shape[0] / max(thumb_rgb.shape[1], 1)))
    ax.imshow(thumb_rgb)
    ax.axis("off")
    return _encode_png(fig)


def _build_heatmap(
    thumb_rgb: np.ndarray,
    width0: int,
    height0: int,
    coords: list[tuple[int, int]],
    scores: list[float],
) -> str:
    """Colorize per-patch probabilities and overlay on the slide thumbnail."""
    th, tw = thumb_rgb.shape[:2]
    grid = np.full((th, tw), np.nan, dtype=np.float32)
    for (x0, y0), score in zip(coords, scores):
        tx0 = int(x0 / width0 * tw)
        ty0 = int(y0 / height0 * th)
        tx1 = max(tx0 + 1, int((x0 + PATCH_SIZE) / width0 * tw))
        ty1 = max(ty0 + 1, int((y0 + PATCH_SIZE) / height0 * th))
        grid[ty0:ty1, tx0:tx1] = score

    # Not: `_build_thumbnail_png` ile aynı figsize/axis/padding kullanılıyor — burada
    # ek bir başlık/margin eklenirse iki PNG farklı en-boy oranına düşer ve frontend'de
    # bağımsız object-contain ile üst üste bindirildiklerinde hizaları kayar.
    fig, ax = plt.subplots(figsize=(6, 6 * th / max(tw, 1)))
    ax.imshow(thumb_rgb)
    masked = np.ma.masked_invalid(grid)
    ax.imshow(masked, cmap="jet", vmin=0.0, vmax=1.0, alpha=0.5)
    ax.axis("off")
    return _encode_png(fig)


def _compute_metrics(scores: list[float]) -> dict[str, float]:
    if not scores:
        return {"maxProb": 0.0, "tumorAreaPct": 0.0, "patchesAnalyzed": 0}
    arr = np.array(scores)
    tumor_pct = float((arr >= TUMOR_PROB_THRESHOLD).mean() * 100.0)
    return {
        "maxProb": round(float(arr.max()), 4),
        "tumorAreaPct": round(tumor_pct, 2),
        "patchesAnalyzed": len(scores),
    }


# ── Entry point ───────────────────────────────────────────────────────────────

def run_detection(path: str) -> DetectionResult:
    start = time.time()
    slide = openslide.OpenSlide(path)
    try:
        width0, height0 = slide.level_dimensions[0]
        mask_level = _pick_mask_level(slide)
        mask_downsample = slide.level_downsamples[mask_level]
        mask_rgb = np.asarray(
            slide.read_region((0, 0), mask_level, slide.level_dimensions[mask_level]).convert("RGB"),
            dtype=np.uint8,
        )
        mask = _tissue_mask(mask_rgb)

        coords = _patch_coords(slide, mask, mask_downsample)
        scores = _predict_patches(slide, coords)

        thumb_rgb = _thumbnail(slide)
        heatmap_png = _build_heatmap(thumb_rgb, width0, height0, coords, scores)
        thumbnail_png = _build_thumbnail_png(thumb_rgb)
        metrics = _compute_metrics(scores)
    finally:
        slide.close()

    return DetectionResult(
        heatmap_png_b64=heatmap_png,
        thumbnail_png_b64=thumbnail_png,
        metrics=metrics,
        elapsed_ms=int((time.time() - start) * 1000),
        device=str(DEVICE),
    )
