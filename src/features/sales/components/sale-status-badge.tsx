import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { SALE_STATUS_CLASS, SALE_STATUS_LABELS, type SaleStatus } from "../schemas"

export function SaleStatusBadge({ status, className }: { status: SaleStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", SALE_STATUS_CLASS[status], className)}>
      {SALE_STATUS_LABELS[status]}
    </Badge>
  )
}
