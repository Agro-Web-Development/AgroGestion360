import { describe, expect, it } from "vitest"

import { customerSchema } from "@/features/customers/schemas"
import { EXPENSE_CATEGORIES, expenseSchema, ratio } from "@/features/finance/schemas"
import { harvestSchema } from "@/features/harvests/schemas"
import { movementSchema } from "@/features/inventory/schemas"
import { laborSchema } from "@/features/labor/schemas"
import { usageSchema } from "@/features/machinery/schemas"
import { agingBucket } from "@/features/sales/aging"
import { lineAmount, paymentSchema, saleSchema } from "@/features/sales/schemas"
import { isDuplicateId } from "@/lib/actions"
import { can } from "@/lib/auth/roles"
import { todayISO } from "@/lib/format"
import { newId } from "@/lib/ids"
import { NONE } from "@/lib/validation"

const UUID = "00000000-0000-4000-a000-000000000001"
const UUID2 = "00000000-0000-4000-a000-000000000002"
const TODAY = todayISO()
const TOMORROW = new Date(Date.parse(`${TODAY}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)

describe("inventario", () => {
  const movement = {
    id: UUID,
    productId: UUID,
    type: "entrada",
    date: TODAY,
    warehouseId: UUID2,
    toWarehouseId: "",
    quantity: "100",
    unitCost: "9.80",
    projectId: "",
    plotId: "",
    lotId: "",
    lotNumber: "",
    lotExpiry: "",
    supplierId: NONE,
    responsibleId: NONE,
    reference: "",
    notes: "",
  } as const

  it("una entrada exige costo unitario y no requiere proyecto", () => {
    expect(movementSchema.safeParse(movement).success).toBe(true)
    expect(movementSchema.safeParse({ ...movement, unitCost: "" }).success).toBe(false)
  })

  it("consumos y devoluciones exigen proyecto y parcela", () => {
    const consumo = { ...movement, type: "consumo", unitCost: "" } as const
    expect(movementSchema.safeParse(consumo).success).toBe(false)
    expect(movementSchema.safeParse({ ...consumo, projectId: UUID }).success).toBe(false)
    expect(movementSchema.safeParse({ ...consumo, projectId: UUID, plotId: UUID2 }).success).toBe(true)
  })

  it("rechaza fechas futuras y cantidades con más de 3 decimales", () => {
    expect(movementSchema.safeParse({ ...movement, date: TOMORROW }).success).toBe(false)
    expect(movementSchema.safeParse({ ...movement, quantity: "1.2345" }).success).toBe(false)
  })
})

describe("maquinaria y mano de obra", () => {
  it("el uso de maquinaria acepta tarifa vacía (la toma del equipo) y máximo 24 h", () => {
    const usage = {
      id: UUID,
      machineId: UUID,
      projectId: UUID,
      plotId: NONE,
      date: TODAY,
      hours: "8",
      rateBasis: "hora",
      jornadas: "",
      rate: "",
      operatorId: NONE,
      operator: "",
      activityTypeId: NONE,
      activity: "",
      fuelQuantity: "",
      fuelFromStock: false,
      fuelProductId: "",
      fuelWarehouseId: "",
      fuelLotId: "",
      notes: "",
    } as const
    const r = usageSchema.parse(usage)
    expect(r.rate).toBeNull()
    expect(r.plotId).toBeNull()
    expect(usageSchema.safeParse({ ...usage, hours: "25" }).success).toBe(false)
  })

  const labor = {
    id: UUID,
    projectId: UUID,
    plotId: "",
    employeeId: UUID,
    crew: "",
    date: TODAY,
    activityTypeId: NONE,
    activity: "Deshierbe",
    payType: "jornal",
    quantity: "1",
    unitLabel: "",
    unitRate: "",
    notes: "",
  } as const

  it("un empleado registra máximo un jornal por día", () => {
    expect(laborSchema.safeParse(labor).success).toBe(true)
    expect(laborSchema.safeParse({ ...labor, quantity: "1.5" }).success).toBe(false)
  })

  it("una cuadrilla exige descripción y tarifa", () => {
    const crew = { ...labor, employeeId: NONE, quantity: "8" }
    expect(laborSchema.safeParse(crew).success).toBe(false)
    expect(laborSchema.safeParse({ ...crew, crew: "Cuadrilla 1", unitRate: "350" }).success).toBe(true)
  })

  it("el destajo exige tarifa por unidad", () => {
    const destajo = { ...labor, payType: "destajo", quantity: "200", unitLabel: "caja" } as const
    expect(laborSchema.safeParse(destajo).success).toBe(false)
    expect(laborSchema.safeParse({ ...destajo, unitRate: "9" }).success).toBe(true)
  })
})

describe("gastos y cosechas", () => {
  it("las categorías de gasto excluyen insumos, maquinaria y mano de obra (evita duplicar costos)", () => {
    for (const forbidden of ["insumos", "maquinaria", "mano_obra", "combustible"]) {
      expect(EXPENSE_CATEGORIES).not.toContain(forbidden)
    }
  })

  it("normaliza el folio de factura", () => {
    const r = expenseSchema.parse({
      id: UUID,
      projectId: UUID,
      plotId: "",
      date: TODAY,
      category: "fletes",
      description: "Flete",
      supplier: "",
      invoiceRef: "tfe-1290",
      amount: "28,500",
      notes: "",
    })
    expect(r).toMatchObject({ invoiceRef: "TFE-1290", amount: 28500, plotId: null })
  })

  it("una cosecha exige parcela y peso positivo", () => {
    const harvest = { id: UUID, projectId: UUID, plotId: UUID, date: TODAY, quality: "primera", quantityKg: "42000", packages: "", notes: "" } as const
    expect(harvestSchema.safeParse(harvest).success).toBe(true)
    expect(harvestSchema.safeParse({ ...harvest, plotId: "" }).success).toBe(false)
    expect(harvestSchema.safeParse({ ...harvest, quantityKg: "0" }).success).toBe(false)
  })
})

describe("ventas y cobranza", () => {
  const sale = {
    id: UUID,
    customerId: UUID,
    saleDate: TODAY,
    dueDate: "",
    notes: "",
    items: [{ projectId: UUID, description: "Brócoli", quality: NONE, quantityKg: "1000", unitPrice: "9.8" }],
  }

  it("valida partidas y convierte la calidad vacía en null", () => {
    const r = saleSchema.parse(sale)
    expect(r.items[0]).toMatchObject({ quality: null, quantityKg: 1000, unitPrice: 9.8 })
    expect(r.dueDate).toBeNull()
    expect(saleSchema.safeParse({ ...sale, items: [] }).success).toBe(false)
    expect(saleSchema.safeParse({ ...sale, items: [{ ...sale.items[0], unitPrice: "0" }] }).success).toBe(false)
  })

  it("el vencimiento no es anterior a la venta", () => {
    expect(saleSchema.safeParse({ ...sale, saleDate: "2026-03-10", dueDate: "2026-03-01" }).success).toBe(false)
  })

  it("el importe de la partida se redondea a centavos como en la BD", () => {
    expect(lineAmount(1000, 9.8)).toBe(9800)
    expect(lineAmount(333.333, 1.115)).toBe(371.67)
    expect(lineAmount(0.1, 0.2)).toBe(0.02)
  })

  it("un pago exige importe positivo con 2 decimales", () => {
    const payment = { id: UUID, saleId: UUID, date: TODAY, amount: "100.50", method: "efectivo", reference: "", notes: "" } as const
    expect(paymentSchema.safeParse(payment).success).toBe(true)
    expect(paymentSchema.safeParse({ ...payment, amount: "0" }).success).toBe(false)
    expect(paymentSchema.safeParse({ ...payment, amount: "10.555" }).success).toBe(false)
  })

  it("clasifica la antigüedad de saldos", () => {
    expect(agingBucket(0)).toBe("corriente")
    expect(agingBucket(1)).toBe("d1_30")
    expect(agingBucket(31)).toBe("d31_60")
    expect(agingBucket(90)).toBe("d61_90")
    expect(agingBucket(91)).toBe("d90")
  })

  it("valida RFC y días de crédito del cliente", () => {
    const customer = { name: "Exportadora", rfc: "", contactName: "", phone: "", email: "", address: "", creditDays: "", notes: "" }
    expect(customerSchema.parse(customer).creditDays).toBe(0)
    expect(customerSchema.parse({ ...customer, rfc: "ehb120415kq3" }).rfc).toBe("EHB120415KQ3")
    expect(customerSchema.safeParse({ ...customer, rfc: "XYZ" }).success).toBe(false)
    expect(customerSchema.safeParse({ ...customer, creditDays: "400" }).success).toBe(false)
  })
})

describe("idempotencia y permisos", () => {
  it("genera UUID v4 válidos y distintos", () => {
    const a = newId()
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(newId()).not.toBe(a)
  })

  it("reconoce el choque de llave primaria de un reintento, no otros duplicados", () => {
    expect(isDuplicateId({ code: "23505", message: 'duplicate key value violates unique constraint "harvests_pkey"' })).toBe(true)
    expect(
      isDuplicateId({ code: "23505", message: 'duplicate key value violates unique constraint "project_expenses_invoice_key"' })
    ).toBe(false)
  })

  it("ratio no divide entre cero", () => {
    expect(ratio(100, 0)).toBeNull()
    expect(ratio(8380, 35)).toBeCloseTo(239.43, 2)
  })

  it("los permisos financieros coinciden con la RLS", () => {
    expect(can("finanzas", "expenses.write")).toBe(true)
    expect(can("agronomo", "expenses.write")).toBe(false)
    expect(can("agronomo", "finance.read")).toBe(false)
    expect(can("almacen", "inventory.write")).toBe(true)
    expect(can("supervisor", "labor.write")).toBe(true)
    expect(can("supervisor", "employees.write")).toBe(false)
    expect(can("consulta", "finance.read")).toBe(true)
  })
})
