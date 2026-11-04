import "server-only"

import { notFound } from "next/navigation"

import { getOrgContext } from "@/lib/auth/session"
import { LIST_LIMIT } from "@/lib/list-limit"
import { fetchRows } from "@/lib/supabase/rows"
import { createClient } from "@/lib/supabase/server"
import type { DeliveryState, PaymentState } from "./schemas"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const n = (v: number | string | null | undefined) => (v === null || v === undefined ? 0 : Number(v))

export type SaleFilters = { from?: string; to?: string; customerId?: string }

/** Ventas con saldo, estado de pago y de entrega (vista v_sale_balances). */
export async function getSales(filters: SaleFilters = {}) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase
    .from("v_sale_balances")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .order("sale_date", { ascending: false })
    .order("code", { ascending: false })
  if (filters.from) query = query.gte("sale_date", filters.from)
  if (filters.to) query = query.lte("sale_date", filters.to)
  if (filters.customerId) query = query.eq("customer_id", filters.customerId)
  // Sin límite práctico: la cobranza suma todas las ventas (en páginas de 1,000).
  const { data, error } = await fetchRows(query.order("id"), 50_000)
  if (error || !data) throw new Error("No fue posible cargar las ventas.")
  return data.map((s) => ({
    id: s.id!,
    code: s.code!,
    customerId: s.customer_id!,
    customerName: s.customer_name!,
    saleDate: s.sale_date!,
    dueDate: s.due_date!,
    deliveryDate: s.delivery_date,
    status: s.status!,
    subtotal: n(s.subtotal),
    discount: n(s.discount),
    total: n(s.total),
    paid: n(s.amount_paid),
    advance: n(s.advance_balance),
    balance: n(s.balance),
    paymentState: s.payment_status as PaymentState,
    deliveryState: s.delivery_status as DeliveryState | null,
    daysOverdue: n(s.days_overdue),
    recoveryPct: s.recovery_pct === null ? null : Number(s.recovery_pct),
    lastPaymentDate: s.last_payment_date,
    totalKg: n(s.total_kg),
  }))
}

export async function getSale(id: string) {
  if (!UUID_REGEX.test(id)) notFound()
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("sales")
    .select(
      `id, code, sale_date, due_date, delivery_date, status, subtotal, discount, total, amount_paid, advance_balance, notes,
       cancel_reason, cancelled_at, cancelled_by, confirmed_at, confirmed_by, created_at, created_by,
       customer:customers!inner(id, name, rfc, credit_days, contact_name, phone),
       sale_items(id, description, quality, unit, quantity, unit_weight_kg, quantity_kg, unit_price, gross_amount, discount,
         amount, delivered_quantity,
         harvest:harvests(id, lot_code, harvest_date, available_kg, assignment:project_plots!inner(plot:plots!inner(name))),
         project:projects!inner(id, code, name, status)),
       payments(id, kind, payment_date, amount, applied_amount, method, reference, notes, status, cancel_reason, cancelled_at,
         created_at, created_by),
       advance_applications(id, payment_id, application_date, amount, status, cancel_reason, cancelled_at, created_at, created_by),
       sale_deliveries(id, delivery_date, received_by, transport, notes, status, cancel_reason, cancelled_at, created_at, created_by,
         sale_delivery_items(sale_item_id, quantity))`
    )
    .eq("organization_id", ctx.organization.id)
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error("No fue posible cargar la venta.")
  if (!data) notFound()
  const byDateDesc = <T extends { created_at: string }>(rows: T[], date: (r: T) => string) =>
    rows.sort((a, b) => date(b).localeCompare(date(a)) || b.created_at.localeCompare(a.created_at))
  return {
    ...data,
    payments: byDateDesc(data.payments, (p) => p.payment_date),
    advance_applications: byDateDesc(data.advance_applications, (a) => a.application_date),
    sale_deliveries: byDateDesc(data.sale_deliveries, (d) => d.delivery_date),
  }
}

