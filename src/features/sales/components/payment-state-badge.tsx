import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { PAYMENT_STATE_CLASS, PAYMENT_STATE_LABELS, type PaymentState } from "../schemas"

export function PaymentStateBadge({ state, className }: { state: PaymentState; className?: string }) {
  return <Badge className={cn(PAYMENT_STATE_CLASS[state], className)}>{PAYMENT_STATE_LABELS[state]}</Badge>
}
