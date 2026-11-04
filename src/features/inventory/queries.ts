import "server-only"

import { getOrgContext } from "@/lib/auth/session"
import { LIST_LIMIT } from "@/lib/list-limit"
import { fetchRows } from "@/lib/supabase/rows"
import { createClient } from "@/lib/supabase/server"

export async function getProducts() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("inventory_products")
    .select(
      "id, name, sku, unit, min_stock, stock, stock_value, avg_cost, track_lots, notes, is_active, category:inventory_categories!inner(id, name, kind), inventory_movements(count)"
    )
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

export type MovementFilters = { from?: string; to?: string; warehouseId?: string; productId?: string }

export async function getMovements(filters: MovementFilters = {}, limit = LIST_LIMIT) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase
    .from("inventory_movements")
    .select(
      "id, movement_type, movement_date, quantity, unit, unit_cost, total_cost, reference, notes, reverses_id, stock_after, created_at, product:inventory_products!inner(id, name), warehouse:warehouses!inventory_movements_organization_id_warehouse_id_fkey!inner(id, name), destination:warehouses!inventory_movements_organization_id_to_warehouse_id_fkey(id, name), lot:inventory_lots(lot_number, expiry_date), supplier:suppliers(name), responsible:employees(full_name), project:projects(id, code, status), assignment:project_plots(plot:plots!inner(name))"
    )
    .eq("organization_id", ctx.organization.id)
  if (filters.from) query = query.gte("movement_date", filters.from)
  if (filters.to) query = query.lte("movement_date", filters.to)
  if (filters.productId) query = query.eq("product_id", filters.productId)
  if (filters.warehouseId) {
    query = query.or(`warehouse_id.eq.${filters.warehouseId},to_warehouse_id.eq.${filters.warehouseId}`)
  }
  const { data, error } = await fetchRows(query.order("created_at", { ascending: false }).order("id"), limit)
  if (error) throw new Error("No fue posible cargar los movimientos.")

  // Los movimientos que pertenecen a una aplicación o al combustible de un uso de
  // maquinaria se revierten desde su propio registro, no desde el almacén.
  const [applications, usage] = await Promise.all([
    supabase
      .from("chemical_applications")
      .select("inventory_movement_id")
      .eq("organization_id", ctx.organization.id)
      .not("inventory_movement_id", "is", null),
    supabase
      .from("machinery_usage")
      .select("fuel_movement_id")
      .eq("organization_id", ctx.organization.id)
      .not("fuel_movement_id", "is", null),
  ])
  const linked = new Set([
    ...(applications.data ?? []).map((a) => a.inventory_movement_id),
    ...(usage.data ?? []).map((u) => u.fuel_movement_id),
  ])
  // Una anulación siempre es posterior a su original, así que ambas están en la misma ventana.
  const reversed = new Set(data.map((m) => m.reverses_id).filter(Boolean))
  return data.map((m) => ({ ...m, reversed: reversed.has(m.id), linked: linked.has(m.id) }))
}

/** Existencias por almacén y lote (vista v_inventory_stock). */
export async function getStock() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("v_inventory_stock")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .order("product_name")
    .order("warehouse_name")
  if (error) throw new Error("No fue posible cargar las existencias por almacén.")
  return data.map((s) => ({
    id: s.id!,
    productId: s.product_id!,
    productName: s.product_name ?? "",
    sku: s.sku,
    unit: s.unit ?? "",
    categoryName: s.category_name ?? "",
    categoryKind: s.category_kind!,
    productActive: s.product_active ?? true,
    warehouseId: s.warehouse_id!,
    warehouseName: s.warehouse_name ?? "",
    lotId: s.lot_id,
    lotNumber: s.lot_number,
    expiryDate: s.expiry_date,
    daysToExpiry: s.days_to_expiry,
    quantity: Number(s.quantity ?? 0),
    estimatedValue: Number(s.estimated_value ?? 0),
  }))
}

export async function getCategories() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("inventory_categories")
    .select("id, name, kind, description, is_active, inventory_products(count)")
    .eq("organization_id", ctx.organization.id)
    .order("is_active", { ascending: false })
    .order("name")
  if (error) throw new Error("No fue posible cargar las categorías.")
  return data.map(({ inventory_products, ...c }) => ({ ...c, productCount: inventory_products[0]?.count ?? 0 }))
}

export async function getWarehouses() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("warehouses")
    .select("id, name, code, farm_id, location, responsible_id, notes, is_active, farm:farms(name), responsible:employees(full_name), inventory_balances(quantity)")
    .eq("organization_id", ctx.organization.id)
    .order("is_active", { ascending: false })
    .order("name")
  if (error) throw new Error("No fue posible cargar los almacenes.")
  return data.map(({ inventory_balances, ...w }) => ({
    ...w,
    hasStock: inventory_balances.some((b) => Number(b.quantity) > 0),
    usedCount: inventory_balances.length,
  }))
}

export async function getSuppliers() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, rfc, contact_name, phone, email, address, notes, is_active, inventory_movements(count)")
    .eq("organization_id", ctx.organization.id)
    .order("is_active", { ascending: false })
    .order("name")
  if (error) throw new Error("No fue posible cargar los proveedores.")
  return data.map(({ inventory_movements, ...s }) => ({ ...s, movementCount: inventory_movements[0]?.count ?? 0 }))
}

/** Lotes con existencia por producto y almacén, para elegir de cuál sale un movimiento. */
export async function getLotBalances() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("inventory_balances")
    .select("product_id, warehouse_id, lot_id, quantity, lot:inventory_lots(lot_number, expiry_date)")
    .eq("organization_id", ctx.organization.id)
    .gt("quantity", 0)
  if (error) throw new Error("No fue posible cargar los lotes.")
  return data.map((b) => ({
    productId: b.product_id,
    warehouseId: b.warehouse_id,
    lotId: b.lot_id,
    lotNumber: b.lot?.lot_number ?? null,
    expiryDate: b.lot?.expiry_date ?? null,
    quantity: Number(b.quantity),
  }))
}

export type Product = Awaited<ReturnType<typeof getProducts>>[number]
export type Movement = Awaited<ReturnType<typeof getMovements>>[number]
export type StockRow = Awaited<ReturnType<typeof getStock>>[number]
export type Category = Awaited<ReturnType<typeof getCategories>>[number]
export type Warehouse = Awaited<ReturnType<typeof getWarehouses>>[number]
export type Supplier = Awaited<ReturnType<typeof getSuppliers>>[number]
export type LotBalance = Awaited<ReturnType<typeof getLotBalances>>[number]
