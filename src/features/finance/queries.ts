import "server-only"

import { getOrgContext } from "@/lib/auth/session"
import { fromCents, toCents } from "@/lib/money"
import { fetchRows } from "@/lib/supabase/rows"
import { createClient } from "@/lib/supabase/server"
import {
  DEFAULT_THRESHOLDS,
  type AlertThresholds,
  type BudgetCategory,
  type BudgetStatus,
  type CostClass,
  type CostSource,
} from "./schemas"

/** Las vistas SQL devuelven columnas anulables en los tipos generados; aquí se normalizan a número. */
const n = (v: number | string | null | undefined) => (v === null || v === undefined ? 0 : Number(v))
const nOrNull = (v: number | string | null | undefined) => (v === null || v === undefined ? null : Number(v))

function normalizeCosts(row: Awaited<ReturnType<typeof fetchCosts>>[number]) {
  return {
    projectId: row.project_id!,
    code: row.code ?? "",
    name: row.name ?? "",
    status: row.status!,
    cropId: row.crop_id!,
    cropName: row.crop_name ?? "",
    startDate: row.start_date!,
    budget: nOrNull(row.budget_amount),
    budgetId: row.budget_id,
    budgetVersion: row.budget_version,
    areaHa: n(row.area_ha),
    inputsCost: n(row.inputs_cost),
    machineryCost: n(row.machinery_cost),
    laborCost: n(row.labor_cost),
    expensesCost: n(row.expenses_cost),
    activitiesCost: n(row.activities_cost),
    /** Por clase de costo (las siete clases suman totalCost). */
    byClass: {
      insumos: n(row.materials_cost),
      mano_obra: n(row.labor_cost),
      maquinaria: n(row.machinery_cost),
      combustibles: n(row.fuel_cost),
      mantenimiento: n(row.maintenance_cost),
      servicios: n(row.services_cost),
      gastos_adicionales: n(row.other_cost),
    } satisfies Record<CostClass, number>,
    totalCost: n(row.total_cost),
    costPerHa: nOrNull(row.cost_per_ha),
    harvestedKg: n(row.harvested_kg),
    costPerKg: nOrNull(row.cost_per_kg),
    costPerTon: nOrNull(row.cost_per_ton),
    yieldKgPerHa: nOrNull(row.yield_kg_per_ha),
    soldKg: n(row.sold_kg),
    availableKg: n(row.available_kg),
    shrinkageKg: n(row.shrinkage_kg),
    lots: n(row.lots),
    cuts: n(row.cuts),
    salesAmount: n(row.sales_amount),
    collectedAmount: n(row.collected_amount),
    receivableAmount: n(row.receivable_amount),
    grossProfit: n(row.gross_profit),
    estimatedResult: n(row.estimated_result),
    marginPct: nOrNull(row.margin_pct),
    stockValueAtCost: n(row.stock_value_at_cost),
    budgetUsedPct: nOrNull(row.budget_used_pct),
    budgetVariance: nOrNull(row.budget_variance),
    budgetRemaining: nOrNull(row.budget_remaining),
    budgetStatus: (row.budget_status ?? "sin_presupuesto") as BudgetStatus,
  }
}

export type CostScope = { projectId?: string; cropId?: string }

async function fetchCosts(scope: CostScope = {}) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase.from("v_project_costs").select("*").eq("organization_id", ctx.organization.id).order("code")
  if (scope.projectId) query = query.eq("project_id", scope.projectId)
  if (scope.cropId) query = query.eq("crop_id", scope.cropId)
  const { data, error } = await query
  if (error) throw new Error("No fue posible calcular los costos.")
  return data
}

/** Costos, producción, ventas, cobranza y presupuesto por proyecto (vista v_project_costs). */
export async function getProjectCosts(scope: CostScope = {}) {
  return (await fetchCosts(scope)).map(normalizeCosts)
}

export async function getProjectCost(projectId: string) {
  const [row] = await fetchCosts({ projectId })
  return row ? normalizeCosts(row) : null
}

