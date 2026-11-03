export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:mb-8">
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">{title}</h1>
        {description && <p className="max-w-3xl text-sm text-muted-foreground sm:text-[0.9375rem]">{description}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap gap-2 *:max-sm:flex-1 sm:shrink-0 sm:justify-end">{actions}</div>
      )}
    </div>
  )
}
