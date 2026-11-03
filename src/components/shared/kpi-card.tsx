import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type KpiTone = "default" | "positive" | "negative" | "warning"

const ICON_TONE: Record<KpiTone, string> = {
  default: "bg-secondary text-secondary-foreground ring-primary/10",
  positive: "bg-success/15 text-primary ring-success/20 dark:text-success",
  negative: "bg-destructive/10 text-destructive ring-destructive/15",
  warning: "bg-warning/20 text-foreground ring-warning/25",
}

const VALUE_TONE: Record<KpiTone, string> = {
  default: "",
  positive: "",
  negative: "text-destructive",
  warning: "",
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  muted = false,
  tone = "default",
}: {
  label: string
  /** Valor ya formateado; null indica que el módulo aún no tiene registros. */
  value: string | null
  hint?: string
  icon: LucideIcon
  muted?: boolean
  /** Solo cambia el acento visual; no altera el valor mostrado. */
  tone?: KpiTone
}) {
  return (
    <Card className={cn("gap-0 py-4 transition-shadow hover:shadow-sm sm:py-5", muted && "bg-muted/40")}>
      <CardContent className="flex items-start justify-between gap-3 px-4 sm:px-5">
        <div className="min-w-0 space-y-1.5">
          <p className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
          <p
            className={cn(
              "text-2xl leading-tight font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere]",
              value === null ? "text-muted-foreground" : VALUE_TONE[tone]
            )}
          >
            {value ?? "—"}
          </p>
          {hint && <p className="text-xs leading-snug text-muted-foreground">{hint}</p>}
        </div>
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
            ICON_TONE[tone]
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
      </CardContent>
    </Card>
  )
}
