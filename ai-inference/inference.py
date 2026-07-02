"""MONAI brain tumor (BraTS) segmentation — MVP inference core.

Loads the `brats_mri_segmentation` bundle weights into a SegResNet and runs
sliding-window inference on a 4-channel MRI volume. Produces per-subregion
tumor volumes (TC / WT / ET) and a base64 PNG overlay of a representative
axial slice.

MSD Task01_BrainTumour files stack channels as [FLAIR, T1, T1c, T2], but the
bundle was trained with input order [T1c, T1, T2, FLAIR] (see the bundle README).
We reorder to the model order before inference — this is critical: a wrong order
tanks TC/ET (which depend on T1c) while WT survives. Empirically verified.
The bundle predicts 3 nested subregions: ch0=TC, ch1=WT, ch2=ET.
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
import nibabel as nib
import numpy as np
import torch
from PIL import Image
from monai.bundle import download
from monai.inferers import sliding_window_inference
from monai.networks.nets import SegResNet

# ── Config ────────────────────────────────────────────────────────────────────

BUNDLE_NAME = "brats_mri_segmentation"
BUNDLE_DIR = os.environ.get("BUNDLE_DIR", os.path.join(os.path.dirname(__file__), "bundles"))
# ROI for sliding-window inference. Bundle's official inference.json uses
# 240x240x160 (whole volume in one window). Overridable via env for low-memory machines.
_roi_env = os.environ.get("INFERENCE_ROI", "240,240,160")
ROI_SIZE = tuple(int(x) for x in _roi_env.split(","))

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Bundle input channel order is [T1c, T1, T2, FLAIR]. MSD files are [FLAIR, T1, T1c, T2],
# so reorder with these source indices. FLAIR ends up at index 3 (used for overlay bg).
_MSD_TO_MODEL = [2, 1, 3, 0]  # [T1c, T1, T2, FLAIR] from [FLAIR, T1, T1c, T2]
_FLAIR_CHANNEL = 3  # FLAIR position in model-order array

# Subregion display order + overlay colors (RGBA, 0-1) for the matplotlib overlay.
SUBREGIONS = ["tc", "wt", "et"]
_OVERLAY_COLORS = {
    "wt": (0.20, 0.80, 0.20, 0.35),  # whole tumor — green, drawn first (largest)
    "tc": (1.00, 0.75, 0.10, 0.45),  # tumor core — amber
    "et": (0.95, 0.15, 0.15, 0.55),  # enhancing tumor — red (smallest, on top)
}

# Solid RGB + per-subregion alpha (0-255) for the PIL viewer mask layer. Global
# opacity is applied on the client via CSS; this alpha only sets the relative
# emphasis between subregions when they overlap (ET most solid, on top).
_MASK_RGBA = {
    "wt": (51, 204, 51, 110),   # green
    "tc": (255, 191, 26, 150),  # amber
    "et": (242, 38, 38, 190),   # red
}

# Plane name -> volume axis index for (H, W, D) volumes.
_PLANE_AXIS = {"sagittal": 0, "coronal": 1, "axial": 2}
_MAX_SLICES_PER_PLANE = 24
_SLICE_MARGIN = 3

_model: SegResNet | None = None


@dataclass
class SegmentationResult:
    volumes_ml: dict[str, float]  # {"tc": .., "wt": .., "et": ..}
    overlay_png_b64: str
    metrics: dict[str, float]  # {"brainMl", "wtPctOfBrain", "maxDiameterMm"}
    viewer: dict  # {"planes": {axial|coronal|sagittal: {axis, defaultIndex, slices}}}
    elapsed_ms: int
    device: str


# ── Model ─────────────────────────────────────────────────────────────────────

def _build_network() -> SegResNet:
    # Architecture matches the brats_mri_segmentation bundle exactly.
    return SegResNet(
        blocks_down=[1, 2, 2, 4],
        blocks_up=[1, 1, 1],
        init_filters=16,
        in_channels=4,
        out_channels=3,
        dropout_prob=0.2,
    )


def load_model() -> SegResNet:
    """Download the bundle weights (once) and load them into a SegResNet.

    Idempotent: subsequent calls return the cached model.
    """
    global _model
    if _model is not None:
        return _model

    os.makedirs(BUNDLE_DIR, exist_ok=True)
    download(name=BUNDLE_NAME, bundle_dir=BUNDLE_DIR)

    weights_path = os.path.join(BUNDLE_DIR, BUNDLE_NAME, "models", "model.pt")
    state = torch.load(weights_path, map_location=DEVICE)
    # Bundle checkpoints may wrap the state dict under a key.
    if isinstance(state, dict) and "model" in state:
        state = state["model"]

    net = _build_network()
    net.load_state_dict(state)
    net.to(DEVICE).eval()
    _model = net
    return net


def is_model_loaded() -> bool:
    return _model is not None


# ── Preprocessing ─────────────────────────────────────────────────────────────

def load_volume_4d(path: str) -> tuple[np.ndarray, tuple[float, float, float]]:
    """Load a 4-channel MSD NIfTI and reorder to model input order.

    MSD stacks [FLAIR, T1, T1c, T2] on the last axis; we return (4, H, W, D) in
    model order [T1c, T1, T2, FLAIR] + voxel spacing.
    """
    img = nib.load(path)
    data = img.get_fdata(dtype=np.float32)
    if data.ndim != 4 or data.shape[-1] != 4:
        raise ValueError(
            f"Expected a 4-channel NIfTI (…, 4); got shape {data.shape}. "
            "Provide a stacked [FLAIR, T1, T1c, T2] volume."
        )
    data = np.moveaxis(data, -1, 0)  # (4, H, W, D) as [FLAIR, T1, T1c, T2]
    data = data[_MSD_TO_MODEL]       # -> [T1c, T1, T2, FLAIR]
    spacing = tuple(float(z) for z in img.header.get_zooms()[:3])
    return data, spacing


def stack_modalities(paths: dict[str, str]) -> tuple[np.ndarray, tuple[float, float, float]]:
    """Load 4 separate modality NIfTIs and stack in model order [T1c, T1, T2, FLAIR].

    `paths` keys: 'flair', 't1', 't1c', 't2'. Used by the upload path.
    """
    order = ["t1c", "t1", "t2", "flair"]  # model input order
    channels: list[np.ndarray] = []
    spacing: tuple[float, float, float] | None = None
    ref_shape: tuple[int, ...] | None = None
    for key in order:
        img = nib.load(paths[key])
        vol = img.get_fdata(dtype=np.float32)
        if vol.ndim != 3:
            raise ValueError(f"Modality '{key}' must be a 3D NIfTI; got shape {vol.shape}")
        if ref_shape is None:
            ref_shape = vol.shape
            spacing = tuple(float(z) for z in img.header.get_zooms()[:3])
        elif vol.shape != ref_shape:
            raise ValueError(
                f"Modality '{key}' shape {vol.shape} does not match '{order[0]}' {ref_shape}. "
                "All modalities must be co-registered to the same grid."
            )
        channels.append(vol)
    assert spacing is not None
    return np.stack(channels, axis=0), spacing


def _normalize_nonzero(data: np.ndarray) -> np.ndarray:
    """Per-channel z-score over the nonzero (brain) region — matches bundle transform."""
    out = np.zeros_like(data, dtype=np.float32)
    for c in range(data.shape[0]):
        ch = data[c]
        mask = ch > 0
        if mask.any():
            mean = ch[mask].mean()
            std = ch[mask].std() + 1e-8
            normed = (ch - mean) / std
            normed[~mask] = 0.0
            out[c] = normed
    return out


# ── Inference ─────────────────────────────────────────────────────────────────

def _predict(data: np.ndarray) -> np.ndarray:
    """Run sliding-window inference. Returns binary mask (3, H, W, D): TC, WT, ET."""
    model = load_model()
    x = torch.from_numpy(_normalize_nonzero(data))[None].to(DEVICE)  # (1, 4, H, W, D)
    with torch.no_grad():
        logits = sliding_window_inference(
            inputs=x,
            roi_size=ROI_SIZE,
            sw_batch_size=1,
            predictor=model,
            overlap=0.5,
        )
    prob = torch.sigmoid(logits)[0].cpu().numpy()  # (3, H, W, D)
    return (prob > 0.5).astype(np.uint8)


def _compute_volumes(seg: np.ndarray, spacing: tuple[float, float, float]) -> dict[str, float]:
    voxel_ml = (spacing[0] * spacing[1] * spacing[2]) / 1000.0  # mm^3 -> ml
    return {name: round(float(seg[i].sum()) * voxel_ml, 2) for i, name in enumerate(SUBREGIONS)}


def _build_overlay(background: np.ndarray, seg: np.ndarray) -> str:
    """Overlay tumor masks on the axial slice with the largest whole-tumor area."""
    wt = seg[1]  # whole tumor
    areas = wt.sum(axis=(0, 1))  # per-z area
    z = int(np.argmax(areas)) if areas.max() > 0 else background.shape[2] // 2

    bg = background[:, :, z]
    bg = np.rot90(bg)
    vmax = np.percentile(bg[bg > 0], 99) if (bg > 0).any() else 1.0

    fig, ax = plt.subplots(figsize=(5, 5), dpi=110)
    ax.imshow(bg, cmap="gray", vmin=0, vmax=max(vmax, 1e-6))
    ax.axis("off")

    for name in ("wt", "tc", "et"):  # draw largest first
        idx = SUBREGIONS.index(name)
        mask = np.rot90(seg[idx][:, :, z])
        if mask.any():
            rgba = np.zeros((*mask.shape, 4), dtype=np.float32)
            rgba[mask.astype(bool)] = _OVERLAY_COLORS[name]
            ax.imshow(rgba)

    ax.set_title(f"Aksiyel kesit z={z}", fontsize=9, color="#334155")
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", pad_inches=0.05)
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode("ascii")


# ── Interactive viewer (PIL) ────────────────────────────────────────────────────

def _encode_png(arr: np.ndarray) -> str:
    """Encode a uint8 numpy array (grayscale HxW or RGBA HxWx4) as base64 PNG."""
    mode = "RGBA" if arr.ndim == 3 else "L"
    buf = io.BytesIO()
    Image.fromarray(arr, mode=mode).save(buf, format="PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _window_to_uint8(slice2d: np.ndarray, vmin: float, vmax: float) -> np.ndarray:
    """Window a float slice to 0-255 grayscale with fixed vmin/vmax (consistent brightness)."""
    span = max(vmax - vmin, 1e-6)
    norm = np.clip((slice2d - vmin) / span, 0.0, 1.0)
    return (norm * 255.0).astype(np.uint8)


def _mask_rgba(seg_slices: dict[str, np.ndarray]) -> np.ndarray:
    """Composite TC/WT/ET binary slices into one RGBA uint8 image (transparent elsewhere)."""
    ref = seg_slices["wt"]
    rgba = np.zeros((*ref.shape, 4), dtype=np.uint8)
    for name in ("wt", "tc", "et"):  # paint largest first, ET on top
        mask = seg_slices[name].astype(bool)
        if mask.any():
            rgba[mask] = _MASK_RGBA[name]
    return rgba


def _slice_along(vol: np.ndarray, axis: int, index: int) -> np.ndarray:
    """Take a 2D slice from a 3D volume along `axis`, rotated to match overlay orientation."""
    sl = np.take(vol, index, axis=axis)
    return np.rot90(sl)


def _bbox_range(wt: np.ndarray, axis: int) -> list[int]:
    """Slice indices covering the whole-tumor bbox along `axis` (+margin), capped to max."""
    other = tuple(a for a in range(3) if a != axis)
    present = np.where(wt.any(axis=other))[0]
    dim = wt.shape[axis]
    if present.size == 0:
        mid = dim // 2  # no tumor on this axis — show a few central slices
        lo, hi = max(0, mid - 5), min(dim - 1, mid + 5)
    else:
        lo = max(0, int(present.min()) - _SLICE_MARGIN)
        hi = min(dim - 1, int(present.max()) + _SLICE_MARGIN)
    full = list(range(lo, hi + 1))
    if len(full) <= _MAX_SLICES_PER_PLANE:
        return full
    # Evenly subsample while keeping the true indices.
    picks = np.linspace(0, len(full) - 1, _MAX_SLICES_PER_PLANE).round().astype(int)
    return [full[i] for i in sorted(set(picks.tolist()))]


def _build_viewer(background_flair: np.ndarray, seg: np.ndarray) -> dict:
    """Build multi-plane base+mask PNG stacks for the interactive viewer."""
    nz = background_flair[background_flair > 0]
    vmin = float(np.percentile(nz, 1)) if nz.size else 0.0
    vmax = float(np.percentile(nz, 99)) if nz.size else 1.0

    seg_by_name = {name: seg[i] for i, name in enumerate(SUBREGIONS)}
    wt = seg_by_name["wt"]
    planes: dict[str, dict] = {}

    for plane, axis in _PLANE_AXIS.items():
        indices = _bbox_range(wt, axis)
        # Default slice = largest WT area along this axis.
        other = tuple(a for a in range(3) if a != axis)
        areas = wt.sum(axis=other)
        default_index = int(np.argmax(areas)) if areas.max() > 0 else background_flair.shape[axis] // 2
        if default_index not in indices:
            default_index = min(indices, key=lambda i: abs(i - default_index))

        slices = []
        for idx in indices:
            base = _window_to_uint8(_slice_along(background_flair, axis, idx), vmin, vmax)
            mask_slices = {name: _slice_along(seg_by_name[name], axis, idx) for name in SUBREGIONS}
            slices.append({
                "index": idx,
                "basePng": _encode_png(base),
                "maskPng": _encode_png(_mask_rgba(mask_slices)),
            })

        planes[plane] = {"axis": plane[0], "defaultIndex": default_index, "slices": slices}

    return {"planes": planes}


def _compute_metrics(
    seg: np.ndarray, spacing: tuple[float, float, float], background_flair: np.ndarray
) -> dict[str, float]:
    """Brain volume, WT share of brain, and WT's largest in-plane diameter (mm)."""
    voxel_ml = (spacing[0] * spacing[1] * spacing[2]) / 1000.0
    brain_voxels = int((background_flair > 0).sum())
    brain_ml = brain_voxels * voxel_ml
    wt = seg[1]
    wt_ml = float(wt.sum()) * voxel_ml
    wt_pct = (wt_ml / brain_ml * 100.0) if brain_ml > 0 else 0.0

    # Largest axial (z) WT bbox diagonal in mm.
    max_diam = 0.0
    areas = wt.sum(axis=(0, 1))
    if areas.max() > 0:
        z = int(np.argmax(areas))
        ys, xs = np.where(wt[:, :, z] > 0)
        dy = (ys.max() - ys.min()) * spacing[0]
        dx = (xs.max() - xs.min()) * spacing[1]
        max_diam = float(np.hypot(dx, dy))

    return {
        "brainMl": round(brain_ml, 1),
        "wtPctOfBrain": round(wt_pct, 2),
        "maxDiameterMm": round(max_diam, 1),
    }


def run_segmentation(
    data: np.ndarray, spacing: tuple[float, float, float]
) -> SegmentationResult:
    """Full pipeline: predict -> volumes + overlay + metrics + viewer. `data` is (4, H, W, D)."""
    start = time.time()
    seg = _predict(data)
    flair = data[_FLAIR_CHANNEL]  # FLAIR channel (model order) — background for overlay/viewer
    volumes = _compute_volumes(seg, spacing)
    overlay = _build_overlay(background=flair, seg=seg)
    metrics = _compute_metrics(seg, spacing, flair)
    viewer = _build_viewer(background_flair=flair, seg=seg)
    return SegmentationResult(
        volumes_ml=volumes,
        overlay_png_b64=overlay,
        metrics=metrics,
        viewer=viewer,
        elapsed_ms=int((time.time() - start) * 1000),
        device=str(DEVICE),
    )
