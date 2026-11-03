import { describe, expect, it } from "vitest"

import {
  budgetAlerts,
  cashFlowSummary,
  combineProjects,
  compareBudget,
  comparisonTotals,
  costsByProjectClass,
  expensesByCategory,
  profitabilityByCrop,
  type ProjectFigures,
} from "@/features/finance/analysis"
import {
  allocateExpense,
  budgetSchema,
  budgetStatus,
  cashMovementSchema,
  COST_CLASSES,
  DEFAULT_THRESHOLDS,
  defaultBudgetCategory,
  EXPENSE_BUDGET_CATEGORIES,
  EXPENSE_CATEGORIES,
  expenseCostClass,
  expenseSchema,
  financeSettingsSchema,
  type ExpenseInput,
} from "@/features/finance/schemas"
import { toXlsxRows } from "@/features/reports/csv"
import { can, ROLES } from "@/lib/auth/roles"
import { todayISO } from "@/lib/format"
import { divRound, lineAmount, percent, scaleMoney, sumMoney, toCents, toScaled } from "@/lib/money"
import { NONE } from "@/lib/validation"
import { buildXlsx, columnName, crc32, excelDate } from "@/lib/xlsx"

const P1 = "00000000-0000-4000-a000-000000000001"
const P2 = "00000000-0000-4000-a000-000000000002"
const P3 = "00000000-0000-4000-a000-000000000003"
const TODAY = todayISO()

describe("aritmética de importes sin punto flotante", () => {
  it("suma al centavo donde los flotantes fallan", () => {
    expect(0.1 + 0.2).not.toBe(0.3)
    expect(sumMoney([0.1, 0.2])).toBe(0.3)
    expect(sumMoney(["1,000.10", 2000.2, null, "0.01"])).toBe(3000.31)
  })

  it("redondea a la mitad lejos de cero como round() de PostgreSQL", () => {
    expect(divRound(BigInt(5), BigInt(2))).toBe(BigInt(3))
    expect(divRound(BigInt(-5), BigInt(2))).toBe(BigInt(-3))
    expect(toScaled("12.345", 2)).toBe(BigInt(1235))
    expect(toCents("-0.005")).toBe(-1)
  })

  it("calcula el importe de una partida igual que la columna generada", () => {
    // 1.005 × 1 = 1.005 → 1.01 (en flotante 1.005 * 100 = 100.49999…)
    expect(lineAmount("1.005", "1")).toBe(1.01)
    expect(lineAmount("2.5", "400")).toBe(1000)
    expect(lineAmount("880000", "0.42")).toBe(369600)
  })

  it("porcentaje con un decimal y prorrateo exacto", () => {
    expect(percent(11616.67, 14400)).toBe(80.7)
    expect(percent(1, 0)).toBeNull()
    expect(scaleMoney(400, 0.333333)).toBe(133.33)
  })
})

describe("reparto de gastos compartidos (igual que register_expense)", () => {
  it("por superficie: 1,000 entre 30 y 15 ha", () => {
    const r = allocateExpense(1000, "superficie", [
      { projectId: P2, areaHa: 15 },
      { projectId: P1, areaHa: 30 },
    ])
    expect(r).toEqual({
      ok: true,
      rows: [
        { projectId: P1, basis: 30, share: 0.666667, amount: 666.67 },
        { projectId: P2, basis: 15, share: 0.333333, amount: 333.33 },
      ],
    })
  })

  it("el residuo del redondeo va al proyecto con mayor base y el total cuadra", () => {
    const r = allocateExpense(36000, "superficie", [
      { projectId: P1, areaHa: 45 },
      { projectId: P2, areaHa: 12 },
      { projectId: P3, areaHa: 20 },
    ])
    expect(r.ok && r.rows.map((x) => x.amount)).toEqual([21038.96, 5610.39, 9350.65])
    expect(r.ok && sumMoney(r.rows.map((x) => x.amount))).toBe(36000)
  })

  it("partes iguales con un centavo de más: lo ajusta el primer proyecto por id", () => {
    const r = allocateExpense("1000.01", "partes_iguales", [{ projectId: P2 }, { projectId: P1 }])
    expect(r.ok && r.rows.map((x) => [x.projectId, x.amount])).toEqual([
      [P1, 500],
      [P2, 500.01],
    ])
  })

  it("valida porcentajes, importes, duplicados y montos demasiado pequeños", () => {
    expect(allocateExpense(100, "porcentaje", [{ projectId: P1, value: 60 }, { projectId: P2, value: 30 }]).ok).toBe(false)
    expect(allocateExpense(100, "porcentaje", [{ projectId: P1, value: "60" }, { projectId: P2, value: "40" }]).ok).toBe(true)
    expect(allocateExpense(100, "importe", [{ projectId: P1, value: 60 }, { projectId: P2, value: 30 }]).ok).toBe(false)
    expect(allocateExpense(100, "partes_iguales", [{ projectId: P1 }, { projectId: P1 }]).ok).toBe(false)
    expect(allocateExpense(0.01, "partes_iguales", [{ projectId: P1 }, { projectId: P2 }]).ok).toBe(false)
    expect(allocateExpense(100, "superficie", [{ projectId: P1, areaHa: 0 }, { projectId: P2, areaHa: 3 }]).ok).toBe(false)
    expect(allocateExpense(100, "directo", [{ projectId: P1 }, { projectId: P2 }]).ok).toBe(false)
  })
})

