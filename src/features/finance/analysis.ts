/**
 * Agregaciones del módulo financiero. Funciones puras (sin acceso a datos):
 * reciben renglones ya filtrados por organización y periodo, y suman al
 * centavo con aritmética entera (lib/money), igual que la base de datos.
 */
import { fromCents, percent, sumMoney, toCents } from "@/lib/money"
import {
  BUDGET_CATEGORIES,
  budgetStatus,
  COST_CLASSES,
  type AlertThresholds,
  type BudgetCategory,
  type BudgetStatus,
  type CostClass,
} from "./schemas"

export type ComparisonRow = {
  category: BudgetCategory
  budget: number
  actual: number
  difference: number
  usedPct: number | null
  status: BudgetStatus
}

/** Presupuesto contra gasto real por categoría (mismo criterio que v_budget_comparison). */
export function compareBudget(
  budget: readonly { category: BudgetCategory; amount: number }[],
  actual: readonly { category: BudgetCategory; amount: number }[],
  thresholds: AlertThresholds
): ComparisonRow[] {
  return BUDGET_CATEGORIES.map((category) => {
    const b = sumMoney(budget.filter((r) => r.category === category).map((r) => r.amount))
    const a = sumMoney(actual.filter((r) => r.category === category).map((r) => r.amount))
    return {
      category,
      budget: b,
      actual: a,
      difference: fromCents(toCents(b) - toCents(a)),
      usedPct: percent(a, b),
      status: budgetStatus(b, a, thresholds),
    }
  }).filter((r) => r.budget !== 0 || r.actual !== 0)
}

/** Totales de una comparación (presupuesto, real, diferencia, % y estado del conjunto). */
export function comparisonTotals(rows: readonly ComparisonRow[], thresholds: AlertThresholds) {
  const budget = sumMoney(rows.map((r) => r.budget))
  const actual = sumMoney(rows.map((r) => r.actual))
  return {
    budget,
    actual,
    difference: fromCents(toCents(budget) - toCents(actual)),
    usedPct: percent(actual, budget),
    status: budgetStatus(budget, actual, thresholds),
  }
}

const ALERT_ORDER: Record<BudgetStatus, number> = { agotado: 0, critico: 1, aviso: 2, normal: 3, sin_presupuesto: 4 }

/** Partidas en aviso, crítico o agotadas, de la más grave a la menos grave. */
export function budgetAlerts<T extends { status: BudgetStatus; usedPct: number | null }>(rows: readonly T[]): T[] {
  return rows
    .filter((r) => r.status === "aviso" || r.status === "critico" || r.status === "agotado")
    .sort((a, b) => ALERT_ORDER[a.status] - ALERT_ORDER[b.status] || (b.usedPct ?? 0) - (a.usedPct ?? 0))
}

// -----------------------------------------------------------------------------
// Rentabilidad
// -----------------------------------------------------------------------------
export type ProjectFigures = {
  cropName: string
  areaHa: number
  harvestedKg: number
  soldKg: number
  availableKg: number
  totalCost: number
  salesAmount: number
  collectedAmount: number
  receivableAmount: number
  stockValueAtCost: number
  budget: number | null
  byClass: Record<CostClass, number>
}

/** Suma de las cifras de varios proyectos, con indicadores derivados. */
export function combineProjects(rows: readonly ProjectFigures[]) {
  const totalCost = sumMoney(rows.map((r) => r.totalCost))
  const sales = sumMoney(rows.map((r) => r.salesAmount))
  const collected = sumMoney(rows.map((r) => r.collectedAmount))
  const receivable = sumMoney(rows.map((r) => r.receivableAmount))
  const budget = sumMoney(rows.map((r) => r.budget ?? 0))
  const areaHa = rows.reduce((s, r) => s + r.areaHa, 0)
  const harvestedKg = rows.reduce((s, r) => s + r.harvestedKg, 0)
  const result = fromCents(toCents(sales) - toCents(totalCost))
  return {
    projects: rows.length,
    areaHa: Math.round(areaHa * 100) / 100,
    harvestedKg: Math.round(harvestedKg * 1000) / 1000,
    soldKg: Math.round(rows.reduce((s, r) => s + r.soldKg, 0) * 1000) / 1000,
    availableKg: Math.round(rows.reduce((s, r) => s + r.availableKg, 0) * 1000) / 1000,
    totalCost,
    budget,
    budgetUsedPct: percent(totalCost, budget),
    sales,
    collected,
    receivable,
    stockValueAtCost: sumMoney(rows.map((r) => r.stockValueAtCost)),
    result,
    marginPct: sales > 0 ? percent(result, sales) : null,
    costPerHa: areaHa > 0 ? totalCost / areaHa : null,
    costPerKg: harvestedKg > 0 ? totalCost / harvestedKg : null,
    yieldKgPerHa: areaHa > 0 ? harvestedKg / areaHa : null,
    byClass: Object.fromEntries(COST_CLASSES.map((c) => [c, sumMoney(rows.map((r) => r.byClass[c]))])) as Record<CostClass, number>,
  }
}

