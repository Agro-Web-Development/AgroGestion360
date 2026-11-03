import { ClipboardList, Droplets, FlaskConical, HardHat, Package, Tractor, Wheat, type LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { formatDate, formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { TimelineEntry } from "../queries"
import { TIMELINE_LABELS, type TimelineKind } from "../schemas"

const ICONS: Record<TimelineKind, LucideIcon> = {
  riego: Droplets,
  aplicacion: FlaskConical,
  actividad: ClipboardList,
  mano_obra: HardHat,
  maquinaria: Tractor,
  insumo: Package,
  cosecha: Wheat,
}

const TONES: Record<TimelineKind, string> = {
  riego: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  aplicacion: "bg-warning/20 text-foreground",
  actividad: "bg-secondary text-secondary-foreground",
  mano_obra: "bg-primary/10 text-primary",
  maquinaria: "bg-muted text-foreground",
  insumo: "bg-success/15 text-primary dark:text-success",
  cosecha: "bg-primary text-primary-foreground",
}

/** Bitácora cronológica del proyecto, agrupada por día. */
export function ProjectTimeline({ entries, showAmounts }: { entries: TimelineEntry[]; showAmounts: boolean }) {
  const days = new Map<string, TimelineEntry[]>()
  for (const e of entries) days.set(e.date, [...(days.get(e.date) ?? []), e])

  return (
    <ol className="space-y-6">
      {[...days.entries()].map(([date, items]) => (
        <li key={date}>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{formatDate(date)}</p>
          <ol className="relative space-y-3 border-l pl-5">
            {items.map((e) => {
              const Icon = ICONS[e.kind]
              return (
                <li key={`${e.kind}-${e.id}`} className={cn("relative", e.cancelled && "opacity-60")}>
                  <span
                    className={cn(
                      "absolute top-0.5 -left-[31px] flex size-5 items-center justify-center rounded-full ring-4 ring-background",
                      TONES[e.kind]
                    )}
                    aria-hidden
                  >
                    <Icon className="size-3" />
                  </span>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <p className="text-sm font-medium">
                      <span className="sr-only">{TIMELINE_LABELS[e.kind]}: </span>
                      {e.title}
                      {e.cancelled && (
                        <Badge variant="destructive" className="ml-2">
                          Cancelado
                        </Badge>
                      )}
                    </p>
                    {showAmounts && e.amount !== null && (
                      <span className={cn("text-sm tabular-nums", e.amount < 0 && "text-primary")}>{formatMoney(e.amount)}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[e.time, e.plot, e.detail, e.responsible].filter(Boolean).join(" · ")}
                  </p>
                </li>
              )
            })}
          </ol>
        </li>
      ))}
    </ol>
  )
}
