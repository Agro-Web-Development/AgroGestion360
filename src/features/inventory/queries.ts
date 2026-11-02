import "server-only"

import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

export async function getProducts() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("inventory_products")
    .select("id, name, sku, category, unit, min_stock, stock, stock_value, avg_cost, notes, is_active, inventory_movements(count)")
    .eq("organization_id", ctx.organization.id)
    .order("is_active", { ascending: false })
    .order("name")
  if (error) throw new Error("No fue posible cargar el inventario.")
  return data.map(({ inventory_movements, ...p }) => ({
    ...p,
    movementCount: inventory_movements[0]?.count ?? 0,
    lowStock: p.min_stock !== null && Number(p.stock) <= Number(p.min_stock),
  }))
}

export async function getMovements(limit = 200) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("inventory_movements")
    .select(
      "id, movement_type, movement_date, quantity, unit_cost, total_cost, supplier, reference, notes, reverses_id, stock_after, created_at, product:inventory_products!inner(id, name, unit), project:projects(id, code, status), assignment:project_plots(plot:plots!inner(name))"
    )
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error("No fue posible cargar los movimientos.")
  // Una anulación siempre es posterior a su original, así que ambas están en la misma ventana.
  const reversed = new Set(data.map((m) => m.reverses_id).filter(Boolean))
  return data.map((m) => ({ ...m, reversed: reversed.has(m.id) }))
}

export type Product = Awaited<ReturnType<typeof getProducts>>[number]
export type Movement = Awaited<ReturnType<typeof getMovements>>[number]
