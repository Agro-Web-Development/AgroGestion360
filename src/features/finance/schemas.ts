import { z } from "zod"

import { todayISO } from "@/lib/format"
import { divRound, toScaled } from "@/lib/money"
import {
  decimal,
  optionalDate,
  optionalDecimal,
  optionalId,
  optionalText,
  requiredDate,
  requiredId,
  requiredText,
} from "@/lib/validation"
import type { Database } from "@/types/database"

type Enums = Database["public"]["Enums"]
export type ExpenseCategory = Enums["expense_category"]
export type BudgetCategory = Enums["budget_category"]
export type AllocationMethod = Enums["allocation_method"]
export type CashKind = Enums["cash_kind"]
export type PaymentMethod = Enums["payment_method"]

// -----------------------------------------------------------------------------
// Tipos de gasto (qué es) y categorías presupuestales (contra qué se compara)
// -----------------------------------------------------------------------------

/** Sin insumos, maquinaria ni mano de obra: esos costos se capturan en su módulo. */
export const EXPENSE_CATEGORIES = [
  "renta_tierra",
  "agua_riego",
  "energia",
  "fletes",
  "servicios_profesionales",
  "maquila",
  "mantenimiento",
  "seguros",
  "financiamiento",
  "derechos_impuestos",
  "otros",
] as const satisfies readonly ExpenseCategory[]

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  renta_tierra: "Renta de tierra",
  agua_riego: "Agua de riego",
  energia: "Energía eléctrica",
  fletes: "Fletes",
  servicios_profesionales: "Servicios profesionales",
  maquila: "Maquila / servicios contratados",
  mantenimiento: "Mantenimiento de infraestructura",
  seguros: "Seguro agrícola",
  financiamiento: "Intereses y comisiones",
  derechos_impuestos: "Derechos e impuestos",
  otros: "Otros",
}

export const BUDGET_CATEGORIES = [
  "preparacion_terreno",
  "semillas",
  "fertilizantes",
  "agroquimicos",
  "riego",
  "mano_obra",
  "maquinaria",
  "combustible",
  "mantenimiento",
  "cosecha",
  "transporte",
  "otros",
] as const satisfies readonly BudgetCategory[]

export const BUDGET_CATEGORY_LABELS: Record<BudgetCategory, string> = {
  preparacion_terreno: "Preparación de terreno",
  semillas: "Semillas",
  fertilizantes: "Fertilizantes",
  agroquimicos: "Agroquímicos",
  riego: "Riego",
  mano_obra: "Mano de obra",
  maquinaria: "Maquinaria",
  combustible: "Combustible",
  mantenimiento: "Mantenimiento",
  cosecha: "Cosecha",
  transporte: "Transporte",
  otros: "Otros gastos",
}

/** Categorías que admite un gasto (las demás nacen en inventario, personal o maquinaria). Igual que la BD. */
export const EXPENSE_BUDGET_CATEGORIES = [
  "preparacion_terreno",
  "riego",
  "mantenimiento",
  "cosecha",
  "transporte",
  "otros",
] as const satisfies readonly BudgetCategory[]

/** Categoría sugerida para un tipo de gasto (expense_default_budget_category en la BD). */
export function defaultBudgetCategory(category: ExpenseCategory): (typeof EXPENSE_BUDGET_CATEGORIES)[number] {
  switch (category) {
    case "agua_riego":
    case "energia":
      return "riego"
    case "fletes":
      return "transporte"
    case "maquila":
      return "cosecha"
    case "mantenimiento":
      return "mantenimiento"
    default:
      return "otros"
  }
}

// -----------------------------------------------------------------------------
// Clases de costo (consolidación) y módulos de origen
// -----------------------------------------------------------------------------
export const COST_CLASSES = [
  "insumos",
  "mano_obra",
  "maquinaria",
  "combustibles",
  "mantenimiento",
  "servicios",
  "gastos_adicionales",
] as const
export type CostClass = (typeof COST_CLASSES)[number]

