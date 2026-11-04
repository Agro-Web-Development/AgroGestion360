"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { dbErrorMessage, failure, success, validationFailure, type ActionResult } from "@/lib/actions"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { harvestFailure } from "./errors"
import { createHarvest } from "./mutations"
import { adjustmentSchema, harvestSchema, needsUnitWeight, type AdjustmentInput, type HarvestInput } from "./schemas"

const idSchema = z.uuid()
const reasonSchema = z.string().trim().min(5).max(500)

/**
 * Alta (id del cliente, idempotente) o corrección de un corte. El folio del
 * lote, el número de corte por omisión y los kg los calcula la BD; un lote con
 * ventas o ajustes conserva su proyecto, parcela, fecha y calidad.
 */
export async function saveHarvest(input: HarvestInput, isUpdate = false): Promise<ActionResult> {
  const parsed = harvestSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "harvest.write")) return failure("No tienes permiso para registrar cosechas.")

  const v = parsed.data
  const values = {
    plot_id: v.plotId,
    harvest_date: v.date,
    quality: v.quality,
    classification: v.classification,
    unit: v.unit,
    quantity: v.quantity,
    unit_weight_kg: needsUnitWeight(v.unit) ? v.unitWeightKg : null,
    packages: v.packages,
    responsible_id: v.responsibleId,
    notes: v.notes,
  }
  const supabase = await createClient()

  if (isUpdate) {
    const { data, error } = await supabase
      .from("harvests")
      .update({ ...values, ...(v.cutNumber !== null && { cut_number: v.cutNumber }) })
      .eq("id", v.id)
      .eq("organization_id", ctx.organization.id)
      .select("id")
    if (error) return harvestFailure(error)
    if (!data?.length) return failure("No tienes permiso para modificar este corte.")
    refresh()
    return success(undefined, "Corte actualizado.")
  }

  const error = await createHarvest(supabase, ctx.organization.id, v)
  if (error) return harvestFailure(error)

  refresh()
  return success(undefined, "Corte registrado. Se generó su lote de producción.")
}

/** Solo lotes sin ventas ni ajustes; sus fotografías se eliminan con él. */
export async function deleteHarvest(harvestId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(harvestId).success) return failure("Registro no válido.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "harvest.write")) return failure("No tienes permiso para eliminar cortes.")

  const supabase = await createClient()
  const { data: files } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("organization_id", ctx.organization.id)
    .eq("entity_type", "harvest")
    .eq("entity_id", harvestId)
  const { data, error } = await supabase
    .from("harvests")
    .delete()
    .eq("id", harvestId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) return failure(dbErrorMessage(error))
  if (!data?.length) return failure("No tienes permiso para eliminar este corte.")
  if (files?.length) await supabase.storage.from("evidencias").remove(files.map((f) => f.storage_path))

  refresh()
  return success(undefined, "Corte eliminado.")
}

/** Merma, pérdida o ajuste justificado (RPC: bloquea el lote y valida la existencia). */
export async function registerAdjustment(input: AdjustmentInput): Promise<ActionResult> {
  const parsed = adjustmentSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "produce.adjust")) return failure("No tienes permiso para registrar mermas o ajustes.")

  const v = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.rpc("register_production_adjustment", {
    p_id: v.id,
    p_harvest: v.harvestId,
    p_type: v.type,
    p_quantity_kg: v.quantityKg,
    p_date: v.date,
    p_reason: v.reason,
  })
  if (error) {
    if (error.code === "22023" && error.message.includes("disponibles")) {
      return failure(error.message, { quantityKg: [error.message] })
    }
    if (error.code === "22023" && error.message.includes("fecha")) return failure(error.message, { date: [error.message] })
    return failure(dbErrorMessage(error))
  }

  refresh()
  return success(undefined, "Movimiento registrado.")
}

export async function reverseAdjustment(id: string, movementId: string, reason: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success || !idSchema.safeParse(movementId).success) return failure("Movimiento no válido.")
  if (!reasonSchema.safeParse(reason).success) return failure("Indica el motivo de la reversión.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "produce.adjust")) return failure("No tienes permiso para revertir ajustes.")

  const supabase = await createClient()
  const { error } = await supabase.rpc("reverse_production_adjustment", {
    p_id: id,
    p_movement: movementId,
    p_reason: reason.trim(),
  })
  if (error) return failure(dbErrorMessage(error))

  refresh()
  return success(undefined, "Ajuste revertido con su contrapartida.")
}
