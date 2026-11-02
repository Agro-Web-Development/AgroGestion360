import { z } from "zod"

import { todayISO } from "@/lib/format"
import { decimal, optionalDecimal, optionalId, optionalText, requiredDate, requiredId, requiredText } from "@/lib/validation"
import type { Database } from "@/types/database"

export type MachineKind = Database["public"]["Enums"]["machine_kind"]

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

export const machineSchema = z.object({
  id: z.uuid().optional(),
  name: requiredText(2, 120, "El nombre debe tener al menos 2 caracteres"),
  code: optionalText(20).transform((v) => v?.toUpperCase() ?? null),
  kind: z.enum(MACHINE_KINDS, { error: "Selecciona el tipo de equipo" }),
  hourlyCost: decimal({ scale: 2, max: 9_999_999, allowZero: true }),
  notes: optionalText(2000),
})

export const usageSchema = z
  .object({
    id: z.uuid(),
    machineId: requiredId("Selecciona el equipo"),
    projectId: requiredId("Selecciona el proyecto"),
    plotId: optionalId(),
    date: requiredDate(),
    hours: decimal({ scale: 2, max: 24 }),
    hourlyRate: optionalDecimal({ scale: 2, max: 9_999_999, allowZero: true }),
    operator: optionalText(120),
    activity: optionalText(150),
    notes: optionalText(500),
  })
  .refine((v) => v.date <= todayISO(), { path: ["date"], message: "No puede ser una fecha futura" })

export type MachineInput = z.input<typeof machineSchema>
export type UsageInput = z.input<typeof usageSchema>