export const COST_CLASS_LABELS: Record<CostClass, string> = {
  insumos: "Insumos consumidos",
  mano_obra: "Mano de obra",
  maquinaria: "Maquinaria",
  combustibles: "Combustibles",
  mantenimiento: "Mantenimiento",
  servicios: "Servicios",
  gastos_adicionales: "Gastos adicionales",
}

export const COST_CLASS_DESCRIPTIONS: Record<CostClass, string> = {
  insumos: "Semillas, fertilizantes, agroquímicos y materiales consumidos del almacén.",
  mano_obra: "Jornales y destajos.",
  maquinaria: "Horas o jornadas de equipo a su tarifa (sin combustible del almacén).",
  combustibles: "Combustible surtido del almacén.",
  mantenimiento: "Mantenimiento de infraestructura del proyecto (el de maquinaria va en su tarifa).",
  servicios: "Servicios contratados: actividades, agua, energía, fletes, maquila y asesoría.",
  gastos_adicionales: "Renta, seguros, financiamiento, derechos y otros gastos.",
}

/** Clase de un gasto según su tipo (expense_cost_class en la BD). */
export function expenseCostClass(category: ExpenseCategory): CostClass {
  if (category === "mantenimiento") return "mantenimiento"
  if (["servicios_profesionales", "maquila", "fletes", "agua_riego", "energia"].includes(category)) return "servicios"
  return "gastos_adicionales"
}

export const COST_SOURCES = ["insumos", "maquinaria", "mano_obra", "gastos", "actividades"] as const
export type CostSource = (typeof COST_SOURCES)[number]

export const COST_SOURCE_LABELS: Record<CostSource, string> = {
  insumos: "Inventario",
  maquinaria: "Maquinaria",
  mano_obra: "Mano de obra",
  gastos: "Gastos",
  actividades: "Actividades de campo",
}

// -----------------------------------------------------------------------------
// Reparto de gastos compartidos
// -----------------------------------------------------------------------------
export const ALLOCATION_METHODS = ["directo", "superficie", "partes_iguales", "porcentaje", "importe"] as const satisfies readonly AllocationMethod[]

export const ALLOCATION_METHOD_LABELS: Record<AllocationMethod, string> = {
  directo: "Directo (un proyecto)",
  superficie: "Compartido por superficie",
  partes_iguales: "Compartido en partes iguales",
  porcentaje: "Compartido por porcentaje",
  importe: "Compartido por importe",
}

export const ALLOCATION_METHOD_DESCRIPTIONS: Record<AllocationMethod, string> = {
  directo: "Todo el gasto se carga a un proyecto (y opcionalmente a una parcela).",
  superficie: "Proporcional a las hectáreas asignadas a cada proyecto.",
  partes_iguales: "El mismo importe para cada proyecto.",
  porcentaje: "Porcentajes capturados que suman 100 %.",
  importe: "Importes capturados que suman el total del gasto.",
}

export type AllocationInput = { projectId: string; areaHa?: number | null; value?: number | string | null }
export type AllocationResult = { projectId: string; basis: number; share: number; amount: number }

/**
 * Reparto de un gasto, idéntico al de register_expense: proyectos en orden de
 * id, importe = round(total × base / Σ base, 2) y los centavos del redondeo al
 * proyecto con mayor base. Devuelve un mensaje si el reparto no es válido.
 */
