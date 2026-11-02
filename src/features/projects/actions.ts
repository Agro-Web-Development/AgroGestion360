"use server"

import { refresh } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { dbErrorMessage, failure, success, validationFailure, type ActionResult } from "@/lib/actions"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import {
  changeStatusSchema,
  projectPlotSchema,
  projectSchema,
  updateProjectPlotSchema,
  type ChangeStatusInput,
  type ProjectInput,
  type ProjectPlotInput,
  type UpdateProjectPlotInput,
} from "./schemas"

const idSchema = z.uuid()

export async function saveProject(input: ProjectInput): Promise<ActionResult> {
  const parsed = projectSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "projects.write")) return failure("No tienes permiso para administrar proyectos.")

  const { id, ...v } = parsed.data
  const values = {
    name: v.name,
    crop_id: v.cropId,
    season: v.season,
    start_date: v.startDate,
    planting_date: v.plantingDate,
    expected_harvest_date: v.expectedHarvestDate,
    expected_yield: v.expectedYield,
    budget_amount: v.budgetAmount,
    responsible_id: v.responsibleId,
    description: v.description,
  }

  const supabase = await createClient()
  const { data, error } = id
    ? await supabase.from("projects").update(values).eq("id", id).eq("organization_id", ctx.organization.id).select("id")
    : await supabase.from("projects").insert({ ...values, organization_id: ctx.organization.id }).select("id")

  if (error) {
    if (error.code === "23503") return failure("El cultivo o responsable seleccionado no existe.")
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para modificar este proyecto.")

  redirect(`/proyectos/${data[0].id}`)
}

export async function changeProjectStatus(input: ChangeStatusInput): Promise<ActionResult> {
  const parsed = changeStatusSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "projects.write")) return failure("No tienes permiso para cambiar el estado del proyecto.")

  const supabase = await createClient()
  const { error } = await supabase.rpc("change_project_status", {
    p_project: parsed.data.projectId,
    p_status: parsed.data.status,
    p_note: parsed.data.note ?? undefined,
  })
  if (error) return failure(dbErrorMessage(error))

  refresh()
  return success(undefined, "Estado del proyecto actualizado.")
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(projectId).success) return failure("Proyecto no válido.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "projects.delete")) return failure("Solo propietarios y administradores pueden eliminar proyectos.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) {
    if (error.code === "23503") return failure("El proyecto tiene costos, cosechas o ventas registradas; no puede eliminarse.")
    return failure(dbErrorMessage(error))
  }
  // La RLS solo permite eliminar proyectos en planeación o cancelados.
  if (!data?.length) return failure("Solo se pueden eliminar proyectos en planeación o cancelados.")

  redirect("/proyectos")
}

export async function assignPlot(input: ProjectPlotInput): Promise<ActionResult> {
  const parsed = projectPlotSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "projects.write")) return failure("No tienes permiso para modificar el proyecto.")

  const supabase = await createClient()
  const { error } = await supabase.from("project_plots").insert({
    organization_id: ctx.organization.id,
    project_id: parsed.data.projectId,
    plot_id: parsed.data.plotId,
    assigned_area_ha: parsed.data.assignedAreaHa,
  })
  if (error) {
    if (error.code === "23505") return failure("La parcela ya está asignada a este proyecto.")
    if (error.code === "22023") return failure(error.message, { assignedAreaHa: [error.message] })
    return failure(dbErrorMessage(error))
  }

  refresh()
  return success(undefined, "Parcela asignada al proyecto.")
}

export async function updateProjectPlot(input: UpdateProjectPlotInput): Promise<ActionResult> {
  const parsed = updateProjectPlotSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "projects.write")) return failure("No tienes permiso para modificar el proyecto.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("project_plots")
    .update({ assigned_area_ha: parsed.data.assignedAreaHa })
    .eq("id", parsed.data.id)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) {
    if (error.code === "22023") return failure(error.message, { assignedAreaHa: [error.message] })
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para modificar el proyecto.")

  refresh()
  return success(undefined, "Superficie asignada actualizada.")
}

export async function removeProjectPlot(projectPlotId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(projectPlotId).success) return failure("Asignación no válida.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "projects.write")) return failure("No tienes permiso para modificar el proyecto.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("project_plots")
    .delete()
    .eq("id", projectPlotId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) {
    if (error.code === "23503") return failure("La parcela tiene costos o cosechas registradas en este proyecto; no puede retirarse.")
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para modificar el proyecto.")

  refresh()
  return success(undefined, "Parcela retirada del proyecto.")
}
