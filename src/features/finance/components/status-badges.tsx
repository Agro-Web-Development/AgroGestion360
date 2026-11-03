import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { budgetStatusLabel, DEFAULT_THRESHOLDS, type AlertThresholds, type BudgetStatus } from "../schemas"

const BUDGET_STATUS_CLASS: Record<BudgetStatus, string> = {
  normal: "bg-secondary text-secondary-foreground",
  aviso: "bg-warning/20 text-foreground",
  critico: "bg-orange-500/15 text-orange-800 dark:text-orange-200",
  agotado: "bg-destructive/15 text-destructive",
  sin_presupuesto: "border-dashed bg-transparent text-muted-foreground",
}

export function BudgetStatusBadge({
  status,
  thresholds = DEFAULT_THRESHOLDS,
  short = false,
  className,
}: {
  status: BudgetStatus
  thresholds?: AlertThresholds
  /** Solo el nombre del estado, sin el umbral. */
  short?: boolean
  className?: string
}) {
  const label = budgetStatusLabel(status, thresholds)
  return (
    <Badge variant="outline" className={cn("border-transparent", BUDGET_STATUS_CLASS[status], className)}>
      {short ? label.replace(/ \(.*\)$/, "") : label}
    </Badge>
  )
}

export type ExpensePaymentStatus = "pendiente" | "parcial" | "pagado" | "cancelado"

const PAYMENT_LABELS: Record<ExpensePaymentStatus, string> = {
  pendiente: "Por pagar",
  parcial: "Pago parcial",
  pagado: "Pagado",
  cancelado: "Cancelado",
}

const PAYMENT_CLASS: Record<ExpensePaymentStatus, string> = {
  pendiente: "bg-warning/20 text-foreground",
  parcial: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  pagado: "bg-primary text-primary-foreground",
  cancelado: "bg-destructive/15 text-destructive",
}

export function ExpensePaymentBadge({ status, className }: { status: ExpensePaymentStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", PAYMENT_CLASS[status], className)}>
      {PAYMENT_LABELS[status]}
    </Badge>
  )
}
