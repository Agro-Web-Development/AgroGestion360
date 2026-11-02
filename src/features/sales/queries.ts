import "server-only"

import { notFound } from "next/navigation"

import { getProjectCosts } from "@/features/finance/queries"
import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import type { PaymentState } from "./schemas"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Ventas con saldo y estado de pago (vista v_sale_balances). */
export async function getSales() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("v_sale_balances")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .order("sale_date", { ascending: false })
    .order("code", { ascending: false })
  if (error) throw new Error("No fue posible cargar las ventas.")
  return data.map((s) => ({
    id: s.id!,
    code: s.code!,
    customerId: s.customer_id!,
    customerName: s.customer_name!,
    saleDate: s.sale_date!,
    dueDate: s.due_date!,
    status: s.status!,
    total: Number(s.total),
    paid: Number(s.amount_paid),
    balance: Number(s.balance),
    paymentState: s.payment_status as PaymentState,
    daysOverdue: Number(s.days_overdue),
  }))
}

export async function getSale(id: string) {
  if (!UUID_REGEX.test(id)) notFound()
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("sales")
    .select(
      `id, code, sale_date, due_date, status, total, amount_paid, notes, cancel_reason, cancelled_at, created_at,
       customer:customers!inner(id, name, rfc, credit_days),
       sale_items(id, description, quality, quantity_kg, unit_price, amount, project:projects!inner(id, code, name, status)),
       payments(id, payment_date, amount, method, reference, notes, status, cancel_reason, cancelled_at, created_at)`
    )
    .eq("organization_id", ctx.organization.id)
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error("No fue posible cargar la venta.")
  if (!data) notFound()
  return {
    ...data,
    payments: data.payments.sort((a, b) => b.payment_date.localeCompare(a.payment_date) || b.created_at.localeCompare(a.created_at)),
  }
}

/** Proyectos vigentes con producción cosechada aún no vendida. */
export async function getSaleableProjects() {
  const costs = await getProjectCosts()
  return costs
    .filter((c) => c.status !== "cerrado" && c.status !== "cancelado" && c.availableKg > 0)
    .map((c) => ({ id: c.projectId, code: c.code, name: c.name, availableKg: c.availableKg, costPerKg: c.costPerKg }))
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

export async function getRecentPayments(limit = 30) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("payments")
    .select("id, payment_date, amount, method, reference, status, sale:sales!inner(id, code, customer:customers!inner(name))")
    .eq("organization_id", ctx.organization.id)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error("No fue posible cargar los pagos.")
  return data
}

export type SaleListItem = Awaited<ReturnType<typeof getSales>>[number]
export type SaleDetail = Awaited<ReturnType<typeof getSale>>
export type SaleableProject = Awaited<ReturnType<typeof getSaleableProjects>>[number]
export type CustomerOption = Awaited<ReturnType<typeof getActiveCustomers>>[number]
