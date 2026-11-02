import { ArrowLeft, Ban, X } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { ReasonDialog } from "@/components/shared/reason-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { QUALITY_LABELS } from "@/features/harvests/schemas"
import { isClosed } from "@/features/projects/status"
import { cancelPayment, cancelSale } from "@/features/sales/actions"
import { PaymentDialog } from "@/features/sales/components/payment-dialog"
import { PaymentStateBadge } from "@/features/sales/components/payment-state-badge"
import { getSale } from "@/features/sales/queries"
import { PAYMENT_METHOD_LABELS, type PaymentState } from "@/features/sales/schemas"
import { NoAccess } from "@/components/shared/no-access"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatDate, formatDateTime, formatMoney, formatNumber, todayISO } from "@/lib/format"

export const metadata: Metadata = { title: "Venta" }

export default async function SalePage({ params }: PageProps<"/ventas/[id]">) {
  const { id } = await params
  const ctx = await getOrgContext()
  if (!can(ctx.role, "finance.read")) return <NoAccess title="Venta" />
  const sale = await getSale(id)

  const total = Number(sale.total)
  const paid = Number(sale.amount_paid)
  const balance = sale.status === "vigente" ? Math.round((total - paid) * 100) / 100 : 0
  const state: PaymentState =
    sale.status === "cancelada" ? "cancelada" : paid === 0 ? "pendiente" : paid < total ? "parcial" : "pagada"
  const overdueDays =
    balance > 0 && sale.due_date < todayISO()
      ? Math.round((Date.parse(todayISO()) - Date.parse(sale.due_date)) / 86_400_000)
      : 0
  const canPay = can(ctx.role, "payments.write") && sale.status === "vigente" && balance > 0
  const projectsClosed = sale.sale_items.some((i) => isClosed(i.project.status))
  const canCancel = can(ctx.role, "sales.write") && sale.status === "vigente" && paid === 0 && !projectsClosed
  const totalKg = sale.sale_items.reduce((s, i) => s + Number(i.quantity_kg), 0)

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/ventas">
          <ArrowLeft aria-hidden /> Ventas
        </Link>
      </Button>
      <PageHeader
        title={`Venta ${sale.code}`}
        description={`${sale.customer.name} · ${formatDate(sale.sale_date)}`}
        actions={
          <>
            {canCancel && (
              <ReasonDialog
                title="Cancelar venta"
                description={`${sale.code} dejará de contar como venta y sus ${formatNumber(totalKg, "kg")} volverán a estar disponibles.`}
                confirmLabel="Cancelar venta"
                action={cancelSale.bind(null, sale.id)}
                trigger={
                  <Button variant="outline">
                    <Ban aria-hidden /> Cancelar venta
                  </Button>
                }
              />
            )}
            {canPay && <PaymentDialog saleId={sale.id} saleCode={sale.code} saleDate={sale.sale_date} balance={balance} />}
          </>
        }
      />

      {sale.status === "cancelada" && (
        <Card className="mb-4 border-destructive/40 bg-destructive/5">
          <CardContent className="text-sm">
            <p className="font-medium text-destructive">Venta cancelada el {formatDateTime(sale.cancelled_at)}</p>
            {sale.cancel_reason && <p className="text-muted-foreground">“{sale.cancel_reason}”</p>}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Partidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="hidden sm:table-cell">Proyecto</TableHead>
                      <TableHead className="text-right">Kilogramos</TableHead>
                      <TableHead className="hidden text-right md:table-cell">Precio / kg</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sale.sale_items.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>
                          <p className="font-medium">{i.description}</p>
                          {i.quality && <p className="text-xs text-muted-foreground">{QUALITY_LABELS[i.quality]}</p>}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Link href={`/proyectos/${i.project.id}`} className="hover:underline">
                            {i.project.code}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(i.quantity_kg)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums md:table-cell">{formatMoney(i.unit_price)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatMoney(i.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-medium">Total</TableCell>
                      <TableCell className="hidden sm:table-cell" />
                      <TableCell className="text-right font-semibold tabular-nums">{formatNumber(totalKg, "kg")}</TableCell>
                      <TableCell className="hidden md:table-cell" />
                      <TableCell className="text-right font-semibold tabular-nums">{formatMoney(total)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pagos</CardTitle>
              <CardDescription>Un pago cancelado se conserva en el historial y restituye el saldo.</CardDescription>
            </CardHeader>
            <CardContent>
              {sale.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
              ) : (
                <ul className="divide-y">
                  {sale.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div className={p.status === "cancelado" ? "opacity-60" : undefined}>
                        <p className="font-medium">
                          {formatMoney(p.amount)} · {PAYMENT_METHOD_LABELS[p.method]}
                          {p.status === "cancelado" && (
                            <Badge variant="outline" className="ml-2">
                              Cancelado
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(p.payment_date)}
                          {p.reference && ` · ${p.reference}`}
                          {p.cancel_reason && ` · Motivo: ${p.cancel_reason}`}
                        </p>
                      </div>
                      {p.status === "aplicado" && can(ctx.role, "payments.write") && (
                        <ReasonDialog
                          title="Cancelar pago"
                          description={`El pago de ${formatMoney(p.amount)} dejará de aplicarse y el saldo de la venta aumentará en ese importe.`}
                          confirmLabel="Cancelar pago"
                          action={cancelPayment.bind(null, p.id)}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label={`Cancelar pago de ${formatMoney(p.amount)}`}>
                              <X aria-hidden />
                            </Button>
                          }
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Saldo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <PaymentStateBadge state={state} />
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="text-right tabular-nums">{formatMoney(total)}</dd>
                <dt className="text-muted-foreground">Cobrado</dt>
                <dd className="text-right tabular-nums">{formatMoney(paid)}</dd>
                <dt className="font-medium">Saldo pendiente</dt>
                <dd className="text-right text-lg font-semibold tabular-nums">{formatMoney(balance)}</dd>
                <dt className="text-muted-foreground">Vencimiento</dt>
                <dd className="text-right">
                  {formatDate(sale.due_date)}
                  {overdueDays > 0 && <span className="block text-xs text-destructive">Vencida hace {formatNumber(overdueDays)} días</span>}
                </dd>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cliente</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="font-medium">{sale.customer.name}</p>
              {sale.customer.rfc && <p className="text-muted-foreground">RFC {sale.customer.rfc}</p>}
              <p className="text-muted-foreground">
                {sale.customer.credit_days ? `${sale.customer.credit_days} días de crédito` : "Contado"}
              </p>
              {sale.notes && <p className="mt-3 whitespace-pre-line">{sale.notes}</p>}
              <p className="mt-3 text-xs text-muted-foreground">Registrada el {formatDateTime(sale.created_at)}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
