"use client"

import { CalendarClock } from "lucide-react"
import { useMemo, useState } from "react"

import { matchesQuery, SearchInput } from "@/components/shared/search-input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"
import type { StockRow } from "../queries"
import { expiryStatus } from "../schemas"
import { LotFormDialog } from "./catalog-dialogs"

const ALL = "todos"

export function ExpiryBadge({ days }: { days: number | null }) {
  const status = expiryStatus(days)
  if (!status || status === "vigente") return null
  return (
    <Badge variant={status === "caducado" ? "destructive" : "outline"} className={status === "por_caducar" ? "border-warning" : undefined}>
      {status === "caducado" ? "Caducado" : `Caduca en ${formatNumber(days)} d`}
    </Badge>
  )
}

/** Existencias por almacén y lote, con caducidades. */
export function StockTable({ rows, canWrite }: { rows: StockRow[]; canWrite: boolean }) {
  const [query, setQuery] = useState("")
  const [warehouseId, setWarehouseId] = useState(ALL)
  const [expiringOnly, setExpiringOnly] = useState(false)
  const warehouses = useMemo(
    () => [...new Map(rows.map((r) => [r.warehouseId, r.warehouseName])).entries()].sort((a, b) => a[1].localeCompare(b[1], "es")),
    [rows]
  )
  const filtered = rows.filter(
    (r) =>
      (warehouseId === ALL || r.warehouseId === warehouseId) &&
      (!expiringOnly || (expiryStatus(r.daysToExpiry) ?? "vigente") !== "vigente") &&
      matchesQuery(query, r.productName, r.sku, r.lotNumber, r.categoryName)
  )
  const value = filtered.reduce((s, r) => s + r.estimatedValue, 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput value={query} onChange={setQuery} placeholder="Producto, clave o lote" />
        {warehouses.length > 1 && (
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger className="w-full sm:w-56" aria-label="Filtrar por almacén">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los almacenes</SelectItem>
              {warehouses.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={expiringOnly}
            onChange={(e) => setExpiringOnly(e.target.checked)}
            className="size-4 accent-primary"
          />
          Caducados o por caducar (30 días)
        </label>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Almacén</TableHead>
              <TableHead className="hidden sm:table-cell">Lote / caducidad</TableHead>
              <TableHead className="text-right">Existencia</TableHead>
              <TableHead className="hidden text-right md:table-cell">Valor estimado</TableHead>
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
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Sin existencias con esos filtros.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <p className="font-medium">{r.productName}</p>
                  <p className="text-xs text-muted-foreground">{r.categoryName}</p>
                </TableCell>
                <TableCell>{r.warehouseName}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  {r.lotNumber ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span>{r.lotNumber}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(r.expiryDate)}</span>
                      <ExpiryBadge days={r.daysToExpiry} />
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Sin lote</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(r.quantity, r.unit)}
                  {r.lotNumber && <p className="text-xs text-muted-foreground sm:hidden">Lote {r.lotNumber}</p>}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">{formatMoney(r.estimatedValue)}</TableCell>
                {canWrite && (
                  <TableCell>
                    {r.lotId && (
                      <LotFormDialog
                        label={r.lotNumber ?? ""}
                        lot={{ id: r.lotId, expiryDate: r.expiryDate ?? "", notes: "" }}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`Editar lote ${r.lotNumber}`}>
                            <CalendarClock aria-hidden />
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
                <TableCell colSpan={3} className="font-medium sm:col-span-3">
                  Valor estimado
                  <span className="block text-xs font-normal text-muted-foreground">
                    Existencia × costo promedio; el valor exacto por producto está en Existencias.
                  </span>
                </TableCell>
                <TableCell className="hidden md:table-cell" />
                <TableCell className="text-right font-semibold tabular-nums">{formatMoney(value)}</TableCell>
                {canWrite && <TableCell />}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  )
}
