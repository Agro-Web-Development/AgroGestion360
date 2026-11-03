"use client"

import { Undo2 } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { ReasonDialog } from "@/components/shared/reason-dialog"
import { matchesQuery, SearchInput } from "@/components/shared/search-input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { isClosed } from "@/features/projects/status"
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format"
import { reverseMovement } from "../actions"
import type { Movement } from "../queries"
import { isInflow, MOVEMENT_LABELS, MOVEMENT_TYPES, type MovementType } from "../schemas"

const ALL = "todos"

/**
 * Historial de movimientos (inmutable). Un error se corrige con la anulación,
 * que registra la contrapartida exacta y deja ambos movimientos visibles.
 */
export function MovementsTable({ movements, canWrite }: { movements: Movement[]; canWrite: boolean }) {
  const [type, setType] = useState<MovementType | typeof ALL>(ALL)
  const [query, setQuery] = useState("")
  const filtered = useMemo(
    () =>
      movements.filter(
        (m) =>
          (type === ALL || m.movement_type === type) &&
          matchesQuery(
            query,
            m.product.name,
            m.lot?.lot_number,
            m.supplier?.name,
            m.reference,
            m.project?.code,
            m.responsible?.full_name,
            m.notes
          )
      ),
    [movements, type, query]
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <SearchInput value={query} onChange={setQuery} placeholder="Producto, lote, proveedor, proyecto o referencia" />
        <Select value={type} onValueChange={(v) => setType(v as MovementType | typeof ALL)}>
          <SelectTrigger className="w-full sm:w-64" aria-label="Filtrar por tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los movimientos</SelectItem>
            {MOVEMENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {MOVEMENT_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Producto / tipo</TableHead>
              <TableHead className="hidden md:table-cell">Almacén / lote</TableHead>
              <TableHead className="hidden lg:table-cell">Destino / referencia</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Costo unit.</TableHead>
              <TableHead className="text-right">Importe</TableHead>
              {canWrite && (
                <TableHead className="w-12">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Sin movimientos con esos filtros.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((m) => {
              const transfer = m.movement_type === "transferencia"
              const inflow = isInflow(m.movement_type)
              const reversible =
                canWrite && !m.reversed && !m.reverses_id && !m.linked && !(m.project && isClosed(m.project.status))
              return (
                <TableRow key={m.id} className={m.reversed ? "opacity-60" : undefined}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(m.movement_date)}
                    <p className="hidden text-xs text-muted-foreground xl:block" title="Registrado">
                      {formatDateTime(m.created_at)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{m.product.name}</p>
                    <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      {MOVEMENT_LABELS[m.movement_type]}
                      {m.reverses_id && <Badge variant="outline">Anulación</Badge>}
                      {m.reversed && <Badge variant="outline">Anulado</Badge>}
                      {m.linked && <Badge variant="secondary">Desde bitácora</Badge>}
                    </p>
                  </TableCell>
                  <TableCell className="hidden text-sm md:table-cell">
                    {m.warehouse.name}
                    {transfer && m.destination && ` → ${m.destination.name}`}
                    {m.lot && <p className="text-xs text-muted-foreground">Lote {m.lot.lot_number}</p>}
                  </TableCell>
                  <TableCell className="hidden text-sm lg:table-cell">
                    {m.project ? (
                      <Link href={`/proyectos/${m.project.id}`} className="hover:underline">
                        {m.project.code}
                        {m.assignment && ` · ${m.assignment.plot.name}`}
                      </Link>
                    ) : (
                      [m.supplier?.name, m.reference].filter(Boolean).join(" · ") || "—"
                    )}
                    {(m.responsible || m.notes) && (
                      <p className="max-w-64 truncate text-xs text-muted-foreground">
                        {[m.responsible?.full_name, m.notes].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${inflow ? "text-primary" : ""}`}>
                    {transfer ? "" : inflow ? "+" : "−"}
                    {formatNumber(m.quantity, m.unit)}
                    {!transfer && <p className="text-xs text-muted-foreground">Queda {formatNumber(m.stock_after)}</p>}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatMoney(m.unit_cost)}</TableCell>
                  <TableCell className={`text-right font-medium tabular-nums ${transfer ? "text-muted-foreground" : ""}`}>
                    {formatMoney(m.total_cost)}
                  </TableCell>
                  {canWrite && (
                    <TableCell>
                      {reversible && (
                        <ReasonDialog
                          title="Anular movimiento"
                          description={`Se registrará la contrapartida exacta (${formatNumber(m.quantity, m.unit)} por ${formatMoney(m.total_cost)}). Ambos movimientos quedan en el historial.`}
                          confirmLabel="Anular"
                          action={(reason) => reverseMovement(m.id, reason)}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label="Anular movimiento">
                              <Undo2 aria-hidden />
                            </Button>
                          }
                        />
                      )}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
