import type { DocumentChecklistItem } from "./types"

// Onkoloji seed'indeki (prisma/seed-clinicalos.ts) sabit documentType değerleri
// için okunabilir Türkçe başlıklar — kapsam bu listeyle sınırlı, bilinmeyen bir
// değer gelirse ham slug alt çizgileri boşluğa çevrilerek gösterilir. DocumentStep
// (canlı yükleme adımı) ve IntakeSummary (Son Kontrol / /patients özeti) aynı
// etiketi kullansın diye tek yerden paylaşılıyor.
const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  oncology_meme: "Meme",
  oncology_akciger: "Akciğer",
  oncology_kolorektal: "Kolorektal",
  oncology_prostat: "Prostat",
  oncology_mss: "Beyin / Omurilik (MSS)",
  oncology_over: "Over",
  oncology_pankreas: "Pankreas",
  oncology_karaciger: "Karaciğer",
  oncology_lenfoma: "Lenfoma",
  oncology_losemi: "Lösemi",
  oncology_diger: "Diğer Onkolojik",
  lab_report: "Laboratuvar",
}

export function documentTypeLabel(documentType?: string): string | null {
  if (!documentType) return null
  return DOCUMENT_TYPE_LABELS[documentType] ?? documentType.replace(/_/g, " ")
}

// Sunucu (advanceDocumentStepAction) ve istemci (DocumentStep) aynı "tamamlandı"
// tanımını kullansın diye tek yerden paylaşılıyor. Checklist kaleminin kararlı bir
// id'si yok (Studio'da yalnızca label/required düzenlenebiliyor) — eşleşme
// WorkflowDocument.checklistLabel ile DocumentChecklistItem.label karşılaştırmasıyla
// yapılıyor.
export function isChecklistSatisfied(
  checklist: DocumentChecklistItem[] | undefined,
  documents: { checklistLabel: string | null }[],
): boolean {
  const requiredLabels = (checklist ?? []).filter((item) => item.required).map((item) => item.label)
  // Checklist yoksa (ör. serbest "laboratuvar" belge adımı) eski davranış korunur:
  // en az bir belge yeterlidir.
  if (requiredLabels.length === 0) return documents.length > 0
  return requiredLabels.every((label) => documents.some((doc) => doc.checklistLabel === label))
}
