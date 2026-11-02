import { CircleDollarSign, HandCoins, TriangleAlert } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { KpiCard } from "@/components/shared/kpi-card"
import { NoAccess } from "@/components/shared/no-access"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PaymentDialog } from "@/features/sales/components/payment-dialog"
import { getRecentPayments, getSales } from "@/features/sales/queries"
import { PAYMENT_METHOD_LABELS } from "@/features/sales/schemas"
import { agingBucket, AGING_BUCKETS, AGING_LABELS } from "@/features/sales/aging"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Cobranza" }

export default async function ReceivablesPage() {
  const ctx = await getOrgContext()
  if (!can(ctx.role, "finance.read")) return <NoAccess title="Cobranza" />
  const canPay = can(ctx.role, "payments.write")
  const [sales, payments] = await Promise.all([getSales(), getRecentPayments()])
  const open = sales.filter((s) => s.status === "vigente" && s.balance > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  const receivable = open.reduce((t, s) => t + s.balance, 0)
  const overdue = open.filter((s) => s.daysOverdue > 0).reduce((t, s) => t + s.balance, 0)
  const collected = sales.filter((s) => s.status === "vigente").reduce((t, s) => t + s.paid, 0)

  // Antigüedad de saldos por cliente.
  const byCustomer = new Map<string, { name: string; buckets: Record<(typeof AGING_BUCKETS)[number], number>; total: number }>()
  for (const s of open) {
    const row = byCustomer.get(s.customerId) ?? {
      name: s.customerName,
      buckets: Object.fromEntries(AGING_BUCKETS.map((b) => [b, 0])) as Record<(typeof AGING_BUCKETS)[number], number>,
      total: 0,
    }
    row.buckets[agingBucket(s.daysOverdue)] += s.balance
    row.total += s.balance
    byCustomer.set(s.customerId, row)
  }
  const aging = [...byCustomer.values()].sort((a, b) => b.total - a.total)
  const bucketTotals = AGING_BUCKETS.map((b) => aging.reduce((t, r) => t + r.buckets[b], 0))

  return (
    <>
      <PageHeader
        title="Cobranza"
        description="Cuentas por cobrar y antigüedad de saldos. El dinero cobrado no se presenta como utilidad."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Cuentas por cobrar" value={formatMoney(receivable)} hint={`${formatNumber(open.length)} ventas con saldo`} icon={HandCoins} />
        <KpiCard label="Vencido" value={formatMoney(overdue)} hint={receivable > 0 ? `${formatNumber((overdue / receivable) * 100)} % del saldo` : undefined} icon={TriangleAlert} />
        <KpiCard label="Dinero cobrado" value={formatMoney(collected)} hint="Pagos aplicados a ventas vigentes" icon={CircleDollarSign} />
      </div>

      {open.length === 0 ? (
        <EmptyState icon={HandCoins} title="Sin saldos pendientes" description="Todas las ventas vigentes están liquidadas." />
      ) : (
        <div className="mb-6 grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Antigüedad de saldos por cliente</CardTitle>
              <CardDescription>Días transcurridos desde el vencimiento de cada venta.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      {AGING_BUCKETS.map((b) => (
                        <TableHead key={b} className="hidden text-right md:table-cell">
                          {AGING_LABELS[b]}
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aging.map((r) => (
                      <TableRow key={r.name}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        {AGING_BUCKETS.map((b) => (
                          <TableCell
                            key={b}
                            className={cn("hidden text-right tabular-nums md:table-cell", b !== "corriente" && r.buckets[b] > 0 && "text-destructive")}
                          >
                            {r.buckets[b] ? formatMoney(r.buckets[b]) : "—"}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-medium tabular-nums">{formatMoney(r.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-medium">Total</TableCell>
                      {bucketTotals.map((t, i) => (
                        <TableCell key={AGING_BUCKETS[i]} className="hidden text-right font-semibold tabular-nums md:table-cell">
                          {formatMoney(t)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-semibold tabular-nums">{formatMoney(receivable)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ventas con saldo</CardTitle>
              <CardDescription>Ordenadas por vencimiento.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {open.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <Link href={`/ventas/${s.id}`} className="font-medium hover:underline">
                        {s.code} · {s.customerName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Vence {formatDate(s.dueDate)}
                        {s.daysOverdue > 0 && <span className="text-destructive"> · vencida hace {formatNumber(s.daysOverdue)} días</span>}
                        {" · "}cobrado {formatMoney(s.paid)} de {formatMoney(s.total)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold tabular-nums">{formatMoney(s.balance)}</span>
                      {canPay && (
                        <PaymentDialog saleId={s.id} saleCode={s.code} saleDate={s.saleDate} balance={s.balance} size="sm" />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pagos recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
          ) : (
            <ul className="divide-y">
              {payments.map((p) => (
                <li key={p.id} className={cn("flex items-center justify-between gap-3 py-2 text-sm", p.status === "cancelado" && "opacity-60")}>
                  <div className="min-w-0">
                    <Link href={`/ventas/${p.sale.id}`} className="font-medium hover:underline">
                      {p.sale.code} · {p.sale.customer.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(p.payment_date)} · {PAYMENT_METHOD_LABELS[p.method]}
                      {p.reference && ` · ${p.reference}`}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">
                    {p.status === "cancelado" && (
                      <Badge variant="outline" className="mr-2">
                        Cancelado
                      </Badge>
                    )}
                    {formatMoney(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  )
}
