import "server-only"

import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

/** Las vistas SQL devuelven columnas anulables en los tipos generados; aquí se normalizan a número. */
const n = (v: number | string | null | undefined) => (v === null || v === undefined ? 0 : Number(v))
const nOrNull = (v: number | string | null | undefined) => (v === null || v === undefined ? null : Number(v))

function normalizeCosts(row: Awaited<ReturnType<typeof fetchCosts>>[number]) {
  return {
    projectId: row.project_id!,
    code: row.code ?? "",
    name: row.name ?? "",
    status: row.status!,
    budget: nOrNull(row.budget_amount),
    areaHa: n(row.area_ha),
    inputsCost: n(row.inputs_cost),
    machineryCost: n(row.machinery_cost),
    laborCost: n(row.labor_cost),
    expensesCost: n(row.expenses_cost),
    totalCost: n(row.total_cost),
    costPerHa: nOrNull(row.cost_per_ha),
    harvestedKg: n(row.harvested_kg),
    costPerKg: nOrNull(row.cost_per_kg),
    yieldKgPerHa: nOrNull(row.yield_kg_per_ha),
    soldKg: n(row.sold_kg),
    availableKg: n(row.available_kg),
    salesAmount: n(row.sales_amount),
    collectedAmount: n(row.collected_amount),
    receivableAmount: n(row.receivable_amount),
    grossProfit: n(row.gross_profit),
    budgetUsedPct: nOrNull(row.budget_used_pct),
  }
}

async function fetchCosts(projectId?: string) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase.from("v_project_costs").select("*").eq("organization_id", ctx.organization.id).order("code")
  if (projectId) query = query.eq("project_id", projectId)
  const { data, error } = await query
  if (error) throw new Error("No fue posible calcular los costos.")
  return data
}

/** Costos, producción, ventas y cobranza por proyecto (vista v_project_costs). */
export async function getProjectCosts() {
  return (await fetchCosts()).map(normalizeCosts)
}

export async function getProjectCost(projectId: string) {
  const [row] = await fetchCosts(projectId)
  return row ? normalizeCosts(row) : null
}

/** Detalle de costos del proyecto: la misma fuente que alimenta los totales. */
export async function getProjectCostEntries(projectId: string, limit = 100) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("v_project_cost_entries")
    .select("source, source_id, entry_date, concept, detail, amount, expense_category")
    .eq("organization_id", ctx.organization.id)
    .eq("project_id", projectId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error("No fue posible cargar el detalle de costos.")
  return data.map((e) => ({ ...e, amount: n(e.amount) }))
}

export async function getExpenses(limit = 300) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("project_expenses")
    .select(
      "id, expense_date, category, description, supplier, invoice_ref, amount, project:projects!inner(id, code, status), assignment:project_plots(plot:plots!inner(name))"
    )
    .eq("organization_id", ctx.organization.id)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error("No fue posible cargar los gastos.")
  return data
}

type FinanceSummary = {
  total_cost: number
  inputs_cost: number
  machinery_cost: number
  labor_cost: number
  expenses_cost: number
  period_cost: number
  harvested_kg: number
  available_kg: number
  sales_total: number
  sales_count: number
  collected: number
  receivable: number
  overdue: number
  overdue_count: number
  inventory_value: number
}

export async function getFinanceSummary(): Promise<FinanceSummary> {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("finance_summary", { p_org: ctx.organization.id })
  if (error || !data) throw new Error("No fue posible calcular los indicadores financieros.")
  return data as FinanceSummary
}

export type ProjectCosts = Awaited<ReturnType<typeof getProjectCosts>>[number]
export type CostEntry = Awaited<ReturnType<typeof getProjectCostEntries>>[number]
