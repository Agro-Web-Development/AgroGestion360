import { z } from "zod"

import { todayISO } from "@/lib/format"
import {
  decimal,
  optionalDate,
  optionalDecimal,
  optionalId,
  optionalInteger,
  optionalText,
  requiredDate,
  requiredId,
  requiredText,
} from "@/lib/validation"
import type { Database } from "@/types/database"

export type MachineKind = Database["public"]["Enums"]["machine_kind"]
export type MachineStatus = Database["public"]["Enums"]["machine_status"]
export type RateBasis = Database["public"]["Enums"]["machine_rate_basis"]
export type MaintenanceKind = Database["public"]["Enums"]["maintenance_kind"]

export const MACHINE_KINDS = [
  "tractor",
  "cosechadora",
  "aspersora",
  "implemento",
  "vehiculo",
  "bomba",
  "otro",
] as const satisfies readonly MachineKind[]

export const MACHINE_KIND_LABELS: Record<MachineKind, string> = {
  tractor: "Tractor",
  cosechadora: "Cosechadora",
  aspersora: "Aspersora / fumigadora",
  implemento: "Implemento",
  vehiculo: "Vehículo",
  bomba: "Bomba / equipo de riego",
  otro: "Otro",
}

export const MACHINE_STATUSES = ["operativa", "en_mantenimiento", "fuera_servicio", "baja"] as const satisfies readonly MachineStatus[]

export const MACHINE_STATUS_LABELS: Record<MachineStatus, string> = {
  operativa: "Operativa",
  en_mantenimiento: "En mantenimiento",
  fuera_servicio: "Fuera de servicio",
  baja: "Dada de baja",
}

export const RATE_BASES = ["hora", "jornada"] as const satisfies readonly RateBasis[]

export const RATE_BASIS_LABELS: Record<RateBasis, string> = {
  hora: "Por hora",
  jornada: "Por jornada",
}

export const MAINTENANCE_KINDS = ["preventivo", "correctivo"] as const satisfies readonly MaintenanceKind[]

export const MAINTENANCE_KIND_LABELS: Record<MaintenanceKind, string> = {
  preventivo: "Mantenimiento preventivo",
  correctivo: "Reparación (correctivo)",
}

export type MaintenanceAlert = "vencido" | "proximo" | "al_dia" | "sin_programa" | "no_aplica"

export const MAINTENANCE_ALERT_LABELS: Record<MaintenanceAlert, string> = {
  vencido: "Mantenimiento vencido",
  proximo: "Mantenimiento próximo",
  al_dia: "Al día",
  sin_programa: "Sin programa",
  no_aplica: "—",
}

/** Un equipo puede registrar uso mientras no esté fuera de servicio ni dado de baja (misma regla que la BD). */
export const canRegisterUsage = (status: MachineStatus) => status === "operativa" || status === "en_mantenimiento"

export const machineSchema = z
  .object({
    id: z.uuid().optional(),
    name: requiredText(2, 120, "El nombre debe tener al menos 2 caracteres"),
    code: optionalText(20).transform((v) => v?.toUpperCase() ?? null),
    kind: z.enum(MACHINE_KINDS, { error: "Selecciona el tipo de equipo" }),
    brand: optionalText(60),
    model: optionalText(60),
    serialNumber: optionalText(60),
    acquisitionDate: optionalDate(),
    acquisitionCost: optionalDecimal({ scale: 2, max: 999_999_999, allowZero: true }),
    status: z.enum(MACHINE_STATUSES),
    responsibleId: optionalId(),
    rateBasis: z.enum(RATE_BASES),
    hourlyCost: decimal({ scale: 2, max: 9_999_999, allowZero: true }),
    dailyRate: optionalDecimal({ scale: 2, max: 9_999_999, allowZero: true }),
    maintenanceIntervalHours: optionalDecimal({ scale: 1, max: 99_999 }),
    maintenanceIntervalDays: optionalInteger(1, 3650),
    notes: optionalText(2000),
  })
  .superRefine((v, ctx) => {
    if (v.rateBasis === "jornada" && v.dailyRate === null) {
      ctx.addIssue({ code: "custom", path: ["dailyRate"], message: "Indica la tarifa por jornada" })
    }
    if (v.acquisitionDate && v.acquisitionDate > todayISO()) {
      ctx.addIssue({ code: "custom", path: ["acquisitionDate"], message: "No puede ser una fecha futura" })
    }
  })

export const usageSchema = z
  .object({
    id: z.uuid(),
    machineId: requiredId("Selecciona el equipo"),
    projectId: requiredId("Selecciona el proyecto"),
    plotId: optionalId(),
    date: requiredDate(),
    hours: decimal({ scale: 2, max: 24 }),
    rateBasis: z.enum(RATE_BASES),
    jornadas: optionalDecimal({ scale: 2, max: 1 }),
    rate: optionalDecimal({ scale: 2, max: 9_999_999, allowZero: true }),
    operatorId: optionalId(),
    operator: optionalText(120),
    activityTypeId: optionalId(),
    activity: optionalText(150),
    fuelQuantity: optionalDecimal({ scale: 3, max: 99_999 }),
    fuelFromStock: z.boolean(),
    fuelProductId: optionalId(),
    fuelWarehouseId: optionalId(),
    fuelLotId: optionalId(),
    notes: optionalText(500),
  })
  .superRefine((v, ctx) => {
    if (v.date > todayISO()) ctx.addIssue({ code: "custom", path: ["date"], message: "No puede ser una fecha futura" })
    if (v.rateBasis === "jornada" && v.jornadas === null) {
      ctx.addIssue({ code: "custom", path: ["jornadas"], message: "Indica la fracción de jornada (1 = completa)" })
    }
    if (v.fuelFromStock) {
      if (!v.fuelProductId) ctx.addIssue({ code: "custom", path: ["fuelProductId"], message: "Selecciona el combustible" })
      if (v.fuelQuantity === null) ctx.addIssue({ code: "custom", path: ["fuelQuantity"], message: "Indica la cantidad" })
      if (!v.fuelWarehouseId) ctx.addIssue({ code: "custom", path: ["fuelWarehouseId"], message: "Selecciona el almacén" })
      if (!v.plotId) {
        ctx.addIssue({ code: "custom", path: ["plotId"], message: "El combustible del almacén se carga a una parcela" })
      }
    }
  })

export const maintenanceSchema = z
  .object({
    id: z.uuid(),
    machineId: requiredId("Selecciona el equipo"),
    date: requiredDate(),
    kind: z.enum(MAINTENANCE_KINDS),
    description: requiredText(3, 300, "Describe el servicio o la reparación"),
    provider: optionalText(150),
    cost: optionalDecimal({ scale: 2, max: 99_999_999, allowZero: true }).transform((v) => v ?? 0),
    hourMeter: optionalDecimal({ scale: 1, max: 999_999 }),
    responsibleId: optionalId(),
    notes: optionalText(1000),
  })
  .refine((v) => v.date <= todayISO(), { path: ["date"], message: "No puede ser una fecha futura" })

export type MachineInput = z.input<typeof machineSchema>
export type UsageInput = z.input<typeof usageSchema>
export type MaintenanceInput = z.input<typeof maintenanceSchema>

/** Importe del uso: horas × tarifa o jornadas × tarifa (mismo cálculo que la columna amount). */
export function usageAmount(basis: RateBasis, hours: number, jornadas: number | null, rate: number): number {
  return Math.round((basis === "jornada" ? (jornadas ?? 0) : hours) * rate * 100) / 100
}
