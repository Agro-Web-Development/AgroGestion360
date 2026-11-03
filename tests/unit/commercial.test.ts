import { describe, expect, it } from "vitest"

import { monthSeries } from "@/features/commercial/series"
import { ATTACHMENT_PERMISSION, attachmentFileSchema, attachmentTypes } from "@/features/fieldlogs/schemas"
import { productionByDate, productionTotals, sumBy, yieldByPlot, type LotFigures } from "@/features/harvests/aggregate"
import { adjustmentSchema, harvestSchema, needsUnitWeight, toKg } from "@/features/harvests/schemas"
import {
  collectionSummary,
  deliverySchema,
  isActiveSale,
  paymentSchema,
  saleSchema,
  saleTotals,
} from "@/features/sales/schemas"
import { can } from "@/lib/auth/roles"
import { todayISO } from "@/lib/format"
import { NONE } from "@/lib/validation"

const UUID = "00000000-0000-4000-a000-000000000001"
const UUID2 = "00000000-0000-4000-a000-000000000002"
const TODAY = todayISO()

describe("cortes y lotes", () => {
  const harvest = {
    id: UUID,
    projectId: UUID,
    plotId: UUID,
    date: TODAY,
    cutNumber: "",
    quality: "primera",
    classification: "Exportación",
    unit: "caja",
    quantity: "500",
    unitWeightKg: "20",
    packages: "",
    responsibleId: NONE,
    notes: "",
  } as const

  it("convierte la unidad capturada a kilogramos como la BD", () => {
    expect(toKg(500, "caja", 20)).toBe(10000)
    expect(toKg(38.5, "t")).toBe(38500)
    expect(toKg(12.3456, "kg")).toBe(12.346)
    expect(needsUnitWeight("kg")).toBe(false)
    expect(needsUnitWeight("t")).toBe(false)
    expect(needsUnitWeight("arpilla")).toBe(true)
  })

  it("una unidad de empaque exige su peso; el número de corte es opcional", () => {
    const r = harvestSchema.parse(harvest)
    expect(r).toMatchObject({ cutNumber: null, quantity: 500, unitWeightKg: 20, responsibleId: null })
    expect(harvestSchema.safeParse({ ...harvest, unitWeightKg: "" }).success).toBe(false)
    expect(harvestSchema.safeParse({ ...harvest, unit: "kg", unitWeightKg: "" }).success).toBe(true)
    expect(harvestSchema.safeParse({ ...harvest, cutNumber: "0" }).success).toBe(false)
  })

  it("un ajuste exige justificación y cantidad positiva", () => {
    const adj = { id: UUID, harvestId: UUID2, type: "merma", quantityKg: "150", date: TODAY, reason: "Rezaga de selección" } as const
    expect(adjustmentSchema.safeParse(adj).success).toBe(true)
    expect(adjustmentSchema.safeParse({ ...adj, reason: "x" }).success).toBe(false)
    expect(adjustmentSchema.safeParse({ ...adj, quantityKg: "0" }).success).toBe(false)
    expect(adjustmentSchema.safeParse({ ...adj, type: "venta" }).success).toBe(false)
  })
})

describe("indicadores de producción", () => {
  const lot = (over: Partial<LotFigures>): LotFigures => ({
    projectId: "p1",
    projectCode: "PRY-1",
    cutNumber: 1,
    date: "2026-10-01",
    quality: "primera",
    plotId: "a",
    plotName: "Lote A",
    areaHa: 10,
    quantityKg: 1000,
    soldKg: 0,
    adjustedKg: 0,
    availableKg: 1000,
    ...over,
  })
  const rows = [
    lot({}),
    lot({ quality: "segunda", quantityKg: 500, availableKg: 300, soldKg: 200 }),
    lot({ cutNumber: 2, date: "2026-10-05", quantityKg: 2000, soldKg: 1500, adjustedKg: 100, availableKg: 400 }),
    lot({ projectId: "p2", projectCode: "PRY-2", plotId: "b", plotName: "Lote B", areaHa: 5, quantityKg: 800, availableKg: 800 }),
  ]

  it("cuenta cortes por proyecto (varias calidades = un corte) y suma existencias", () => {
    expect(productionTotals(rows)).toEqual({
      cuts: 3,
      lots: 4,
      producedKg: 4300,
      soldKg: 1700,
      shrinkageKg: 100,
      availableKg: 2500,
    })
  })

  it("rendimiento por parcela: la superficie cuenta una vez aunque haya varios cortes", () => {
    expect(yieldByPlot(rows)).toEqual([
      { projectCode: "PRY-1", plotName: "Lote A", areaHa: 10, kg: 3500, kgPerHa: 350 },
      { projectCode: "PRY-2", plotName: "Lote B", areaHa: 5, kg: 800, kgPerHa: 160 },
    ])
  })

  it("agrupa por calidad y por fecha", () => {
    expect(sumBy(rows, (r) => r.quality, (r) => r.quantityKg)).toEqual([
      { label: "primera", value: 3800 },
      { label: "segunda", value: 500 },
    ])
    expect(productionByDate(rows).map((d) => d.label)).toEqual(["2026-10-01", "2026-10-05"])
  })
})

