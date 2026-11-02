"use client"

import { Search } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"
import type { SaleListItem } from "../queries"
import { PAYMENT_STATE_LABELS, type PaymentState } from "../schemas"
import { PaymentStateBadge } from "./payment-state-badge"

const ALL = "todas"
const STATES: PaymentState[] = ["pendiente", "parcial", "pagada", "cancelada"]

export function SalesTable({ sales }: { sales: SaleListItem[] }) {
  const [query, setQuery] = useState("")
  const [state, setState] = useState<PaymentState | typeof ALL>(ALL)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sales.filter(
      (s) =>
        (state === ALL || s.paymentState === state) &&
        (!q || s.code.toLowerCase().includes(q) || s.customerName.toLowerCase().includes(q))
    )
  }, [sales, query, state])
  const active = filtered.filter((s) => s.status === "vigente")

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por folio o cliente"
            className="pl-8"
            aria-label="Buscar ventas"
          />
        </div>
        <Select value={state} onValueChange={(v) => setState(v as PaymentState | typeof ALL)}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Filtrar por estado de pago">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {STATES.map((s) => (
              <SelectItem key={s} value={s}>
                {PAYMENT_STATE_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folio / cliente</TableHead>
              <TableHead className="hidden sm:table-cell">Fecha</TableHead>
              <TableHead className="hidden md:table-cell">Vencimiento</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Cobrado</TableHead>
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
                  <p className="text-xs text-muted-foreground">{s.customerName}</p>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap sm:table-cell">{formatDate(s.saleDate)}</TableCell>
                <TableCell className="hidden whitespace-nowrap md:table-cell">
                  {formatDate(s.dueDate)}
                  {s.daysOverdue > 0 && (
                    <span className="block text-xs text-destructive">Vencida hace {formatNumber(s.daysOverdue)} días</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(s.total)}</TableCell>
                <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatMoney(s.paid)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatMoney(s.balance)}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <PaymentStateBadge state={s.paymentState} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {active.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell className="font-medium">Vigentes ({formatNumber(active.length)})</TableCell>
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
