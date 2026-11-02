import { describe, expect, it } from "vitest"

import { cropSchema } from "@/features/crops/schemas"
import { farmSchema, plotSchema } from "@/features/farms/schemas"
import { changeStatusSchema, projectPlotSchema, projectSchema } from "@/features/projects/schemas"
import { nextStatuses, PROJECT_STATUSES, TRANSITIONS } from "@/features/projects/status"
import { can } from "@/lib/auth/roles"
import { formatDate } from "@/lib/format"
import { NONE } from "@/lib/validation"

const UUID = "00000000-0000-4000-a000-000000000001"

describe("ranchos y parcelas", () => {
  const farm = {
    name: "El Mezquite",
    code: "",
    municipality: "",
    state: "",
    address: "",
    totalAreaHa: "",
    latitude: "",
    longitude: "",
    notes: "",
  }

  it("convierte vacíos en null y normaliza la clave", () => {
    const r = farmSchema.parse({ ...farm, code: "mzq-01", totalAreaHa: "1,250.5" })
    expect(r).toMatchObject({ code: "MZQ-01", totalAreaHa: 1250.5, municipality: null, latitude: null })
  })

  it("exige latitud y longitud juntas y en rango", () => {
    expect(farmSchema.safeParse({ ...farm, latitude: "20.5" }).success).toBe(false)
    expect(farmSchema.safeParse({ ...farm, latitude: "95", longitude: "-101" }).success).toBe(false)
    expect(farmSchema.safeParse({ ...farm, latitude: "20.676700", longitude: "-101.354200" }).success).toBe(true)
  })

  it("rechaza estados que no son de México", () => {
    expect(farmSchema.safeParse({ ...farm, state: "Texas" }).success).toBe(false)
    expect(farmSchema.safeParse({ ...farm, state: "Guanajuato" }).success).toBe(true)
  })

  it("valida la superficie de la parcela", () => {
    const plot = { farmId: UUID, name: "P1", code: "", soilType: "", irrigationType: "goteo", notes: "" } as const
    expect(plotSchema.safeParse({ ...plot, areaHa: "0" }).success).toBe(false)
    expect(plotSchema.safeParse({ ...plot, areaHa: "12.345" }).success).toBe(false)
    expect(plotSchema.safeParse({ ...plot, areaHa: "abc" }).success).toBe(false)
    expect(plotSchema.parse({ ...plot, areaHa: "12.5" }).areaHa).toBe(12.5)
  })
})

describe("cultivos", () => {
  it("valida ciclo y unidad", () => {
    const crop = { name: "Maíz", variety: "", scientificName: "", yieldUnit: "ton", notes: "" } as const
    expect(cropSchema.parse({ ...crop, cycleDays: "150" }).cycleDays).toBe(150)
    expect(cropSchema.parse({ ...crop, cycleDays: "" }).cycleDays).toBeNull()
    expect(cropSchema.safeParse({ ...crop, cycleDays: "12.5" }).success).toBe(false)
    expect(cropSchema.safeParse({ ...crop, cycleDays: "", yieldUnit: "litro" }).success).toBe(false)
  })
})

describe("proyectos", () => {
  const project = {
    name: "Maíz P-V",
    cropId: UUID,
    season: "",
    startDate: "2026-03-01",
    plantingDate: "",
    expectedHarvestDate: "",
    expectedYield: "",
    budgetAmount: "",
    responsibleId: NONE,
    description: "",
  }

  it("acepta un proyecto mínimo y convierte el responsable vacío en null", () => {
    const r = projectSchema.parse(project)
    expect(r.responsibleId).toBeNull()
    expect(r.budgetAmount).toBeNull()
  })

  it("valida el orden de las fechas", () => {
    expect(projectSchema.safeParse({ ...project, plantingDate: "2026-02-01" }).success).toBe(false)
    expect(
      projectSchema.safeParse({ ...project, plantingDate: "2026-03-10", expectedHarvestDate: "2026-03-05" }).success
    ).toBe(false)
    expect(
      projectSchema.safeParse({ ...project, plantingDate: "2026-03-10", expectedHarvestDate: "2026-07-10" }).success
    ).toBe(true)
  })

  it("permite presupuesto cero pero no superficie asignada cero", () => {
    expect(projectSchema.parse({ ...project, budgetAmount: "0" }).budgetAmount).toBe(0)
    expect(projectPlotSchema.safeParse({ projectId: UUID, plotId: UUID, assignedAreaHa: "0" }).success).toBe(false)
  })

  it("exige motivo al cancelar", () => {
    expect(changeStatusSchema.safeParse({ projectId: UUID, status: "cancelado", note: "" }).success).toBe(false)
    expect(changeStatusSchema.safeParse({ projectId: UUID, status: "cancelado", note: "Sequía" }).success).toBe(true)
    expect(changeStatusSchema.safeParse({ projectId: UUID, status: "siembra", note: "" }).success).toBe(true)
  })
})

describe("estados del proyecto", () => {
  it("define transiciones para los 8 estados sin permitir quedarse igual", () => {
    expect(PROJECT_STATUSES).toHaveLength(8)
    for (const s of PROJECT_STATUSES) {
      expect(TRANSITIONS[s].length).toBeGreaterThan(0)
      expect(TRANSITIONS[s]).not.toContain(s)
    }
  })

  it("solo quien puede reabrir ve opciones en proyectos cerrados o cancelados", () => {
    expect(nextStatuses("cerrado", false)).toEqual([])
    expect(nextStatuses("cancelado", true)).toEqual(["planeacion"])
    expect(nextStatuses("planeacion", false)).toContain("cancelado")
    expect(nextStatuses("comercializacion", false)).not.toContain("cancelado")
  })

  it("los permisos coinciden con la RLS", () => {
    expect(can("agronomo", "projects.write")).toBe(true)
    expect(can("agronomo", "projects.reopen")).toBe(false)
    expect(can("agronomo", "catalogs.delete")).toBe(false)
    expect(can("supervisor", "catalogs.write")).toBe(false)
    expect(can("administrador", "projects.delete")).toBe(true)
  })
})

describe("fechas sin hora", () => {
  it("no recorre las columnas DATE al día anterior en la zona de México", () => {
    expect(formatDate("2026-03-01")).toMatch(/^01 mar/)
  })
})