/** Detalle de costos del proyecto: la misma fuente que alimenta los totales, con su origen. */
export async function getProjectCostEntries(projectId: string, limit = 100) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("v_project_cost_entries")
    .select("source, source_id, entry_date, concept, detail, amount, expense_category, cost_class, budget_category, origin_table, origin_id")
    .eq("organization_id", ctx.organization.id)
    .eq("project_id", projectId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error("No fue posible cargar el detalle de costos.")
  return data.map((e) => ({
    ...e,
    source: e.source as CostSource,
    cost_class: e.cost_class as CostClass,
    amount: n(e.amount),
  }))
}

export type CostEntryFilters = { from?: string; to?: string; projectId?: string; cropId?: string }

/** Renglones de costo para reportes (máximo `limit`). */
export async function getCostEntries(filters: CostEntryFilters, limit = 20000) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase
    .from("v_project_cost_entries")
    .select("project_id, entry_date, source, cost_class, budget_category, amount")
    .eq("organization_id", ctx.organization.id)
  if (filters.from) query = query.gte("entry_date", filters.from)
  if (filters.to) query = query.lte("entry_date", filters.to)
  if (filters.projectId) query = query.eq("project_id", filters.projectId)
  const { data, error } = await fetchRows(query.order("entry_date").order("source").order("source_id"), limit)
  if (error || !data) throw new Error("No fue posible cargar los costos.")
  return data.map((e) => ({
    projectId: e.project_id!,
    date: e.entry_date!,
    source: e.source as CostSource,
    costClass: e.cost_class as CostClass,
    budgetCategory: e.budget_category as BudgetCategory,
    amount: n(e.amount),
  }))
}

// -----------------------------------------------------------------------------
// Gastos
// -----------------------------------------------------------------------------
export type ExpenseFilters = { from?: string; to?: string; projectId?: string }

export async function getExpenses(filters: ExpenseFilters = {}, limit = 500) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const projectJoin = filters.projectId ? "project_expenses!inner" : "project_expenses"
  let query = supabase
    .from("expenses")
    .select(
      `id, expense_date, category, cost_category, description, invoice_ref, amount, paid_amount, payment_method,
       allocation_method, notes, status, cancel_reason, created_at,
       supplier:suppliers(id, name), responsible:profiles(full_name, email),
       allocations:${projectJoin}(id, project_id, plot_id, amount, allocation_share, allocation_basis,
         project:projects!inner(id, code, name, status), assignment:project_plots(plot:plots!inner(name)))`
    )
    .eq("organization_id", ctx.organization.id)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
  if (filters.from) query = query.gte("expense_date", filters.from)
  if (filters.to) query = query.lte("expense_date", filters.to)
  if (filters.projectId) query = query.eq("project_expenses.project_id", filters.projectId)
  const { data, error } = await fetchRows(query.order("id"), limit)
  if (error || !data) throw new Error("No fue posible cargar los gastos.")
  return data.map((e) => {
    const amount = n(e.amount)
    const paid = n(e.paid_amount)
    return {
      ...e,
      amount,
      paidAmount: paid,
      pendingAmount: e.status === "registrado" ? fromCents(toCents(amount) - toCents(paid)) : 0,
      paymentStatus: (e.status === "cancelado" ? "cancelado" : paid === 0 ? "pendiente" : paid < amount ? "parcial" : "pagado") as
        | "cancelado"
        | "pendiente"
        | "parcial"
        | "pagado",
      allocations: e.allocations
        .map((a) => ({ ...a, amount: n(a.amount), allocation_share: n(a.allocation_share), allocation_basis: n(a.allocation_basis) }))
        .sort((a, b) => a.project.code.localeCompare(b.project.code)),
    }
  })
}

/** Pagos registrados de un gasto (movimientos de efectivo), incluidos los cancelados. */
export async function getExpensePayments(expenseIds: string[]) {
  if (expenseIds.length === 0) return []
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("cash_movements")
    .select("id, expense_id, movement_date, amount, method, reference, status, cancel_reason")
    .eq("organization_id", ctx.organization.id)
    .in("expense_id", expenseIds)
    .order("movement_date", { ascending: false })
  if (error) throw new Error("No fue posible cargar los pagos de gastos.")
  return data.map((m) => ({ ...m, amount: n(m.amount) }))
}

