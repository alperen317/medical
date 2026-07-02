# MedPanel AI Inference — Beyin Tümörü Segmentasyonu (MVP)

MONAI `brats_mri_segmentation` bundle'ını (SegResNet, BraTS 2018, Apache-2.0)
çalıştıran FastAPI mikroservisi. Next.js uygulaması buraya HTTP ile bağlanır.

- Girdi: 4 hizalı MRI modalitesi `[FLAIR, T1, T1c, T2]` (NIfTI).
- Çıktı: tümör alt-bölge hacimleri (TC / WT / ET, ml) + temsili aksiyel kesitte overlay PNG.
- Cihaz: varsayılan CPU (yavaş, vaka başına birkaç dakika). GPU varsa otomatik kullanılır.

## Örnek vakaları yerleştirme (Aşama 1)

`sample_cases/` klasörü **gitignore'lu** — commit edilmez. Buraya 4 kanallı
BraTS/Decathlon NIfTI dosyaları koyun (her vaka tek dosya):

```
ai-inference/sample_cases/BRATS_001.nii.gz   # shape (H, W, D, 4)
```

Kaynak: [Medical Segmentation Decathlon — Task01_BrainTumour](http://medicaldecathlon.com/)
(`imagesTr/BRATS_XXX.nii.gz` dosyaları zaten 4 kanallıdır).

## Lokalde çalıştırma

### Docker (önerilen)
```bash
docker compose --profile all build ai-inference
docker compose --profile all up ai-inference
```
`sample_cases/` klasörünü mount etmek için docker-compose'daki volume yeterli.

### Doğrudan Python
```bash
cd ai-inference
python -m venv .venv && source .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8070
```

## Uçları test etme
```bash
curl localhost:8070/health
curl localhost:8070/cases
curl -X POST localhost:8070/segment -H "Content-Type: application/json" -d '{"caseId":"BRATS_001"}'

# Aşama 2 — kendi modalitelerini yükle:
curl -X POST localhost:8070/segment-upload \
  -F flair=@flair.nii.gz -F t1=@t1.nii.gz -F t1c=@t1c.nii.gz -F t2=@t2.nii.gz
```

## Ayarlar (env)
| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `INFERENCE_ROI` | `224,224,144` | Sliding-window ROI. Düşük RAM'de `128,128,128` deneyin. |
| `SAMPLE_DIR` | `./sample_cases` | Örnek vaka klasörü. |
| `BUNDLE_DIR` | `./bundles` | İndirilen model ağırlıkları. |

> ⚠️ **Deneysel MVP — klinik tanı amaçlı değildir.**