/** Rentabilidad agrupada por cultivo (incluye variedad). */
export function profitabilityByCrop<T extends ProjectFigures>(rows: readonly T[]) {
  const groups = new Map<string, T[]>()
  for (const r of rows) groups.set(r.cropName, [...(groups.get(r.cropName) ?? []), r])
  return [...groups.entries()]
    .map(([crop, items]) => ({ crop, ...combineProjects(items) }))
    .sort((a, b) => a.crop.localeCompare(b.crop, "es"))
}

// -----------------------------------------------------------------------------
// Flujo de efectivo
// -----------------------------------------------------------------------------
export type CashFlowRow = { direction: "ingreso" | "egreso"; kind: string; amount: number; entry_date: string }

export function cashFlowSummary(rows: readonly CashFlowRow[]) {
  const income = sumMoney(rows.filter((r) => r.direction === "ingreso").map((r) => r.amount))
  const outflow = sumMoney(rows.filter((r) => r.direction === "egreso").map((r) => r.amount))
  const byKind = new Map<string, number>()
  for (const r of rows) byKind.set(r.kind, fromCents(toCents(byKind.get(r.kind) ?? 0) + toCents(r.amount)))
  return { income, outflow, net: fromCents(toCents(income) - toCents(outflow)), byKind }
}

/** Ingresos y egresos por mes (AAAA-MM). */
export function cashFlowByMonth(rows: readonly CashFlowRow[]) {
  const months = new Map<string, { income: number; outflow: number }>()
  for (const r of rows) {
    const key = r.entry_date.slice(0, 7)
    const m = months.get(key) ?? { income: 0, outflow: 0 }
    if (r.direction === "ingreso") m.income = fromCents(toCents(m.income) + toCents(r.amount))
    else m.outflow = fromCents(toCents(m.outflow) + toCents(r.amount))
    months.set(key, m)
  }
  return months
}

// -----------------------------------------------------------------------------
// Reportes
// -----------------------------------------------------------------------------
export type ExpenseAllocationRow = {
  category: string
  costCategory: string
  projectCode: string
  amount: number
  shared: boolean
}

/** Gastos por tipo y categoría presupuestal (importes asignados a los proyectos del filtro). */
export function expensesByCategory(rows: readonly ExpenseAllocationRow[]) {
  const groups = new Map<string, ExpenseAllocationRow[]>()
  for (const r of rows) {
    const key = `${r.category}|${r.costCategory}`
    groups.set(key, [...(groups.get(key) ?? []), r])
  }
  return [...groups.values()]
    .map((items) => ({
      category: items[0].category,
      costCategory: items[0].costCategory,
      records: items.length,
      projects: [...new Set(items.map((i) => i.projectCode))].sort().join(", "),
      shared: sumMoney(items.filter((i) => i.shared).map((i) => i.amount)),
      amount: sumMoney(items.map((i) => i.amount)),
    }))
    .sort((a, b) => b.amount - a.amount)
}

/** Costos por proyecto y clase (un renglón por proyecto, una columna por clase). */
export function costsByProjectClass(entries: readonly { projectId: string; costClass: CostClass; amount: number }[], codes: Map<string, string>) {
  const groups = new Map<string, { projectId: string; costClass: CostClass; amount: number }[]>()
  for (const e of entries) groups.set(e.projectId, [...(groups.get(e.projectId) ?? []), e])
  return [...groups.entries()]
    .map(([projectId, items]) => ({
      project: codes.get(projectId) ?? "",
      ...Object.fromEntries(COST_CLASSES.map((c) => [c, sumMoney(items.filter((i) => i.costClass === c).map((i) => i.amount))])),
      total: sumMoney(items.map((i) => i.amount)),
    }))
    .sort((a, b) => a.project.localeCompare(b.project))
}
