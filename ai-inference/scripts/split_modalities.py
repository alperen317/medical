"""4-kanal BraTS NIfTI'yi 4 ayrı modalite dosyasına böler (yükleme testi için).

Task01_BrainTumour / BraTS vakaları tek bir 4-kanal NIfTI'dir; kanal sırası
[FLAIR, T1, T1c, T2]. "MR Yükle" akışını denemek için bu script bir vakayı
flair.nii.gz / t1.nii.gz / t1c.nii.gz / t2.nii.gz olarak dışarı yazar.

Kullanım:
    python split_modalities.py <4kanal.nii.gz> [cikti_klasoru]

Bağımlılık: nibabel, numpy (ai-inference imajında zaten var — konteynerde de
çalıştırılabilir).
"""

from __future__ import annotations

import os
import sys

import nibabel as nib
import numpy as np

CHANNELS = ["flair", "t1", "t1c", "t2"]  # BraTS kanal sırası


def split(src: str, out_dir: str) -> None:
    img = nib.load(src)
    data = img.get_fdata(dtype=np.float32)
    if data.ndim != 4 or data.shape[-1] != 4:
        raise SystemExit(f"Beklenen 4-kanal NIfTI (…, 4); gelen şekil {data.shape}")

    os.makedirs(out_dir, exist_ok=True)
    for i, name in enumerate(CHANNELS):
        vol = nib.Nifti1Image(data[..., i], img.affine, img.header)
        dest = os.path.join(out_dir, f"{name}.nii.gz")
        nib.save(vol, dest)
        print(f"  {name:5s} -> {dest}")
    print(f"Bitti. 4 modalite '{out_dir}' klasörüne yazıldı.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Kullanım: python split_modalities.py <4kanal.nii.gz> [cikti_klasoru]")
    source = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(source) or ".", "modalities")
    split(source, out)
