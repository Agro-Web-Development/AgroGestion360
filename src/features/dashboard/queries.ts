import "server-only"

import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { todayISO } from "@/lib/format"
import type { ProjectStatus } from "@/features/projects/status"

type Summary = {
  farms: number
  plots: number
  crops: number
  registered_area: number
  cultivated_area: number
  projects_total: number
  projects_active: number
  planned_budget: number
  by_status: Partial<Record<ProjectStatus, number>>
  area_by_crop: { crop: string; area: number }[]
}

/** Indicadores agregados en la base de datos (función SQL que respeta la RLS). */
export async function getAgroSummary(): Promise<Summary> {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("dashboard_summary", { p_org: ctx.organization.id })
  if (error || !data) throw new Error("No fue posible calcular los indicadores.")
  return data as Summary
}

/** Proyectos vigentes con cosecha estimada en los próximos `days` días (o ya vencida). */
export async function getUpcomingHarvests(days = 45) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const limit = new Date(Date.parse(todayISO()) + days * 86_400_000).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from("projects")
    .select("id, code, name, status, expected_harvest_date, crop:crops!inner(name, variety)")
    .eq("organization_id", ctx.organization.id)
    .not("status", "in", "(cerrado,cancelado,comercializacion)")
    .not("expected_harvest_date", "is", null)
    .lte("expected_harvest_date", limit)
    .order("expected_harvest_date")
    .limit(6)
  if (error) throw new Error("No fue posible cargar las próximas cosechas.")
  return data
}

export async function getRecentProjects(limit = 5) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("projects")
    .select("id, code, name, status, updated_at")
    .eq("organization_id", ctx.organization.id)
    .order("updated_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error("No fue posible cargar los proyectos recientes.")
  return data
}
