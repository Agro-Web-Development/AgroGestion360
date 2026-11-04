"use client"

import { Trash2 } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { ConfirmAction } from "@/components/shared/confirm-action"
import { TablePagination, usePagination } from "@/components/shared/table-pagination"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { isClosed, type ProjectStatus } from "@/features/projects/status"
import type { ActionResult } from "@/lib/actions"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"

export type RecordRow = {
  id: string
  date: string
  title: string
  subtitle?: string | null
  project: { id: string; code: string; status: ProjectStatus }
  plot?: string | null
  quantity?: string
  value: number | string | null
}

const ALL = "todos"

/**
 * Registros imputados a proyectos (maquinaria, mano de obra, gastos, cosechas)
 * con filtro por proyecto y total. Solo se eliminan mientras el proyecto está
 * vigente; la base de datos aplica la misma regla.
 */
export function RecordsTable({
  rows,
  quantityHeader,
  valueHeader = "Importe",
  valueUnit,
  deleteAction,
  deleteLabel = "Eliminar registro",
  emptyText = "Sin registros.",
}: {
  rows: RecordRow[]
  quantityHeader?: string
  valueHeader?: string
  /** Sin unidad el valor se muestra como importe en MXN. */
  valueUnit?: string
  deleteAction?: (id: string) => Promise<ActionResult>
  deleteLabel?: string
  emptyText?: string
}) {
  const [projectId, setProjectId] = useState(ALL)
  const projects = useMemo(() => {
    const map = new Map(rows.map((r) => [r.project.id, r.project.code]))
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [rows])
  const filtered = projectId === ALL ? rows : rows.filter((r) => r.project.id === projectId)
  const total = filtered.reduce((s, r) => s + Number(r.value), 0)
  const { pageRows, pagination } = usePagination(filtered)
  const format = (v: number | string | null) => (valueUnit ? formatNumber(v, valueUnit) : formatMoney(v))

  return (
    <div className="space-y-3">
      {projects.length > 1 && (
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-full sm:w-64" aria-label="Filtrar por proyecto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los proyectos</SelectItem>
            {projects.map(([id, code]) => (
              <SelectItem key={id} value={id}>
                {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead className="hidden md:table-cell">Proyecto / parcela</TableHead>
              {quantityHeader && <TableHead className="hidden text-right sm:table-cell">{quantityHeader}</TableHead>}
              <TableHead className="text-right">{valueHeader}</TableHead>
              {deleteAction && (
                <TableHead className="w-12">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {emptyText}
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{formatDate(r.date)}</TableCell>
                <TableCell>
                  <p className="font-medium">{r.title}</p>
                  {r.subtitle && <p className="text-xs text-muted-foreground">{r.subtitle}</p>}
                  <p className="text-xs text-muted-foreground md:hidden">{r.project.code}</p>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Link href={`/proyectos/${r.project.id}`} className="hover:underline">
                    {r.project.code}
                  </Link>
                  <p className="text-xs text-muted-foreground">{r.plot ?? "Todo el proyecto"}</p>
                </TableCell>
                {quantityHeader && (
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{r.quantity}</TableCell>
                )}
                <TableCell className="text-right font-medium tabular-nums">{format(r.value)}</TableCell>
                {deleteAction && (
                  <TableCell>
                    {!isClosed(r.project.status) && (
                      <ConfirmAction
                        title={deleteLabel}
                        description={`Se eliminará "${r.title}" (${format(r.value)}) del proyecto ${r.project.code}.`}
                        confirmLabel="Eliminar"
                        action={() => deleteAction(r.id)}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`${deleteLabel}: ${r.title}`}>
                            <Trash2 aria-hidden />
                          </Button>
                        }
                      />
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
          {filtered.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-medium">
                  Total ({formatNumber(filtered.length)} registros)
                </TableCell>
                <TableCell className="hidden md:table-cell" />
                {quantityHeader && <TableCell className="hidden sm:table-cell" />}
                <TableCell className="text-right font-semibold tabular-nums">{format(total)}</TableCell>
                {deleteAction && <TableCell />}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
      <TablePagination {...pagination} />
    </div>
  )
}
