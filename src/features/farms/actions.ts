"use server"

import { refresh } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { dbErrorMessage, failure, success, validationFailure, type ActionResult } from "@/lib/actions"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { farmSchema, plotSchema, type FarmInput, type PlotInput } from "./schemas"

const idSchema = z.uuid()

export async function saveFarm(input: FarmInput): Promise<ActionResult<{ id: string }>> {
  const parsed = farmSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "catalogs.write")) return failure("No tienes permiso para administrar ranchos.")

  const { id, totalAreaHa, ...rest } = parsed.data
  const values = {
    name: rest.name,
    code: rest.code,
    municipality: rest.municipality,
    state: rest.state,
    address: rest.address,
    total_area_ha: totalAreaHa,
    latitude: rest.latitude,
    longitude: rest.longitude,
    notes: rest.notes,
  }

  const supabase = await createClient()
  const { data, error } = id
    ? await supabase.from("farms").update(values).eq("id", id).eq("organization_id", ctx.organization.id).select("id")
    : await supabase.from("farms").insert({ ...values, organization_id: ctx.organization.id }).select("id")

  if (error) {
    if (error.code === "23505") return failure("Ya existe un rancho con ese nombre o clave.")
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para modificar este rancho.")

  refresh()
  return success({ id: data[0].id }, id ? "Rancho actualizado." : "Rancho registrado.")
}

export async function setFarmActive(farmId: string, active: boolean): Promise<ActionResult> {
  if (!idSchema.safeParse(farmId).success) return failure("Rancho no válido.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "catalogs.write")) return failure("No tienes permiso para administrar ranchos.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("farms")
    .update({ is_active: active })
    .eq("id", farmId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) return failure(dbErrorMessage(error))
  if (!data?.length) return failure("No tienes permiso para modificar este rancho.")

  refresh()
  return success(undefined, active ? "Rancho reactivado." : "Rancho desactivado.")
}

export async function deleteFarm(farmId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(farmId).success) return failure("Rancho no válido.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "catalogs.delete")) return failure("Solo propietarios y administradores pueden eliminar ranchos.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("farms")
    .delete()
    .eq("id", farmId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) {
    if (error.code === "23503") return failure("El rancho tiene parcelas registradas. Elimínalas o desactiva el rancho.")
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para eliminar este rancho.")

  redirect("/ranchos")
}

export async function savePlot(input: PlotInput): Promise<ActionResult> {
  const parsed = plotSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "catalogs.write")) return failure("No tienes permiso para administrar parcelas.")

  const { id, farmId, areaHa, soilType, irrigationType, ...rest } = parsed.data
  const values = {
    farm_id: farmId,
    name: rest.name,
    code: rest.code,
    area_ha: areaHa,
    soil_type: soilType,
    irrigation_type: irrigationType,
    notes: rest.notes,
  }

  const supabase = await createClient()
  const { data, error } = id
    ? await supabase.from("plots").update(values).eq("id", id).eq("organization_id", ctx.organization.id).select("id")
    : await supabase.from("plots").insert({ ...values, organization_id: ctx.organization.id }).select("id")

  if (error) {
    if (error.code === "23505") return failure("Ya existe una parcela con ese nombre en el rancho.")
    if (error.code === "23503") return failure("El rancho seleccionado no existe.")
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para modificar esta parcela.")

  refresh()
  return success(undefined, id ? "Parcela actualizada." : "Parcela registrada.")
}

export async function setPlotActive(plotId: string, active: boolean): Promise<ActionResult> {
  if (!idSchema.safeParse(plotId).success) return failure("Parcela no válida.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "catalogs.write")) return failure("No tienes permiso para administrar parcelas.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("plots")
    .update({ is_active: active })
    .eq("id", plotId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) return failure(dbErrorMessage(error))
  if (!data?.length) return failure("No tienes permiso para modificar esta parcela.")

  refresh()
  return success(undefined, active ? "Parcela reactivada." : "Parcela desactivada.")
}

export async function deletePlot(plotId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(plotId).success) return failure("Parcela no válida.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "catalogs.delete")) return failure("Solo propietarios y administradores pueden eliminar parcelas.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("plots")
    .delete()
    .eq("id", plotId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) {
    if (error.code === "23503") return failure("La parcela tiene proyectos asociados. Puedes desactivarla en su lugar.")
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para eliminar esta parcela.")

  refresh()
  return success(undefined, "Parcela eliminada.")
}
