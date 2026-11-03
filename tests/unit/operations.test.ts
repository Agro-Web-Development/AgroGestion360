import { describe, expect, it } from "vitest"

import { matchesQuery } from "@/components/shared/search-input"
import {
  activitySchema,
  applicationSchema,
  appliedRate,
  attachmentPath,
  durationMinutes,
  formatDuration,
  irrigationSchema,
} from "@/features/fieldlogs/schemas"
import { expiryStatus, movementSchema, supplierSchema } from "@/features/inventory/schemas"
import { attendanceSchema, crewLaborSchema } from "@/features/labor/schemas"
import { canRegisterUsage, machineSchema, usageAmount, usageSchema } from "@/features/machinery/schemas"
import {
  inputConsumption,
  irrigationByPlot,
  laborByWorker,
  laborCostByProject,
  machineryUtilization,
  operatingCosts,
  sum,
} from "@/features/reports/aggregate"
import { toCsv } from "@/features/reports/csv"
import { can } from "@/lib/auth/roles"
import { todayISO } from "@/lib/format"
import { dateParam, idParam, param } from "@/lib/search-params"
import { NONE } from "@/lib/validation"

const UUID = "00000000-0000-4000-a000-000000000001"
const UUID2 = "00000000-0000-4000-a000-000000000002"
const TODAY = todayISO()
const TOMORROW = new Date(Date.parse(`${TODAY}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)

describe("inventario: almacenes, lotes y transferencias", () => {
  const base = {
    id: UUID,
    productId: UUID,
    type: "transferencia",
    date: TODAY,
    warehouseId: UUID,
    toWarehouseId: UUID2,
    quantity: "10",
    unitCost: "",
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

  it("una transferencia exige un almacén destino distinto al de origen", () => {
    expect(movementSchema.safeParse(base).success).toBe(true)
    expect(movementSchema.safeParse({ ...base, toWarehouseId: "" }).success).toBe(false)
    expect(movementSchema.safeParse({ ...base, toWarehouseId: UUID }).success).toBe(false)
  })

  it("todo movimiento indica el almacén", () => {
    expect(movementSchema.safeParse({ ...base, warehouseId: "" }).success).toBe(false)
  })

  it("clasifica caducidades: caducado, por caducar (30 días) y vigente", () => {
    expect(expiryStatus(-1)).toBe("caducado")
    expect(expiryStatus(0)).toBe("por_caducar")
    expect(expiryStatus(30)).toBe("por_caducar")
    expect(expiryStatus(31)).toBe("vigente")
    expect(expiryStatus(null)).toBeNull()
  })

  it("valida el RFC del proveedor y lo normaliza a mayúsculas", () => {
    const supplier = { name: "Agroinsumos", rfc: "agr120415kq3", contactName: "", phone: "", email: "", address: "", notes: "" }
    expect(supplierSchema.parse(supplier).rfc).toBe("AGR120415KQ3")
    expect(supplierSchema.safeParse({ ...supplier, rfc: "XYZ" }).success).toBe(false)
  })
})

describe("bitácoras de campo", () => {
  it("la duración del riego cruza la medianoche (mismo cálculo que la BD)", () => {
    expect(durationMinutes("06:00", "08:30")).toBe(150)
    expect(durationMinutes("22:00", "02:00")).toBe(240)
    expect(durationMinutes("07:00:00", "07:45:00")).toBe(45)
    expect(formatDuration(150)).toBe("2 h 30 min")
    expect(formatDuration(45)).toBe("45 min")
  })

  const irrigation = {
    id: UUID,
    projectId: UUID,
    plotId: UUID2,
    date: TODAY,
    startTime: "06:00",
    endTime: "07:00",
    system: NONE,
    waterM3: "",
    responsibleId: NONE,
    notes: "",
  }

  it("un riego exige parcela, horas distintas y fecha no futura; el sistema vacío usa el de la parcela", () => {
    const r = irrigationSchema.parse(irrigation)
    expect(r.system).toBeNull()
    expect(r.waterM3).toBeNull()
    expect(irrigationSchema.safeParse({ ...irrigation, endTime: "06:00" }).success).toBe(false)
    expect(irrigationSchema.safeParse({ ...irrigation, plotId: "" }).success).toBe(false)
    expect(irrigationSchema.safeParse({ ...irrigation, date: TOMORROW }).success).toBe(false)
    expect(irrigationSchema.safeParse({ ...irrigation, startTime: "25:00" }).success).toBe(false)
  })

  const application = {
    id: UUID,
    projectId: UUID,
    plotId: UUID2,
    date: TODAY,
    time: "07:30",
    productId: UUID,
    activeIngredient: "",
    quantity: "20",
    treatedArea: "10",
    issueFromStock: true,
    warehouseId: UUID,
    lotId: "",
    lotNumber: "",
    responsibleId: NONE,
    machineId: NONE,
    equipment: "",
    reentryHours: "",
    preharvestDays: "",
    notes: "",
  }

  it("una aplicación que sale del almacén exige el almacén", () => {
    expect(applicationSchema.safeParse(application).success).toBe(true)
    expect(applicationSchema.safeParse({ ...application, warehouseId: "" }).success).toBe(false)
    expect(applicationSchema.safeParse({ ...application, warehouseId: "", issueFromStock: false }).success).toBe(true)
    expect(applicationSchema.safeParse({ ...application, reentryHours: "-1" }).success).toBe(false)
  })

  it("la cantidad por hectárea es un dato de lo aplicado (sin recomendaciones)", () => {
    expect(appliedRate("20", "10")).toBe(2)
    expect(appliedRate(5, 0)).toBeNull()
  })

  it("una actividad sin costo registra 0 y no admite costo negativo", () => {
    const activity = {
      id: UUID,
      projectId: UUID,
      plotId: NONE,
      activityTypeId: UUID2,
      date: TODAY,
      description: "",
      responsibleId: NONE,
      cost: "",
      notes: "",
    }
    expect(activitySchema.parse(activity).cost).toBe(0)
    expect(activitySchema.safeParse({ ...activity, cost: "-5" }).success).toBe(false)
  })

  it("la ruta de una evidencia empieza con la organización (la RLS de Storage la usa)", () => {
    expect(attachmentPath(UUID, "irrigation_log", UUID2, "f1", "Foto Campo.JPG")).toBe(
      `${UUID}/irrigation_log/${UUID2}/f1.jpg`
    )
  })
})

describe("maquinaria", () => {
  it("el uso por jornada exige la fracción y el combustible del almacén exige producto y parcela", () => {
    const usage = {
      id: UUID,
      machineId: UUID,
      projectId: UUID,
      plotId: UUID2,
      date: TODAY,
      hours: "6",
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
    expect(usageSchema.safeParse(usage).success).toBe(true)
    expect(usageSchema.safeParse({ ...usage, rateBasis: "jornada" }).success).toBe(false)
    expect(usageSchema.safeParse({ ...usage, rateBasis: "jornada", jornadas: "1.5" }).success).toBe(false)
    expect(usageSchema.safeParse({ ...usage, rateBasis: "jornada", jornadas: "0.5" }).success).toBe(true)
    const fuel = { ...usage, fuelFromStock: true, fuelQuantity: "50", fuelProductId: UUID, fuelWarehouseId: UUID }
    expect(usageSchema.safeParse(fuel).success).toBe(true)
    expect(usageSchema.safeParse({ ...fuel, plotId: NONE }).success).toBe(false)
    expect(usageSchema.safeParse({ ...fuel, fuelProductId: "" }).success).toBe(false)
  })

  it("el importe se calcula por hora o por jornada", () => {
    expect(usageAmount("hora", 6, null, 500)).toBe(3000)
    expect(usageAmount("jornada", 9.5, 0.5, 3000)).toBe(1500)
  })

  it("un equipo cobrado por jornada exige la tarifa por jornada", () => {
    const machine = {
      name: "Tractor",
      code: "",
      kind: "tractor",
      brand: "",
      model: "",
      serialNumber: "",
      acquisitionDate: "",
      acquisitionCost: "",
      status: "operativa",
      responsibleId: NONE,
      rateBasis: "jornada",
      hourlyCost: "500",
      dailyRate: "",
      maintenanceIntervalHours: "",
      maintenanceIntervalDays: "",
      notes: "",
    } as const
    expect(machineSchema.safeParse(machine).success).toBe(false)
    expect(machineSchema.safeParse({ ...machine, dailyRate: "3000" }).success).toBe(true)
  })

  it("solo equipos operativos o en mantenimiento registran uso (misma regla que la BD)", () => {
    expect(canRegisterUsage("operativa")).toBe(true)
    expect(canRegisterUsage("en_mantenimiento")).toBe(true)
    expect(canRegisterUsage("fuera_servicio")).toBe(false)
    expect(canRegisterUsage("baja")).toBe(false)
  })
})

describe("personal", () => {
  it("las horas de entrada y salida solo se registran si el empleado está presente", () => {
    const attendance = { employeeId: UUID, date: TODAY, status: "presente", checkIn: "07:00", checkOut: "15:00", notes: "" } as const
    expect(attendanceSchema.safeParse(attendance).success).toBe(true)
    expect(attendanceSchema.safeParse({ ...attendance, status: "falta" }).success).toBe(false)
    expect(attendanceSchema.safeParse({ ...attendance, checkOut: "06:00" }).success).toBe(false)
    expect(attendanceSchema.safeParse({ ...attendance, status: "falta", checkIn: "", checkOut: "" }).success).toBe(true)
  })

  it("la jornada de cuadrilla exige integrantes y máximo 1 jornal por integrante", () => {
    const crew = {
      id: UUID,
      crewId: UUID,
      projectId: UUID,
      plotId: NONE,
      date: TODAY,
      activityTypeId: NONE,
      activity: "Deshierbe",
      payType: "jornal",
      quantity: "1",
      unitLabel: "",
      unitRate: "",
      employeeIds: [UUID, UUID2],
      notes: "",
    } as const
    expect(crewLaborSchema.safeParse(crew).success).toBe(true)
    expect(crewLaborSchema.safeParse({ ...crew, employeeIds: [] }).success).toBe(false)
    expect(crewLaborSchema.safeParse({ ...crew, quantity: "2" }).success).toBe(false)
    expect(crewLaborSchema.safeParse({ ...crew, payType: "destajo", quantity: "200" }).success).toBe(false)
  })
})

describe("reportes operativos", () => {
  const project = { id: UUID, code: "PRY-2026-0001" }

  it("el consumo neto descuenta devoluciones al costo histórico", () => {
    const product = { id: UUID2, name: "Urea", category: { name: "Fertilizantes" } }
    const rows = inputConsumption([
      { movement_type: "consumo", quantity: "100", total_cost: "1000.10", unit: "kg", product, project },
      { movement_type: "consumo", quantity: "50", total_cost: "550.20", unit: "kg", product, project },
      { movement_type: "devolucion", quantity: "10", total_cost: "100.01", unit: "kg", product, project },
      { movement_type: "entrada", quantity: "999", total_cost: "9999", unit: "kg", product, project: null },
    ])
    expect(rows).toEqual([
      {
        projectId: UUID,
        project: "PRY-2026-0001",
        product: "Urea",
        category: "Fertilizantes",
        unit: "kg",
        consumed: 150,
        returned: 10,
        net: 140,
        cost: 1450.29,
      },
    ])
  })

  it("los riegos cancelados no cuentan y el agua solo suma lo medido", () => {
    const assignment = { plot: { name: "Norte" } }
    const rows = irrigationByPlot([
      { status: "registrado", duration_minutes: 90, water_m3: "100", project, assignment },
      { status: "registrado", duration_minutes: 30, water_m3: null, project, assignment },
      { status: "cancelado", duration_minutes: 600, water_m3: "999", project, assignment },
    ])
    expect(rows).toEqual([{ project: "PRY-2026-0001", plot: "Norte", events: 2, hours: 2, water: 100, measured: 1 }])
  })

  it("agrupa jornadas por trabajador y costos por proyecto y actividad", () => {
    const labor = [
      { work_date: "2026-10-01", pay_type: "jornal", quantity: 1, amount: 400, crew: null, activity: "Deshierbe", employee: { full_name: "Ana" }, activity_type: { name: "Deshierbe" }, project },
      { work_date: "2026-10-02", pay_type: "jornal", quantity: 0.5, amount: 200, crew: null, activity: "Poda", employee: { full_name: "Ana" }, activity_type: null, project },
      { work_date: "2026-10-02", pay_type: "destajo", quantity: 100, amount: 900, crew: "Corte", activity: "Corte", employee: null, activity_type: null, project },
    ] as const
    const workers = laborByWorker(labor)
    expect(workers[0]).toMatchObject({ worker: "Ana", days: 2, jornales: 1.5, amount: 600 })
    expect(workers[1]).toMatchObject({ worker: "Cuadrilla: Corte", destajoRecords: 1, amount: 900 })
    expect(laborCostByProject(labor).map((r) => [r.activity, r.amount])).toEqual([
      ["Corte", 900],
      ["Deshierbe", 400],
      ["Poda", 200],
    ])
  })

  it("la maquinaria separa lo cargado a proyectos del mantenimiento", () => {
    const machine = { id: UUID, name: "Tractor" }
    const rows = machineryUtilization(
      [
        { hours: 6, jornadas: null, amount: 3000, fuel_quantity: 50, machine, fuel: { total_cost: 1000 }, project },
        { hours: 9.5, jornadas: 1, amount: 3000, fuel_quantity: null, machine, fuel: null, project },
      ],
      [
        { status: "registrado", kind: "preventivo", cost: 5000, machine_id: UUID, machine },
        { status: "cancelado", kind: "correctivo", cost: 999, machine_id: UUID, machine },
      ]
    )
    expect(rows).toEqual([
      {
        machine: "Tractor",
        records: 2,
        hours: 15.5,
        jornadas: 1,
        projects: "PRY-2026-0001",
        charged: 6000,
        fuel: 50,
        fuelCost: 1000,
        maintenance: 5000,
        repairs: 0,
      },
    ])
  })

  it("los costos operativos excluyen gastos directos y suman por fuente", () => {
    const rows = operatingCosts([
      { project_id: UUID, code: "P1", source: "insumos", amount: 100.1 },
      { project_id: UUID, code: "P1", source: "insumos", amount: -0.1 },
      { project_id: UUID, code: "P1", source: "maquinaria", amount: 50 },
      { project_id: UUID, code: "P1", source: "actividades", amount: 25 },
      { project_id: UUID, code: "P1", source: "gastos", amount: 1000 },
    ])
    expect(rows).toEqual([{ project: "P1", insumos: 100, maquinaria: 50, mano_obra: 0, actividades: 25, total: 175 }])
  })

  it("suma sin residuos de punto flotante", () => {
    expect(sum([{ v: 0.1 }, { v: 0.2 }], (r) => r.v)).toBe(0.3)
  })

  it("el CSV escapa comillas y comas y lleva BOM para Excel", () => {
    const csv = toCsv(
      [
        { key: "name", header: "Producto" },
        { key: "qty", header: "Cantidad", unit: "kg" },
      ],
      [{ name: 'Urea "46", granulada', qty: 12.5 }]
    )
    expect(csv).toBe('﻿Producto,Cantidad (kg)\r\n"Urea ""46"", granulada",12.5')
  })
})

describe("filtros y permisos", () => {
  it("los parámetros de búsqueda se validan antes de llegar a la consulta", () => {
    expect(idParam(UUID)).toBe(UUID)
    expect(idParam("x),organization_id.eq.otro")).toBeUndefined()
    expect(dateParam("2026-02-30")).toBeUndefined()
    expect(dateParam("2026-02-28")).toBe("2026-02-28")
    expect(param("__all__")).toBeUndefined()
    expect(param(["a", "b"])).toBe("a")
  })

  it("la búsqueda ignora mayúsculas y acentos", () => {
    expect(matchesQuery("fungicida", "Fungicida clorotalonil")).toBe(true)
    expect(matchesQuery("aplicacion", "Aplicación")).toBe(true)
    expect(matchesQuery("diesel", null, "Diésel")).toBe(true)
    expect(matchesQuery("urea", "Diésel")).toBe(false)
  })

  it("las bitácoras las capturan campo y agronomía; el almacén mueve inventario", () => {
    expect(can("supervisor", "fieldlogs.write")).toBe(true)
    expect(can("almacen", "fieldlogs.write")).toBe(false)
    expect(can("supervisor", "inventory.write")).toBe(false)
    expect(can("almacen", "inventory.write")).toBe(true)
    expect(can("consulta", "fieldlogs.write")).toBe(false)
  })
})
