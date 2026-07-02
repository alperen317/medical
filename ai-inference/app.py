"""MedPanel AI inference microservice — brain tumor (BraTS) segmentation MVP.

Endpoints:
  GET  /health          -> service + model status
  GET  /cases           -> locally available sample cases (Phase 1)
  POST /segment         -> run segmentation on a sample case by id (Phase 1)
  POST /segment-upload  -> run segmentation on 4 uploaded modality NIfTIs (Phase 2)

Sample cases live in ./sample_cases (gitignored, placed locally). Each case is
a single 4-channel NIfTI ([FLAIR, T1, T1c, T2]) named <id>.nii.gz.
"""

from __future__ import annotations

import glob
import os
import tempfile

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel

import inference

SAMPLE_DIR = os.environ.get("SAMPLE_DIR", os.path.join(os.path.dirname(__file__), "sample_cases"))

app = FastAPI(title="MedPanel Brain Tumor Segmentation", version="0.1.0")


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
def _warm_model() -> None:
    # Best-effort model load at startup so the first request isn't cold.
    # Non-fatal: if weights can't be fetched, endpoints report modelLoaded=false.
    try:
        inference.load_model()
    except Exception as exc:  # noqa: BLE001
        print(f"[startup] model preload failed (will retry on request): {exc}")


# ── Case discovery ────────────────────────────────────────────────────────────

def _list_cases() -> list[dict[str, str]]:
    if not os.path.isdir(SAMPLE_DIR):
        return []
    cases: list[dict[str, str]] = []
    for path in sorted(glob.glob(os.path.join(SAMPLE_DIR, "*.nii*"))):
        base = os.path.basename(path)
        case_id = base.replace(".nii.gz", "").replace(".nii", "")
        cases.append({"id": case_id, "label": case_id})
    return cases


def _case_path(case_id: str) -> str | None:
    for ext in (".nii.gz", ".nii"):
        path = os.path.join(SAMPLE_DIR, f"{case_id}{ext}")
        if os.path.isfile(path):
            return path
    return None


# ── Schemas ───────────────────────────────────────────────────────────────────

class SegmentRequest(BaseModel):
    caseId: str


class SegmentResponse(BaseModel):
    caseId: str | None = None
    volumes: dict[str, float]
    overlayPng: str
    metrics: dict[str, float]
    viewer: dict
    elapsedMs: int
    device: str


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "device": str(inference.DEVICE),
        "modelLoaded": inference.is_model_loaded(),
        "sampleCases": len(_list_cases()),
    }


@app.get("/cases")
def cases() -> dict:
    return {"cases": _list_cases()}


@app.post("/segment", response_model=SegmentResponse)
def segment(req: SegmentRequest) -> SegmentResponse:
    path = _case_path(req.caseId)
    if path is None:
        raise HTTPException(status_code=404, detail=f"Örnek vaka bulunamadı: {req.caseId}")
    try:
        data, spacing = inference.load_volume_4d(path)
        result = inference.run_segmentation(data, spacing)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return SegmentResponse(
        caseId=req.caseId,
        volumes=result.volumes_ml,
        overlayPng=result.overlay_png_b64,
        metrics=result.metrics,
        viewer=result.viewer,
        elapsedMs=result.elapsed_ms,
        device=result.device,
    )


@app.post("/segment-upload", response_model=SegmentResponse)
async def segment_upload(
    flair: UploadFile = File(...),
    t1: UploadFile = File(...),
    t1c: UploadFile = File(...),
    t2: UploadFile = File(...),
) -> SegmentResponse:
    """Phase 2: run segmentation on 4 co-registered modality NIfTIs."""
    uploads = {"flair": flair, "t1": t1, "t1c": t1c, "t2": t2}
    with tempfile.TemporaryDirectory() as tmp:
        paths: dict[str, str] = {}
        for key, upload in uploads.items():
            name = upload.filename or f"{key}.nii.gz"
            if not name.endswith((".nii", ".nii.gz")):
                raise HTTPException(status_code=400, detail=f"'{key}' bir NIfTI dosyası olmalı (.nii/.nii.gz)")
            dest = os.path.join(tmp, f"{key}.nii.gz" if name.endswith(".gz") else f"{key}.nii")
            with open(dest, "wb") as fh:
                fh.write(await upload.read())
            paths[key] = dest

        try:
            data, spacing = inference.stack_modalities(paths)
            result = inference.run_segmentation(data, spacing)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return SegmentResponse(
        caseId=None,
        volumes=result.volumes_ml,
        overlayPng=result.overlay_png_b64,
        metrics=result.metrics,
        viewer=result.viewer,
        elapsedMs=result.elapsed_ms,
        device=result.device,
    )
