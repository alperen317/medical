import "server-only"
import { PDFParse } from "pdf-parse"

export interface PDFParseResult {
  text: string
  numPages: number
}

export async function extractTextFromPDF(buffer: Buffer): Promise<PDFParseResult> {
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  return {
    text: result.text,
    numPages: result.total,
  }
}

/**
 * Strips non-lab-result noise from Turkish medical PDF lab reports.
 * Removes: patient PII, hospital header, vertical watermark, timestamps,
 * doctor signatures, protocol numbers, IP addresses, page metadata.
 * Keeps: lab section names, column headers, test values, reference ranges.
 */
export function cleanMedicalReportText(raw: string): string {
  let text = raw

  // ── 1. Vertical watermark ──────────────────────────────────────────────────
  // pdf-parse renders rotated stamp text as single letters on consecutive lines
  // e.g. "B\nu\nR\na\np\no\nr\n..." — match 5+ such lines in a row
  text = text.replace(/(^[A-Za-zÇçĞğİıÖöŞşÜüı.]\n){5,}/gm, "")

  // ── 2. Patient PII ─────────────────────────────────────────────────────────
  // "ALİ ALPEREN ASLAN   Hasta Ad Soyad" — line containing the label
  text = text.replace(/^.*Hasta Ad Soyad\s*$/gm, "")
  // "Adı/Soyadı: ALİ ALPEREN ASLAN Cinsiyet: Erkek" — e-Nabız format
  text = text.replace(/^Adı\/Soyadı\s*:.*$/gm, "")
  text = text.replace(/^Cinsiyet\s*:.*$/gm, "")
  // "TC Kimlik No 29*******66"
  text = text.replace(/^TC Kimlik No[\s\S]{0,30}$/gm, "")
  // "Tarih: 25.05.2015 Doğum Tarihi: 17.07.1995" — combined or separate
  text = text.replace(/^Tarih\s*:\s*[\d.]+.*$/gm, "")
  text = text.replace(/^Doğum Tarihi\s*:.*$/gm, "")
  // "17.07.1995 / ERKEK  :" — birth date + gender line
  text = text.replace(/^\d{2}\.\d{2}\.\d{4}\s*\/\s*(ERKEK|KADIN|DİĞER)\s*:?\s*$/gm, "")
  // Standalone label lines left behind
  text = text.replace(/^Doğum Tarihi,?\s*$/gm, "")
  text = text.replace(/^Cinsiyeti\s*$/gm, "")

  // ── 3. Hospital / government header block ─────────────────────────────────
  // "T.C." standalone OR "T.C.SAĞLIK BAKANLIĞI" full line
  text = text.replace(/^T\.C\..*$/gm, "")
  // Any line ending with HASTANESİ or ÜNİVERSİTESİ (covers all hospital names)
  text = text.replace(/^.{0,80}(HASTANESİ|ÜNİVERSİTESİ)\s*$/gm, "")
  // Ministry/directorate lines
  text = text.replace(/^.*Sağlık Bilgi Sistemleri.*$/gm, "")
  text = text.replace(/^.*Genel Müdürlüğü.*$/gm, "")

  // ── 4. Protocol / report numbers ──────────────────────────────────────────
  text = text.replace(/^Protokol\s*\/\s*Dosya No.*$/gm, "")
  text = text.replace(/^Rapor Numarası.*$/gm, "")
  // Long digit sequences (report IDs, barcodes)
  text = text.replace(/[\d.\/]{15,}/g, "")
  // Lab license line "(Laboratuvar Ruhsat No:...)"
  text = text.replace(/^\(Laboratuvar Ruhsat No:.*\)\s*$/gm, "")

  // ── 5. Sample / request metadata ──────────────────────────────────────────
  text = text.replace(/^Tetkiki İsteyen\s*:.*$/gm, "")
  text = text.replace(/^Numune Türü\s*:.*$/gm, "")
  text = text.replace(/^Tetkik İstem Zamanı\s*:.*$/gm, "")
  text = text.replace(/^Numune Alınma Zamanı\s*:.*$/gm, "")
  text = text.replace(/^Numune Kabul Zamanı\s*:.*$/gm, "")
  text = text.replace(/^Uzman Onay Zamanı\s*:.*$/gm, "")
  // "Uzman Odyolog ÖMER FARUK BİRKENT" / "Odyoloji Polikliniği(KOZ)"
  text = text.replace(/^Uzman\s+(Odyolog|Doktor|Dr\.?).*$/gim, "")
  text = text.replace(/^.{0,60}Polikliniği.*$/gm, "")

  // ── 6. Doctor signature block ─────────────────────────────────────────────
  // "UZM. DR. SAKİNE YAVŞAN" / "Uzm. Dr. ..."
  text = text.replace(/^(UZM\.?|Uzm\.?)\s+(DR\.?|Dr\.?).*$/gm, "")
  text = text.replace(/^Tıbbi Biyokimya Uzmanı\s*$/gm, "")
  text = text.replace(/^Dip\. Tescil No\s*:.*$/gm, "")

  // ── 7. Timestamps & print metadata ────────────────────────────────────────
  text = text.replace(/\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2}/g, "")
  text = text.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "")  // IP
  text = text.replace(/\b\d{5,} \d+ \/ \d+\b/g, "")                    // "112071 1 / 2"

  // ── 8. e-Nabız / government portal specific ───────────────────────────────
  // Table column header rows
  text = text.replace(/^Tarih\s+Tahlil\s+Sonuç.*$/gm, "")
  text = text.replace(/^(Birimi|Referans|Değeri)\s*$/gm, "")
  // Standalone date lines used as section separators (DD.MM.YYYY alone on a line)
  text = text.replace(/^\d{2}\.\d{2}\.\d{4}\s*$/gm, "")
  // Standalone time lines (HH:MM)
  text = text.replace(/^\d{1,2}:\d{2}\s*$/gm, "")
  // enabiz.gov.tr and phone numbers
  text = text.replace(/^enabiz\.gov\.tr.*$/gm, "")
  text = text.replace(/^0\s*850\s*[\d\s]+$/gm, "")
  // Page number lines: "Sayfa 1 / 2"
  text = text.replace(/^Sayfa\s+\d+\s*\/\s*\d+.*$/gm, "")

  // ── 9. Page separators & lone punctuation ─────────────────────────────────
  text = text.replace(/^-- \d+ of \d+ --\s*$/gm, "")
  text = text.replace(/^:\s*$/gm, "")   // lone colon lines (table artefact)

  // ── 9. Normalize whitespace ───────────────────────────────────────────────
  text = text.replace(/\n{3,}/g, "\n\n")
  text = text.trim()

  return text
}