// -----------------------------------------------------------------------------
// Presupuestos
// -----------------------------------------------------------------------------
export async function getFinanceSettings(): Promise<AlertThresholds> {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("finance_settings")
    .select("warning_pct, critical_pct, exhausted_pct")
    .eq("organization_id", ctx.organization.id)
    .maybeSingle()
  if (error) throw new Error("No fue posible cargar la configuración de alertas.")
  if (!data) return DEFAULT_THRESHOLDS
  return { warning: n(data.warning_pct), critical: n(data.critical_pct), exhausted: n(data.exhausted_pct) }
}

/** Presupuesto vigente contra costo real por proyecto y categoría (vista v_budget_comparison). */
export async function getBudgetComparison(scope: CostScope = {}) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase
    .from("v_budget_comparison")
    .select("project_id, code, name, project_status, category, budget_amount, actual_amount, difference, used_pct, status")
    .eq("organization_id", ctx.organization.id)
    .order("code")
  if (scope.projectId) query = query.eq("project_id", scope.projectId)
  if (scope.cropId) {
    const { data: ids } = await supabase.from("projects").select("id").eq("organization_id", ctx.organization.id).eq("crop_id", scope.cropId)
    query = query.in("project_id", (ids ?? []).map((p) => p.id))
  }
  const { data, error } = await query
  if (error) throw new Error("No fue posible comparar el presupuesto.")
  return data.map((r) => ({
    projectId: r.project_id!,
    code: r.code,
    name: r.name,
    category: r.category as BudgetCategory,
    budget: n(r.budget_amount),
    actual: n(r.actual_amount),
    difference: n(r.difference),
    usedPct: nOrNull(r.used_pct),
    status: (r.status ?? "sin_presupuesto") as BudgetStatus,
  }))
}

/** Versiones del presupuesto de un proyecto (la más reciente primero). */
export async function getBudgetVersions(projectId: string) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("project_budgets")
    .select("id, version, is_current, area_ha, period_start, period_end, total, revision_reason, notes, created_at, crop:crops!inner(name, variety)")
    .eq("organization_id", ctx.organization.id)
    .eq("project_id", projectId)
    .order("version", { ascending: false })
  if (error) throw new Error("No fue posible cargar los presupuestos.")
  return data.map((b) => ({ ...b, total: n(b.total), area_ha: n(b.area_ha) }))
}

/** Total de la versión original (1) de cada proyecto: el presupuesto inicial. */
export async function getInitialBudgets() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("project_budgets")
    .select("project_id, total")
    .eq("organization_id", ctx.organization.id)
    .eq("version", 1)
  if (error) throw new Error("No fue posible cargar los presupuestos iniciales.")
  return new Map(data.map((b) => [b.project_id, n(b.total)]))
}

export async function getBudgetLines(budgetId: string) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("project_budget_lines")
    .select("id, line_no, category, concept, unit, quantity, unit_cost, amount")
    .eq("organization_id", ctx.organization.id)
    .eq("budget_id", budgetId)
    .order("line_no")
  if (error) throw new Error("No fue posible cargar las partidas del presupuesto.")
  return data.map((l) => ({ ...l, quantity: n(l.quantity), unit_cost: n(l.unit_cost), amount: n(l.amount) }))
}

/** Partidas de los presupuestos vigentes (reporte de presupuestos). */
export async function getCurrentBudgetLines(scope: CostScope = {}) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase
    .from("project_budget_lines")
    .select(
      "line_no, category, concept, unit, quantity, unit_cost, amount, budget:project_budgets!inner(version, is_current, period_start, period_end, area_ha, project:projects!inner(id, code, name, crop_id))"
    )
    .eq("organization_id", ctx.organization.id)
    .eq("budget.is_current", true)
  if (scope.projectId) query = query.eq("budget.project_id", scope.projectId)
  if (scope.cropId) query = query.eq("budget.project.crop_id", scope.cropId)
  const { data, error } = await fetchRows(query.order("budget_id").order("line_no"), 5000)
  if (error || !data) throw new Error("No fue posible cargar los presupuestos.")
  return data
    .map((l) => ({
      project: l.budget.project.code,
      projectName: l.budget.project.name,
      version: l.budget.version,
      lineNo: l.line_no,
      category: l.category,
      concept: l.concept,
      unit: l.unit,
      quantity: n(l.quantity),
      unitCost: n(l.unit_cost),
      amount: n(l.amount),
    }))
    .sort((a, b) => a.project.localeCompare(b.project) || a.lineNo - b.lineNo)
}

