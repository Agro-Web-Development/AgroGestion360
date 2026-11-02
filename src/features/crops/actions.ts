"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { dbErrorMessage, failure, success, validationFailure, type ActionResult } from "@/lib/actions"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { cropSchema, type CropInput } from "./schemas"

const idSchema = z.uuid()

export async function saveCrop(input: CropInput): Promise<ActionResult> {
  const parsed = cropSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "catalogs.write")) return failure("No tienes permiso para administrar cultivos.")

  const { id, ...v } = parsed.data
  const values = {
    name: v.name,
    variety: v.variety,
    scientific_name: v.scientificName,
    cycle_days: v.cycleDays,
    yield_unit: v.yieldUnit,
    notes: v.notes,
  }

  const supabase = await createClient()
  const { data, error } = id
    ? await supabase.from("crops").update(values).eq("id", id).eq("organization_id", ctx.organization.id).select("id")
    : await supabase.from("crops").insert({ ...values, organization_id: ctx.organization.id }).select("id")

  if (error) {
    if (error.code === "23505") return failure("Ya existe ese cultivo con la misma variedad.")
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para modificar este cultivo.")

  refresh()
  return success(undefined, id ? "Cultivo actualizado." : "Cultivo registrado.")
}

export async function setCropActive(cropId: string, active: boolean): Promise<ActionResult> {
  if (!idSchema.safeParse(cropId).success) return failure("Cultivo no válido.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "catalogs.write")) return failure("No tienes permiso para administrar cultivos.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("crops")
    .update({ is_active: active })
    .eq("id", cropId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) return failure(dbErrorMessage(error))
  if (!data?.length) return failure("No tienes permiso para modificar este cultivo.")

  refresh()
  return success(undefined, active ? "Cultivo reactivado." : "Cultivo desactivado.")
}

export async function deleteCrop(cropId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(cropId).success) return failure("Cultivo no válido.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "catalogs.delete")) return failure("Solo propietarios y administradores pueden eliminar cultivos.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("crops")
    .delete()
    .eq("id", cropId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) {
    if (error.code === "23503") return failure("El cultivo está asociado a proyectos. Puedes desactivarlo en su lugar.")
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para eliminar este cultivo.")

  refresh()
  return success(undefined, "Cultivo eliminado.")
}
