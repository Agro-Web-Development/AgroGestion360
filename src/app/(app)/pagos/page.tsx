import { CalendarCheck, CircleDollarSign, HandCoins, Percent, TriangleAlert, Wallet } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterBar } from "@/components/shared/filter-bar"
import { KpiCard } from "@/components/shared/kpi-card"
import { NoAccess } from "@/components/shared/no-access"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { agingBucket, AGING_BUCKETS, AGING_LABELS } from "@/features/sales/aging"
import { ApplyAdvanceDialog } from "@/features/sales/components/advance-dialog"
import { PaymentDialog } from "@/features/sales/components/payment-dialog"
import { PaymentsTable } from "@/features/sales/components/payments-table"
import { getPayments, getPendingAdvances, getSales } from "@/features/sales/queries"
import { collectionSummary, isActiveSale } from "@/features/sales/schemas"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatDate, formatMoney, formatNumber, todayISO } from "@/lib/format"
import { dateParam } from "@/lib/search-params"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Cobranza" }

export default async function ReceivablesPage({ searchParams }: PageProps<"/pagos">) {
  const ctx = await getOrgContext()
  if (!can(ctx.role, "finance.read")) return <NoAccess title="Cobranza" />
  const canPay = can(ctx.role, "payments.write")
  const sp = await searchParams
  const today = todayISO()
  const range = {
    from: dateParam(sp.desde) ?? new Date(Date.parse(today) - 90 * 86_400_000).toISOString().slice(0, 10),
    to: dateParam(sp.hasta) ?? today,
  }
  const [sales, payments, advances] = await Promise.all([
    getSales(),
    getPayments({ ...range, includeCancelled: true }),
    getPendingAdvances(),
  ])
  const active = sales.filter((s) => isActiveSale(s.status))
  const summary = collectionSummary(active)
  const open = active.filter((s) => s.balance > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const overdue = open.filter((s) => s.daysOverdue > 0)
  const overdueTotal = overdue.reduce((t, s) => t + s.balance, 0)
  const advanceTotal = advances.reduce((t, a) => t + a.pending, 0)
  const salesById = new Map(sales.map((s) => [s.id, s]))
  const receivedInRange = payments
    .filter((p) => p.status === "aplicado" && p.kind === "pago")
    .reduce((t, p) => t + Number(p.amount), 0)

  // Antigüedad de saldos por cliente.
  type Buckets = Record<(typeof AGING_BUCKETS)[number], number>
  const byCustomer = new Map<string, { id: string; name: string; buckets: Buckets; total: number }>()
  for (const s of open) {
    const row = byCustomer.get(s.customerId) ?? {
      id: s.customerId,
      name: s.customerName,
      buckets: Object.fromEntries(AGING_BUCKETS.map((b) => [b, 0])) as Buckets,
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
        description="Pagos, anticipos y cuentas por cobrar. Lo vendido y lo efectivamente cobrado se presentan por separado."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Total vendido" value={formatMoney(summary.total)} hint={`${formatNumber(active.length)} ventas confirmadas`} icon={Wallet} />
        <KpiCard label="Total pagado" value={formatMoney(summary.paid)} hint="Pagos y anticipos aplicados" icon={CircleDollarSign} tone="positive" />
        <KpiCard
          label="Saldo pendiente"
          value={formatMoney(summary.balance)}
          hint={`${formatNumber(open.length)} ventas con saldo`}
          icon={HandCoins}
        />
        <KpiCard
          label="Porcentaje de recuperación"
          value={summary.recoveryPct !== null ? `${formatNumber(summary.recoveryPct)} %` : "—"}
          hint="Pagado ÷ vendido"
          icon={Percent}
        />
        <KpiCard
          label="Vencido"
          value={formatMoney(overdueTotal)}
          hint={summary.balance > 0 ? `${formatNumber((overdueTotal / summary.balance) * 100)} % del saldo · ${formatNumber(overdue.length)} ventas` : undefined}
          icon={TriangleAlert}
          tone={overdueTotal > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Fecha del último pago"
          value={summary.lastPaymentDate ? formatDate(summary.lastPaymentDate) : "—"}
          hint={advanceTotal > 0 ? `Anticipos sin aplicar: ${formatMoney(advanceTotal)}` : "Sin anticipos pendientes"}
          icon={CalendarCheck}
        />
      </div>

      {advances.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Anticipos pendientes de aplicar</CardTitle>
            <CardDescription>
              Dinero recibido que todavía no reduce el saldo. Se aplica de forma explícita cuando la venta está confirmada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {advances.map((a) => {
                const sale = salesById.get(a.sale.id)
                const applicable = sale && isActiveSale(sale.status) && sale.balance > 0
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <Link href={`/ventas/${a.sale.id}`} className="font-medium hover:underline">
                        {a.sale.code} · {a.sale.customer.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Recibido el {formatDate(a.payment_date)} · {formatMoney(a.amount)}
                        {sale?.status === "borrador" && " · la venta sigue en borrador"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold tabular-nums">{formatMoney(a.pending)}</span>
                      {canPay && applicable && (
                        <ApplyAdvanceDialog paymentId={a.id} paymentDate={a.payment_date} pending={a.pending} balance={sale.balance} />
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {open.length === 0 ? (
        <div className="mb-6">
          <EmptyState icon={HandCoins} title="Sin saldos pendientes" description="Todas las ventas confirmadas están liquidadas." />
        </div>
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
                      <TableRow key={r.id}>
                        <TableCell>
                          <Link href={`/clientes/${r.id}`} className="font-medium hover:underline">
                            {r.name}
                          </Link>
                        </TableCell>
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
                      <TableCell className="text-right font-semibold tabular-nums">{formatMoney(summary.balance)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ventas con saldo</CardTitle>
              <CardDescription>Ordenadas por vencimiento; las vencidas se marcan en rojo.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {open.map((s) => {
                  const collectible = Math.round((s.balance - s.advance) * 100) / 100
                  return (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                      <div className="min-w-0">
                        <Link href={`/ventas/${s.id}`} className="font-medium hover:underline">
                          {s.code} · {s.customerName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          Vence {formatDate(s.dueDate)}
                          {s.daysOverdue > 0 && <span className="text-destructive"> · vencida hace {formatNumber(s.daysOverdue)} días</span>}
                          {" · "}pagado {formatMoney(s.paid)} de {formatMoney(s.total)}
                          {s.recoveryPct !== null && ` (${formatNumber(s.recoveryPct)} %)`}
                          {s.lastPaymentDate && ` · último pago ${formatDate(s.lastPaymentDate)}`}
                          {s.advance > 0 && ` · ${formatMoney(s.advance)} en anticipos sin aplicar`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn("font-semibold tabular-nums", s.daysOverdue > 0 && "text-destructive")}>
                          {formatMoney(s.balance)}
                        </span>
                        {canPay && collectible > 0 && (
                          <PaymentDialog
                            organizationId={ctx.organization.id}
                            saleId={s.id}
                            saleCode={s.code}
                            saleDate={s.saleDate}
                            collectible={collectible}
                            size="sm"
                          />
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pagos y anticipos recibidos</CardTitle>
          <CardDescription>
            {formatDate(range.from)} – {formatDate(range.to)} · pagos aplicados en el periodo: {formatMoney(receivedInRange)}. Los
            cancelados se conservan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FilterBar action="/pagos" from={range.from} to={range.to} preserve={[]} />
          <PaymentsTable payments={payments} organizationId={ctx.organization.id} canAttach={canPay} />
        </CardContent>
      </Card>
    </>
  )
}
