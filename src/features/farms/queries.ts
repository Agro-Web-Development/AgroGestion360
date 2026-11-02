import "server-only"

import { notFound } from "next/navigation"

import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getFarms() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("farms")
    .select(
      "id, name, code, municipality, state, address, total_area_ha, latitude, longitude, notes, is_active, plots(area_ha, is_active)"
    )
    .eq("organization_id", ctx.organization.id)
    .order("is_active", { ascending: false })
    .order("name")
  if (error) throw new Error("No fue posible cargar los ranchos.")

  return data.map(({ plots, ...farm }) => {
    const active = plots.filter((p) => p.is_active)
    return {
      ...farm,
      plotCount: active.length,
      plottedArea: active.reduce((sum, p) => sum + Number(p.area_ha), 0),
    }
  })
}

export async function getFarm(id: string) {
  if (!UUID_REGEX.test(id)) notFound()
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("farms")
    .select("id, name, code, municipality, state, address, total_area_ha, latitude, longitude, notes, is_active, created_at")
    .eq("organization_id", ctx.organization.id)
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error("No fue posible cargar el rancho.")
  if (!data) notFound()
  return data
}

/**
 * Parcelas con la superficie comprometida en proyectos vigentes (no cerrados ni
 * cancelados), para mostrar disponibilidad.
 */
export async function getPlots(farmId?: string) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase
    .from("plots")
    .select(
      "id, farm_id, name, code, area_ha, soil_type, irrigation_type, notes, is_active, farm:farms!inner(name, is_active), project_plots(assigned_area_ha, project:projects!inner(id, code, name, status))"
    )
    .eq("organization_id", ctx.organization.id)
    .order("name")
  if (farmId) query = query.eq("farm_id", farmId)

  const { data, error } = await query
  if (error) throw new Error("No fue posible cargar las parcelas.")

  return data.map(({ project_plots, ...plot }) => {
    const current = project_plots.filter((pp) => pp.project.status !== "cerrado" && pp.project.status !== "cancelado")
    const assigned = current.reduce((sum, pp) => sum + Number(pp.assigned_area_ha), 0)
    return {
      ...plot,
      assignedArea: assigned,
      availableArea: Math.max(Number(plot.area_ha) - assigned, 0),
      projects: current.map((pp) => ({ ...pp.project, area: Number(pp.assigned_area_ha) })),
      hasHistory: project_plots.length > 0,
    }
  })
}

export type Farm = Awaited<ReturnType<typeof getFarms>>[number]
export type FarmDetail = Awaited<ReturnType<typeof getFarm>>
export type Plot = Awaited<ReturnType<typeof getPlots>>[number]
