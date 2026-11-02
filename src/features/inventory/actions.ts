"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { dbErrorMessage, failure, success, validationFailure, type ActionResult } from "@/lib/actions"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { isProjectMovement, movementSchema, productSchema, type MovementInput, type ProductInput } from "./schemas"

const idSchema = z.uuid()
const reasonSchema = z.string().trim().min(5, "Indica el motivo").max(500)

export async function saveProduct(input: ProductInput): Promise<ActionResult> {
  const parsed = productSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "inventory.write")) return failure("No tienes permiso para administrar el inventario.")

  const { id, ...v } = parsed.data
  const values = { name: v.name, sku: v.sku, category: v.category, unit: v.unit, min_stock: v.minStock, notes: v.notes }

  const supabase = await createClient()
  const { data, error } = id
    ? await supabase.from("inventory_products").update(values).eq("id", id).eq("organization_id", ctx.organization.id).select("id")
    : await supabase.from("inventory_products").insert({ ...values, organization_id: ctx.organization.id }).select("id")

  if (error) {
    if (error.code === "23505") return failure("Ya existe un producto con ese nombre o clave.")
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para modificar este producto.")

  refresh()
  return success(undefined, id ? "Producto actualizado." : "Producto registrado.")
}

export async function setProductActive(productId: string, active: boolean): Promise<ActionResult> {
  if (!idSchema.safeParse(productId).success) return failure("Producto no válido.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "inventory.write")) return failure("No tienes permiso para administrar el inventario.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("inventory_products")
    .update({ is_active: active })
    .eq("id", productId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) return failure(dbErrorMessage(error))
  if (!data?.length) return failure("No tienes permiso para modificar este producto.")

  refresh()
  return success(undefined, active ? "Producto reactivado." : "Producto desactivado.")
}

export async function deleteProduct(productId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(productId).success) return failure("Producto no válido.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "catalogs.delete")) return failure("Solo propietarios y administradores pueden eliminar productos.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("inventory_products")
    .delete()
    .eq("id", productId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) {
    if (error.code === "23503") return failure("El producto tiene movimientos registrados. Puedes desactivarlo en su lugar.")
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para eliminar este producto.")

  refresh()
  return success(undefined, "Producto eliminado.")
}

/** Toda la lógica de existencias y costo promedio vive en la RPC (transaccional e idempotente por id). */
export async function registerMovement(input: MovementInput): Promise<ActionResult> {
  const parsed = movementSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "inventory.write")) return failure("No tienes permiso para registrar movimientos de inventario.")

  const v = parsed.data
  const forProject = isProjectMovement(v.type)
  const supabase = await createClient()
  const { error } = await supabase.rpc("register_inventory_movement", {
    p_id: v.id,
    p_product: v.productId,
    p_type: v.type,
    p_date: v.date,
    p_quantity: v.quantity,
    p_unit_cost: v.type === "entrada" || v.type === "ajuste_entrada" ? (v.unitCost ?? undefined) : undefined,
    p_project: forProject ? (v.projectId ?? undefined) : undefined,
    p_plot: forProject ? (v.plotId ?? undefined) : undefined,
    p_supplier: v.supplier ?? undefined,
    p_reference: v.reference ?? undefined,
    p_notes: v.notes ?? undefined,
  })
  if (error) {
    if (error.code === "22023" && error.message.startsWith("Existencia insuficiente")) {
      return failure(error.message, { quantity: [error.message] })
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