describe("clasificación de costos y gastos", () => {
  it("un gasto no puede llevar categorías que nacen en otros módulos", () => {
    for (const c of ["semillas", "fertilizantes", "agroquimicos", "combustible", "mano_obra", "maquinaria"]) {
      expect(EXPENSE_BUDGET_CATEGORIES).not.toContain(c)
    }
  })

  it("cada tipo de gasto sugiere una categoría permitida y tiene clase de costo", () => {
    for (const c of EXPENSE_CATEGORIES) {
      expect(EXPENSE_BUDGET_CATEGORIES).toContain(defaultBudgetCategory(c))
      expect(COST_CLASSES).toContain(expenseCostClass(c))
    }
    expect(expenseCostClass("fletes")).toBe("servicios")
    expect(expenseCostClass("mantenimiento")).toBe("mantenimiento")
    expect(expenseCostClass("renta_tierra")).toBe("gastos_adicionales")
    expect(defaultBudgetCategory("maquila")).toBe("cosecha")
  })
})

describe("alertas de presupuesto (igual que budget_status)", () => {
  it("umbrales por omisión 70 / 90 / 100 con importes exactos", () => {
    expect(budgetStatus(1000, 699.99, DEFAULT_THRESHOLDS)).toBe("normal")
    expect(budgetStatus(1000, 700, DEFAULT_THRESHOLDS)).toBe("aviso")
    expect(budgetStatus(3300, 3000, DEFAULT_THRESHOLDS)).toBe("critico")
    expect(budgetStatus(2500, 2500, DEFAULT_THRESHOLDS)).toBe("agotado")
    expect(budgetStatus(0, 10, DEFAULT_THRESHOLDS)).toBe("sin_presupuesto")
  })

  it("respeta umbrales configurados", () => {
    const t = { warning: 50, critical: 75, exhausted: 95 }
    expect(budgetStatus(2000, 1500, t)).toBe("critico")
    expect(budgetStatus(1000, 400, t)).toBe("normal")
  })

  it("compara por categoría y ordena las alertas por gravedad", () => {
    const rows = compareBudget(
      [
        { category: "combustible", amount: 2500 },
        { category: "transporte", amount: 2000 },
        { category: "mano_obra", amount: 1000 },
      ],
      [
        { category: "combustible", amount: 2500 },
        { category: "transporte", amount: 1500 },
        { category: "mano_obra", amount: 400 },
        { category: "riego", amount: 500 },
      ],
      DEFAULT_THRESHOLDS
    )
    expect(rows.find((r) => r.category === "riego")).toMatchObject({ budget: 0, difference: -500, status: "sin_presupuesto" })
    expect(budgetAlerts(rows).map((r) => r.category)).toEqual(["combustible", "transporte"])
    expect(comparisonTotals(rows, DEFAULT_THRESHOLDS)).toMatchObject({ budget: 5500, actual: 4900, difference: 600, usedPct: 89.1 })
  })
})

