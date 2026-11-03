import { ArrowLeft, Ban, CheckCircle2, Pencil, Undo2, X } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { ConfirmAction } from "@/components/shared/confirm-action"
import { NoAccess } from "@/components/shared/no-access"
import { ReasonDialog } from "@/components/shared/reason-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EvidenceDialog } from "@/features/fieldlogs/components/evidence"
import { QUALITY_LABELS, UNIT_SHORT } from "@/features/harvests/schemas"
import { getActiveMembers } from "@/features/projects/queries"
import { isClosed } from "@/features/projects/status"
import {
  cancelAdvanceApplication,
  cancelDelivery,
  cancelPayment,
  cancelSale,
  confirmSale,
} from "@/features/sales/actions"
import { ApplyAdvanceDialog } from "@/features/sales/components/advance-dialog"
import { DeliveryDialog } from "@/features/sales/components/delivery-dialog"
import { PaymentDialog } from "@/features/sales/components/payment-dialog"
import { SaleStatusBadge } from "@/features/sales/components/sale-status-badge"
import { TraceTable } from "@/features/sales/components/trace-table"
import { getLotTrace, getSale } from "@/features/sales/queries"
import {
  DELIVERY_STATE_LABELS,
  isActiveSale,
  PAYMENT_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  type DeliveryState,
} from "@/features/sales/schemas"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatDate, formatDateTime, formatMoney, formatNumber, todayISO } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Venta" }

const n = (v: number | string | null) => Number(v ?? 0)
const cents = (v: number) => Math.round(v * 100) / 100

