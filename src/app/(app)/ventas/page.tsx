import { CircleDollarSign, HandCoins, Percent, Plus, ShoppingCart, TriangleAlert } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterBar } from "@/components/shared/filter-bar"
import { KpiCard } from "@/components/shared/kpi-card"
import { NoAccess } from "@/components/shared/no-access"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SalesTable } from "@/features/sales/components/sales-table"
import { getSales } from "@/features/sales/queries"
import { collectionSummary, isActiveSale } from "@/features/sales/schemas"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"
import { dateParam } from "@/lib/search-params"

export const metadata: Metadata = { title: "Ventas" }

export default async function SalesPage({ searchParams }: PageProps<"/ventas">) {
  const ctx = await getOrgContext()
  if (!can(ctx.role, "finance.read")) return <NoAccess title="Ventas" />
  const sp = await searchParams
  const filters = { from: dateParam(sp.desde), to: dateParam(sp.hasta) }
  const sales = await getSales(filters)
  const active = sales.filter((s) => isActiveSale(s.status))
  const summary = collectionSummary(active)
  const overdue = active.filter((s) => s.daysOverdue > 0)
  const drafts = sales.filter((s) => s.status === "borrador")

  const newSale = can(ctx.role, "sales.write") && (
    <Button asChild>
      <Link href="/ventas/nueva">
        <Plus aria-hidden /> Nueva venta
      </Link>
    </Button>
  )

  return (
    <>
      <PageHeader
        title="Ventas"
        description="Ventas de producción por lote. El valor vendido y lo efectivamente cobrado se reportan por separado."
        actions={newSale}
      />
      <div className="mb-6">
        <FilterBar action="/ventas" from={filters.from} to={filters.to} preserve={[]} />
      </div>
      {sales.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={filters.from || filters.to ? "Sin ventas en el periodo" : "Aún no hay ventas registradas"}
          description="Registra cortes en Producción y clientes para vender los lotes disponibles."
          action={newSale}
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total vendido"
              value={formatMoney(summary.total)}
              hint={`${formatNumber(active.length)} ventas confirmadas${drafts.length ? ` · ${formatNumber(drafts.length)} borradores` : ""}`}
              icon={ShoppingCart}
            />
            <KpiCard
              label="Total pagado"
              value={formatMoney(summary.paid)}
              hint={summary.lastPaymentDate ? `Último pago: ${formatDate(summary.lastPaymentDate)}` : "Sin pagos"}
              icon={CircleDollarSign}
              tone="positive"
            />
            <KpiCard
              label="Saldo pendiente"
              value={formatMoney(summary.balance)}
              hint={
                overdue.length
                  ? `Vencido: ${formatMoney(overdue.reduce((t, s) => t + s.balance, 0))} (${formatNumber(overdue.length)} ventas)`
                  : "Sin saldos vencidos"
              }
              icon={overdue.length ? TriangleAlert : HandCoins}
              tone={overdue.length ? "warning" : "default"}
            />
            <KpiCard
              label="Recuperación"
              value={summary.recoveryPct !== null ? `${formatNumber(summary.recoveryPct)} %` : "—"}
              hint="Pagado ÷ vendido"
              icon={Percent}
            />
          </div>
          <Card>
            <CardContent>
              <SalesTable sales={sales} />
            </CardContent>
          </Card>
        </>
      )}
    </>
  )
}