describe("esquemas financieros", () => {
  const expense: ExpenseInput = {
    id: P1,
    paymentId: P2,
    date: TODAY,
    category: "renta_tierra",
    costCategory: "otros",
    description: "Renta compartida",
    amount: "1000",
    supplierId: NONE,
    invoiceRef: "",
    paymentMethod: "transferencia",
    allocationMethod: "porcentaje",
    allocations: [
      { projectId: P1, plotId: NONE, value: "60" },
      { projectId: P2, plotId: NONE, value: "40" },
    ],
    responsibleId: "",
    notes: "",
    paidNow: false,
    paymentDate: "",
    paymentReference: "",
  }

  it("gasto compartido válido y porcentajes que no suman 100", () => {
    expect(expenseSchema.safeParse(expense).success).toBe(true)
    const bad = { ...expense, allocations: [{ ...expense.allocations[0], value: "50" }, expense.allocations[1]] }
    expect(expenseSchema.safeParse(bad).success).toBe(false)
  })

  it("pagado al registrar exige fecha y método", () => {
    expect(expenseSchema.safeParse({ ...expense, paidNow: true, paymentDate: "" }).success).toBe(false)
    expect(expenseSchema.safeParse({ ...expense, paidNow: true, paymentDate: TODAY }).success).toBe(true)
    expect(expenseSchema.safeParse({ ...expense, paidNow: true, paymentDate: TODAY, paymentMethod: NONE }).success).toBe(false)
  })

  it("no admite una categoría de otro módulo", () => {
    expect(expenseSchema.safeParse({ ...expense, costCategory: "semillas" as never }).success).toBe(false)
  })

  const budget = {
    id: P1,
    projectId: P2,
    baseVersion: null,
    periodStart: "2026-01-01",
    periodEnd: "2026-06-30",
    areaHa: "30",
    reason: "",
    notes: "",
    lines: [{ category: "fertilizantes", concept: "Urea", unit: "kg", quantity: "400", unitCost: "10" }],
  } as const

  it("presupuesto: periodo, motivo de revisión y total positivo", () => {
    expect(budgetSchema.safeParse(budget).success).toBe(true)
    expect(budgetSchema.safeParse({ ...budget, periodEnd: "2025-12-31" }).success).toBe(false)
    expect(budgetSchema.safeParse({ ...budget, periodEnd: "2029-12-31" }).success).toBe(false)
    expect(budgetSchema.safeParse({ ...budget, baseVersion: 1 }).success).toBe(false)
    expect(budgetSchema.safeParse({ ...budget, baseVersion: 1, reason: "Nuevo precio" }).success).toBe(true)
    expect(budgetSchema.safeParse({ ...budget, lines: [{ ...budget.lines[0], unitCost: "0" }] }).success).toBe(false)
  })

  it("movimientos de efectivo y umbrales", () => {
    const base = {
      id: P1,
      kind: "pago_proveedor",
      expenseId: "",
      supplierId: "",
      projectId: "",
      date: TODAY,
      amount: "100",
      method: "efectivo",
      concept: "Pago factura",
      reference: "",
      notes: "",
    } as const
    expect(cashMovementSchema.safeParse(base).success).toBe(false)
    expect(cashMovementSchema.safeParse({ ...base, supplierId: P2 }).success).toBe(true)
    expect(cashMovementSchema.safeParse({ ...base, kind: "otro_ingreso", concept: "" }).success).toBe(false)
    expect(financeSettingsSchema.safeParse({ warning: "70", critical: "90", exhausted: "100" }).success).toBe(true)
    expect(financeSettingsSchema.safeParse({ warning: "90", critical: "80", exhausted: "100" }).success).toBe(false)
  })
})

