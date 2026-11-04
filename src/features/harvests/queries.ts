import "server-only"

import { notFound } from "next/navigation"

import type { DateRange } from "@/features/labor/queries"
import { getOrgContext } from "@/lib/auth/session"
import { LIST_LIMIT } from "@/lib/list-limit"
import { fetchRows } from "@/lib/supabase/rows"
import { createClient } from "@/lib/supabase/server"
import type { LotFigures } from "./aggregate"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const LOT_FIELDS = `id, lot_code, cut_number, harvest_date, quality, classification, unit, quantity, unit_weight_kg,
  quantity_kg, sold_kg, adjusted_kg, available_kg, packages, notes, responsible_id, created_at,
  responsible:employees(full_name),
  project:projects!inner(id, code, name, status, crop:crops!inner(name, variety)),
  assignment:project_plots!inner(assigned_area_ha, plot:plots!inner(id, name, farm:farms!inner(name)))`

/** Cortes (lotes) del periodo, del más reciente al más antiguo. */
export async function getHarvests(range: DateRange = {}, limit = LIST_LIMIT) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase.from("harvests").select(LOT_FIELDS).eq("organization_id", ctx.organization.id)
  if (range.from) query = query.gte("harvest_date", range.from)
  if (range.to) query = query.lte("harvest_date", range.to)
  if (range.projectId) query = query.eq("project_id", range.projectId)
  const { data, error } = await fetchRows(
    query.order("harvest_date", { ascending: false }).order("lot_code", { ascending: false }).order("id"),
    limit
  )
  if (error) throw new Error("No fue posible cargar los cortes.")
  return data
}

export async function getProjectHarvests(projectId: string) {
  return getHarvests({ projectId })
}

export async function getLot(id: string) {
  if (!UUID_REGEX.test(id)) notFound()
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("harvests")
    .select(LOT_FIELDS)
    .eq("organization_id", ctx.organization.id)
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error("No fue posible cargar el lote.")
  if (!data) notFound()
  return data
}

/**
 * Movimientos de producto (en kg). El folio de la venta solo llega a los roles
 * con lectura financiera: para el resto la RLS deja la venta en null.
 */
export async function getProductionMovements(range: DateRange & { harvestId?: string } = {}, limit = LIST_LIMIT) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase
    .from("production_movements")
    .select(
      `id, movement_type, movement_date, quantity_kg, available_after, reason, reverses_id, created_at, created_by,
       lot:harvests!inner(id, lot_code, project_id, project:projects!inner(id, code, status)),
       sale:sales(id, code)`
    )
    .eq("organization_id", ctx.organization.id)
  if (range.from) query = query.gte("movement_date", range.from)
  if (range.to) query = query.lte("movement_date", range.to)
  if (range.projectId) query = query.eq("lot.project_id", range.projectId)
  if (range.harvestId) query = query.eq("harvest_id", range.harvestId)
  const { data, error } = await fetchRows(query.order("created_at", { ascending: false }).order("id"), limit)
  if (error) throw new Error("No fue posible cargar los movimientos de producto.")
  const reversed = new Set(data.map((m) => m.reverses_id).filter(Boolean))
  return data.map((m) => ({ ...m, reversed: reversed.has(m.id) }))
}

/** Lotes con existencia de proyectos vigentes, para la captura de ventas. */
export async function getSaleableLots() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("harvests")
    .select(
      `id, lot_code, harvest_date, quality, classification, unit, unit_weight_kg, available_kg,
       project:projects!inner(id, code, name, status, crop:crops!inner(name, variety)),
       assignment:project_plots!inner(plot:plots!inner(name))`
    )
    .eq("organization_id", ctx.organization.id)
    .gt("available_kg", 0)
    .not("project.status", "in", "(cerrado,cancelado)")
    .order("harvest_date")
    .order("lot_code")
  if (error) throw new Error("No fue posible cargar los lotes disponibles.")
  return data.map((l) => ({
    id: l.id,
    lotCode: l.lot_code,
    harvestDate: l.harvest_date,
    quality: l.quality,
    classification: l.classification,
    unit: l.unit,
    unitWeightKg: l.unit_weight_kg === null ? null : Number(l.unit_weight_kg),
    availableKg: Number(l.available_kg),
    projectId: l.project.id,
    projectCode: l.project.code,
    product: [l.project.crop.name, l.project.crop.variety].filter(Boolean).join(" "),
    plot: l.assignment.plot.name,
  }))
}

/** Normaliza los lotes para los indicadores (aggregate.ts). */
export function toLotFigures(rows: Harvest[]): LotFigures[] {
  return rows.map((h) => ({
    projectId: h.project.id,
    projectCode: h.project.code,
    cutNumber: h.cut_number,
    date: h.harvest_date,
    quality: h.quality,
    plotId: h.assignment.plot.id,
    plotName: h.assignment.plot.name,
    areaHa: Number(h.assignment.assigned_area_ha),
    quantityKg: Number(h.quantity_kg),
    soldKg: Number(h.sold_kg),
    adjustedKg: Number(h.adjusted_kg),
    availableKg: Number(h.available_kg),
  }))
}

export type Harvest = Awaited<ReturnType<typeof getHarvests>>[number]
export type ProductionMovement = Awaited<ReturnType<typeof getProductionMovements>>[number]
export type SaleableLot = Awaited<ReturnType<typeof getSaleableLots>>[number]
