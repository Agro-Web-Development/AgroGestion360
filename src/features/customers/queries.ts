import "server-only"

import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

/** Clientes con sus ventas vigentes y saldo pendiente. */
export async function getCustomers() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const [customers, balances] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, rfc, contact_name, phone, email, address, credit_days, notes, is_active, sales(count)")
      .eq("organization_id", ctx.organization.id)
      .order("is_active", { ascending: false })
      .order("name"),
    supabase
      .from("v_sale_balances")
      .select("customer_id, total, balance, days_overdue")
      .eq("organization_id", ctx.organization.id)
      .eq("status", "vigente"),
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

export type Customer = Awaited<ReturnType<typeof getCustomers>>[number]