export default async function SalePage({ params }: PageProps<"/ventas/[id]">) {
  const { id } = await params
  const ctx = await getOrgContext()
  if (!can(ctx.role, "finance.read")) return <NoAccess title="Venta" />
  const [sale, trace, members] = await Promise.all([getSale(id), getLotTrace({ saleId: id }), getActiveMembers()])
  const names = new Map(members.map((m) => [m.id, m.name]))
  const who = (userId: string | null) => (userId ? (names.get(userId) ?? "Usuario sin acceso") : "—")

  const canSell = can(ctx.role, "sales.write")
  const canPay = can(ctx.role, "payments.write")
  const active = isActiveSale(sale.status)
  const draft = sale.status === "borrador"
  const total = n(sale.total)
  const paid = n(sale.amount_paid)
  const advance = n(sale.advance_balance)
  const balance = active ? cents(total - paid) : 0
  const collectible = cents(total - paid - advance)
  const recovery = active && total > 0 ? Math.round((paid / total) * 1000) / 10 : null
  const overdueDays =
    balance > 0 && sale.due_date < todayISO()
      ? Math.round((Date.parse(todayISO()) - Date.parse(sale.due_date)) / 86_400_000)
      : 0
  const projectsClosed = sale.sale_items.some((i) => isClosed(i.project.status))
  const pendingItems = sale.sale_items
    .map((i) => ({
      id: i.id,
      description: i.description,
      lotCode: i.harvest?.lot_code ?? null,
      unit: i.unit,
      pending: Math.round((n(i.quantity) - n(i.delivered_quantity)) * 1000) / 1000,
    }))
    .filter((i) => i.pending > 0)
  const deliveryState: DeliveryState | null = !active
    ? null
    : pendingItems.length === 0
      ? "entregada"
      : sale.sale_items.some((i) => n(i.delivered_quantity) > 0)
        ? "parcial"
        : "pendiente"
  const totalKg = sale.sale_items.reduce((s, i) => s + n(i.quantity_kg), 0)
  const appliedPayments = sale.payments.filter((p) => p.status === "aplicado")
  const lastPayment = appliedPayments.map((p) => p.payment_date).sort().at(-1) ?? null
  const paymentsById = new Map(sale.payments.map((p) => [p.id, p]))
  const canCancel =
    canSell && sale.status !== "cancelada" && paid === 0 && advance === 0 && (draft || !projectsClosed)

  // Historial de la venta en orden cronológico inverso.
  const history = [
    { at: sale.created_at, text: `Venta registrada como borrador`, by: sale.created_by },
    ...(sale.confirmed_at ? [{ at: sale.confirmed_at, text: "Venta confirmada; se descontaron los lotes", by: sale.confirmed_by }] : []),
    ...sale.sale_deliveries.flatMap((d) => [
      { at: d.created_at, text: `Entrega del ${formatDate(d.delivery_date)}${d.received_by ? ` · recibió ${d.received_by}` : ""}`, by: d.created_by },
      ...(d.cancelled_at ? [{ at: d.cancelled_at, text: `Entrega cancelada: ${d.cancel_reason}`, by: null }] : []),
    ]),
    ...sale.payments.flatMap((p) => [
      { at: p.created_at, text: `${PAYMENT_KIND_LABELS[p.kind]} de ${formatMoney(p.amount)} (${PAYMENT_METHOD_LABELS[p.method]})`, by: p.created_by },
      ...(p.cancelled_at ? [{ at: p.cancelled_at, text: `${PAYMENT_KIND_LABELS[p.kind]} de ${formatMoney(p.amount)} cancelado: ${p.cancel_reason}`, by: null }] : []),
    ]),
    ...sale.advance_applications.flatMap((a) => [
      { at: a.created_at, text: `Anticipo aplicado al saldo: ${formatMoney(a.amount)}`, by: a.created_by },
      ...(a.cancelled_at ? [{ at: a.cancelled_at, text: `Aplicación revertida: ${a.cancel_reason}`, by: null }] : []),
    ]),
    ...(sale.cancelled_at ? [{ at: sale.cancelled_at, text: `Venta cancelada: ${sale.cancel_reason}`, by: sale.cancelled_by }] : []),
  ].sort((a, b) => b.at.localeCompare(a.at))

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
                title={draft ? "Cancelar borrador" : "Cancelar venta"}
                description={
                  draft
                    ? `${sale.code} quedará cancelada; el borrador no había descontado producto.`
                    : `${sale.code} dejará de contar como venta y sus ${formatNumber(totalKg, "kg")} regresarán a sus lotes con un movimiento de reversión. Si el producto ya se entregó y no regresó, registra después la merma correspondiente.`
                }
                confirmLabel="Cancelar venta"
                action={cancelSale.bind(null, sale.id)}
                trigger={
                  <Button variant="outline">
                    <Ban aria-hidden /> Cancelar
                  </Button>
                }
              />
            )}
            {draft && canSell && (
              <>
                <Button asChild variant="outline">
                  <Link href={`/ventas/${sale.id}/editar`}>
                    <Pencil aria-hidden /> Editar borrador
                  </Link>
                </Button>
                <ConfirmAction
                  title="Confirmar venta"
                  description={`Se descontarán ${formatNumber(totalKg, "kg")} de los lotes de la venta y pasará a cuentas por cobrar con vencimiento el ${formatDate(sale.due_date)}. Si otro usuario vendió antes esa producción, la confirmación se rechaza.`}
                  confirmLabel="Confirmar venta"
                  destructive={false}
                  action={confirmSale.bind(null, sale.id)}
                  trigger={
                    <Button>
                      <CheckCircle2 aria-hidden /> Confirmar venta
                    </Button>
                  }
                />
              </>
            )}
            {active && canSell && pendingItems.length > 0 && (
              <DeliveryDialog saleId={sale.id} saleDate={sale.sale_date} items={pendingItems} />
            )}
            {canPay && (draft || active) && collectible > 0 && (
              <PaymentDialog
                organizationId={ctx.organization.id}
                saleId={sale.id}
                saleCode={sale.code}
                saleDate={sale.sale_date}
                collectible={collectible}
                draft={draft}
              />
            )}
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
      {draft && (
        <Card className="mb-4 border-dashed">
          <CardContent className="text-sm text-muted-foreground">
            Borrador: aún no descuenta producto ni genera cuenta por cobrar. Puede recibir anticipos, que se aplican al saldo
            después de confirmar.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Productos y lotes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto · lote</TableHead>
                      <TableHead className="hidden md:table-cell">Origen</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Precio</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sale.sale_items.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>
                          <p className="font-medium">{i.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {i.harvest ? (
                              <Link href={`/produccion/lotes/${i.harvest.id}`} className="hover:underline">
                                {i.harvest.lot_code}
                              </Link>
                            ) : (
                              "Varios lotes (ver trazabilidad)"
                            )}
                            {i.quality && ` · ${QUALITY_LABELS[i.quality]}`}
                          </p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Link href={`/proyectos/${i.project.id}`} className="hover:underline">
                            {i.project.code}
                          </Link>
                          {i.harvest && <p className="text-xs text-muted-foreground">{i.harvest.assignment.plot.name}</p>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(i.quantity, UNIT_SHORT[i.unit])}
                          <span className="block text-xs text-muted-foreground">
                            {i.unit !== "kg" && `${formatNumber(i.quantity_kg, "kg")} · `}
                            {active && `entregado ${formatNumber(i.delivered_quantity)}`}
                          </span>
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatMoney(i.unit_price)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(i.amount)}
                          {n(i.discount) > 0 && (
                            <span className="block text-xs font-normal text-muted-foreground">
                              {formatMoney(i.gross_amount)} − {formatMoney(i.discount)}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2} className="hidden md:table-cell">
                        Subtotal {formatMoney(sale.subtotal)} · descuentos {formatMoney(sale.discount)}
                      </TableCell>
                      <TableCell className="md:hidden">Total</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatNumber(totalKg, "kg")}</TableCell>
                      <TableCell className="hidden sm:table-cell" />
                      <TableCell className="text-right font-semibold tabular-nums">{formatMoney(total)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>

          {trace.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Trazabilidad</CardTitle>
                <CardDescription>Lote, parcela y proyecto que originaron cada salida de producto.</CardDescription>
              </CardHeader>
              <CardContent>
                <TraceTable rows={trace} hide={["sale", "customer"]} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Pagos y anticipos</CardTitle>
              <CardDescription>
                Nunca se eliminan: un movimiento cancelado se conserva y restituye el saldo. Los anticipos cuentan como
                pagado solo al aplicarse.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sale.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
              ) : (
                <ul className="divide-y">
                  {sale.payments.map((p) => {
                    const pendingAdvance = p.kind === "anticipo" ? cents(n(p.amount) - n(p.applied_amount)) : 0
                    return (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                        <div className={cn("min-w-0", p.status === "cancelado" && "opacity-60")}>
                          <p className="font-medium">
                            {formatMoney(p.amount)} · {PAYMENT_METHOD_LABELS[p.method]}
                            <Badge variant={p.kind === "anticipo" ? "secondary" : "outline"} className="ml-2">
                              {PAYMENT_KIND_LABELS[p.kind]}
                            </Badge>
                            {p.status === "cancelado" && (
                              <Badge variant="outline" className="ml-1">
                                Cancelado
                              </Badge>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(p.payment_date)}
                            {p.reference && ` · Ref. ${p.reference}`} · registró {who(p.created_by)}
                            {p.kind === "anticipo" &&
                              p.status === "aplicado" &&
                              ` · aplicado ${formatMoney(p.applied_amount)}, pendiente ${formatMoney(pendingAdvance)}`}
                            {p.cancel_reason && ` · Motivo: ${p.cancel_reason}`}
                          </p>
                          {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          {p.status === "aplicado" && pendingAdvance > 0 && canPay && active && balance > 0 && (
                            <ApplyAdvanceDialog
                              paymentId={p.id}
                              paymentDate={p.payment_date}
                              pending={pendingAdvance}
                              balance={balance}
                            />
                          )}
                          <EvidenceDialog
                            organizationId={ctx.organization.id}
                            entity="payment"
                            entityId={p.id}
                            title={`${PAYMENT_KIND_LABELS[p.kind]} de ${formatMoney(p.amount)} · ${formatDate(p.payment_date)}`}
                            canAdd={canPay}
                          />
                          {p.status === "aplicado" && canPay && n(p.applied_amount) === 0 && (
                            <ReasonDialog
                              title={`Cancelar ${PAYMENT_KIND_LABELS[p.kind].toLowerCase()}`}
                              description={
                                p.kind === "anticipo"
                                  ? `El anticipo de ${formatMoney(p.amount)} dejará de estar disponible para aplicarse. Queda en el historial.`
                                  : `El pago de ${formatMoney(p.amount)} dejará de aplicarse y el saldo de la venta aumentará en ese importe. Queda en el historial.`
                              }
                              confirmLabel="Cancelar"
                              action={cancelPayment.bind(null, p.id)}
                              trigger={
                                <Button variant="ghost" size="icon" aria-label={`Cancelar ${PAYMENT_KIND_LABELS[p.kind].toLowerCase()} de ${formatMoney(p.amount)}`}>
                                  <X aria-hidden />
                                </Button>
                              }
                            />
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              {sale.advance_applications.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <p className="mb-2 text-sm font-medium">Aplicaciones de anticipos</p>
                  <ul className="divide-y">
                    {sale.advance_applications.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <div className={cn(a.status === "cancelado" && "opacity-60")}>
                          <p>
                            {formatMoney(a.amount)} aplicados el {formatDate(a.application_date)}
                            {a.status === "cancelado" && (
                              <Badge variant="outline" className="ml-2">
                                Revertida
                              </Badge>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Anticipo del {formatDate(paymentsById.get(a.payment_id)?.payment_date ?? null)} · registró {who(a.created_by)}
                            {a.cancel_reason && ` · Motivo: ${a.cancel_reason}`}
                          </p>
                        </div>
                        {a.status === "aplicado" && canPay && (
                          <ReasonDialog
                            title="Revertir aplicación"
                            description={`${formatMoney(a.amount)} dejarán de contar como pagado y volverán al anticipo pendiente.`}
                            confirmLabel="Revertir"
                            action={cancelAdvanceApplication.bind(null, a.id)}
                            trigger={
                              <Button variant="ghost" size="icon" aria-label="Revertir aplicación">
                                <Undo2 aria-hidden />
                              </Button>
                            }
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {active || sale.sale_deliveries.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Entregas</CardTitle>
                <CardDescription>
                  {deliveryState ? DELIVERY_STATE_LABELS[deliveryState] : "Sin entregas vigentes"}
                  {sale.delivery_date && ` · entrega programada el ${formatDate(sale.delivery_date)}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sale.sale_deliveries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin entregas registradas.</p>
                ) : (
                  <ul className="divide-y">
                    {sale.sale_deliveries.map((d) => (
                      <li key={d.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                        <div className={cn(d.status === "cancelado" && "opacity-60")}>
                          <p className="font-medium">
                            {formatDate(d.delivery_date)}
                            {d.status === "cancelado" && (
                              <Badge variant="outline" className="ml-2">
                                Cancelada
                              </Badge>
                            )}
                          </p>
                          <ul className="text-xs text-muted-foreground">
                            {d.sale_delivery_items.map((di) => {
                              const item = sale.sale_items.find((i) => i.id === di.sale_item_id)
                              return (
                                <li key={di.sale_item_id}>
                                  {formatNumber(di.quantity, item ? UNIT_SHORT[item.unit] : undefined)} · {item?.description}
                                  {item?.harvest && ` (${item.harvest.lot_code})`}
                                </li>
                              )
                            })}
                          </ul>
                          <p className="text-xs text-muted-foreground">
                            {[d.received_by && `Recibió ${d.received_by}`, d.transport, d.notes, d.cancel_reason && `Motivo: ${d.cancel_reason}`]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        {d.status === "registrado" && canSell && sale.status !== "cancelada" && (
                          <ReasonDialog
                            title="Cancelar entrega"
                            description="Lo entregado en este viaje volverá a quedar pendiente. La entrega se conserva en el historial."
                            confirmLabel="Cancelar entrega"
                            action={cancelDelivery.bind(null, d.id)}
                            trigger={
                              <Button variant="ghost" size="icon" aria-label={`Cancelar entrega del ${formatDate(d.delivery_date)}`}>
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
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Historial</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-3 border-l pl-5">
                {history.map((h, i) => (
                  <li key={`${h.at}-${i}`} className="relative text-sm">
                    <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-primary" aria-hidden />
                    <p>{h.text}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(h.at)}
                      {h.by && ` · ${who(h.by)}`}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Saldo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <SaleStatusBadge status={sale.status} />
                {deliveryState && sale.status !== "entregada" && (
                  <Badge variant="outline">{DELIVERY_STATE_LABELS[deliveryState]}</Badge>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="text-right tabular-nums">{formatMoney(sale.subtotal)}</dd>
                <dt className="text-muted-foreground">Descuentos</dt>
                <dd className="text-right tabular-nums">−{formatMoney(sale.discount)}</dd>
                <dt className="font-medium">Total vendido</dt>
                <dd className="text-right font-medium tabular-nums">{formatMoney(total)}</dd>
                <dt className="text-muted-foreground">Total pagado</dt>
                <dd className="text-right tabular-nums">{formatMoney(paid)}</dd>
                {advance > 0 && (
                  <>
                    <dt className="text-muted-foreground">Anticipos sin aplicar</dt>
                    <dd className="text-right tabular-nums">{formatMoney(advance)}</dd>
                  </>
                )}
                <dt className="font-medium">Saldo pendiente</dt>
                <dd className="text-right text-lg font-semibold tabular-nums">{formatMoney(balance)}</dd>
                <dt className="text-muted-foreground">Recuperación</dt>
                <dd className="text-right tabular-nums">{recovery !== null ? `${formatNumber(recovery)} %` : "—"}</dd>
                <dt className="text-muted-foreground">Último pago</dt>
                <dd className="text-right">{formatDate(lastPayment)}</dd>
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
              <Link href={`/clientes/${sale.customer.id}`} className="font-medium hover:underline">
                {sale.customer.name}
              </Link>
              {sale.customer.rfc && <p className="text-muted-foreground">RFC {sale.customer.rfc}</p>}
              {sale.customer.contact_name && (
                <p className="text-muted-foreground">
                  {sale.customer.contact_name}
                  {sale.customer.phone && ` · ${sale.customer.phone}`}
                </p>
              )}
              <p className="text-muted-foreground">
                {sale.customer.credit_days ? `${sale.customer.credit_days} días de crédito` : "Contado"}
              </p>
              {sale.notes && <p className="mt-3 whitespace-pre-line">{sale.notes}</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
