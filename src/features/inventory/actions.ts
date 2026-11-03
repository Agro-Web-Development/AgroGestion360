"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { dbErrorMessage, failure, success, validationFailure, type ActionResult } from "@/lib/actions"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import {
  categorySchema,
  createsLot,
  usesLotNumber,
  isProjectMovement,
  lotSchema,
  movementSchema,
  productSchema,
  supplierSchema,
  warehouseSchema,
  type CategoryInput,
  type LotInput,
  type MovementInput,
  type ProductInput,
  type SupplierInput,
  type WarehouseInput,
} from "./schemas"

const idSchema = z.uuid()
const reasonSchema = z.string().trim().min(5, "Indica el motivo").max(500)

/** Catálogos del inventario con alta, edición, activación y eliminación (sin uso). */
type CatalogTable = "inventory_products" | "inventory_categories" | "warehouses" | "suppliers"

const CATALOG_NOUN: Record<CatalogTable, { one: string; inUse: string }> = {
  inventory_products: { one: "Producto", inUse: "El producto tiene movimientos registrados. Puedes desactivarlo en su lugar." },
  inventory_categories: { one: "Categoría", inUse: "La categoría tiene productos. Puedes desactivarla en su lugar." },
  warehouses: { one: "Almacén", inUse: "El almacén tiene movimientos registrados. Puedes desactivarlo en su lugar." },
  suppliers: { one: "Proveedor", inUse: "El proveedor tiene compras registradas. Puedes desactivarlo en su lugar." },
}

type Client = Awaited<ReturnType<typeof createClient>>
type WriteResult = { data: { id: string }[] | null; error: Parameters<typeof dbErrorMessage>[0] | null }

/** Alta o edición de un catálogo: permisos, mensajes y refresco comunes; la consulta la arma cada catálogo. */
async function saveCatalog(
  table: CatalogTable,
  isUpdate: boolean,
  write: (supabase: Client, organizationId: string) => PromiseLike<WriteResult>,
  duplicateMessage: string
): Promise<ActionResult> {
  const ctx = await getOrgContext()
  if (!can(ctx.role, "inventory.write")) return failure("No tienes permiso para administrar el inventario.")

  const { data, error } = await write(await createClient(), ctx.organization.id)
  if (error) {
    if (error.code === "23505") return failure(duplicateMessage)
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para modificar este registro.")

  refresh()
  const noun = CATALOG_NOUN[table].one
  const ending = noun === "Categoría" ? "a" : "o"
  return success(undefined, `${noun} ${isUpdate ? "actualizad" : "registrad"}${ending}.`)
}

export async function setCatalogActive(table: CatalogTable, recordId: string, active: boolean): Promise<ActionResult> {
  if (!(table in CATALOG_NOUN) || !idSchema.safeParse(recordId).success) return failure("Registro no válido.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "inventory.write")) return failure("No tienes permiso para administrar el inventario.")

  const supabase = await createClient()
  // Las cuatro tablas comparten id, organization_id e is_active.
  const { data, error } = await supabase
    .from(table as "suppliers")
    .update({ is_active: active })
    .eq("id", recordId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) return failure(dbErrorMessage(error))
  if (!data?.length) return failure("No tienes permiso para modificar este registro.")

  refresh()
  return success(undefined, active ? "Registro reactivado." : "Registro desactivado.")
}

export async function deleteCatalog(table: CatalogTable, recordId: string): Promise<ActionResult> {
  if (!(table in CATALOG_NOUN) || !idSchema.safeParse(recordId).success) return failure("Registro no válido.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "catalogs.delete")) return failure("Solo propietarios y administradores pueden eliminar registros.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq("id", recordId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) {
    if (error.code === "23503") return failure(CATALOG_NOUN[table].inUse)
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para eliminar este registro.")

  refresh()
  return success(undefined, "Registro eliminado.")
}

export async function saveProduct(input: ProductInput): Promise<ActionResult> {
  const parsed = productSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)
  const { id, ...v } = parsed.data
  const values = {
    name: v.name,
    sku: v.sku,
    category_id: v.categoryId,
    unit: v.unit,
    min_stock: v.minStock,
    track_lots: v.trackLots,
    notes: v.notes,
  }
  return saveCatalog(
    "inventory_products",
    Boolean(id),
    (db, org) =>
      id
        ? db.from("inventory_products").update(values).eq("id", id).eq("organization_id", org).select("id")
        : db.from("inventory_products").insert({ ...values, organization_id: org }).select("id"),
    "Ya existe un producto con ese nombre o clave."
  )
}

export async function saveCategory(input: CategoryInput): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)
  const { id, ...v } = parsed.data
  const values = { name: v.name, kind: v.kind, description: v.description }
  return saveCatalog(
    "inventory_categories",
    Boolean(id),
    (db, org) =>
      id
        ? db.from("inventory_categories").update(values).eq("id", id).eq("organization_id", org).select("id")
        : db.from("inventory_categories").insert({ ...values, organization_id: org }).select("id"),
    "Ya existe una categoría con ese nombre."
  )
}

export async function saveWarehouse(input: WarehouseInput): Promise<ActionResult> {
  const parsed = warehouseSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)
  const { id, ...v } = parsed.data
  const values = {
    name: v.name,
    code: v.code,
    farm_id: v.farmId,
    location: v.location,
    responsible_id: v.responsibleId,
    notes: v.notes,
  }
  return saveCatalog(
    "warehouses",
    Boolean(id),
    (db, org) =>
      id
        ? db.from("warehouses").update(values).eq("id", id).eq("organization_id", org).select("id")
        : db.from("warehouses").insert({ ...values, organization_id: org }).select("id"),
    "Ya existe un almacén con ese nombre."
  )
}

