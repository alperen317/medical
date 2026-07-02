"""Model doğruluğu (Dice) değerlendirmesi — MSD Task01_BrainTumour üzerinde.

Her vaka için modeli çalıştırır, `labelsTr`'deki gerçek maskeyi BraTS alt-bölgelerine
(TC/WT/ET) dönüştürür ve Dice katsayısını hesaplar. Alt-bölge başına ortalama Dice raporlar.

Etiketler (dataset.json): 1=ödem, 2=non-enhancing, 3=enhancing.
Alt-bölgeler:
    WT (bütün tümör)     = 1 ∪ 2 ∪ 3
    TC (tümör çekirdeği) = 2 ∪ 3
    ET (kontrastlanan)   = 3

⚠️  UYARI: Bu MONAI bundle'ı BraTS 2018 ile eğitildi; bu dataset büyük ölçüde aynı
vakaları içerir. Buradaki Dice EĞİTİM verisinden gelir → gerçek performanstan İYİMSER.
Dürüst tahmin için modelin görmediği ayrı bir set kullanın. Bu skorları "üst sınır /
sağlık kontrolü" olarak yorumlayın (referans ort. Dice ~0.85).

Kullanım (konteynerde, dataset mount edilerek):
    docker run --rm \
      -v "/c/Users/alperen.aslan/Downloads/Task01_BrainTumour:/data:ro" \
      -v "$(pwd)/ai-inference/scripts:/app/scripts:ro" \
      medpanel-ai-inference \
      python scripts/evaluate.py --data /data -n 20 --csv /data/dice_results.csv

Argümanlar:
    --data DIR   imagesTr/ + labelsTr/ içeren dataset klasörü (zorunlu)
    -n N         değerlendirilecek vaka sayısı (varsayılan 20; 0 = hepsi)
    --csv PATH   sonuçları CSV'ye de yaz (isteğe bağlı)
"""

from __future__ import annotations

import argparse
import csv
import glob
import os
import sys

import nibabel as nib
import numpy as np

# inference.py /app kökünde; script /app/scripts altında çalışırken import edilebilsin.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import inference  # noqa: E402


def _subregions_from_label(lbl: np.ndarray) -> dict[str, np.ndarray]:
    """Ground-truth etiket haritasını nested alt-bölge maskelerine çevirir."""
    return {
        "tc": (lbl == 2) | (lbl == 3),
        "wt": (lbl == 1) | (lbl == 2) | (lbl == 3),
        "et": lbl == 3,
    }


def _dice(pred: np.ndarray, gt: np.ndarray) -> float:
    """İkili maskeler için Dice. İkisi de boşsa 1.0 (konvansiyon)."""
    pred = pred.astype(bool)
    gt = gt.astype(bool)
    denom = pred.sum() + gt.sum()
    if denom == 0:
        return 1.0
    return float(2.0 * np.logical_and(pred, gt).sum() / denom)


def _list_cases(images_dir: str) -> list[str]:
    paths = sorted(glob.glob(os.path.join(images_dir, "*.nii*")))
    # macOS tar artığı "._" gizli dosyalarını atla.
    return [p for p in paths if not os.path.basename(p).startswith("._")]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, help="imagesTr/ + labelsTr/ içeren klasör")
    ap.add_argument("-n", type=int, default=20, help="vaka sayısı (0 = hepsi)")
    ap.add_argument("--csv", default=None, help="isteğe bağlı CSV çıktı yolu")
    args = ap.parse_args()

    images_dir = os.path.join(args.data, "imagesTr")
    labels_dir = os.path.join(args.data, "labelsTr")
    for d in (images_dir, labels_dir):
        if not os.path.isdir(d):
            raise SystemExit(f"Klasör bulunamadı: {d}")

    cases = _list_cases(images_dir)
    if args.n > 0:
        cases = cases[: args.n]
    if not cases:
        raise SystemExit(f"imagesTr içinde vaka bulunamadı: {images_dir}")

    print(f"Model yükleniyor (device={inference.DEVICE})…")
    inference.load_model()
    print(f"{len(cases)} vaka değerlendirilecek.\n")

    header = f"{'vaka':<16}{'WT':>8}{'TC':>8}{'ET':>8}"
    print(header)
    print("-" * len(header))

    rows: list[dict] = []
    sums = {"wt": 0.0, "tc": 0.0, "et": 0.0}

    for i, img_path in enumerate(cases, 1):
        name = os.path.basename(img_path).replace(".nii.gz", "").replace(".nii", "")
        lbl_path = os.path.join(labels_dir, os.path.basename(img_path))
        if not os.path.isfile(lbl_path):
            print(f"{name:<16}  (etiket yok, atlandı)")
            continue

        data, _ = inference.load_volume_4d(img_path)
        seg = inference._predict(data)  # (3,H,W,D) — [tc, wt, et]
        pred = {name_: seg[idx] for idx, name_ in enumerate(inference.SUBREGIONS)}

        gt = _subregions_from_label(nib.load(lbl_path).get_fdata().astype(np.int16))
        dice = {k: _dice(pred[k], gt[k]) for k in ("wt", "tc", "et")}
        for k in sums:
            sums[k] += dice[k]

        rows.append({"case": name, **dice})
        # flush=True: çıktı dosyaya/pipe'a yazılırken ilerleme anında görünsün.
        print(f"{name:<16}{dice['wt']:>8.3f}{dice['tc']:>8.3f}{dice['et']:>8.3f}  [{i}/{len(cases)}]", flush=True)

    n = len(rows)
    if n == 0:
        raise SystemExit("Hiç vaka değerlendirilemedi.")

    print("-" * len(header))
    print(f"{'ORTALAMA':<16}{sums['wt']/n:>8.3f}{sums['tc']/n:>8.3f}{sums['et']/n:>8.3f}")
    print(f"\n{n} vaka. Ortalama Dice — WT: {sums['wt']/n:.3f}  TC: {sums['tc']/n:.3f}  ET: {sums['et']/n:.3f}")
    print("(Hatırlatma: eğitim verisiyle örtüşme olabilir → iyimser skor.)")

    if args.csv:
        with open(args.csv, "w", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=["case", "wt", "tc", "et"])
            w.writeheader()
            w.writerows(rows)
        print(f"\nCSV yazıldı: {args.csv}")


if __name__ == "__main__":
    main()
