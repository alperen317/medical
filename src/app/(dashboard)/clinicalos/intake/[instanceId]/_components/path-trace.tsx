"use client"

import { NODE_VISUALS, BRANCH_COLORS } from "@/lib/workflow/node-visuals"
import { humanize, humanizeDecision, visiblePathSteps, type PathStep } from "@/lib/workflow/path"
import { cn } from "@/lib/utils"
import { useT } from "@/store/translations-context"

// Hasta kaydındaki kronolojik olay geçmişinden (bkz. patients/[id] timeline)
// bilinçli olarak farklı bir görsel dil: burada "ne zaman oldu" değil "süreçte
// neredeyim" sorusuna cevap veriliyor — dar bir yan panelde sakin duran, tek bir
// vurgulu an (mevcut adım) etrafında kurulu kompakt bir adım izleyicisi.
export function StepTrace({ steps }: { steps: PathStep[] }) {
  const t = useT()
  const visibleSteps = visiblePathSteps(steps)

  if (!visibleSteps.length) return null

  const lastIndex = visibleSteps.length - 1
  const isComplete = visibleSteps[lastIndex].kind === "end"

  return (
    <ol>
      {visibleSteps.map((step, i) => {
        const isLast = i === lastIndex

        if (step.kind === "decision") {
          const colors = BRANCH_COLORS[step.branch]
          return (
            <li key={`${step.node.id}-${i}`} className="relative flex items-center gap-2.5 pb-3">
              {!isLast && <span className="absolute left-[10.5px] top-4 bottom-0 w-px bg-border" />}
              <span className="relative z-10 flex h-5.25 w-5.25 shrink-0 items-center justify-center">
                <span className={cn("h-1.75 w-1.75 rotate-45 bg-current", colors.text)} />
              </span>
              <p className="min-w-0 truncate text-xs text-muted-foreground">
                {humanizeDecision(step.node.id)}{" "}
                <span className={cn("font-semibold", colors.text)}>
                  {step.branch === "then" ? t("common.yes") : t("common.no")}
                </span>
              </p>
            </li>
          )
        }

        const visual = NODE_VISUALS[step.kind]
        const Icon = visual.icon
        const isCurrent = isLast && !isComplete
        const isEnd = step.kind === "end"

        return (
          <li
            key={`${step.node.id}-${i}`}
            className={cn(
              "relative flex items-start gap-2.5 rounded-md pb-4 last:pb-0",
              isCurrent && "-mx-2 bg-primary/5 px-2 pt-1.5 pb-2.5",
            )}
          >
            {!isLast && <span className="absolute left-[10.5px] top-7 bottom-0 w-px bg-border" />}
            <span
              className={cn(
                "relative z-10 flex h-5.25 w-5.25 shrink-0 items-center justify-center rounded-full border",
                isCurrent && "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15",
                isEnd && !isCurrent && "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
                !isCurrent && !isEnd && cn(visual.bg, visual.color, "border-transparent opacity-75"),
              )}
            >
              <Icon className="h-3 w-3" />
            </span>

            <div className="min-w-0 pt-0.5">
              <p className={cn("text-sm leading-tight truncate", isCurrent ? "font-semibold text-primary" : "text-foreground/80")}>
                {humanize(step.node.id)}
              </p>
              {isCurrent && <p className="mt-0.5 text-[11px] text-muted-foreground">{t("intake.runner.current_step")}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
