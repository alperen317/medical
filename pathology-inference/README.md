# MedPanel AI Inference — Patoloji Tümör Tespiti (WSI, MVP)

MONAI `pathology_tumor_detection` bundle'ını (ResNet18 patch sınıflandırıcı,
Camelyon-16, Apache-2.0) çalıştıran FastAPI mikroservisi. Next.js uygulaması
buraya HTTP ile bağlanır — beyin MR mikroservisinin (`../ai-inference`)
patoloji kardeşi.

- Girdi: tek bir whole-slide image (`.tif`/`.tiff`/`.svs`/`.ndpi`).
- Çıktı: doku bölgesindeki 224×224 patch'ler için tümör olasılığı ısı
  haritası (PNG overlay) + özet metrikler (`maxProb`, `tumorAreaPct`,
  `patchesAnalyzed`).
- Cihaz: varsayılan CPU. Tüm slide'ı native (40x) çözünürlükte taramak
  CPU'da saatler sürebileceğinden, `MAX_PATCHES` ile analiz edilen patch
  sayısı sınırlanır (doku maskesinden eşit aralıklarla örneklenir).

> ⚠️ **Deneysel MVP — klinik tanı amaçlı değildir.** Camelyon-16 üzerinde
> eğitilmiş genel bir sınıflandırıcıdır; FROC/duyarlılık tam kapsamlı GPU
> taramasına göre daha düşüktür (bkz. `MAX_PATCHES`).

## Örnek slide yerleştirme

`sample_slides/` klasörü **gitignore'lu** — commit edilmez. Servis şu an
yalnızca yükleme (`/detect-upload`) akışını destekliyor; hazır örnek listesi
yok (beyin MR servisindeki `/cases` uç noktasının aksine — WSI'lar gigabayt
mertebesinde olduğundan depoya gömülü örnek desteklenmiyor).

Test için iki kaynak:

- **Hızlı pipeline testi** (küçük dosya, gerçek tümör etiketi yok):
  [CMU-1-Small-Region.svs](https://openslide.cs.cmu.edu/download/openslide-testdata/Aperio/CMU-1-Small-Region.svs) (1.85 MB) veya
  [CMU-1.svs](https://openslide.cs.cmu.edu/download/openslide-testdata/Aperio/CMU-1.svs) (169 MB) — OpenSlide'ın CC0 lisanslı örnek slide'ları.
  ```bash
  curl -o pathology-inference/sample_slides/CMU-1-Small-Region.svs \
    https://openslide.cs.cmu.edu/download/openslide-testdata/Aperio/CMU-1-Small-Region.svs
  ```
- **Gerçek tümör tespiti doğruluğu** (Camelyon-16, pozitif/negatif etiketli):
  https://camelyon17.grand-challenge.org/Data/ (GigaDB üzerinden barındırılıyor,
  `tumor_XXX.tif` dosyaları yüzlerce MB - birkaç GB).

## Lokalde çalıştırma

### Docker (önerilen)
```bash
docker compose -f ../docker-compose.ai.yml build pathology-inference
docker compose -f ../docker-compose.ai.yml up pathology-inference
```
İlk build MONAI bundle ağırlıklarını indirir (uzun sürebilir).

### Doğrudan Python
```bash
cd pathology-inference
python -m venv .venv && source .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8071
```
Windows'ta `openslide-python` için ayrıca OpenSlide DLL'lerinin PATH'te
olması gerekir (bkz. https://openslide.org/download/) — Docker'da bu sorun
yok, `libopenslide0` apt ile kuruluyor.

## Uçları test etme
```bash
curl localhost:8071/health
curl -X POST localhost:8071/detect-upload -F file=@sample_slides/CMU-1-Small-Region.svs
```

## Çoklu slide üzerinde model doğruluğunu ölçme

`evaluate_batch.py`, etiketli birkaç Camelyon-16 slide'ı (`tumor_XXX.tif` /
`normal_XXX.tif`) üzerinde slide-düzeyi accuracy/precision/recall + confusion
matrix üretir. Piksel-düzeyi FROC değil — "model tümörlü/tümörsüz slide'ları
genel olarak ayırt edebiliyor mu" sorusuna hızlı bir cevap.

1. `sample_slides/eval/` altına birkaç etiketli slide koyun (gerçek tümör
   etiketi için `CMU-1-Small-Region.svs` gibi genel demo slide'lar **işe
   yaramaz** — https://camelyon17.grand-challenge.org/Data/ üzerinden
   `tumor_XXX.tif`/`normal_XXX.tif` indirilmesi gerekir).
2. Aynı klasöre bir `labels.json` yazın:
   ```json
   { "tumor_001.tif": "tumor", "normal_001.tif": "normal" }
   ```
3. Çalıştırın:
   ```bash
   docker exec medpanel-pathology-inference python evaluate_batch.py
   ```
   Konsola her slide için tahmin + özet tablo basılır; ayrıntılı satırlar
   `/app/eval_report.csv`'ye yazılır (`sample_slides` salt-okunur mount
   edildiğinden rapor konteynerin yazılabilir katmanına düşer):
   ```bash
   docker cp medpanel-pathology-inference:/app/eval_report.csv ./eval_report.csv
   ```

## Ayarlar (env)
| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `MAX_PATCHES` | `300` | CPU'da makul sürede bitmesi için analiz edilen üst patch sayısı. Doku maskesinden eşit aralıklı örneklenir. GPU'da artırılabilir. |
| `BATCH_SIZE` | `8` | Model ileri geçişi başına patch sayısı. |
| `MASK_TARGET_DOWNSAMPLE` | `64` | Doku maskesi çıkarılan piramit seviyesi, bu hedef downsample'a en yakın seviye seçilerek belirlenir. |
| `BUNDLE_DIR` | `./bundles` | İndirilen model ağırlıkları. |