export async function saveSupplier(input: SupplierInput): Promise<ActionResult> {
  const parsed = supplierSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)
  const { id, ...v } = parsed.data
  const values = {
    name: v.name,
    rfc: v.rfc,
    contact_name: v.contactName,
    phone: v.phone,
    email: v.email,
    address: v.address,
    notes: v.notes,
  }
  return saveCatalog(
    "suppliers",
    Boolean(id),
    (db, org) =>
      id
        ? db.from("suppliers").update(values).eq("id", id).eq("organization_id", org).select("id")
        : db.from("suppliers").insert({ ...values, organization_id: org }).select("id"),
    "Ya existe un proveedor con ese nombre."
  )
}

export async function updateLot(input: LotInput): Promise<ActionResult> {
  const parsed = lotSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)
  const ctx = await getOrgContext()
  if (!can(ctx.role, "inventory.write")) return failure("No tienes permiso para administrar el inventario.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("inventory_lots")
    .update({ expiry_date: parsed.data.expiryDate, notes: parsed.data.notes })
    .eq("id", parsed.data.id)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) return failure(dbErrorMessage(error))
  if (!data?.length) return failure("No tienes permiso para modificar este lote.")

  refresh()
  return success(undefined, "Lote actualizado.")
}

/** Toda la lógica de existencias, lotes y costo promedio vive en la RPC (transaccional e idempotente por id). */
export async function registerMovement(input: MovementInput): Promise<ActionResult> {
  const parsed = movementSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "inventory.write")) return failure("No tienes permiso para registrar movimientos de inventario.")

  const v = parsed.data
  const forProject = isProjectMovement(v.type)
  const newLot = createsLot(v.type)
  const byNumber = usesLotNumber(v.type)
  const supabase = await createClient()
  const { error } = await supabase.rpc("register_inventory_movement", {
    p_id: v.id,
    p_product: v.productId,
    p_type: v.type,
    p_date: v.date,
    p_quantity: v.quantity,
    p_warehouse: v.warehouseId,
    p_to_warehouse: v.type === "transferencia" ? (v.toWarehouseId ?? undefined) : undefined,
    p_unit_cost: newLot ? (v.unitCost ?? undefined) : undefined,
    p_project: forProject ? (v.projectId ?? undefined) : undefined,
    p_plot: forProject ? (v.plotId ?? undefined) : undefined,
    p_lot: byNumber ? undefined : (v.lotId ?? undefined),
    p_lot_number: byNumber ? (v.lotNumber ?? undefined) : undefined,
    p_lot_expiry: newLot ? (v.lotExpiry ?? undefined) : undefined,
    p_supplier: v.type === "entrada" ? (v.supplierId ?? undefined) : undefined,
    p_responsible: v.responsibleId ?? undefined,
    p_reference: v.reference ?? undefined,
    p_notes: v.notes ?? undefined,
  })
  if (error) {
    if (error.code === "22023" && error.message.startsWith("Existencia insuficiente")) {
      return failure(error.message, { quantity: [error.message] })
    }
    if (error.code === "22023" && /lote/i.test(error.message)) {
      return failure(error.message, { [byNumber ? "lotNumber" : "lotId"]: [error.message] })
    }
    return failure(dbErrorMessage(error))
  }

  refresh()
  return success(undefined, "Movimiento registrado.")
}

export async function reverseMovement(movementId: string, reason: string): Promise<ActionResult> {
  if (!idSchema.safeParse(movementId).success) return failure("Movimiento no válido.")
  const parsedReason = reasonSchema.safeParse(reason)
  if (!parsedReason.success) return failure("Indica el motivo de la anulación.")

  const ctx = await getOrgContext()
  if (!can(ctx.role, "inventory.write")) return failure("No tienes permiso para anular movimientos de inventario.")

  const supabase = await createClient()
  // Un reintento no duplica la anulación: la BD solo permite anular cada movimiento una vez.
  const { error } = await supabase.rpc("reverse_inventory_movement", {
    p_id: crypto.randomUUID(),
    p_movement: movementId,
    p_reason: parsedReason.data,
  })
  if (error) return failure(dbErrorMessage(error))

  refresh()
  return success(undefined, "Movimiento anulado con su contrapartida.")
}
