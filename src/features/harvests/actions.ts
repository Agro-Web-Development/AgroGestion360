"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { dbErrorMessage, failure, isDuplicateId, success, validationFailure, type ActionResult } from "@/lib/actions"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { harvestSchema, type HarvestInput } from "./schemas"

const idSchema = z.uuid()

export async function registerHarvest(input: HarvestInput): Promise<ActionResult> {
  const parsed = harvestSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "harvest.write")) return failure("No tienes permiso para registrar cosechas.")

  const v = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.from("harvests").insert({
    id: v.id,
    organization_id: ctx.organization.id,
    project_id: v.projectId,
    plot_id: v.plotId,
    harvest_date: v.date,
    quality: v.quality,
    quantity_kg: v.quantityKg,
    packages: v.packages,
    notes: v.notes,
  })
  if (error && !isDuplicateId(error)) {
    if (error.code === "23503") return failure("La parcela no está asignada al proyecto.", { plotId: ["Parcela no válida"] })
    return failure(dbErrorMessage(error))
  }

  refresh()
  return success(undefined, "Corte registrado.")
}

export async function deleteHarvest(harvestId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(harvestId).success) return failure("Registro no válido.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "harvest.write")) return failure("No tienes permiso para eliminar cosechas.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("harvests")
    .delete()
    .eq("id", harvestId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) return failure(dbErrorMessage(error))
  if (!data?.length) return failure("No tienes permiso para eliminar este registro.")

  refresh()
  return success(undefined, "Corte eliminado.")
}
