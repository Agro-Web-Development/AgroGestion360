import "server-only"

import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

type Datum = { label: string; value: number }
type MonthDatum = { month: string; value: number }

export type CommercialSummary = {
  production_kg: number
  available_kg: number
  sold_kg: number
  shrinkage_kg: number
  lots: number
  cuts: number
  sales_total: number
  sales_count: number
  sales_month: number
  collected: number
  period_sales_paid: number
  receivable: number
  overdue: number
  customers_active: number
  customers_with_balance: number
  production_by_crop: Datum[]
  production_by_project: (Datum & { name: string })[]
  production_by_quality: Datum[]
  sales_by_month: MonthDatum[]
  sales_by_customer: Datum[]
  collections_by_month: MonthDatum[]
  balances_by_customer: (Datum & { overdue: number })[]
}

export type CommercialFilters = { from: string; to: string; cropId?: string; projectId?: string }

/**
 * Indicadores comerciales agregados en la BD (SECURITY INVOKER: respeta la
 * RLS, así que las cifras de venta solo llegan a roles con lectura financiera).
 */
export async function getCommercialSummary(filters: CommercialFilters): Promise<CommercialSummary> {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("commercial_summary", {
    p_org: ctx.organization.id,
    p_from: filters.from,
    p_to: filters.to,
    p_crop: filters.cropId,
    p_project: filters.projectId,
  })
  if (error || !data) throw new Error("No fue posible calcular los indicadores comerciales.")
  const s = data as CommercialSummary
  // jsonb trae los numeric como número; se normalizan las series por seguridad.
  const num = <T extends { value: number }>(rows: T[]) => rows.map((r) => ({ ...r, value: Number(r.value) }))
  return {
    ...s,
    production_by_crop: num(s.production_by_crop),
    production_by_project: num(s.production_by_project),
    production_by_quality: num(s.production_by_quality),
    sales_by_month: num(s.sales_by_month),
    sales_by_customer: num(s.sales_by_customer),
    collections_by_month: num(s.collections_by_month),
    balances_by_customer: num(s.balances_by_customer),
  }
}
