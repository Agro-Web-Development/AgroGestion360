import "server-only"

import { notFound } from "next/navigation"

import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

/** Clientes con sus ventas vigentes y saldo pendiente. */
export async function getCustomers() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const [customers, balances] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, customer_type, rfc, contact_name, phone, email, address, credit_days, notes, is_active, sales(count)")
      .eq("organization_id", ctx.organization.id)
      .order("is_active", { ascending: false })
      .order("name"),
    supabase
      .from("v_sale_balances")
      .select("customer_id, total, balance, days_overdue")
      .eq("organization_id", ctx.organization.id)
      .not("status", "in", "(borrador,cancelada)"),
  ])
  if (customers.error || balances.error) throw new Error("No fue posible cargar los clientes.")

  const byCustomer = new Map<string, { sales: number; balance: number; overdue: number }>()
  for (const b of balances.data) {
    const acc = byCustomer.get(b.customer_id!) ?? { sales: 0, balance: 0, overdue: 0 }
    acc.sales += Number(b.total)
    acc.balance += Number(b.balance)
    if (Number(b.days_overdue) > 0) acc.overdue += Number(b.balance)
    byCustomer.set(b.customer_id!, acc)
  }
  return customers.data.map(({ sales, ...c }) => ({
    ...c,
    saleCount: sales[0]?.count ?? 0,
    ...(byCustomer.get(c.id) ?? { sales: 0, balance: 0, overdue: 0 }),
  }))
}

export async function getCustomer(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound()
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, customer_type, rfc, contact_name, phone, email, address, credit_days, notes, is_active, created_at")
    .eq("organization_id", ctx.organization.id)
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error("No fue posible cargar el cliente.")
  if (!data) notFound()
  return data
}

export type Customer = Awaited<ReturnType<typeof getCustomers>>[number]