export function allocateExpense(
  amount: number | string,
  method: AllocationMethod,
  items: readonly AllocationInput[]
): { ok: true; rows: AllocationResult[] } | { ok: false; error: string } {
  const total = toScaled(amount, 2)
  if (total <= BigInt(0)) return { ok: false, error: "Indica el importe del gasto." }
  if (method === "directo" ? items.length !== 1 : items.length < 2) {
    return { ok: false, error: method === "directo" ? "Selecciona un proyecto." : "Selecciona al menos dos proyectos." }
  }
  if (new Set(items.map((i) => i.projectId)).size !== items.length) {
    return { ok: false, error: "Cada proyecto aparece una sola vez." }
  }
  const sorted = [...items].sort((a, b) => (a.projectId < b.projectId ? -1 : a.projectId > b.projectId ? 1 : 0))
  // Bases escaladas a 2 decimales (hectáreas, porcentaje o importe).
  const basis = sorted.map((i) =>
    method === "superficie" ? toScaled(i.areaHa, 2) : method === "porcentaje" || method === "importe" ? toScaled(i.value ?? null, 2) : BigInt(100)
  )
  if (basis.some((b) => b <= BigInt(0))) {
    return {
      ok: false,
      error:
        method === "superficie"
          ? "Algún proyecto no tiene superficie asignada."
          : "Indica un valor mayor que cero para cada proyecto.",
    }
  }
  const totalBasis = basis.reduce((s, b) => s + b, BigInt(0))
  if (method === "porcentaje" && totalBasis !== BigInt(10000)) {
    return { ok: false, error: `Los porcentajes suman ${Number(totalBasis) / 100} %; deben sumar 100 %.` }
  }
  if (method === "importe" && totalBasis !== total) {
    return { ok: false, error: "Los importes del reparto deben sumar el total del gasto." }
  }
  const cents = basis.map((b) => divRound(total * b, totalBasis))
  let max = 0
  basis.forEach((b, i) => {
    if (b > basis[max]) max = i
  })
  cents[max] += total - cents.reduce((s, c) => s + c, BigInt(0))
  if (cents.some((c) => c <= BigInt(0))) {
    return { ok: false, error: `El importe es demasiado pequeño para repartirlo entre ${items.length} proyectos.` }
  }
  return {
    ok: true,
    rows: sorted.map((i, idx) => ({
      projectId: i.projectId,
      basis: Number(basis[idx]) / 100,
      share: Number(divRound(basis[idx] * BigInt(1_000_000), totalBasis)) / 1_000_000,
      amount: Number(cents[idx]) / 100,
    })),
  }
}

// -----------------------------------------------------------------------------
// Alertas de presupuesto
// -----------------------------------------------------------------------------
export const BUDGET_STATUSES = ["normal", "aviso", "critico", "agotado", "sin_presupuesto"] as const
export type BudgetStatus = (typeof BUDGET_STATUSES)[number]

export type AlertThresholds = { warning: number; critical: number; exhausted: number }
export const DEFAULT_THRESHOLDS: AlertThresholds = { warning: 70, critical: 90, exhausted: 100 }

export function budgetStatusLabel(status: BudgetStatus, t: AlertThresholds = DEFAULT_THRESHOLDS): string {
  switch (status) {
    case "normal":
      return `Normal (< ${t.warning} %)`
    case "aviso":
      return `Aviso (≥ ${t.warning} %)`
    case "critico":
      return `Crítico (≥ ${t.critical} %)`
    case "agotado":
      return `Agotado (≥ ${t.exhausted} %)`
    default:
      return "Sin presupuesto"
  }
}

/** Mismo criterio que budget_status() en la BD: compara importes exactos contra los umbrales. */
export function budgetStatus(budget: number | string | null, actual: number | string | null, t: AlertThresholds): BudgetStatus {
  const b = toScaled(budget ?? 0, 2)
  if (b <= BigInt(0)) return "sin_presupuesto"
  const a = toScaled(actual ?? 0, 2) * BigInt(1000)
  const reaches = (pct: number) => a >= b * toScaled(pct, 1)
  if (reaches(t.exhausted)) return "agotado"
  if (reaches(t.critical)) return "critico"
  if (reaches(t.warning)) return "aviso"
  return "normal"
}

export const isAlert = (status: BudgetStatus | string | null) => status === "aviso" || status === "critico" || status === "agotado"

// -----------------------------------------------------------------------------
// Movimientos de efectivo
// -----------------------------------------------------------------------------
export const CASH_KIND_LABELS: Record<CashKind, string> = {
  pago_gasto: "Pago de gasto",
  pago_proveedor: "Pago a proveedor",
  otro_ingreso: "Otro ingreso",
  otro_egreso: "Otro egreso",
}

/** Movimientos que se capturan desde Flujo de efectivo (el pago de un gasto se registra desde el gasto). */
export const MANUAL_CASH_KINDS = ["pago_proveedor", "otro_ingreso", "otro_egreso"] as const satisfies readonly CashKind[]

