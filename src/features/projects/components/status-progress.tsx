import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { LIFECYCLE, STATUS_LABELS, type ProjectStatus } from "../status"

/** Línea de avance del ciclo productivo. Un proyecto cancelado se muestra aparte. */
export function StatusProgress({ status }: { status: ProjectStatus }) {
  if (status === "cancelado") {
    return (
      <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        Proyecto cancelado. Consulta el motivo en el historial.
      </p>
    )
  }
  const current = LIFECYCLE.indexOf(status)

  return (
    <ol className="grid grid-cols-7 gap-1" aria-label="Avance del proyecto">
      {LIFECYCLE.map((s, i) => {
        const done = i < current || status === "cerrado"
        const active = i === current && status !== "cerrado"
        return (
          <li key={s} className="min-w-0 space-y-1.5" aria-current={active ? "step" : undefined}>
            <div
              className={cn(
                "flex h-2 rounded-full",
                done ? "bg-primary" : active ? "bg-primary/60" : "bg-muted"
              )}
            />
            <p
              className={cn(
                "hidden truncate text-xs md:block",
                active ? "font-medium text-foreground" : "text-muted-foreground"
              )}
              title={STATUS_LABELS[s]}
            >
              {done && <Check className="mr-0.5 inline size-3" aria-hidden />}
              {STATUS_LABELS[s]}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
