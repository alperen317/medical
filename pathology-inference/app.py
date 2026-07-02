"""MedPanel AI inference microservice — pathology tumor detection (Camelyon-16) MVP.

Endpoints:
  GET  /health         -> service + model status
  POST /detect-upload  -> run tumor detection on an uploaded WSI (.tif/.tiff/.svs/.ndpi)

WSI files can be gigabyte-scale, so the upload is streamed to a temp file in
chunks rather than read fully into memory before processing.
"""

from __future__ import annotations

import os
import tempfile

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel

import inference

ALLOWED_EXTENSIONS = (".tif", ".tiff", ".svs", ".ndpi")
CHUNK_SIZE = 8 * 1024 * 1024  # 8 MB

app = FastAPI(title="MedPanel Pathology Tumor Detection", version="0.1.0")


@app.on_event("startup")
def _warm_model() -> None:
    # Best-effort model load at startup so the first request isn't cold.
    # Non-fatal: if weights can't be fetched, endpoints report modelLoaded=false.
    try:
        inference.load_model()
    except Exception as exc:  # noqa: BLE001
        print(f"[startup] model preload failed (will retry on request): {exc}")


class DetectResponse(BaseModel):
    fileName: str
    heatmapPng: str
    thumbnailPng: str
    metrics: dict[str, float]
    elapsedMs: int
    device: str


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "device": str(inference.DEVICE),
        "modelLoaded": inference.is_model_loaded(),
    }


@app.post("/detect-upload", response_model=DetectResponse)
async def detect_upload(file: UploadFile = File(...)) -> DetectResponse:
    name = file.filename or "slide"
    if not name.lower().endswith(ALLOWED_EXTENSIONS):
        raise HTTPException(
            status_code=400,
            detail=f"Desteklenmeyen dosya türü. Beklenen: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    suffix = os.path.splitext(name)[1]
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_path = tmp.name
        while chunk := await file.read(CHUNK_SIZE):
            tmp.write(chunk)

    try:
        result = inference.run_detection(tmp_path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 — surface openslide/format errors as 400s
        raise HTTPException(status_code=400, detail=f"Slide okunamadı: {exc}") from exc
    finally:
        os.unlink(tmp_path)

    return DetectResponse(
        fileName=name,
        heatmapPng=result.heatmap_png_b64,
        thumbnailPng=result.thumbnail_png_b64,
        metrics=result.metrics,
        elapsedMs=result.elapsed_ms,
        device=result.device,
    )