describe("ventas", () => {
  const sale = {
    id: UUID,
    customerId: UUID,
    saleDate: TODAY,
    dueDate: "",
    deliveryDate: "",
    notes: "",
    items: [
      { harvestId: UUID, description: "", unit: "caja", quantity: "400", unitWeightKg: "20", unitPrice: "180", discount: "1000" },
      { harvestId: UUID2, description: "Lechuga", unit: "t", quantity: "2", unitWeightKg: "", unitPrice: "9000", discount: "" },
    ],
  }

  it("acepta varios productos o lotes en una venta", () => {
    const r = saleSchema.parse(sale)
    expect(r.items).toHaveLength(2)
    expect(r.items[1]).toMatchObject({ unit: "t", unitWeightKg: null, discount: 0 })
  })

  it("rechaza descuentos mayores al importe y empaques sin peso", () => {
    const bad = (item: Partial<(typeof sale.items)[number]>) =>
      saleSchema.safeParse({ ...sale, items: [{ ...sale.items[0], ...item }] }).success
    expect(bad({ discount: "72000.01" })).toBe(false)
    expect(bad({ discount: "72000" })).toBe(true)
    expect(bad({ unitWeightKg: "" })).toBe(false)
    expect(bad({ harvestId: "" })).toBe(false)
  })

  it("la entrega no puede ser anterior a la venta", () => {
    expect(saleSchema.safeParse({ ...sale, saleDate: "2026-03-10", deliveryDate: "2026-03-09" }).success).toBe(false)
  })

  it("calcula subtotal, descuentos, total y kilogramos con el redondeo de la BD", () => {
    expect(
      saleTotals([
        { quantity: 400, unitPrice: 180, discount: 1000, unit: "caja", unitWeightKg: 20 },
        { quantity: 2, unitPrice: 9000, discount: 0, unit: "t" },
        { quantity: 333.333, unitPrice: 1.115, discount: 0.5, unit: "kg" },
      ])
    ).toEqual({ subtotal: 90371.67, discount: 1000.5, total: 89371.17, kg: 10333.333 })
  })

  it("solo las ventas confirmadas cuentan como venta", () => {
    expect(isActiveSale("borrador")).toBe(false)
    expect(isActiveSale("cancelada")).toBe(false)
    expect(isActiveSale("confirmada")).toBe(true)
    expect(isActiveSale("parcialmente_pagada")).toBe(true)
    expect(isActiveSale("pagada")).toBe(true)
  })

  it("una entrega exige al menos una cantidad", () => {
    const delivery = {
      id: UUID,
      saleId: UUID,
      date: TODAY,
      receivedBy: "",
      transport: "",
      notes: "",
      items: [{ saleItemId: UUID, quantity: "0" }],
    }
    expect(deliverySchema.safeParse(delivery).success).toBe(false)
    expect(deliverySchema.safeParse({ ...delivery, items: [{ saleItemId: UUID, quantity: "100" }] }).success).toBe(true)
  })
})

describe("pagos y cuentas por cobrar", () => {
  it("distingue pagos de anticipos", () => {
    const payment = { id: UUID, saleId: UUID, kind: "anticipo", date: TODAY, amount: "20000", method: "cheque", reference: "", notes: "" }
    expect(paymentSchema.safeParse(payment).success).toBe(true)
    expect(paymentSchema.safeParse({ ...payment, kind: "otro" }).success).toBe(false)
    expect(paymentSchema.safeParse({ ...payment, method: "bitcoin" }).success).toBe(false)
  })

  it("total vendido, pagado, saldo, recuperación y último pago", () => {
    expect(
      collectionSummary([
        { total: 89000, paid: 45000, lastPaymentDate: "2026-10-03" },
        { total: 11000, paid: 0, lastPaymentDate: null },
        { total: 0.3, paid: 0.1, lastPaymentDate: "2026-10-09" },
      ])
    ).toEqual({ total: 100000.3, paid: 45000.1, balance: 55000.2, recoveryPct: 45, lastPaymentDate: "2026-10-09" })
    expect(collectionSummary([]).recoveryPct).toBeNull()
  })

  it("serie mensual continua con meses en cero", () => {
    expect(monthSeries("2026-09-15", "2026-12-01", [{ month: "2026-10", value: 5 }])).toEqual([
      { label: "sep 26", month: "2026-09", value: 0 },
      { label: "oct 26", month: "2026-10", value: 5 },
      { label: "nov 26", month: "2026-11", value: 0 },
      { label: "dic 26", month: "2026-12", value: 0 },
    ])
    expect(monthSeries("2026-12-01", "2027-01-31", []).map((m) => m.month)).toEqual(["2026-12", "2027-01"])
  })
})

describe("evidencias y permisos", () => {
  it("los comprobantes de pago aceptan PDF; las fotografías no", () => {
    expect(attachmentTypes("payment")).toContain("application/pdf")
    expect(attachmentTypes("harvest")).not.toContain("application/pdf")
    expect(attachmentFileSchema.safeParse({ path: `${UUID}/payment/${UUID}/a.pdf`, name: "a.pdf", type: "application/pdf", size: 10 }).success).toBe(true)
  })

  it("cada evidencia exige el permiso de su módulo", () => {
    expect(ATTACHMENT_PERMISSION.harvest).toBe("harvest.write")
    expect(ATTACHMENT_PERMISSION.payment).toBe("payments.write")
    expect(can("supervisor", ATTACHMENT_PERMISSION.harvest)).toBe(true)
    expect(can("supervisor", ATTACHMENT_PERMISSION.payment)).toBe(false)
  })

  it("mermas y ajustes: campo y almacén, pero no finanzas ni consulta", () => {
    expect(can("almacen", "produce.adjust")).toBe(true)
    expect(can("supervisor", "produce.adjust")).toBe(true)
    expect(can("finanzas", "produce.adjust")).toBe(false)
    expect(can("consulta", "produce.adjust")).toBe(false)
    expect(can("agronomo", "sales.write")).toBe(false)
  })
})
