import { CircleDollarSign, HandCoins, Plus, ShoppingCart, TriangleAlert } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { KpiCard } from "@/components/shared/kpi-card"
import { NoAccess } from "@/components/shared/no-access"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SalesTable } from "@/features/sales/components/sales-table"
import { getSales } from "@/features/sales/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatMoney, formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Ventas" }

export default async function SalesPage() {
  const ctx = await getOrgContext()
  if (!can(ctx.role, "finance.read")) return <NoAccess title="Ventas" />
  const sales = await getSales()
  const active = sales.filter((s) => s.status === "vigente")
  const total = active.reduce((t, s) => t + s.total, 0)
  const paid = active.reduce((t, s) => t + s.paid, 0)
  const overdue = active.filter((s) => s.daysOverdue > 0)

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
        description="Ventas de producción cosechada. Lo vendido y lo cobrado se reportan por separado."
        actions={newSale}
      />
      {sales.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Aún no hay ventas registradas"
          description="Registra cortes de cosecha y clientes para vender la producción disponible de cada proyecto."
          action={newSale}
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Ventas registradas" value={formatMoney(total)} hint={`${formatNumber(active.length)} vigentes`} icon={ShoppingCart} />
            <KpiCard label="Dinero cobrado" value={formatMoney(paid)} hint="Pagos aplicados" icon={CircleDollarSign} />
            <KpiCard label="Por cobrar" value={formatMoney(total - paid)} icon={HandCoins} />
            <KpiCard
              label="Vencido"
              value={formatMoney(overdue.reduce((t, s) => t + s.balance, 0))}
              hint={`${formatNumber(overdue.length)} ventas vencidas`}
              icon={TriangleAlert}
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
