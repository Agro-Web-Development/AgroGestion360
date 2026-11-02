import { z } from "zod"

import { optionalInteger, optionalText, requiredText } from "@/lib/validation"

export const YIELD_UNITS = ["ton", "kg", "caja", "saco", "pieza"] as const
export type YieldUnit = (typeof YIELD_UNITS)[number]

export const YIELD_UNIT_LABELS: Record<YieldUnit, string> = {
  ton: "Toneladas",
  kg: "Kilogramos",
  caja: "Cajas",
  saco: "Sacos / arpillas",
  pieza: "Piezas",
}

export const YIELD_UNIT_SHORT: Record<YieldUnit, string> = {
  ton: "t",
  kg: "kg",
  caja: "cajas",
  saco: "sacos",
  pieza: "pzas",
}

export function yieldUnitShort(unit: string): string {
  return YIELD_UNIT_SHORT[unit as YieldUnit] ?? unit
}

export const cropSchema = z.object({
  id: z.uuid().optional(),
  name: requiredText(2, 80, "El nombre debe tener al menos 2 caracteres"),
  variety: optionalText(80),
  scientificName: optionalText(120),
  cycleDays: optionalInteger(1, 1825),
  yieldUnit: z.enum(YIELD_UNITS, { error: "Selecciona la unidad de producción" }),
  notes: optionalText(2000),
})

export type CropInput = z.input<typeof cropSchema>
