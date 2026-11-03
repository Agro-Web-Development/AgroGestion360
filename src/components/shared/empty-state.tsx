import type { LucideIcon } from "lucide-react"

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed bg-card/60 px-6 py-12 text-center sm:py-16">
      <span className="relative flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary ring-8 ring-secondary/40 dark:text-secondary-foreground">
        <Icon className="size-6" aria-hidden />
      </span>
      <div className="space-y-1.5">
        <p className="text-base font-semibold tracking-tight">{title}</p>
        {description && <p className="mx-auto max-w-md text-sm text-balance text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}
