import "server-only"

import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

export type ReportFilters = { from: string; to: string; projectId?: string }

/** Máximo de registros por reporte; si se alcanza, la página pide acotar el periodo. */
export const REPORT_LIMIT = 5000

/** Consumos y devoluciones de insumos a proyectos en el periodo. */
export async function getConsumptionMovements(filters: ReportFilters) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase
    .from("inventory_movements")
    .select(
      "movement_type, quantity, total_cost, unit, product:inventory_products!inner(id, name, category:inventory_categories!inner(name)), project:projects(id, code)"
    )
    .eq("organization_id", ctx.organization.id)
    .in("movement_type", ["consumo", "devolucion"])
    .gte("movement_date", filters.from)
    .lte("movement_date", filters.to)
  if (filters.projectId) query = query.eq("project_id", filters.projectId)
  const { data, error } = await query.limit(REPORT_LIMIT)
  if (error) throw new Error("No fue posible cargar los consumos de insumos.")
  return data
}

/** Renglones de costo del periodo (misma fuente que el costo de producción). */
export async function getCostEntries(filters: ReportFilters) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase
    .from("v_project_cost_entries")
    .select("project_id, source, amount")
    .eq("organization_id", ctx.organization.id)
    .in("source", ["insumos", "maquinaria", "mano_obra", "actividades"])
    .gte("entry_date", filters.from)
    .lte("entry_date", filters.to)
  if (filters.projectId) query = query.eq("project_id", filters.projectId)
  const { data, error } = await query.limit(REPORT_LIMIT * 4)
  if (error) throw new Error("No fue posible calcular los costos operativos.")
  return data.map((e) => ({ project_id: e.project_id!, source: e.source!, amount: e.amount }))
}
