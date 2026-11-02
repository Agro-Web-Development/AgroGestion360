"use client"

import { Search } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"
import type { ProjectListItem } from "../queries"
import { isClosed, PROJECT_STATUSES, STATUS_LABELS } from "../status"
import { ProjectStatusBadge } from "./project-status-badge"

const FILTER_ACTIVE = "vigentes"
const FILTER_ALL = "todos"

export function ProjectsTable({ projects }: { projects: ProjectListItem[] }) {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<string>(FILTER_ACTIVE)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return projects.filter((p) => {
      if (status === FILTER_ACTIVE && isClosed(p.status)) return false
      if (status !== FILTER_ACTIVE && status !== FILTER_ALL && p.status !== status) return false
      if (!q) return true
      return [p.code, p.name, p.season, p.crop.name, p.crop.variety, ...p.farms].some((v) =>
        v?.toLowerCase().includes(q)
      )
    })
  }, [projects, query, status])

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por folio, nombre, cultivo o rancho"
            className="pl-8"
            aria-label="Buscar proyectos"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-56" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ACTIVE}>Vigentes</SelectItem>
            <SelectItem value={FILTER_ALL}>Todos los estados</SelectItem>
            {PROJECT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proyecto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden md:table-cell">Cultivo</TableHead>
              <TableHead className="text-right">Superficie</TableHead>
              <TableHead className="hidden lg:table-cell">Cosecha estimada</TableHead>
              <TableHead className="hidden text-right xl:table-cell">Presupuesto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No hay proyectos con esos filtros.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="max-w-72">
                  <Link href={`/proyectos/${p.id}`} className="block truncate font-medium hover:underline">
                    {p.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {[p.code, p.season, p.farms.join(", ")].filter(Boolean).join(" · ")}
                  </p>
                </TableCell>
                <TableCell>
                  <ProjectStatusBadge status={p.status} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {p.crop.name}
                  {p.crop.variety && <span className="text-muted-foreground"> · {p.crop.variety}</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.area > 0 ? formatNumber(p.area, "ha") : <span className="text-muted-foreground">Sin parcelas</span>}
                </TableCell>
                <TableCell className="hidden lg:table-cell">{formatDate(p.expected_harvest_date)}</TableCell>
                <TableCell className="hidden text-right tabular-nums xl:table-cell">{formatMoney(p.budget_amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        {filtered.length} de {projects.length} proyectos
      </p>
    </div>
  )
}