describe("análisis y reportes", () => {
  const classes = (insumos: number, other = 0) => ({
    insumos,
    mano_obra: 0,
    maquinaria: 0,
    combustibles: 0,
    mantenimiento: 0,
    servicios: 0,
    gastos_adicionales: other,
  })
  const project = (crop: string, cost: number, sales: number, collected: number): ProjectFigures => ({
    cropName: crop,
    areaHa: 10,
    harvestedKg: 1000,
    soldKg: 800,
    availableKg: 200,
    totalCost: cost,
    salesAmount: sales,
    collectedAmount: collected,
    receivableAmount: sumMoney([sales, -collected]),
    stockValueAtCost: 0,
    budget: 1000,
    byClass: classes(cost),
  })

  it("resultado = ventas − costo (lo cobrado no es utilidad)", () => {
    const t = combineProjects([project("Maíz", 750.5, 1000.1, 200), project("Maíz", 100.2, 0, 0)])
    expect(t).toMatchObject({ totalCost: 850.7, sales: 1000.1, collected: 200, receivable: 800.1, result: 149.4, budget: 2000 })
    expect(t.byClass.insumos).toBe(850.7)
  })

  it("rentabilidad por cultivo", () => {
    const rows = profitabilityByCrop([project("Maíz", 100, 300, 0), project("Brócoli", 500, 400, 400), project("Maíz", 50, 0, 0)])
    expect(rows.map((r) => [r.crop, r.result, r.projects])).toEqual([
      ["Brócoli", -100, 1],
      ["Maíz", 150, 2],
    ])
  })

  it("gastos por categoría y costos por proyecto y clase", () => {
    const g = expensesByCategory([
      { category: "Renta", costCategory: "Otros", projectCode: "P1", amount: 666.67, shared: true },
      { category: "Renta", costCategory: "Otros", projectCode: "P2", amount: 333.33, shared: true },
      { category: "Fletes", costCategory: "Transporte", projectCode: "P1", amount: 1500, shared: false },
    ])
    expect(g[0]).toMatchObject({ category: "Fletes", amount: 1500, shared: 0 })
    expect(g[1]).toMatchObject({ category: "Renta", amount: 1000, shared: 1000, projects: "P1, P2", records: 2 })

    const c = costsByProjectClass(
      [
        { projectId: P1, costClass: "insumos", amount: 3000 },
        { projectId: P1, costClass: "servicios", amount: 0.1 },
        { projectId: P1, costClass: "servicios", amount: 0.2 },
      ],
      new Map([[P1, "PRY-1"]])
    )
    expect(c[0]).toMatchObject({ project: "PRY-1", insumos: 3000, servicios: 0.3, total: 3000.3 })
  })

  it("flujo de efectivo: ingresos, egresos y neto", () => {
    const s = cashFlowSummary([
      { direction: "ingreso", kind: "cobro_venta", amount: 5000.1, entry_date: TODAY },
      { direction: "egreso", kind: "pago_gasto", amount: 1500.05, entry_date: TODAY },
      { direction: "egreso", kind: "pago_gasto", amount: 400, entry_date: TODAY },
    ])
    expect(s).toMatchObject({ income: 5000.1, outflow: 1900.05, net: 3100.05 })
    expect(s.byKind.get("pago_gasto")).toBe(1900.05)
  })
})

describe("exportación a Excel", () => {
  it("columnas, fechas de Excel y CRC del ZIP", () => {
    expect([columnName(0), columnName(25), columnName(26), columnName(701)]).toEqual(["A", "Z", "AA", "ZZ"])
    expect(excelDate("1900-03-01")).toBe(61)
    expect(excelDate("2026-01-01")).toBe(46023)
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926)
  })

  it("genera un libro con números, fechas y texto escapado", () => {
    const columns = [
      { key: "date", header: "Fecha", format: "date" as const },
      { key: "concept", header: "Concepto" },
      { key: "amount", header: "Importe", format: "money" as const },
    ]
    const rows = toXlsxRows(columns, [{ date: "2026-01-01", concept: "Renta <B&C>", amount: "1500.5" }])
    expect(rows).toEqual([["2026-01-01", "Renta <B&C>", 1500.5]])
    const file = buildXlsx("Gastos", columns, rows)
    const text = new TextDecoder().decode(file)
    expect([...file.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
    expect(text).toContain("xl/worksheets/sheet1.xml")
    expect(text).toContain('<c r="A2" s="3"><v>46023</v></c>')
    expect(text).toContain("Renta &lt;B&amp;C&gt;")
    expect(text).toContain('<c r="C2" s="1"><v>1500.5</v></c>')
  })
})

describe("permisos financieros", () => {
  it("presupuestos y flujo solo para propietario, administrador y finanzas", () => {
    expect(ROLES.filter((r) => can(r, "budgets.write"))).toEqual(["propietario", "administrador", "finanzas"])
    expect(ROLES.filter((r) => can(r, "cash.write"))).toEqual(["propietario", "administrador", "finanzas"])
    expect(can("consulta", "finance.read")).toBe(true)
    expect(can("agronomo", "finance.read")).toBe(false)
  })
})
