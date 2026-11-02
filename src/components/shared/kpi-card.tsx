import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  muted = false,
}: {
  label: string
  /** Valor ya formateado; null indica que el módulo aún no tiene registros. */
  value: string | null
  hint?: string
  icon: LucideIcon
  muted?: boolean
}) {
  return (
    <Card className={cn("gap-0 py-4", muted && "bg-muted/40")}>
      <CardContent className="flex items-start justify-between gap-3 px-4">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={cn("text-2xl font-semibold tabular-nums", value === null && "text-muted-foreground")}>
            {value ?? "—"}
          </p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
      </CardContent>
    </Card>
  )
}
