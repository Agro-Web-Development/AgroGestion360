"use client"

import { Filter, X } from "lucide-react"
import Form from "next/form"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ALL_PARAM as ALL } from "@/lib/search-params"

export type FilterSelect = {
  name: string
  label: string
  value?: string
  allLabel: string
  options: { value: string; label: string }[]
}

/**
 * Filtros que viajan en la URL (GET con navegación del lado del cliente): la
 * página vuelve a consultar en el servidor solo los registros del rango.
 */
export function FilterBar({
  action,
  from,
  to,
  selects = [],
  preserve = ["tab", "reporte"],
}: {
  action: string
  from?: string
  to?: string
  selects?: FilterSelect[]
  /** Parámetros de la URL actual que se conservan (p. ej. la pestaña activa). */
  preserve?: string[]
}) {
  const searchParams = useSearchParams()
  const hidden = Object.fromEntries(preserve.map((name) => [name, searchParams.get(name) ?? undefined]))
  const active = Boolean(from || to || selects.some((s) => s.value))
  const clearHref = (() => {
    const params = new URLSearchParams(Object.entries(hidden).filter((e): e is [string, string] => Boolean(e[1])))
    const qs = params.toString()
    return qs ? `${action}?${qs}` : action
  })()

  return (
    <Form action={action} replace scroll={false} className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-end">
      {Object.entries(hidden).map(([name, value]) => value && <input key={name} type="hidden" name={name} value={value} />)}
      <div className="grid gap-1.5">
        <Label htmlFor="filter-from" className="text-xs text-muted-foreground">
          Desde
        </Label>
        <Input id="filter-from" type="date" name="desde" defaultValue={from} className="sm:w-40" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="filter-to" className="text-xs text-muted-foreground">
          Hasta
        </Label>
        <Input id="filter-to" type="date" name="hasta" defaultValue={to} className="sm:w-40" />
      </div>
      {selects.map((s) => (
        <div key={s.name} className="grid gap-1.5">
          <Label htmlFor={`filter-${s.name}`} className="text-xs text-muted-foreground">
            {s.label}
          </Label>
          <Select name={s.name} defaultValue={s.value || ALL}>
            <SelectTrigger id={`filter-${s.name}`} className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{s.allLabel}</SelectItem>
              {s.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="submit" variant="secondary">
          <Filter aria-hidden /> Aplicar
        </Button>
        {active && (
          <Button asChild variant="ghost">
            <Link href={clearHref} replace scroll={false}>
              <X aria-hidden /> Limpiar
            </Link>
          </Button>
        )}
      </div>
    </Form>
  )
}
