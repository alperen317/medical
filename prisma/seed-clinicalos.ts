import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })

import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])

// Onkoloji İlk Başvuru akışı — ClinicalOS_MLP_Onkoloji_Tasarim_Dokumani.docx +
// deep-research-report.md (kanser türüne özel checklist genişletmesi):
// Kimlik → Şikayet → Tanı Var mı? →
//   (Evet: Kanser Türü Seç → [tür]'e özel Belge Checklist'i → Tedavi Geçmişi) /
//   (Hayır: İlk Başvuru → Laboratuvar) → Son Kontrol → Doktora Hazır

async function main() {
  console.log("ClinicalOS v2 seed başlatılıyor...")

  const kimlikForm = await prisma.formDefinition.upsert({
    where: { id: "form_kimlik" },
    update: {},
    create: {
      id: "form_kimlik",
      rootId: "form_kimlik",
      name: "Kimlik Bilgileri",
      fields: [
        { id: "tcNo", type: "text", label: "TC Kimlik No", required: true },
        { id: "firstName", type: "text", label: "Ad", required: true },
        { id: "lastName", type: "text", label: "Soyad", required: true },
        { id: "dateOfBirth", type: "date", label: "Doğum Tarihi", required: true },
        { id: "gender", type: "select", label: "Cinsiyet", required: true, options: ["Erkek", "Kadın", "Diğer"] },
        { id: "phone", type: "text", label: "Telefon", required: true },
      ],
    },
  })

  const sikayetForm = await prisma.formDefinition.upsert({
    where: { id: "form_sikayet" },
    update: {},
    create: {
      id: "form_sikayet",
      rootId: "form_sikayet",
      name: "Şikayet",
      fields: [
        { id: "sikayetMetni", type: "textarea", label: "Şikayet", required: true },
        { id: "sikayetSuresi", type: "text", label: "Şikayet Süresi", required: false },
        { id: "taniVarMi", type: "boolean", label: "Daha önce tanı konuldu mu ?", required: true },
      ],
    },
  })

  const ilkBasvuruForm = await prisma.formDefinition.upsert({
    where: { id: "form_ilk_basvuru" },
    update: {},
    create: {
      id: "form_ilk_basvuru",
      rootId: "form_ilk_basvuru",
      name: "İlk Başvuru",
      fields: [
        { id: "muayeneBulgulari", type: "textarea", label: "Muayene Bulguları", required: true },
        { id: "onTani", type: "text", label: "Ön Tanı", required: false },
      ],
    },
  })

  const tedaviGecmisiForm = await prisma.formDefinition.upsert({
    where: { id: "form_tedavi_gecmisi" },
    update: {},
    create: {
      id: "form_tedavi_gecmisi",
      rootId: "form_tedavi_gecmisi",
      name: "Tedavi Geçmişi",
      fields: [
        { id: "gecmisTedaviler", type: "textarea", label: "Geçmiş Tedaviler", required: false },
        { id: "kullanilanIlaclar", type: "textarea", label: "Kullanılan İlaçlar", required: false },
      ],
    },
  })

  const taniVarMiRule = await prisma.ruleDefinition.upsert({
    where: { id: "rule_tani_var_mi" },
    update: {},
    create: {
      id: "rule_tani_var_mi",
      name: "Tanı Var mı?",
      condition: {
        field: "taniVarMi",
        operator: "equals",
        value: true,
      },
    },
  })

  // Kanser türüne göre gerekli belge checklist'i — deep-research-report.md'den
  // (patoloji/görüntüleme/laboratuvar, zorunlu/opsiyonel ayrımıyla) derlenmiştir.
  type ChecklistItem = { label: string; required: boolean; category: "patoloji" | "goruntuleme" | "laboratuvar" | "diger" }
  type CancerTypeSeed = { key: string; label: string; checklist: ChecklistItem[] }

  const cancerTypes: CancerTypeSeed[] = [
    {
      key: "meme",
      label: "Meme Kanseri",
      checklist: [
        { label: "Patoloji raporu (ER, PR, HER2, Ki-67 dahil)", required: true, category: "patoloji" },
        { label: "Mamografi raporu (DICOM)", required: true, category: "goruntuleme" },
        { label: "Meme ultrasonu (DICOM)", required: true, category: "goruntuleme" },
        { label: "Meme MR (DICOM)", required: false, category: "goruntuleme" },
        { label: "CBC, karaciğer/böbrek fonksiyon testleri", required: true, category: "laboratuvar" },
        { label: "CA 15-3 / CA 27-29", required: false, category: "laboratuvar" },
        { label: "BRCA1/2 genetik testi", required: false, category: "diger" },
        { label: "Cerrahi ve kemoterapi özet raporu", required: false, category: "diger" },
      ],
    },
    {
      key: "akciger",
      label: "Akciğer Kanseri (NSCLC/SCLC)",
      checklist: [
        { label: "Biyopsi/sitoloji patoloji raporu (TTF-1/p40 dahil)", required: true, category: "patoloji" },
        { label: "PD-L1 TPS skoru, EGFR/ALK/ROS1/KRAS G12C/MET ekzon14/RET moleküler panel", required: true, category: "patoloji" },
        { label: "Toraks BT (DICOM)", required: true, category: "goruntuleme" },
        { label: "PET-CT (DICOM)", required: false, category: "goruntuleme" },
        { label: "Beyin MR (DICOM)", required: false, category: "goruntuleme" },
        { label: "CBC, temel metabolik panel", required: true, category: "laboratuvar" },
        { label: "PFT raporu", required: false, category: "laboratuvar" },
        { label: "NTRK / BRAF V600E / HER2 (nadir hedeflenebilir değişiklikler)", required: false, category: "patoloji" },
      ],
    },
    {
      key: "kolorektal",
      label: "Kolorektal Kanser",
      checklist: [
        { label: "Kolonoskopi raporu + biyopsi patolojisi", required: true, category: "patoloji" },
        { label: "MSI/dMMR durumu", required: true, category: "patoloji" },
        { label: "BT Abdomen/Pelvis (DICOM)", required: true, category: "goruntuleme" },
        { label: "Rektum MRI (DICOM, rektal tümörde)", required: false, category: "goruntuleme" },
        { label: "CBC, karaciğer enzimleri", required: true, category: "laboratuvar" },
        { label: "CEA seviyesi", required: false, category: "laboratuvar" },
        { label: "KRAS/NRAS/BRAF V600E mutasyon raporu (metastatik hastalıkta)", required: true, category: "patoloji" },
        { label: "HER2 amplifikasyonu / NTRK füzyonu", required: false, category: "patoloji" },
        { label: "Ailevi sendrom değerlendirme formu (Lynch)", required: false, category: "diger" },
      ],
    },
    {
      key: "prostat",
      label: "Prostat Kanseri",
      checklist: [
        { label: "Prostat biyopsi patoloji raporu (Gleason skoru + ISUP grade grubu)", required: true, category: "patoloji" },
        { label: "Prostat MR (DICOM, PI-RADS v2.1 skoru)", required: true, category: "goruntuleme" },
        { label: "Kemik sintigrafisi veya PSMA PET (DICOM)", required: false, category: "goruntuleme" },
        { label: "PSA düzeyi", required: true, category: "laboratuvar" },
        { label: "Genetik panel (BRCA2)", required: false, category: "diger" },
        { label: "Tedavi özeti (radikal prostatektomi, radyoterapi)", required: false, category: "diger" },
      ],
    },
    {
      key: "mss",
      label: "Merkezi Sinir Sistemi (Beyin) Tümörleri",
      checklist: [
        { label: "Cerrahi biyopsi/patoloji raporu (WHO derecesi ve moleküler alt tipleme)", required: true, category: "patoloji" },
        { label: "Kontrastlı beyin MR (DICOM)", required: true, category: "goruntuleme" },
        { label: "Spinal MR (DICOM)", required: false, category: "goruntuleme" },
        { label: "IDH1/2 mutasyonu, 1p/19q delesyonu", required: false, category: "patoloji" },
      ],
    },
    {
      key: "over",
      label: "Over (Jinekolojik) Kanserleri",
      checklist: [
        { label: "Cerrahi/biyopsi patoloji raporu (epitelyal subtip, grade)", required: true, category: "patoloji" },
        { label: "Transvajinal USG", required: true, category: "goruntuleme" },
        { label: "Batın/pelvis BT veya MR, göğüs BT", required: true, category: "goruntuleme" },
        { label: "Kadın onkoloji konsültasyon raporu", required: true, category: "diger" },
        { label: "CA-125, CBC", required: true, category: "laboratuvar" },
        { label: "BRCA1/2 genetik testi", required: false, category: "diger" },
        { label: "Multidisipliner toplantı notu", required: false, category: "diger" },
      ],
    },
    {
      key: "pankreas",
      label: "Pankreas Kanseri",
      checklist: [
        { label: "Biyopsi patoloji raporu (adenokarsinom, grade)", required: true, category: "patoloji" },
        { label: "Kontrastlı abdominal BT (DICOM)", required: true, category: "goruntuleme" },
        { label: "MRCP / endo-USG / PET-CT (DICOM)", required: false, category: "goruntuleme" },
        { label: "CA 19-9, karaciğer testleri", required: true, category: "laboratuvar" },
        { label: "Genetik panel (herediter pankreas kanseri sendromları)", required: false, category: "diger" },
      ],
    },
    {
      key: "karaciger",
      label: "Karaciğer / Hepatobiliyer Kanserleri",
      checklist: [
        { label: "Biyopsi patoloji raporu", required: true, category: "patoloji" },
        { label: "Kontrastlı karın BT veya MR (DICOM)", required: true, category: "goruntuleme" },
        { label: "AFP, karaciğer paneli", required: true, category: "laboratuvar" },
        { label: "Viral hepatit testleri", required: false, category: "laboratuvar" },
        { label: "Genetik değerlendirme (Lynch vb.)", required: false, category: "diger" },
      ],
    },
    {
      key: "lenfoma",
      label: "Lenfoma (Hodgkin/NHL)",
      checklist: [
        { label: "Eksizyonel/core biyopsi patolojisi (immünfenotipleme dahil)", required: true, category: "patoloji" },
        { label: "PET-CT raporu (DICOM)", required: true, category: "goruntuleme" },
        { label: "Göğüs-abdomen-pelvis BT (DICOM)", required: false, category: "goruntuleme" },
        { label: "CBC, LDH, HIV-HBV-HCV testi", required: true, category: "laboratuvar" },
        { label: "Kemik iliği biyopsi raporu", required: false, category: "patoloji" },
      ],
    },
    {
      key: "losemi",
      label: "Lösemi",
      checklist: [
        { label: "CBC + diferansiyel + periferik yayma", required: true, category: "laboratuvar" },
        { label: "Kemik iliği aspirasyon/biyopsi raporu (fenotipleme, sitogenetik)", required: true, category: "patoloji" },
        { label: "Sitogenetik/moleküler analiz sonucu (FLT3, NPM1 vb.)", required: true, category: "patoloji" },
        { label: "İkinci konsültasyon raporu", required: false, category: "diger" },
      ],
    },
  ]

  const kanserTuruForm = await prisma.formDefinition.upsert({
    where: { id: "form_kanser_turu" },
    update: {},
    create: {
      id: "form_kanser_turu",
      rootId: "form_kanser_turu",
      name: "Kanser Türü",
      fields: [
        {
          id: "kanserTuru",
          type: "select",
          label: "Kanser Türü",
          required: true,
          options: [...cancerTypes.map((c) => c.label), "Diğer"],
        },
      ],
    },
  })

  const cancerRuleIds = new Map<string, string>()
  for (const c of cancerTypes) {
    const ruleId = `rule_kanser_${c.key}`
    await prisma.ruleDefinition.upsert({
      where: { id: ruleId },
      update: {},
      create: {
        id: ruleId,
        name: `Kanser Türü — ${c.label}`,
        condition: { field: "kanserTuru", operator: "equals", value: c.label },
      },
    })
    cancerRuleIds.set(c.key, ruleId)
  }

  // Zincirleme decision node'ları: her tür sırayla kontrol edilir, eşleşmezse
  // bir sonraki türün decision'ına düşer; hiçbiri eşleşmezse (nadir/listede
  // olmayan tür) "doc_diger" genel checklist'ine yönlendirilir.
  const genericChecklist: ChecklistItem[] = [
    { label: "Patoloji raporu", required: true, category: "patoloji" },
    { label: "İlgili görüntüleme raporu (BT/MR/USG)", required: true, category: "goruntuleme" },
    { label: "CBC ve temel biyokimya", required: true, category: "laboratuvar" },
  ]

  type SeedWorkflowNode = {
    id: string
    type: string
    ruleId?: string
    then?: string
    else?: string
    documentType?: string
    checklist?: ChecklistItem[]
    next?: string
  }

  const cancerBranchNodes: SeedWorkflowNode[] = []
  cancerTypes.forEach((c, i) => {
    const decisionId = `kanser_${c.key}_check`
    const docId = `doc_${c.key}`
    const nextDecisionId = i < cancerTypes.length - 1 ? `kanser_${cancerTypes[i + 1].key}_check` : "doc_diger"
    cancerBranchNodes.push({
      id: decisionId,
      type: "decision",
      ruleId: cancerRuleIds.get(c.key),
      then: docId,
      else: nextDecisionId,
    })
    cancerBranchNodes.push({
      id: docId,
      type: "document",
      documentType: `oncology_${c.key}`,
      checklist: c.checklist,
      next: "tedavi_gecmisi",
    })
  })
  cancerBranchNodes.push({
    id: "doc_diger",
    type: "document",
    documentType: "oncology_diger",
    checklist: genericChecklist,
    next: "tedavi_gecmisi",
  })

  const nodes = {
    nodes: [
      { id: "start", type: "start", next: "kimlik" },
      { id: "kimlik", type: "form", formId: kimlikForm.id, next: "sikayet" },
      { id: "sikayet", type: "form", formId: sikayetForm.id, next: "tani_var_mi" },
      { id: "tani_var_mi", type: "decision", ruleId: taniVarMiRule.id, then: "kanser_turu", else: "ilk_basvuru" },
      { id: "kanser_turu", type: "form", formId: kanserTuruForm.id, next: `kanser_${cancerTypes[0].key}_check` },
      ...cancerBranchNodes,
      { id: "tedavi_gecmisi", type: "form", formId: tedaviGecmisiForm.id, next: "son_kontrol" },
      { id: "ilk_basvuru", type: "form", formId: ilkBasvuruForm.id, next: "laboratuvar" },
      { id: "laboratuvar", type: "document", documentType: "lab_report", next: "son_kontrol" },
      { id: "son_kontrol", type: "task", label: "Son Kontrol", next: "doktora_hazir" },
      { id: "doktora_hazir", type: "end" },
    ],
  }

  await prisma.workflowDefinition.upsert({
    where: { id: "wf_onkoloji_ilk_basvuru" },
    update: { nodes },
    create: {
      id: "wf_onkoloji_ilk_basvuru",
      name: "Onkoloji İlk Başvuru",
      branch: "onkoloji",
      version: 1,
      status: "draft",
      nodes,
    },
  })

  console.log(
    `ClinicalOS v2 seed tamamlandı: 1 workflow, 5 form, ${1 + cancerTypes.length} rule, ${cancerTypes.length + 1} kanser türü belge node'u oluşturuldu`,
  )
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
