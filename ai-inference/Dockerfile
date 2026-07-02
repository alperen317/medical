FROM python:3.11-slim

# System libs needed by nibabel/matplotlib/torch at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (better layer caching).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the MONAI bundle weights at build time so startup is fast and
# the container works offline. Cached under /app/bundles.
ENV BUNDLE_DIR=/app/bundles
RUN python -c "from monai.bundle import download; download(name='brats_mri_segmentation', bundle_dir='/app/bundles', source='monaihosting')"

COPY inference.py app.py ./
# sample_cases is gitignored and mounted/copied locally at run time (see README).

ENV SAMPLE_DIR=/app/sample_cases
EXPOSE 8070

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8070"]
