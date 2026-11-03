"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { matchesQuery, SearchInput } from "@/components/shared/search-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"
import type { SaleListItem } from "../queries"
import { DELIVERY_STATE_LABELS, isActiveSale, SALE_STATUS_LABELS, SALE_STATUSES, type SaleStatus } from "../schemas"
import { SaleStatusBadge } from "./sale-status-badge"

const ALL = "todas"

export function SalesTable({ sales, showCustomer = true }: { sales: SaleListItem[]; showCustomer?: boolean }) {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<SaleStatus | typeof ALL>(ALL)
  const filtered = useMemo(
    () =>
      sales.filter((s) => (status === ALL || s.status === status) && matchesQuery(query, s.code, s.customerName)),
    [sales, query, status]
  )
  const active = filtered.filter((s) => isActiveSale(s.status))

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar por folio o cliente" />
        <Select value={status} onValueChange={(v) => setStatus(v as SaleStatus | typeof ALL)}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los estados</SelectItem>
            {SALE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {SALE_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{showCustomer ? "Folio / cliente" : "Folio"}</TableHead>
              <TableHead className="hidden sm:table-cell">Fecha</TableHead>
              <TableHead className="hidden md:table-cell">Vencimiento</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Pagado</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="hidden md:table-cell">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No se encontraron ventas.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((s) => (
              <TableRow key={s.id} className={s.status === "cancelada" ? "opacity-60" : undefined}>
                <TableCell>
                  <Link href={`/ventas/${s.id}`} className="font-medium hover:underline">
                    {s.code}
                  </Link>
                  {showCustomer && <p className="text-xs text-muted-foreground">{s.customerName}</p>}
                  <p className="text-xs text-muted-foreground md:hidden">{SALE_STATUS_LABELS[s.status]}</p>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap sm:table-cell">
                  {formatDate(s.saleDate)}
                  <span className="block text-xs text-muted-foreground">{formatNumber(s.totalKg, "kg")}</span>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap md:table-cell">
                  {isActiveSale(s.status) ? formatDate(s.dueDate) : "—"}
                  {s.daysOverdue > 0 && (
                    <span className="block text-xs text-destructive">Vencida hace {formatNumber(s.daysOverdue)} días</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(s.total)}
                  {s.discount > 0 && <span className="block text-xs text-muted-foreground">−{formatMoney(s.discount)} desc.</span>}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums lg:table-cell">
                  {formatMoney(s.paid)}
                  {s.advance > 0 && (
                    <span className="block text-xs text-muted-foreground">+{formatMoney(s.advance)} anticipo sin aplicar</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatMoney(s.balance)}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <SaleStatusBadge status={s.status} />
                  {s.deliveryState && s.deliveryState !== "entregada" && s.status !== "entregada" && (
                    <span className="mt-1 block text-xs text-muted-foreground">{DELIVERY_STATE_LABELS[s.deliveryState]}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {active.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell className="font-medium">Confirmadas ({formatNumber(active.length)})</TableCell>
                <TableCell className="hidden sm:table-cell" />
                <TableCell className="hidden md:table-cell" />
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatMoney(active.reduce((t, s) => t + s.total, 0))}
                </TableCell>
                <TableCell className="hidden text-right font-semibold tabular-nums lg:table-cell">
                  {formatMoney(active.reduce((t, s) => t + s.paid, 0))}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatMoney(active.reduce((t, s) => t + s.balance, 0))}
                </TableCell>
                <TableCell className="hidden md:table-cell" />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  )
}