export const CASH_FLOW_KIND_LABELS: Record<string, string> = {
  cobro_venta: "Cobro de venta",
  anticipo_cliente: "Anticipo de cliente",
  ...CASH_KIND_LABELS,
}

const PAYMENT_METHODS = ["transferencia", "efectivo", "cheque", "deposito", "otro"] as const satisfies readonly PaymentMethod[]

// -----------------------------------------------------------------------------
// Esquemas de formularios
// -----------------------------------------------------------------------------
const NONE_OR = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .transform((v) => (v === "" || v === "__none__" ? null : v))
    .pipe(z.enum(values).nullable())

export const allocationItemSchema = z.object({
  projectId: requiredId("Selecciona el proyecto"),
  plotId: optionalId(),
  value: optionalDecimal({ scale: 2, max: 999_999_999_999 }),
})

export const expenseSchema = z
  .object({
    id: z.uuid(),
    paymentId: z.uuid(),
    date: requiredDate(),
    category: z.enum(EXPENSE_CATEGORIES, { error: "Selecciona el tipo de gasto" }),
    costCategory: z.enum(EXPENSE_BUDGET_CATEGORIES, { error: "Selecciona la categoría" }),
    description: requiredText(3, 200, "Describe el concepto del gasto"),
    amount: decimal({ scale: 2, max: 999_999_999_999 }),
    supplierId: optionalId(),
    invoiceRef: optionalText(60).transform((v) => v?.toUpperCase() ?? null),
    paymentMethod: NONE_OR(PAYMENT_METHODS),
    allocationMethod: z.enum(ALLOCATION_METHODS),
    allocations: z.array(allocationItemSchema).min(1, "Selecciona el proyecto").max(50, "Máximo 50 proyectos"),
    responsibleId: optionalId(),
    notes: optionalText(1000),
    paidNow: z.boolean(),
    paymentDate: optionalDate(),
    paymentReference: optionalText(60),
  })
  .superRefine((v, ctx) => {
    const today = todayISO()
    if (v.date > today) ctx.addIssue({ code: "custom", path: ["date"], message: "No puede ser una fecha futura" })
    if (v.allocationMethod === "directo" && v.allocations.length !== 1) {
      ctx.addIssue({ code: "custom", path: ["allocations"], message: "Un gasto directo corresponde a un solo proyecto" })
    }
    if (v.allocationMethod !== "directo" && v.allocations.length < 2) {
      ctx.addIssue({ code: "custom", path: ["allocations"], message: "Un gasto compartido se reparte entre al menos dos proyectos" })
    }
    if (new Set(v.allocations.map((a) => a.projectId)).size !== v.allocations.length) {
      ctx.addIssue({ code: "custom", path: ["allocations"], message: "Cada proyecto aparece una sola vez" })
    }
    if (v.allocationMethod === "porcentaje" || v.allocationMethod === "importe") {
      v.allocations.forEach((a, i) => {
        if (a.value === null) {
          ctx.addIssue({ code: "custom", path: ["allocations", i, "value"], message: "Obligatorio" })
        }
      })
      if (v.allocations.every((a) => a.value !== null)) {
        const totalBasis = v.allocations.reduce((s, a) => s + toScaled(a.value, 2), BigInt(0))
        const expected = v.allocationMethod === "porcentaje" ? BigInt(10000) : toScaled(v.amount, 2)
        if (totalBasis !== expected) {
          ctx.addIssue({
            code: "custom",
            path: ["allocations"],
            message:
              v.allocationMethod === "porcentaje"
                ? "Los porcentajes deben sumar 100 %"
                : "Los importes del reparto deben sumar el total del gasto",
          })
        }
      }
    }
    if (v.paidNow) {
      if (!v.paymentMethod) ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Indica cómo se pagó" })
      if (!v.paymentDate) ctx.addIssue({ code: "custom", path: ["paymentDate"], message: "Indica la fecha del pago" })
      else if (v.paymentDate > today) {
        ctx.addIssue({ code: "custom", path: ["paymentDate"], message: "No puede ser una fecha futura" })
      }
    }
  })