/**
 * Trazabilidad comercial: de qué lote, parcela y proyecto salió cada venta.
 * Solo la ven los roles con lectura financiera (RLS de ventas).
 */
export async function getLotTrace(filter: { saleId?: string; harvestId?: string; projectId?: string; customerId?: string }) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase
    .from("v_sale_lot_trace")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .order("sale_date", { ascending: false })
    .order("lot_code")
  if (filter.saleId) query = query.eq("sale_id", filter.saleId)
  if (filter.harvestId) query = query.eq("harvest_id", filter.harvestId)
  if (filter.projectId) query = query.eq("project_id", filter.projectId)
  if (filter.customerId) query = query.eq("customer_id", filter.customerId)
  const { data, error } = await query
  if (error) throw new Error("No fue posible cargar la trazabilidad.")
  return data.map((t) => ({
    movementId: t.movement_id!,
    saleId: t.sale_id!,
    saleCode: t.sale_code!,
    saleStatus: t.sale_status!,
    saleDate: t.sale_date!,
    customerId: t.customer_id!,
    customerName: t.customer_name!,
    saleItemId: t.sale_item_id!,
    description: t.description!,
    harvestId: t.harvest_id!,
    lotCode: t.lot_code!,
    harvestDate: t.harvest_date!,
    quality: t.quality!,
    cutNumber: t.cut_number!,
    projectId: t.project_id!,
    projectCode: t.project_code!,
    plotName: t.plot_name!,
    farmName: t.farm_name!,
    quantityKg: n(t.quantity_kg),
    amount: n(t.amount),
    reversed: Boolean(t.reversed),
  }))
}

export async function getActiveCustomers() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, credit_days")
    .eq("organization_id", ctx.organization.id)
    .eq("is_active", true)
    .order("name")
  if (error) throw new Error("No fue posible cargar los clientes.")
  return data
}

export type PaymentFilters = SaleFilters & { kind?: "pago" | "anticipo"; includeCancelled?: boolean; saleIds?: string[] }

/** Pagos y anticipos (los cancelados se conservan). */
export async function getPayments(filters: PaymentFilters = {}, limit = LIST_LIMIT) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase
    .from("payments")
    .select(
      `id, kind, payment_date, amount, applied_amount, method, reference, notes, status, cancel_reason, created_at, created_by,
       sale:sales!inner(id, code, status, customer_id, customer:customers!inner(id, name))`
    )
    .eq("organization_id", ctx.organization.id)
  if (filters.from) query = query.gte("payment_date", filters.from)
  if (filters.to) query = query.lte("payment_date", filters.to)
  if (filters.customerId) query = query.eq("sale.customer_id", filters.customerId)
  if (filters.kind) query = query.eq("kind", filters.kind)
  if (filters.saleIds) query = query.in("sale_id", filters.saleIds)
  if (!filters.includeCancelled) query = query.eq("status", "aplicado")
  const { data, error } = await fetchRows(
    query.order("payment_date", { ascending: false }).order("created_at", { ascending: false }).order("id"),
    limit
  )
  if (error) throw new Error("No fue posible cargar los pagos.")
  return data
}

/** Anticipos vigentes con importe pendiente de aplicar. */
export async function getPendingAdvances() {
  const rows = await getPayments({ kind: "anticipo" })
  return rows
    .map((p) => ({ ...p, pending: Math.round((n(p.amount) - n(p.applied_amount)) * 100) / 100 }))
    .filter((p) => p.pending > 0)
}

export type SaleListItem = Awaited<ReturnType<typeof getSales>>[number]
export type SaleDetail = Awaited<ReturnType<typeof getSale>>
export type LotTraceRow = Awaited<ReturnType<typeof getLotTrace>>[number]
export type CustomerOption = Awaited<ReturnType<typeof getActiveCustomers>>[number]
export type PaymentRow = Awaited<ReturnType<typeof getPayments>>[number]
export type PendingAdvance = Awaited<ReturnType<typeof getPendingAdvances>>[number]
