import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { STATUS_BADGE_CLASS, STATUS_LABELS, type ProjectStatus } from "../status"

export function ProjectStatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  return <Badge className={cn(STATUS_BADGE_CLASS[status], className)}>{STATUS_LABELS[status]}</Badge>
}
