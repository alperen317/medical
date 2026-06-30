import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })

import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import * as bcrypt from "bcryptjs"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])

async function main() {
  console.log("Seed başlatılıyor...")

  const passwordHash = await bcrypt.hash("medpanel2024", 10)

  // Rolleri al
  const roles = await prisma.role.findMany({ select: { id: true, name: true } })
  const roleMap = Object.fromEntries(roles.map((r) => [r.name, r.id]))

  if (!roleMap.super_admin) {
    throw new Error("Sistem rolleri bulunamadı. Migration'ın çalıştığından emin olun.")
  }

  // ─── Departmanlar ──────────────────────────────────────────────────────────
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { name: "Kardiyoloji" },
      update: {},
      create: { id: "dept1", name: "Kardiyoloji", description: "Kalp ve damar hastalıkları", color: "#ef4444" },
    }),
    prisma.department.upsert({
      where: { name: "Dahiliye" },
      update: {},
      create: { id: "dept2", name: "Dahiliye", description: "İç hastalıkları", color: "#3b82f6" },
    }),
    prisma.department.upsert({
      where: { name: "Nöroloji" },
      update: {},
      create: { id: "dept3", name: "Nöroloji", description: "Sinir sistemi hastalıkları", color: "#8b5cf6" },
    }),
    prisma.department.upsert({
      where: { name: "Ortopedi" },
      update: {},
      create: { id: "dept4", name: "Ortopedi", description: "Kas-iskelet sistemi", color: "#f59e0b" },
    }),
    prisma.department.upsert({
      where: { name: "Acil Tıp" },
      update: {},
      create: { id: "dept5", name: "Acil Tıp", description: "Acil servis ve müdahale", color: "#10b981" },
    }),
  ])
  console.log(`${departments.length} departman oluşturuldu`)

  // ─── Kullanıcılar ──────────────────────────────────────────────────────────
  await Promise.all([
    prisma.user.upsert({
      where: { email: "ahmet.yilmaz@klinik.com" },
      update: { roleId: roleMap.doctor },
      create: {
        id: "u1",
        email: "ahmet.yilmaz@klinik.com",
        name: "Dr. Ahmet Yılmaz",
        roleId: roleMap.doctor,
        passwordHash,
        departments: { connect: [{ id: "dept1" }, { id: "dept2" }] },
      },
    }),
    prisma.user.upsert({
      where: { email: "selin.kaya@klinik.com" },
      update: { roleId: roleMap.doctor },
      create: {
        id: "u2",
        email: "selin.kaya@klinik.com",
        name: "Dr. Selin Kaya",
        roleId: roleMap.doctor,
        passwordHash,
        departments: { connect: [{ id: "dept2" }, { id: "dept3" }] },
      },
    }),
    prisma.user.upsert({
      where: { email: "fatma.demir@klinik.com" },
      update: { roleId: roleMap.nurse },
      create: {
        id: "u3",
        email: "fatma.demir@klinik.com",
        name: "Hemşire Fatma Demir",
        roleId: roleMap.nurse,
        passwordHash,
        departments: { connect: [{ id: "dept5" }, { id: "dept1" }] },
      },
    }),
    prisma.user.upsert({
      where: { email: "mehmet.celik@klinik.com" },
      update: { roleId: roleMap.super_admin, name: "Mehmet Çelik" },
      create: {
        id: "u4",
        email: "mehmet.celik@klinik.com",
        name: "Mehmet Çelik",
        roleId: roleMap.super_admin,
        passwordHash,
      },
    }),
    prisma.user.upsert({
      where: { email: "ayse.yildiz@klinik.com" },
      update: { roleId: roleMap.admin },
      create: {
        id: "u5",
        email: "ayse.yildiz@klinik.com",
        name: "Ayşe Yıldız",
        roleId: roleMap.admin,
        passwordHash,
      },
    }),
    prisma.user.upsert({
      where: { email: "can.ozdemir@klinik.com" },
      update: { roleId: roleMap.receptionist },
      create: {
        id: "u6",
        email: "can.ozdemir@klinik.com",
        name: "Can Özdemir",
        roleId: roleMap.receptionist,
        passwordHash,
        departments: { connect: [{ id: "dept2" }] },
      },
    }),
    // İkinci doktor - Ortopedi
    prisma.user.upsert({
      where: { email: "burak.arslan@klinik.com" },
      update: { roleId: roleMap.doctor },
      create: {
        id: "u7",
        email: "burak.arslan@klinik.com",
        name: "Dr. Burak Arslan",
        roleId: roleMap.doctor,
        passwordHash,
        departments: { connect: [{ id: "dept4" }] },
      },
    }),
  ])
  console.log("7 kullanıcı oluşturuldu")

  // ─── Hastalar ──────────────────────────────────────────────────────────────
  await Promise.all([
    prisma.patient.upsert({
      where: { id: "p1" },
      update: {},
      create: {
        id: "p1", firstName: "Ali", lastName: "Kırmızı",
        dateOfBirth: new Date("1985-03-15"), gender: "male", bloodType: "A_pos",
        tcNo: "12345678901", phone: "0532 111 22 33", email: "ali.kirmizi@email.com",
        address: "Kadıköy, İstanbul", status: "active",
        allergies: ["Penisilin", "Aspirin"], chronicConditions: ["Hipertansiyon", "Tip 2 Diyabet"],
        assignedDoctorId: "u1",
        emergencyContactName: "Ayşe Kırmızı", emergencyContactPhone: "0533 444 55 66", emergencyContactRelation: "Eş",
      },
    }),
    prisma.patient.upsert({
      where: { id: "p2" },
      update: {},
      create: {
        id: "p2", firstName: "Zeynep", lastName: "Arslan",
        dateOfBirth: new Date("1992-07-22"), gender: "female", bloodType: "B_pos",
        tcNo: "98765432109", phone: "0541 999 88 77", email: "zeynep.arslan@email.com",
        address: "Beşiktaş, İstanbul", status: "active",
        allergies: [], chronicConditions: ["Astım"],
        assignedDoctorId: "u2",
      },
    }),
    prisma.patient.upsert({
      where: { id: "p3" },
      update: {},
      create: {
        id: "p3", firstName: "Mustafa", lastName: "Çetin",
        dateOfBirth: new Date("1978-11-30"), gender: "male", bloodType: "O_neg",
        tcNo: "55544433322", phone: "0505 333 22 11",
        address: "Ümraniye, İstanbul", status: "critical",
        allergies: ["Sulfonamid"], chronicConditions: ["Koroner Arter Hastalığı", "Kronik Böbrek Yetmezliği"],
        assignedDoctorId: "u1",
        emergencyContactName: "Hatice Çetin", emergencyContactPhone: "0533 111 00 99", emergencyContactRelation: "Eş",
      },
    }),
    prisma.patient.upsert({
      where: { id: "p4" },
      update: {},
      create: {
        id: "p4", firstName: "Elif", lastName: "Şahin",
        dateOfBirth: new Date("2000-04-08"), gender: "female", bloodType: "AB_pos",
        tcNo: "11122233344", phone: "0555 777 66 55", email: "elif.sahin@email.com",
        address: "Şişli, İstanbul", status: "active",
        allergies: [], chronicConditions: [],
        assignedDoctorId: "u2",
      },
    }),
    prisma.patient.upsert({
      where: { id: "p5" },
      update: {},
      create: {
        id: "p5", firstName: "Hasan", lastName: "Öztürk",
        dateOfBirth: new Date("1965-09-12"), gender: "male", bloodType: "A_neg",
        tcNo: "77788899900", phone: "0506 123 45 67",
        address: "Fatih, İstanbul", status: "inactive",
        allergies: ["İbuprofen"], chronicConditions: ["Hipertansiyon"],
        assignedDoctorId: "u1",
      },
    }),
    prisma.patient.upsert({
      where: { id: "p6" },
      update: {},
      create: {
        id: "p6", firstName: "Merve", lastName: "Koç",
        dateOfBirth: new Date("1995-01-25"), gender: "female", bloodType: "B_neg",
        tcNo: "33344455566", phone: "0543 876 54 32", email: "merve.koc@email.com",
        address: "Maltepe, İstanbul", status: "active",
        allergies: [], chronicConditions: [],
        assignedDoctorId: "u2",
      },
    }),
    prisma.patient.upsert({
      where: { id: "p7" },
      update: {},
      create: {
        id: "p7", firstName: "Kemal", lastName: "Doğan",
        dateOfBirth: new Date("1950-06-18"), gender: "male", bloodType: "O_pos",
        tcNo: "44455566677", phone: "0512 987 65 43",
        address: "Sarıyer, İstanbul", status: "critical",
        allergies: ["Warfarin"], chronicConditions: ["Atriyal Fibrilasyon", "Kalp Yetmezliği"],
        assignedDoctorId: "u1",
        emergencyContactName: "Yusuf Doğan", emergencyContactPhone: "0533 222 11 00", emergencyContactRelation: "Oğlu",
      },
    }),
    prisma.patient.upsert({
      where: { id: "p8" },
      update: {},
      create: {
        id: "p8", firstName: "Sevgi", lastName: "Yıldırım",
        dateOfBirth: new Date("1988-12-03"), gender: "female", bloodType: "AB_neg",
        tcNo: "66677788899", phone: "0549 543 21 09", email: "sevgi.yildirim@email.com",
        address: "Bakırköy, İstanbul", status: "discharged",
        allergies: [], chronicConditions: ["Migren"],
        assignedDoctorId: "u7",
      },
    }),
    prisma.patient.upsert({
      where: { id: "p9" },
      update: {},
      create: {
        id: "p9", firstName: "Tarık", lastName: "Özer",
        dateOfBirth: new Date("1972-02-14"), gender: "male", bloodType: "A_pos",
        tcNo: "22211100099", phone: "0537 654 32 10",
        address: "Pendik, İstanbul", status: "active",
        allergies: ["Kodein"], chronicConditions: ["Disk Hernisi", "Kronik Bel Ağrısı"],
        assignedDoctorId: "u7",
      },
    }),
  ])
  console.log("9 hasta oluşturuldu")

  // ─── Tanılar ───────────────────────────────────────────────────────────────
  await Promise.all([
    prisma.diagnosis.upsert({
      where: { id: "d1" },
      update: {},
      create: {
        id: "d1", patientId: "p1", icdCode: "I10",
        name: "Esansiyel Hipertansiyon", severity: "moderate", status: "chronic",
        diagnosedAt: new Date("2020-05-12"), diagnosedById: "u1",
        description: "Aile öyküsü mevcut. İlaç tedavisi ile kontrol altında.",
      },
    }),
    prisma.diagnosis.upsert({
      where: { id: "d2" },
      update: {},
      create: {
        id: "d2", patientId: "p1", icdCode: "E11",
        name: "Tip 2 Diyabet Mellitus", severity: "moderate", status: "chronic",
        diagnosedAt: new Date("2021-09-30"), diagnosedById: "u1",
        description: "HbA1c takibi 3 ayda bir yapılıyor.",
      },
    }),
    prisma.diagnosis.upsert({
      where: { id: "d3" },
      update: {},
      create: {
        id: "d3", patientId: "p3", icdCode: "I25",
        name: "Kronik İskemik Kalp Hastalığı", severity: "severe", status: "chronic",
        diagnosedAt: new Date("2019-03-10"), diagnosedById: "u1",
        description: "Geçirilmiş miyokard enfarktüsü. Medikal tedavi devam ediyor.",
      },
    }),
    prisma.diagnosis.upsert({
      where: { id: "d4" },
      update: {},
      create: {
        id: "d4", patientId: "p2", icdCode: "J45",
        name: "Bronşiyal Astım", severity: "mild", status: "active",
        diagnosedAt: new Date("2018-06-15"), diagnosedById: "u2",
        description: "Mevsimsel tetikleyiciler mevcut. Inhaler tedavi yanıtı iyi.",
      },
    }),
    prisma.diagnosis.upsert({
      where: { id: "d5" },
      update: {},
      create: {
        id: "d5", patientId: "p7", icdCode: "I48",
        name: "Atriyal Fibrilasyon", severity: "severe", status: "chronic",
        diagnosedAt: new Date("2015-11-22"), diagnosedById: "u1",
        description: "Kalıcı AF. Antikoagülan tedavi altında.",
      },
    }),
    prisma.diagnosis.upsert({
      where: { id: "d6" },
      update: {},
      create: {
        id: "d6", patientId: "p9", icdCode: "M51",
        name: "Lomber Disk Hernisi", severity: "moderate", status: "active",
        diagnosedAt: new Date("2023-08-05"), diagnosedById: "u7",
        description: "L4-L5 seviyesinde disk hernisi. Fizik tedavi planlandı.",
      },
    }),
  ])
  console.log("6 tanı oluşturuldu")

  // ─── Reçeteler ─────────────────────────────────────────────────────────────
  await Promise.all([
    prisma.prescription.upsert({
      where: { id: "rx1" },
      update: {},
      create: {
        id: "rx1", patientId: "p1", medication: "Metformin",
        dosage: "1000 mg", frequency: "Günde 2 kez", duration: "Süresiz",
        prescribedAt: new Date("2024-06-10"), prescribedById: "u1", active: true,
      },
    }),
    prisma.prescription.upsert({
      where: { id: "rx2" },
      update: {},
      create: {
        id: "rx2", patientId: "p1", medication: "Amlodipine",
        dosage: "5 mg", frequency: "Günde 1 kez", duration: "Süresiz",
        prescribedAt: new Date("2023-01-10"), prescribedById: "u1", active: true,
      },
    }),
    prisma.prescription.upsert({
      where: { id: "rx3" },
      update: {},
      create: {
        id: "rx3", patientId: "p1", medication: "Atorvastatin",
        dosage: "20 mg", frequency: "Günde 1 kez (gece)", duration: "Süresiz",
        prescribedAt: new Date("2022-03-15"), prescribedById: "u1", active: true,
      },
    }),
    prisma.prescription.upsert({
      where: { id: "rx4" },
      update: {},
      create: {
        id: "rx4", patientId: "p2", medication: "Salbutamol İnhaler",
        dosage: "100 mcg / puf", frequency: "Gerektiğinde (max 4 puf/gün)", duration: "Süresiz",
        prescribedAt: new Date("2024-01-20"), prescribedById: "u2", active: true,
        instructions: "Nefes darlığı anında 1-2 puf çekin.",
      },
    }),
    prisma.prescription.upsert({
      where: { id: "rx5" },
      update: {},
      create: {
        id: "rx5", patientId: "p3", medication: "Aspirin",
        dosage: "100 mg", frequency: "Günde 1 kez", duration: "Süresiz",
        prescribedAt: new Date("2023-05-01"), prescribedById: "u1", active: true,
        instructions: "Yemekle birlikte alınız.",
      },
    }),
    prisma.prescription.upsert({
      where: { id: "rx6" },
      update: {},
      create: {
        id: "rx6", patientId: "p7", medication: "Warfarin",
        dosage: "5 mg", frequency: "Günde 1 kez (akşam)", duration: "Süresiz",
        prescribedAt: new Date("2022-08-15"), prescribedById: "u1", active: false,
        instructions: "INR takibi aylık yapılacak. Yeşil yapraklı sebze kısıtlaması.",
      },
    }),
    prisma.prescription.upsert({
      where: { id: "rx7" },
      update: {},
      create: {
        id: "rx7", patientId: "p9", medication: "Diklofenak Sodyum",
        dosage: "75 mg", frequency: "Günde 2 kez", duration: "10 gün",
        prescribedAt: new Date("2026-06-10"), prescribedById: "u7", active: true,
        instructions: "Yemekle birlikte alınız. Böbrek fonksiyonu takip edilecek.",
      },
    }),
  ])
  console.log("7 reçete oluşturuldu")

  // ─── Zaman Çizelgesi ───────────────────────────────────────────────────────
  const timelineData = [
    { id: "t1", patientId: "p1", type: "visit" as const, date: new Date("2024-06-10T09:30:00"), title: "Rutin Kontrol Muayenesi", description: "Hasta kan basıncı takibi için başvurdu. KB: 145/90 mmHg.", createdById: "u1" },
    { id: "t2", patientId: "p1", type: "lab" as const, date: new Date("2024-06-10T10:00:00"), title: "Kan Tahlili Sonuçları", description: "HbA1c: %7.8. Açlık kan şekeri: 145 mg/dL.", createdById: "u3", metadata: { "HbA1c": "%7.8", "Açlık Kan Şekeri": "145 mg/dL" } },
    { id: "t3", patientId: "p1", type: "prescription" as const, date: new Date("2024-06-10T10:15:00"), title: "Metformin 1000mg Reçete", description: "Diyabet kontrolü için metformin dozu artırıldı.", createdById: "u1" },
    { id: "t4", patientId: "p1", type: "diagnosis" as const, date: new Date("2024-03-22T14:00:00"), title: "Tip 2 Diyabet Tanısı Güncelleme", description: "Mevcut tedaviye yanıt değerlendirildi.", createdById: "u1" },
    { id: "t5", patientId: "p1", type: "note" as const, date: new Date("2024-03-22T14:30:00"), title: "Doktor Notu", description: "Hasta diyet önerilerine uyumsuz. Diyetisyen konsültasyonu planlandı.", createdById: "u1" },
    { id: "t6", patientId: "p1", type: "document" as const, date: new Date("2024-01-15T11:00:00"), title: "Kardiyoloji Konsültasyon Raporu", description: "Ekokardiyografi normal.", createdById: "u2" },
    { id: "t7", patientId: "p1", type: "visit" as const, date: new Date("2023-10-05T09:00:00"), title: "Acil Başvuru - Hipertansif Kriz", description: "KB: 185/110 mmHg. IV antihipertansif uygulandı.", createdById: "u1" },
    { id: "t8", patientId: "p3", type: "visit" as const, date: new Date("2026-06-15T08:00:00"), title: "Acil Yatış", description: "Göğüs ağrısı ve nefes darlığı şikayetiyle acil başvuru. Troponin yüksek. Kardiyoloji konsültasyonu yapıldı.", createdById: "u3" },
    { id: "t9", patientId: "p3", type: "lab" as const, date: new Date("2026-06-15T08:30:00"), title: "Kardiyak Enzimler", description: "Troponin-I: 2.4 ng/mL (N: <0.04). CK-MB: 45 U/L.", createdById: "u3", metadata: { "Troponin-I": "2.4 ng/mL", "CK-MB": "45 U/L" } },
    { id: "t10", patientId: "p2", type: "visit" as const, date: new Date("2026-06-01T11:00:00"), title: "Kontrol Muayenesi", description: "Astım semptomları kontrol altında. İnhaler tekniği değerlendirildi.", createdById: "u2" },
    { id: "t11", patientId: "p7", type: "visit" as const, date: new Date("2026-06-20T09:00:00"), title: "Kardiyoloji Kontrolü", description: "EKG: AF ritmi mevcut. Kalp hızı: 78/dk. İlaç uyumu sorgulandı.", createdById: "u1" },
    { id: "t12", patientId: "p9", type: "visit" as const, date: new Date("2026-06-10T14:00:00"), title: "Ortopedi Muayenesi", description: "Bel ve sol bacak ağrısı şikayeti. MRI ile L4-L5 disk hernisi doğrulandı.", createdById: "u7" },
  ]

  for (const event of timelineData) {
    await prisma.timelineEvent.upsert({
      where: { id: event.id },
      update: {},
      create: {
        id: event.id, patientId: event.patientId, type: event.type,
        date: event.date, title: event.title, description: event.description,
        createdById: event.createdById,
        metadata: "metadata" in event ? event.metadata : undefined,
      },
    })
  }
  console.log("12 zaman çizelgesi olayı oluşturuldu")

  // ─── Randevular ────────────────────────────────────────────────────────────
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000)
  const setTime = (d: Date, h: number, m = 0) => { const r = new Date(d); r.setHours(h, m, 0, 0); return r }

  await Promise.all([
    // Bugün - planlanmış
    prisma.appointment.upsert({
      where: { id: "appt1" },
      update: {},
      create: {
        id: "appt1", patientId: "p1", doctorId: "u1",
        scheduledAt: setTime(today, 9, 0), duration: 30,
        type: "follow_up", status: "scheduled", createdById: "u6",
        notes: "3 aylık diyabet kontrol randevusu",
      },
    }),
    prisma.appointment.upsert({
      where: { id: "appt2" },
      update: {},
      create: {
        id: "appt2", patientId: "p3", doctorId: "u1",
        scheduledAt: setTime(today, 11, 30), duration: 45,
        type: "consultation", status: "scheduled", createdById: "u4",
        notes: "Kardiyoloji post-yatış kontrolü",
      },
    }),
    prisma.appointment.upsert({
      where: { id: "appt3" },
      update: {},
      create: {
        id: "appt3", patientId: "p2", doctorId: "u2",
        scheduledAt: setTime(today, 14, 0), duration: 30,
        type: "follow_up", status: "scheduled", createdById: "u6",
      },
    }),
    prisma.appointment.upsert({
      where: { id: "appt4" },
      update: {},
      create: {
        id: "appt4", patientId: "p9", doctorId: "u7",
        scheduledAt: setTime(today, 16, 0), duration: 30,
        type: "follow_up", status: "scheduled", createdById: "u6",
        notes: "Fizik tedavi değerlendirmesi",
      },
    }),
    // Dün - tamamlanmış
    prisma.appointment.upsert({
      where: { id: "appt5" },
      update: {},
      create: {
        id: "appt5", patientId: "p4", doctorId: "u2",
        scheduledAt: setTime(addDays(today, -1), 10, 0), duration: 30,
        type: "consultation", status: "completed", createdById: "u6",
      },
    }),
    prisma.appointment.upsert({
      where: { id: "appt6" },
      update: {},
      create: {
        id: "appt6", patientId: "p5", doctorId: "u1",
        scheduledAt: setTime(addDays(today, -1), 13, 30), duration: 20,
        type: "follow_up", status: "completed", createdById: "u6",
      },
    }),
    // 2 gün önce - iptal edilmiş
    prisma.appointment.upsert({
      where: { id: "appt7" },
      update: {},
      create: {
        id: "appt7", patientId: "p6", doctorId: "u2",
        scheduledAt: setTime(addDays(today, -2), 9, 30), duration: 30,
        type: "consultation", status: "cancelled", createdById: "u6",
      },
    }),
    // Yarın - planlanmış
    prisma.appointment.upsert({
      where: { id: "appt8" },
      update: {},
      create: {
        id: "appt8", patientId: "p7", doctorId: "u1",
        scheduledAt: setTime(addDays(today, 1), 10, 0), duration: 60,
        type: "procedure", status: "scheduled", createdById: "u4",
        notes: "Transözafajiyal Ekokardiyografi (TEE)",
      },
    }),
    prisma.appointment.upsert({
      where: { id: "appt9" },
      update: {},
      create: {
        id: "appt9", patientId: "p8", doctorId: "u7",
        scheduledAt: setTime(addDays(today, 1), 15, 0), duration: 30,
        type: "follow_up", status: "scheduled", createdById: "u6",
      },
    }),
    // 3 gün sonra
    prisma.appointment.upsert({
      where: { id: "appt10" },
      update: {},
      create: {
        id: "appt10", patientId: "p1", doctorId: "u1",
        scheduledAt: setTime(addDays(today, 3), 9, 0), duration: 30,
        type: "lab", status: "scheduled", createdById: "u6",
        notes: "Rutin kan tahlili takibi",
      },
    }),
    // Bir hafta sonra
    prisma.appointment.upsert({
      where: { id: "appt11" },
      update: {},
      create: {
        id: "appt11", patientId: "p2", doctorId: "u2",
        scheduledAt: setTime(addDays(today, 7), 11, 0), duration: 30,
        type: "follow_up", status: "scheduled", createdById: "u6",
      },
    }),
    prisma.appointment.upsert({
      where: { id: "appt12" },
      update: {},
      create: {
        id: "appt12", patientId: "p9", doctorId: "u7",
        scheduledAt: setTime(addDays(today, 7), 14, 0), duration: 45,
        type: "procedure", status: "scheduled", createdById: "u6",
        notes: "Fizik tedavi uygulaması - 1. seans",
      },
    }),
  ])
  console.log("12 randevu oluşturuldu")

  // ─── Aktivite Logları ──────────────────────────────────────────────────────
  const activityData = [
    { id: "act1", actorId: "u4", action: "user.login", entityType: "user", entityId: "u4", entityLabel: "Mehmet Çelik", createdAt: addDays(today, -7) },
    { id: "act2", actorId: "u1", action: "patient.create", entityType: "patient", entityId: "p1", entityLabel: "Ali Kırmızı", createdAt: addDays(today, -6) },
    { id: "act3", actorId: "u1", action: "patient.create", entityType: "patient", entityId: "p3", entityLabel: "Mustafa Çetin", createdAt: addDays(today, -5) },
    { id: "act4", actorId: "u2", action: "patient.create", entityType: "patient", entityId: "p2", entityLabel: "Zeynep Arslan", createdAt: addDays(today, -5) },
    { id: "act5", actorId: "u1", action: "diagnosis.create", entityType: "diagnosis", entityId: "d1", entityLabel: "Esansiyel Hipertansiyon (Ali Kırmızı)", createdAt: addDays(today, -4) },
    { id: "act6", actorId: "u6", action: "appointment.create", entityType: "appointment", entityId: "appt1", entityLabel: "Ali Kırmızı — Dr. Ahmet Yılmaz", createdAt: addDays(today, -3) },
    { id: "act7", actorId: "u1", action: "prescription.create", entityType: "prescription", entityId: "rx1", entityLabel: "Metformin — Ali Kırmızı", createdAt: addDays(today, -3) },
    { id: "act8", actorId: "u3", action: "patient.status_change", entityType: "patient", entityId: "p3", entityLabel: "Mustafa Çetin", metadata: { status: "critical" }, createdAt: addDays(today, -2) },
    { id: "act9", actorId: "u1", action: "appointment.status_change", entityType: "appointment", entityId: "appt5", entityLabel: "Elif Şahin — Dr. Selin Kaya", metadata: { status: "completed" }, createdAt: addDays(today, -1) },
    { id: "act10", actorId: "u4", action: "user.create", entityType: "user", entityId: "u7", entityLabel: "Dr. Burak Arslan", createdAt: addDays(today, -1) },
  ]

  for (const log of activityData) {
    await prisma.activityLog.upsert({
      where: { id: log.id },
      update: {},
      create: {
        id: log.id,
        actorId: log.actorId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        entityLabel: log.entityLabel,
        metadata: "metadata" in log ? log.metadata : undefined,
        createdAt: log.createdAt,
      },
    })
  }
  console.log("10 aktivite logu oluşturuldu")

  // ─── Bildirimler ───────────────────────────────────────────────────────────
  await Promise.all([
    prisma.notification.upsert({
      where: { id: "notif1" },
      update: {},
      create: {
        id: "notif1",
        userId: "u1",
        type: "critical_patient",
        title: "Kritik Hasta Uyarısı",
        body: "Mustafa Çetin hastasının durumu KRİTİK olarak güncellendi.",
        entityType: "patient",
        entityId: "p3",
        read: false,
        createdAt: addDays(today, -2),
      },
    }),
    prisma.notification.upsert({
      where: { id: "notif2" },
      update: {},
      create: {
        id: "notif2",
        userId: "u1",
        type: "new_appointment",
        title: "Yeni Randevu",
        body: "Kemal Doğan için yarın 10:00 tarihinde randevu oluşturuldu.",
        entityType: "appointment",
        entityId: "appt8",
        read: false,
        createdAt: addDays(today, -1),
      },
    }),
    prisma.notification.upsert({
      where: { id: "notif3" },
      update: {},
      create: {
        id: "notif3",
        userId: "u2",
        type: "new_appointment",
        title: "Yeni Randevu",
        body: "Zeynep Arslan için bugün 14:00 tarihinde randevu oluşturuldu.",
        entityType: "appointment",
        entityId: "appt3",
        read: true,
        createdAt: addDays(today, -1),
      },
    }),
    prisma.notification.upsert({
      where: { id: "notif4" },
      update: {},
      create: {
        id: "notif4",
        userId: "u7",
        type: "new_appointment",
        title: "Yeni Randevu",
        body: "Tarık Özer için bugün 16:00 tarihinde randevu oluşturuldu.",
        entityType: "appointment",
        entityId: "appt4",
        read: false,
        createdAt: today,
      },
    }),
  ])

  // Seeded kullanıcı dışındaki gerçek hesaplara demo bildirim ekle
  const SEEDED_IDS = ["u1", "u2", "u3", "u4", "u5", "u6", "u7"]
  const realUsers = await prisma.user.findMany({
    where: { id: { notIn: SEEDED_IDS } },
    select: { id: true, name: true },
  })

  for (const user of realUsers) {
    await prisma.notification.upsert({
      where: { id: `notif_welcome_${user.id}` },
      update: {},
      create: {
        id: `notif_welcome_${user.id}`,
        userId: user.id,
        type: "system",
        title: "MedPanel hazır",
        body: "Demo veriler yüklendi. Hastalar, randevular ve reçeteler sisteme eklendi.",
        read: false,
        createdAt: today,
      },
    })
    await prisma.notification.upsert({
      where: { id: `notif_critical_${user.id}` },
      update: {},
      create: {
        id: `notif_critical_${user.id}`,
        userId: user.id,
        type: "critical_patient",
        title: "Kritik Hasta Uyarısı",
        body: "Mustafa Çetin hastasının durumu KRİTİK olarak güncellendi.",
        entityType: "patient",
        entityId: "p3",
        read: false,
        createdAt: addDays(today, -1),
      },
    })
    await prisma.notification.upsert({
      where: { id: `notif_appt_${user.id}` },
      update: {},
      create: {
        id: `notif_appt_${user.id}`,
        userId: user.id,
        type: "new_appointment",
        title: "Yeni Randevu",
        body: "Kemal Doğan için yarın 10:00 tarihinde TEE prosedürü planlandı.",
        entityType: "appointment",
        entityId: "appt8",
        read: false,
        createdAt: today,
      },
    })
  }
  if (realUsers.length > 0) {
    console.log(`${realUsers.length} gerçek kullanıcıya demo bildirimler oluşturuldu`)
  }

  console.log("4+ bildirim oluşturuldu")

  console.log("\nSeed başarıyla tamamlandı!")
  console.log("─────────────────────────────────────────")
  console.log("Kullanıcı Hesapları (şifre: medpanel2024)")
  console.log("  Süper Admin : mehmet.celik@klinik.com")
  console.log("  Admin       : ayse.yildiz@klinik.com")
  console.log("  Doktor      : ahmet.yilmaz@klinik.com")
  console.log("  Doktor      : selin.kaya@klinik.com")
  console.log("  Doktor      : burak.arslan@klinik.com")
  console.log("  Hemşire     : fatma.demir@klinik.com")
  console.log("  Resepsiyonist: can.ozdemir@klinik.com")
  console.log("─────────────────────────────────────────")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
