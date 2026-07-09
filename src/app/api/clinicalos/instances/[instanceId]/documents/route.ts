import { NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs/promises"
import { getOptionalSession } from "@/lib/dal"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/db/activity"
import type { WorkflowGraph } from "@/lib/workflow/types"

interface RouteParams {
  params: Promise<{ instanceId: string }>
}

const UPLOAD_DIR = path.join(process.cwd(), "uploads")
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getOptionalSession()
  if (!session) return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 })
  if (!can(session.permissions, "intake:execute"))
    return NextResponse.json({ error: "Belge yükleme yetkiniz yok" }, { status: 403 })

  const { instanceId } = await params

  const instance = await prisma.workflowInstance.findUnique({
    where: { id: instanceId },
    include: { workflowDef: true },
  })
  if (!instance) return NextResponse.json({ error: "Kabul kaydı bulunamadı" }, { status: 404 })

  const graph = (instance.workflowDef.nodes as unknown as WorkflowGraph).nodes

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Form verisi okunamadı" }, { status: 400 })
  }

  // `retroNodeId` verilmişse bu, bitiş özetinden geçmiş bir belge adımına ek
  // dosya yüklemedir; verilmemişse aktif (current) belge adımına yüklemedir.
  // Her iki durumda da yükleme workflow'u ilerletmez — ilerleme her zaman ayrı
  // ve açık bir "Devam Et" eylemiyle (advanceDocumentStepAction) yapılır, bu
  // sayede checklist'teki tüm zorunlu kalemler yüklenmeden adım geçilemez.
  const retroNodeId = formData.get("retroNodeId")
  const isRetro = typeof retroNodeId === "string" && retroNodeId.length > 0

  if (isRetro && instance.status === "completed") {
    return NextResponse.json({ error: "Son kontrol tamamlandı, artık belge eklenemez" }, { status: 400 })
  }

  const currentNode = isRetro
    ? graph.find((n) => n.id === retroNodeId)
    : graph.find((n) => n.id === instance.currentNodeId)
  if (!currentNode || currentNode.type !== "document") {
    return NextResponse.json({ error: "Geçersiz adım" }, { status: 400 })
  }

  const checklistLabelRaw = formData.get("checklistLabel")
  let checklistLabel: string | null = null
  if (typeof checklistLabelRaw === "string" && checklistLabelRaw.length > 0) {
    const known = (currentNode.checklist ?? []).some((item) => item.label === checklistLabelRaw)
    if (!known) return NextResponse.json({ error: "Geçersiz checklist kalemi" }, { status: 400 })
    checklistLabel = checklistLabelRaw
  }

  const file = formData.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Dosya 10 MB'den büyük olamaz" }, { status: 413 })

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")
  const filename = `${timestamp}-${safeName}`
  const instanceDir = path.join(UPLOAD_DIR, "clinicalos", instanceId)

  await fs.mkdir(instanceDir, { recursive: true })
  await fs.writeFile(path.join(instanceDir, filename), buffer)

  const fileUrl = `/api/files/clinicalos/${instanceId}/${filename}`

  await prisma.workflowDocument.create({
    data: {
      workflowInstanceId: instanceId,
      nodeId: currentNode.id,
      checklistLabel,
      name: file.name,
      url: fileUrl,
      size: file.size,
      type: file.type,
    },
  })

  void logActivity({
    actorId: session.userId,
    action: "intake.document_upload",
    entityType: "workflow_instance",
    entityId: instanceId,
    entityLabel: instance.workflowDef.name,
    metadata: { nodeId: currentNode.id, fileName: file.name, checklistLabel, retro: isRetro },
  }).catch(console.error)

  return NextResponse.json({ instance }, { status: 201 })
}
