import "server-only"

import { notFound } from "next/navigation"

import { getPlots } from "@/features/farms/queries"
import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import type { ProjectStatus } from "./status"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getProjects() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, code, name, season, status, start_date, expected_harvest_date, budget_amount, crop:crops!inner(name, variety), responsible:profiles(full_name, email), project_plots(assigned_area_ha, plot:plots!inner(farm:farms!inner(name)))"
    )
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: false })
  if (error) throw new Error("No fue posible cargar los proyectos.")

  return data.map(({ project_plots, ...p }) => ({
    ...p,
    area: project_plots.reduce((s, pp) => s + Number(pp.assigned_area_ha), 0),
    farms: [...new Set(project_plots.map((pp) => pp.plot.farm.name))],
  }))
}

export async function getProject(id: string) {
  if (!UUID_REGEX.test(id)) notFound()
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("projects")
    .select(
      `id, code, name, season, status, start_date, planting_date, expected_harvest_date, end_date,
       expected_yield, budget_amount, description, responsible_id, crop_id, created_at, updated_at,
       crop:crops!inner(id, name, variety, yield_unit, cycle_days),
       responsible:profiles(full_name, email),
       project_plots(id, assigned_area_ha, plot:plots!inner(id, name, code, area_ha, irrigation_type, farm:farms!inner(id, name)))`
    )
    .eq("organization_id", ctx.organization.id)
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error("No fue posible cargar el proyecto.")
  if (!data) notFound()
  return data
}

export async function getProjectHistory(projectId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("project_status_history")
    .select("id, from_status, to_status, note, changed_by, changed_at")
    .eq("project_id", projectId)
    .order("changed_at", { ascending: false })
    .order("id", { ascending: false })
  if (error) throw new Error("No fue posible cargar el historial del proyecto.")
  return data
}

/** Miembros activos (para elegir responsable y mostrar autores en el historial). */
export async function getActiveMembers() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("memberships")
    .select("user:profiles!inner(id, full_name, email)")
    .eq("organization_id", ctx.organization.id)
    .eq("status", "activo")
  if (error) throw new Error("No fue posible cargar los usuarios.")
  return data
    .map((m) => ({ id: m.user.id, name: m.user.full_name || m.user.email }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
}

export async function getActiveCrops() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("crops")
    .select("id, name, variety, yield_unit, cycle_days")
    .eq("organization_id", ctx.organization.id)
    .eq("is_active", true)
    .order("name")
  if (error) throw new Error("No fue posible cargar los cultivos.")
  return data
}

/** Parcelas activas de ranchos activos con superficie disponible, excluyendo las ya asignadas al proyecto. */
export async function getAssignablePlots(projectId: string) {
  const plots = await getPlots()
  return plots
    .filter((p) => p.is_active && p.farm.is_active && p.availableArea > 0 && !p.projects.some((pr) => pr.id === projectId))
    .map((p) => ({ id: p.id, name: p.name, farm: p.farm.name, available: p.availableArea }))
    .sort((a, b) => a.farm.localeCompare(b.farm, "es") || a.name.localeCompare(b.name, "es"))
}

/**
 * Proyectos vigentes con sus parcelas asignadas, para imputar costos, cosechas
 * y ventas. `statuses` limita los estados (p. ej. cosechas solo en cosecha).
 */
export async function getOpenProjects(statuses?: ProjectStatus[]) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase
    .from("projects")
    .select("id, code, name, status, start_date, project_plots(plot:plots!inner(id, name, farm:farms!inner(name)))")
    .eq("organization_id", ctx.organization.id)
    .not("status", "in", "(cerrado,cancelado)")
    .order("code")
  if (statuses) query = query.in("status", statuses)
  const { data, error } = await query
  if (error) throw new Error("No fue posible cargar los proyectos.")
  return data.map(({ project_plots, ...p }) => ({
    ...p,
    plots: project_plots
      .map((pp) => ({ id: pp.plot.id, name: pp.plot.name, farm: pp.plot.farm.name }))
      .sort((a, b) => a.farm.localeCompare(b.farm, "es") || a.name.localeCompare(b.name, "es")),
  }))
}

export type ProjectListItem = Awaited<ReturnType<typeof getProjects>>[number]
export type ProjectDetail = Awaited<ReturnType<typeof getProject>>
export type OpenProject = Awaited<ReturnType<typeof getOpenProjects>>[number]
export type AssignablePlot = Awaited<ReturnType<typeof getAssignablePlots>>[number]
