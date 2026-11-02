import { Sprout } from "lucide-react"

import { cn } from "@/lib/utils"

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Sprout className="size-5" aria-hidden />
      </span>
      {!compact && (
        <span className="leading-tight">
          AgroGestión <span className="text-[color:var(--chart-2)]">360</span>
        </span>
      )}
    </span>
  )
}
