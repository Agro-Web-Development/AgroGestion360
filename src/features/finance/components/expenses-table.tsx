"use client"

import { Ban } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { ReasonDialog } from "@/components/shared/reason-dialog"
import { matchesQuery, SearchInput } from "@/components/shared/search-input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EvidenceDialog } from "@/features/fieldlogs/components/evidence"
import { isClosed } from "@/features/projects/status"
import { PAYMENT_METHOD_LABELS } from "@/features/sales/schemas"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"
import { sumMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import { cancelExpense } from "../actions"
import type { Expense } from "../queries"
import { ALLOCATION_METHOD_LABELS, BUDGET_CATEGORY_LABELS, EXPENSE_CATEGORY_LABELS } from "../schemas"
import { ExpensePaymentDialog } from "./cash-movement-dialog"
import { ExpensePaymentBadge } from "./status-badges"

const FILTERS = {
  todos: "Todos",
  por_pagar: "Por pagar",
  pagados: "Pagados",
  cancelados: "Cancelados",
} as const
type Filter = keyof typeof FILTERS

/**
 * Gastos con su reparto, lo pagado y lo pendiente. Un gasto se cancela (no se
 * elimina) cuando no tiene pagos y sus proyectos siguen vigentes.
 */
export function ExpensesTable({
  organizationId,
  expenses,
  canWrite,
}: {
  organizationId: string
  expenses: Expense[]
  canWrite: boolean
}) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("todos")
  const rows = expenses.filter(
    (e) =>
      (filter === "todos" ||
        (filter === "por_pagar" && e.pendingAmount > 0) ||
        (filter === "pagados" && e.paymentStatus === "pagado") ||
        (filter === "cancelados" && e.status === "cancelado")) &&
      matchesQuery(query, e.description, e.supplier?.name, e.invoice_ref, ...e.allocations.map((a) => a.project.code))
  )
  const active = rows.filter((e) => e.status === "registrado")

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar por concepto, proveedor, factura o proyecto" />
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por estado de pago">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FILTERS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
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
              <TableHead>Concepto</TableHead>
              <TableHead className="hidden lg:table-cell">Proyectos</TableHead>
              <TableHead className="text-right">Importe</TableHead>
              <TableHead className="hidden text-right md:table-cell">Por pagar</TableHead>
              <TableHead>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Sin gastos con los filtros seleccionados.
                </TableCell>
              </TableRow>
            )}
            {rows.map((e) => {
              const cancelled = e.status === "cancelado"
              const locked = e.allocations.some((a) => isClosed(a.project.status))
              return (
                <TableRow key={e.id} className={cn(cancelled && "text-muted-foreground")}>
                  <TableCell className="align-top whitespace-nowrap">{formatDate(e.expense_date)}</TableCell>
                  <TableCell className="align-top">
                    <p className={cn("font-medium", cancelled && "line-through")}>{e.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        EXPENSE_CATEGORY_LABELS[e.category],
                        BUDGET_CATEGORY_LABELS[e.cost_category],
                        e.supplier?.name,
                        e.invoice_ref,
                        e.payment_method && PAYMENT_METHOD_LABELS[e.payment_method],
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {e.responsible && (
                      <p className="text-xs text-muted-foreground">Responsable: {e.responsible.full_name || e.responsible.email}</p>
                    )}
                    {cancelled && e.cancel_reason && <p className="text-xs">Cancelado: {e.cancel_reason}</p>}
                    <p className="text-xs text-muted-foreground lg:hidden">
                      {e.allocations.map((a) => a.project.code).join(", ")}
                    </p>
                    <div className="mt-1 md:hidden">
                      <ExpensePaymentBadge status={e.paymentStatus} />
                    </div>
                  </TableCell>
                  <TableCell className="hidden align-top lg:table-cell">
                    {e.allocation_method !== "directo" && (
                      <p className="text-xs text-muted-foreground">{ALLOCATION_METHOD_LABELS[e.allocation_method]}</p>
                    )}
                    <ul className="text-sm">
                      {e.allocations.map((a) => (
                        <li key={a.id} className="flex justify-between gap-3">
                          <Link href={`/proyectos/${a.project.id}`} className="hover:underline">
                            {a.project.code}
                            {a.assignment && <span className="text-muted-foreground"> · {a.assignment.plot.name}</span>}
                          </Link>
                          {e.allocation_method !== "directo" && (
                            <span className="text-muted-foreground tabular-nums">
                              {formatNumber(a.allocation_share * 100)} % · {formatMoney(a.amount)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </TableCell>
                  <TableCell className="text-right align-top font-medium tabular-nums">{formatMoney(e.amount)}</TableCell>
                  <TableCell className="hidden text-right align-top md:table-cell">
                    <span className="tabular-nums">{cancelled ? "—" : formatMoney(e.pendingAmount)}</span>
                    <div className="mt-1">
                      <ExpensePaymentBadge status={e.paymentStatus} />
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex justify-end gap-1">
                      {canWrite && !cancelled && e.pendingAmount > 0 && (
                        <ExpensePaymentDialog
                          expense={{
                            id: e.id,
                            description: e.description,
                            pendingAmount: e.pendingAmount,
                            paymentMethod: e.payment_method,
                          }}
                        />
                      )}
                      <EvidenceDialog
                        organizationId={organizationId}
                        entity="expense"
                        entityId={e.id}
                        title={e.description}
                        canAdd={canWrite && !cancelled}
                      />
                      {canWrite && !cancelled && e.paidAmount === 0 && !locked && (
                        <ReasonDialog
                          title="Cancelar gasto"
                          description={`"${e.description}" (${formatMoney(e.amount)}) dejará de contar como costo en ${e.allocations
                            .map((a) => a.project.code)
                            .join(", ")}. Queda en el historial.`}
                          confirmLabel="Cancelar gasto"
                          action={(reason) => cancelExpense(e.id, reason)}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label={`Cancelar gasto: ${e.description}`}>
                              <Ban aria-hidden />
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          {active.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-medium">
                  Total vigente ({formatNumber(active.length)} gastos)
                </TableCell>
                <TableCell className="hidden lg:table-cell" />
                <TableCell className="text-right font-semibold tabular-nums">{formatMoney(sumMoney(active.map((e) => e.amount)))}</TableCell>
                <TableCell className="hidden text-right font-semibold tabular-nums md:table-cell">
                  {formatMoney(sumMoney(active.map((e) => e.pendingAmount)))}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  )
}
