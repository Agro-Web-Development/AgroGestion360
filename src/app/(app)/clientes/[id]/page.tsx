import { ArrowLeft, CircleDollarSign, HandCoins, Pencil, Percent, ShoppingCart } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { KpiCard } from "@/components/shared/kpi-card"
import { NoAccess } from "@/components/shared/no-access"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CustomerFormDialog } from "@/features/customers/components/customer-form-dialog"
import { getCustomer } from "@/features/customers/queries"
import { CUSTOMER_TYPE_LABELS } from "@/features/customers/schemas"
import { PaymentsTable } from "@/features/sales/components/payments-table"
import { SalesTable } from "@/features/sales/components/sales-table"
import { TraceTable } from "@/features/sales/components/trace-table"
import { getLotTrace, getPayments, getSales } from "@/features/sales/queries"
import { collectionSummary, isActiveSale } from "@/features/sales/schemas"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Cliente" }

export default async function CustomerPage({ params }: PageProps<"/clientes/[id]">) {
  const { id } = await params
  const ctx = await getOrgContext()
  if (!can(ctx.role, "finance.read")) return <NoAccess title="Cliente" />
  const [customer, sales, payments, trace] = await Promise.all([
    getCustomer(id),
    getSales({ customerId: id }),
    getPayments({ customerId: id, includeCancelled: true }),
    getLotTrace({ customerId: id }),
  ])
  const active = sales.filter((s) => isActiveSale(s.status))
  const summary = collectionSummary(active)
  const overdue = active.filter((s) => s.daysOverdue > 0).reduce((t, s) => t + s.balance, 0)
  const advances = sales.reduce((t, s) => t + s.advance, 0)
  const kg = active.reduce((t, s) => t + s.totalKg, 0)

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/clientes">
          <ArrowLeft aria-hidden /> Clientes
        </Link>
      </Button>
      <PageHeader
        title={customer.name}
        description={[CUSTOMER_TYPE_LABELS[customer.customer_type], customer.rfc && `RFC ${customer.rfc}`].filter(Boolean).join(" · ")}
        actions={
          can(ctx.role, "sales.write") && (
            <CustomerFormDialog
              customer={{
                id: customer.id,
                name: customer.name,
                customerType: customer.customer_type,
                rfc: customer.rfc ?? "",
                contactName: customer.contact_name ?? "",
                phone: customer.phone ?? "",
                email: customer.email ?? "",
                address: customer.address ?? "",
                creditDays: String(customer.credit_days),
                notes: customer.notes ?? "",
              }}
              trigger={
                <Button variant="outline">
                  <Pencil aria-hidden /> Editar
                </Button>
              }
            />
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total comprado"
          value={formatMoney(summary.total)}
          hint={`${formatNumber(active.length)} ventas · ${formatNumber(kg / 1000, "t")}`}
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
          hint={overdue > 0 ? `Vencido: ${formatMoney(overdue)}` : advances > 0 ? `Anticipos sin aplicar: ${formatMoney(advances)}` : "Sin vencidos"}
          icon={HandCoins}
          tone={overdue > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Recuperación"
          value={summary.recoveryPct !== null ? `${formatNumber(summary.recoveryPct)} %` : "—"}
          hint="Pagado ÷ comprado"
          icon={Percent}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Historial de compras</CardTitle>
            </CardHeader>
            <CardContent>
              <SalesTable sales={sales} showCustomer={false} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pagos y anticipos</CardTitle>
              <CardDescription>Incluye los cancelados, que se conservan en el historial.</CardDescription>
            </CardHeader>
            <CardContent>
              <PaymentsTable payments={payments} organizationId={ctx.organization.id} canAttach={can(ctx.role, "payments.write")} showCustomer={false} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Producto comprado por lote</CardTitle>
              <CardDescription>Lote, parcela y proyecto de origen de cada compra.</CardDescription>
            </CardHeader>
            <CardContent>
              <TraceTable rows={trace} hide={["customer"]} />
            </CardContent>
          </Card>
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Datos del cliente
              <Badge variant={customer.is_active ? "secondary" : "destructive"}>{customer.is_active ? "Activo" : "Inactivo"}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Contacto</dt>
              <dd className="text-right">{customer.contact_name ?? "—"}</dd>
              <dt className="text-muted-foreground">Teléfono</dt>
              <dd className="text-right">{customer.phone ?? "—"}</dd>
              <dt className="text-muted-foreground">Correo</dt>
              <dd className="text-right break-all">{customer.email ?? "—"}</dd>
              <dt className="text-muted-foreground">Dirección</dt>
              <dd className="text-right">{customer.address ?? "—"}</dd>
              <dt className="text-muted-foreground">Crédito</dt>
              <dd className="text-right">{customer.credit_days ? `${customer.credit_days} días` : "Contado"}</dd>
            </dl>
            {customer.notes && <p className="mt-3 text-sm whitespace-pre-line">{customer.notes}</p>}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