export const budgetLineSchema = z.object({
  category: z.enum(BUDGET_CATEGORIES, { error: "Selecciona la categoría" }),
  concept: requiredText(2, 150, "Describe el concepto"),
  unit: optionalText(20),
  quantity: decimal({ scale: 3, max: 999_999_999 }),
  unitCost: decimal({ scale: 4, max: 999_999_999, allowZero: true }),
})

const MAX_BUDGET_DAYS = 1095

export const budgetSchema = z
  .object({
    id: z.uuid(),
    projectId: z.uuid(),
    /** Versión desde la que se editó; null = presupuesto original. */
    baseVersion: z.number().int().positive().nullable(),
    periodStart: requiredDate("Indica el inicio del periodo"),
    periodEnd: requiredDate("Indica el fin del periodo"),
    areaHa: decimal({ scale: 2, max: 99_999 }),
    reason: optionalText(500),
    notes: optionalText(2000),
    lines: z.array(budgetLineSchema).min(1, "Agrega al menos una partida").max(200, "Máximo 200 partidas"),
  })
  .superRefine((v, ctx) => {
    if (v.periodEnd < v.periodStart) {
      ctx.addIssue({ code: "custom", path: ["periodEnd"], message: "No puede ser anterior al inicio" })
    } else if ((Date.parse(v.periodEnd) - Date.parse(v.periodStart)) / 86_400_000 > MAX_BUDGET_DAYS) {
      ctx.addIssue({ code: "custom", path: ["periodEnd"], message: "El periodo no puede exceder 3 años" })
    }
    if (v.baseVersion !== null && (v.reason ?? "").length < 5) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "Indica el motivo de la revisión (mínimo 5 caracteres)" })
    }
    const total = v.lines.reduce((s, l) => s + toScaled(l.quantity, 3) * toScaled(l.unitCost, 4), BigInt(0))
    if (total <= BigInt(0)) ctx.addIssue({ code: "custom", path: ["lines"], message: "El presupuesto debe sumar más de cero" })
  })

export const cashMovementSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(["pago_gasto", "pago_proveedor", "otro_ingreso", "otro_egreso"]),
    expenseId: optionalId(),
    supplierId: optionalId(),
    projectId: optionalId(),
    date: requiredDate(),
    amount: decimal({ scale: 2, max: 999_999_999_999 }),
    method: z.enum(PAYMENT_METHODS, { error: "Selecciona el método de pago" }),
    concept: optionalText(200),
    reference: optionalText(60),
    notes: optionalText(500),
  })
  .superRefine((v, ctx) => {
    if (v.date > todayISO()) ctx.addIssue({ code: "custom", path: ["date"], message: "No puede ser una fecha futura" })
    if (v.kind === "pago_gasto" && !v.expenseId) ctx.addIssue({ code: "custom", path: ["expenseId"], message: "Falta el gasto" })
    if (v.kind === "pago_proveedor" && !v.supplierId) {
      ctx.addIssue({ code: "custom", path: ["supplierId"], message: "Selecciona el proveedor" })
    }
    if (v.kind !== "pago_gasto" && (v.concept ?? "").length < 3) {
      ctx.addIssue({ code: "custom", path: ["concept"], message: "Describe el concepto (mínimo 3 caracteres)" })
    }
  })

const pct = () => decimal({ scale: 1, max: 300 })

export const financeSettingsSchema = z
  .object({ warning: pct(), critical: pct(), exhausted: pct() })
  .superRefine((v, ctx) => {
    if (v.critical <= v.warning) ctx.addIssue({ code: "custom", path: ["critical"], message: "Debe ser mayor que el aviso" })
    if (v.exhausted <= v.critical) ctx.addIssue({ code: "custom", path: ["exhausted"], message: "Debe ser mayor que el crítico" })
  })

export type ExpenseInput = z.input<typeof expenseSchema>
export type BudgetInput = z.input<typeof budgetSchema>
export type BudgetLineInput = z.input<typeof budgetLineSchema>
export type CashMovementInput = z.input<typeof cashMovementSchema>
export type FinanceSettingsInput = z.input<typeof financeSettingsSchema>

/** Divide sin producir Infinity/NaN: sin base devuelve null (se muestra "—"). */
export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null
}
