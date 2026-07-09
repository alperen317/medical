"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, Loader2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { submitFormAnswerAction, completeTaskAction, goBackIntakeAction, advanceDocumentStepAction } from "@/lib/actions/clinicalos-intake"
import { NODE_VISUALS } from "@/lib/workflow/node-visuals"
import { cn } from "@/lib/utils"
import type { getWorkflowInstanceById } from "@/lib/db/clinicalos-intake"
import type { FormDefinitionRow } from "@/lib/db/workflow-studio"
import type { FormField, WorkflowNode } from "@/lib/workflow/types"
import type { PathStep } from "@/lib/workflow/path"
import { DynamicFormRenderer } from "@/components/clinicalos/dynamic-form-renderer"
import { IntakeSummary } from "@/components/clinicalos/intake-summary"
import { DocumentStep } from "./document-step"
import { StepTrace } from "./path-trace"
import { IntakePatientBanner } from "./intake-patient-banner"
import { toast } from "@/store/ui.store"

type Instance = NonNullable<Awaited<ReturnType<typeof getWorkflowInstanceById>>>

type Props = {
  instance: Instance
  currentNode: WorkflowNode
  formDef: FormDefinitionRow | null
  forms: FormDefinitionRow[]
  visitedPath: PathStep[]
}

export function IntakeRunner({ instance, currentNode, formDef, forms, visitedPath }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const submitAnswers = (values: Record<string, unknown>) => {
    startTransition(async () => {
      const result = await submitFormAnswerAction(instance.id, values)
      if (result.success) router.refresh()
      else toast.error(result.message ?? "Kaydedilemedi")
    })
  }

  const completeTask = () => {
    startTransition(async () => {
      const result = await completeTaskAction(instance.id)
      if (result.success) router.refresh()
      else toast.error(result.message ?? "Tamamlanamadı")
    })
  }

  const advanceDocumentStep = () => {
    startTransition(async () => {
      const result = await advanceDocumentStepAction(instance.id)
      if (result.success) router.refresh()
      else toast.error(result.message ?? "İlerlenemedi")
    })
  }

  const goBack = () => {
    startTransition(async () => {
      const result = await goBackIntakeAction(instance.id)
      if (result.success) router.refresh()
      else toast.error(result.message ?? "Geri gidilemedi")
    })
  }

  const history = Array.isArray(instance.history) ? (instance.history as unknown[]) : []
  // Son kontrol (task) tamamlanıp "end" node'una ulaşıldığında süreç kilitlenir —
  // artık geri gidilip düzenleme yapılamaz. Son kontrol tamamlanmadan önce
  // (task ekranının kendisi dahil) geri gidiş/düzenleme serbesttir.
  const canGoBack = history.length > 0 && currentNode.type !== "end"
  const tasks = Array.isArray(instance.tasks) ? (instance.tasks as { nodeId: string; completedAt: string }[]) : []

  return (
    <div>
      <div className="flex min-h-14 items-center gap-2 border-b bg-card px-4 sm:px-6 py-2">
        <Link href="/clinicalos/intake">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Kabul Listesi
          </Button>
        </Link>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="space-y-6">
          <IntakePatientBanner instance={instance} />

          <Card className="overflow-hidden py-0 gap-0">
            {/* Her adım artık kendi ikon+başlık bloğunu gösteriyor (bkz. DocumentStep /
                DynamicFormRenderer / aşağıdaki Görev bloğu) — bu üst bar sadece "Geri"
                için var, "end" ekranına ulaşıldığında (son kontrol tamamlandığında) o da
                gösterilmez, çünkü kontrol bitince düzenleme kapanır. */}
            {canGoBack && (
              <CardHeader className="flex flex-row items-center justify-end gap-2 space-y-0 py-2.5 border-b bg-muted/20">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground"
                  onClick={goBack}
                  disabled={pending}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Geri
                </Button>
              </CardHeader>
            )}
            <CardContent className="py-5">
              {/* Her adım aynı kabuğu paylaşır: solda adımın kendi içeriği, sağda
                  (geniş ekranda sabit kalan) o ana kadarki Adımlar izleyicisi —
                  böylece içeriği kısa adımlarda (Görev, kısa Form) sayfanın yarısı
                  boş kalmıyor ve tüm adımlar aynı genişlikte, aynı "polish" ile görünüyor. */}
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6 items-start">
                <div className="min-w-0">
                  {currentNode.type === "end" && (
                    <IntakeSummary
                      instance={instance}
                      forms={forms}
                      visitedPath={visitedPath}
                      readOnly
                      title="Kabul süreci tamamlandı — hasta doktora hazır."
                      description="Toplanan tüm bilgiler sırasıyla aşağıda listelenmiştir."
                    />
                  )}

                  {currentNode.type === "task" && (() => {
                    const existingCompletions = tasks.filter((t) => t.nodeId === currentNode.id)
                    const TaskIcon = NODE_VISUALS.task.icon
                    return (
                      <div className="space-y-5">
                        {/* visitedPath'in son elemanı bu task adımının kendisi —
                            özet önizlemesinde tekrar etmesin diye çıkarılıyor. */}
                        <IntakeSummary
                          instance={instance}
                          forms={forms}
                          visitedPath={visitedPath.slice(0, -1)}
                          title="Son kontrol için toplanan bilgiler"
                          description="Devam etmeden önce gözden geçirin, gerekirse düzenleyin."
                        />

                        <div className="flex items-center gap-3">
                          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", NODE_VISUALS.task.bg, NODE_VISUALS.task.color)}>
                            <TaskIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <h2 className="text-base font-semibold leading-tight">{currentNode.label ?? "Görev"}</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Kabul sürecini tamamlamak için bu adımı onaylayın.
                            </p>
                          </div>
                        </div>

                        <div className="rounded-lg border bg-card p-3.5 space-y-3">
                          {existingCompletions.length > 0 && (
                            <div className="space-y-1 rounded-md border bg-muted/30 px-3 py-2">
                              <p className="text-xs font-medium text-muted-foreground">Daha önce tamamlandı</p>
                              {existingCompletions.map((t, i) => (
                                <p key={i} className="text-xs text-muted-foreground">
                                  {new Date(t.completedAt).toLocaleString("tr-TR")}
                                </p>
                              ))}
                            </div>
                          )}
                          <Button onClick={completeTask} disabled={pending} className="w-full gap-2">
                            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Tamamlandı Olarak İşaretle
                          </Button>
                          <p className="text-xs font-medium text-muted-foreground">
                            Onayladığınızda kabul süreci bir sonraki adıma geçer.
                          </p>
                        </div>
                      </div>
                    )
                  })()}

                  {currentNode.type !== "end" && currentNode.type !== "task" && (
                    <>
                      {currentNode.type === "form" && formDef && (
                        // key=currentNode.id: farklı form adımları arasında (özellikle
                        // "Geri" ile) bileşen yeniden mount edilsin, önceki adımın
                        // values state'i sızmasın ve initialValues doğru başlasın.
                        <DynamicFormRenderer
                          key={currentNode.id}
                          title={formDef.name}
                          fields={(formDef.fields as unknown as FormField[]) ?? []}
                          pending={pending}
                          onSubmit={submitAnswers}
                          initialValues={instance.answers as Record<string, unknown>}
                        />
                      )}

                      {currentNode.type === "form" && !formDef && (
                        <p className="text-sm text-destructive">Bu adıma bağlı bir form şablonu bulunamadı.</p>
                      )}

                      {currentNode.type === "document" && (
                        // "Geri" ile bu adıma dönüldüğünde daha önce yüklenmiş belgeler
                        // görünmezse kullanıcı hiçbir şey yüklenmemiş sanıyor — bu yüzden
                        // mevcut dosyalar da listeleniyor (bkz. DocumentStep).
                        <DocumentStep
                          instanceId={instance.id}
                          node={currentNode}
                          documents={instance.documents.filter((d) => d.nodeId === currentNode.id)}
                          pending={pending}
                          onAdvance={advanceDocumentStep}
                        />
                      )}
                    </>
                  )}
                </div>

                <div className="xl:sticky xl:top-6 rounded-lg border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Adımlar</p>
                  <StepTrace steps={visitedPath} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
