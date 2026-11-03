import {
  Boxes,
  Building2,
  CalendarRange,
  CircleDollarSign,
  HandCoins,
  PackageCheck,
  ShoppingCart,
  UserRoundX,
  Wheat,
  type LucideIcon,
} from "lucide-react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { FilterBar } from "@/components/shared/filter-bar"
import { KpiCard } from "@/components/shared/kpi-card"
import { NoAccess } from "@/components/shared/no-access"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCommercialSummary } from "@/features/commercial/queries"
import { monthSeries } from "@/features/commercial/series"
import { BarListChart } from "@/features/dashboard/components/bar-list-chart"
import { ColumnChart } from "@/features/dashboard/components/column-chart"
import { getActiveCrops, getProjects } from "@/features/projects/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatDate, formatMoney, formatNumber, todayISO } from "@/lib/format"
import { dateParam, idParam } from "@/lib/search-params"

export const metadata: Metadata = { title: "Dashboard comercial" }

function ChartCard({
  title,
  description,
  empty,
  children,
}: {
  title: string
  description: string
  empty: boolean
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            Sin registros con los filtros seleccionados.
          </p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}

function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold tracking-tight">
        <Icon className="size-4 text-primary" aria-hidden /> {title}
      </h2>
      {children}
    </section>
  )
}

export default async function CommercialDashboardPage({ searchParams }: PageProps<"/comercial">) {
  const ctx = await getOrgContext()
  if (!can(ctx.role, "finance.read")) return <NoAccess title="Dashboard comercial" />
  const sp = await searchParams
  const today = todayISO()
  const filters = {
    from: dateParam(sp.desde) ?? `${today.slice(0, 4)}-01-01`,
    to: dateParam(sp.hasta) ?? today,
    cropId: idParam(sp.cultivo),
    projectId: idParam(sp.proyecto),
  }
  const [summary, crops, projects] = await Promise.all([getCommercialSummary(filters), getActiveCrops(), getProjects()])
  const salesByMonth = monthSeries(filters.from, filters.to, summary.sales_by_month)
  const collectionsByMonth = monthSeries(filters.from, filters.to, summary.collections_by_month)
  const recovery = summary.sales_total > 0 ? (summary.period_sales_paid / summary.sales_total) * 100 : null

  return (
    <>
      <PageHeader
        title="Dashboard comercial"
        description={`Producción, ventas y cobranza del ${formatDate(filters.from)} al ${formatDate(filters.to)}. Los saldos son al día de hoy.`}
      />
      <div className="mb-6">
        <FilterBar
          action="/comercial"
          from={filters.from}
          to={filters.to}
          preserve={[]}
          selects={[
            {
              name: "cultivo",
              label: "Cultivo",
              value: filters.cropId,
              allLabel: "Todos los cultivos",
              options: crops.map((c) => ({ value: c.id, label: [c.name, c.variety].filter(Boolean).join(" · ") })),
            },
            {
              name: "proyecto",
              label: "Proyecto",
              value: filters.projectId,
              allLabel: "Todos los proyectos",
              options: projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` })),
            },
          ]}
        />
      </div>

      <Section icon={Wheat} title="Producción">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Producción total"
            value={formatNumber(summary.production_kg / 1000, "t")}
            hint={`${formatNumber(summary.cuts)} cortes · ${formatNumber(summary.lots)} lotes`}
            icon={Wheat}
          />
          <KpiCard label="Producción disponible" value={formatNumber(summary.available_kg / 1000, "t")} hint="Existencia actual de esos lotes" icon={Boxes} />
          <KpiCard label="Producción vendida" value={formatNumber(summary.sold_kg / 1000, "t")} hint="Ventas confirmadas" icon={PackageCheck} />
          <KpiCard
            label="Mermas y ajustes"
            value={formatNumber(summary.shrinkage_kg, "kg")}
            hint={summary.production_kg > 0 ? `${formatNumber((summary.shrinkage_kg / summary.production_kg) * 100)} % de lo cosechado` : undefined}
            icon={Boxes}
            tone={summary.shrinkage_kg > 0 ? "warning" : "default"}
          />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ChartCard title="Producción por cultivo" description="Kilogramos cosechados en el periodo." empty={summary.production_by_crop.length === 0}>
            <BarListChart data={summary.production_by_crop} unit="kg" caption="Producción por cultivo" />
          </ChartCard>
          <ChartCard title="Producción por proyecto" description="Kilogramos cosechados en el periodo." empty={summary.production_by_project.length === 0}>
            <BarListChart data={summary.production_by_project.slice(0, 10)} unit="kg" caption="Producción por proyecto" />
          </ChartCard>
        </div>
      </Section>

      <Section icon={ShoppingCart} title="Ventas y cobranza">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Ventas del periodo"
            value={formatMoney(summary.sales_total)}
            hint={`${formatNumber(summary.sales_count)} ventas confirmadas`}
            icon={ShoppingCart}
          />
          <KpiCard label="Ventas del mes" value={formatMoney(summary.sales_month)} hint="Mes en curso" icon={CalendarRange} />
          <KpiCard
            label="Total cobrado"
            value={formatMoney(summary.collected)}
            hint={recovery !== null ? `Pagos aplicados en el periodo · recuperación de sus ventas ${formatNumber(recovery)} %` : "Pagos aplicados en el periodo"}
            icon={CircleDollarSign}
            tone="positive"
          />
          <KpiCard
            label="Total por cobrar"
            value={formatMoney(summary.receivable)}
            hint={summary.overdue > 0 ? `Vencido: ${formatMoney(summary.overdue)}` : "Sin saldos vencidos"}
            icon={HandCoins}
            tone={summary.overdue > 0 ? "warning" : "default"}
          />
          <KpiCard label="Clientes activos" value={formatNumber(summary.customers_active)} icon={Building2} />
          <KpiCard
            label="Clientes con saldo pendiente"
            value={formatNumber(summary.customers_with_balance)}
            hint="Al día de hoy"
            icon={UserRoundX}
            tone={summary.customers_with_balance > 0 ? "warning" : "default"}
          />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ChartCard title="Ventas mensuales" description="Importe vendido (confirmado) por mes." empty={summary.sales_by_month.length === 0}>
            <ColumnChart data={salesByMonth} money caption="Ventas mensuales" />
          </ChartCard>
          <ChartCard
            title="Cobranza por periodo"
            description="Pagos y anticipos aplicados por mes: dinero efectivamente cobrado."
            empty={summary.collections_by_month.length === 0}
          >
            <ColumnChart data={collectionsByMonth} money caption="Cobranza por mes" />
          </ChartCard>
          <ChartCard title="Ventas por cliente" description="Principales clientes del periodo." empty={summary.sales_by_customer.length === 0}>
            <BarListChart data={summary.sales_by_customer} money caption="Ventas por cliente" />
          </ChartCard>
          <ChartCard title="Saldos pendientes" description="Por cliente, al día de hoy." empty={summary.balances_by_customer.length === 0}>
            <BarListChart data={summary.balances_by_customer} money caption="Saldos pendientes por cliente" />
          </ChartCard>
        </div>
      </Section>
    </>
  )
}