// -----------------------------------------------------------------------------
// Flujo de efectivo
// -----------------------------------------------------------------------------
export type CashFlowFilters = { from: string; to: string; projectId?: string }

export async function getCashFlow(filters: CashFlowFilters) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("cash_flow_entries", {
    p_org: ctx.organization.id,
    p_from: filters.from,
    p_to: filters.to,
    p_project: filters.projectId,
  })
  if (error) throw new Error("No fue posible calcular el flujo de efectivo.")
  return data
    .map((e) => ({ ...e, amount: n(e.amount), direction: e.direction as "ingreso" | "egreso" }))
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date) || a.concept.localeCompare(b.concept))
}

/** Movimientos de efectivo capturados (para cancelarlos y auditarlos), incluidos los cancelados. */
export async function getCashMovements(filters: CashFlowFilters) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase
    .from("cash_movements")
    .select(
      "id, kind, direction, movement_date, concept, amount, method, reference, status, cancel_reason, notes, expense_id, supplier:suppliers(name), project:projects(id, code)"
    )
    .eq("organization_id", ctx.organization.id)
    .gte("movement_date", filters.from)
    .lte("movement_date", filters.to)
    .order("movement_date", { ascending: false })
    .order("created_at", { ascending: false })
  if (filters.projectId) query = query.eq("project_id", filters.projectId)
  const { data, error } = await fetchRows(query.order("id"), 5000)
  if (error || !data) throw new Error("No fue posible cargar los movimientos de efectivo.")
  return data.map((m) => ({ ...m, amount: n(m.amount) }))
}

// -----------------------------------------------------------------------------
// Series del dashboard financiero
// -----------------------------------------------------------------------------
type MonthDatum = { month: string; value: number }

export type FinancialSeries = {
  period_cost: number
  period_sales: number
  period_collected: number
  costs_by_month: MonthDatum[]
  sales_by_month: MonthDatum[]
  collections_by_month: MonthDatum[]
}

export type FinancialFilters = { from: string; to: string; cropId?: string; projectId?: string }

export async function getFinancialSeries(filters: FinancialFilters): Promise<FinancialSeries> {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("financial_series", {
    p_org: ctx.organization.id,
    p_from: filters.from,
    p_to: filters.to,
    p_crop: filters.cropId,
    p_project: filters.projectId,
  })
  if (error || !data) throw new Error("No fue posible calcular las series financieras.")
  const s = data as FinancialSeries
  const num = (rows: MonthDatum[]) => rows.map((r) => ({ month: r.month, value: Number(r.value) }))
  return {
    period_cost: Number(s.period_cost),
    period_sales: Number(s.period_sales),
    period_collected: Number(s.period_collected),
    costs_by_month: num(s.costs_by_month),
    sales_by_month: num(s.sales_by_month),
    collections_by_month: num(s.collections_by_month),
  }
}

// -----------------------------------------------------------------------------
// Dashboard general (indicadores acumulados de la organización)
// -----------------------------------------------------------------------------
type FinanceSummary = {
  total_cost: number
  inputs_cost: number
  machinery_cost: number
  labor_cost: number
  expenses_cost: number
  activities_cost: number
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
export type Expense = Awaited<ReturnType<typeof getExpenses>>[number]
export type ExpensePayment = Awaited<ReturnType<typeof getExpensePayments>>[number]
export type BudgetComparisonRow = Awaited<ReturnType<typeof getBudgetComparison>>[number]
export type BudgetVersion = Awaited<ReturnType<typeof getBudgetVersions>>[number]
export type BudgetLine = Awaited<ReturnType<typeof getBudgetLines>>[number]
export type CashFlowEntry = Awaited<ReturnType<typeof getCashFlow>>[number]
export type CashMovement = Awaited<ReturnType<typeof getCashMovements>>[number]
