"use client"

import Link from "next/link"

import { TablePagination, usePagination } from "@/components/shared/table-pagination"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EvidenceDialog } from "@/features/fieldlogs/components/evidence"
import { formatDate, formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { PaymentRow } from "../queries"
import { PAYMENT_KIND_LABELS, PAYMENT_METHOD_LABELS } from "../schemas"

/** Pagos y anticipos con su venta, método, referencia y comprobantes. */
export function PaymentsTable({
  payments,
  organizationId,
  canAttach,
  showCustomer = true,
}: {
  payments: PaymentRow[]
  organizationId: string
  canAttach: boolean
  showCustomer?: boolean
}) {
  const { pageRows, pagination } = usePagination(payments)
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Venta</TableHead>
              <TableHead className="hidden md:table-cell">Método · referencia</TableHead>
              <TableHead className="text-right">Importe</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Comprobantes</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Sin pagos registrados.
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((p) => {
              const cancelled = p.status === "cancelado"
              const pending = p.kind === "anticipo" ? Number(p.amount) - Number(p.applied_amount) : 0
              return (
                <TableRow key={p.id} className={cn(cancelled && "opacity-60")}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(p.payment_date)}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.kind === "anticipo" && <Badge variant="secondary">{PAYMENT_KIND_LABELS.anticipo}</Badge>}
                      {cancelled && <Badge variant="outline">Cancelado</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link href={`/ventas/${p.sale.id}`} className="font-medium hover:underline">
                      {p.sale.code}
                    </Link>
                    {showCustomer && <p className="text-xs text-muted-foreground">{p.sale.customer.name}</p>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {PAYMENT_METHOD_LABELS[p.method]}
                    {p.reference && <p className="text-xs text-muted-foreground">{p.reference}</p>}
                    {p.cancel_reason && <p className="text-xs text-muted-foreground">Motivo: {p.cancel_reason}</p>}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(p.amount)}
                    {p.kind === "anticipo" && !cancelled && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {pending > 0 ? `${formatMoney(pending)} sin aplicar` : "Aplicado"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <EvidenceDialog
                      organizationId={organizationId}
                      entity="payment"
                      entityId={p.id}
                      title={`${PAYMENT_KIND_LABELS[p.kind]} ${p.sale.code} · ${formatMoney(p.amount)}`}
                      canAdd={canAttach}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <TablePagination {...pagination} />
    </div>
  )
}
