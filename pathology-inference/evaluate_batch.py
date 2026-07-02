"""Çoklu WSI üzerinde slide-düzeyi doğruluk değerlendirmesi.

Etiketli birkaç Camelyon-16 slide'ı (tumor_XXX.tif / normal_XXX.tif) üzerinde
modelin ne kadar isabetli ayrım yaptığını görmek için: her slide için
`inference.run_detection` çalıştırır, `metrics.maxProb >= PREDICT_THRESHOLD`
ise "tumor" tahmin eder, bilinen etiketle karşılaştırıp accuracy + confusion
matrix üretir. Piksel-düzeyi FROC değil — MVP'nin amacına uygun, hızlı bir
slide-level sinyal.

Kullanım (container içinde, sample_slides/eval/ altında slide'lar + labels.json
ile):
  docker exec medpanel-pathology-inference python evaluate_batch.py

labels.json formatı:
  {"tumor_001.tif": "tumor", "normal_001.tif": "normal"}
"""

from __future__ import annotations

import csv
import json
import os
import sys

import inference

EVAL_DIR = os.environ.get("EVAL_DIR", os.path.join(os.path.dirname(__file__), "sample_slides", "eval"))
LABELS_FILE = os.environ.get("EVAL_LABELS", os.path.join(EVAL_DIR, "labels.json"))
# sample_slides konteynere salt-okunur (:ro) mount edildiğinden rapor oraya
# yazılamaz — /app altına (yazılabilir katman) yazıp `docker cp` ile dışarı alın.
REPORT_FILE = os.environ.get("EVAL_REPORT", "/app/eval_report.csv")

# Bir slide "tumor" sayılsın diye en yüksek patch olasılığının geçmesi gereken eşik.
PREDICT_THRESHOLD = float(os.environ.get("EVAL_PREDICT_THRESHOLD", "0.5"))


def main() -> None:
    if not os.path.isfile(LABELS_FILE):
        print(f"labels.json bulunamadı: {LABELS_FILE}")
        print(f"Beklenen format: {{'tumor_001.tif': 'tumor', 'normal_001.tif': 'normal'}}")
        sys.exit(1)

    with open(LABELS_FILE, encoding="utf-8") as f:
        labels: dict[str, str] = json.load(f)

    rows: list[dict] = []
    tp = fp = tn = fn = 0

    for file_name, true_label in labels.items():
        path = os.path.join(EVAL_DIR, file_name)
        if not os.path.isfile(path):
            print(f"[atlandı] dosya yok: {file_name}")
            continue

        print(f"[çalıştırılıyor] {file_name} ...")
        result = inference.run_detection(path)
        max_prob = result.metrics["maxProb"]
        predicted = "tumor" if max_prob >= PREDICT_THRESHOLD else "normal"
        correct = predicted == true_label

        if true_label == "tumor" and predicted == "tumor":
            tp += 1
        elif true_label == "normal" and predicted == "tumor":
            fp += 1
        elif true_label == "normal" and predicted == "normal":
            tn += 1
        elif true_label == "tumor" and predicted == "normal":
            fn += 1

        rows.append(
            {
                "fileName": file_name,
                "trueLabel": true_label,
                "predicted": predicted,
                "correct": correct,
                "maxProb": max_prob,
                "tumorAreaPct": result.metrics["tumorAreaPct"],
                "patchesAnalyzed": result.metrics["patchesAnalyzed"],
                "elapsedMs": result.elapsed_ms,
            }
        )
        print(
            f"  -> gerçek={true_label} tahmin={predicted} "
            f"({'DOĞRU' if correct else 'YANLIŞ'}) maxProb={max_prob:.3f} "
            f"tumorAreaPct={result.metrics['tumorAreaPct']:.2f}"
        )

    if not rows:
        print("Değerlendirilecek slide bulunamadı.")
        sys.exit(1)

    accuracy = sum(r["correct"] for r in rows) / len(rows)
    precision = tp / (tp + fp) if (tp + fp) else float("nan")
    recall = tp / (tp + fn) if (tp + fn) else float("nan")

    print("\n── Özet ──────────────────────────────")
    print(f"Slide sayısı : {len(rows)}")
    print(f"Accuracy     : {accuracy * 100:.1f}%")
    print(f"Precision    : {precision * 100:.1f}%" if precision == precision else "Precision    : n/a")
    print(f"Recall       : {recall * 100:.1f}%" if recall == recall else "Recall       : n/a")
    print(f"Confusion matrix -> TP={tp} FP={fp} TN={tn} FN={fn}")

    with open(REPORT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"\nDetaylı rapor: {REPORT_FILE}")


if __name__ == "__main__":
    main()
