import { z } from "zod"

import { todayISO } from "@/lib/format"
import {
  decimal,
  optionalDecimal,
  optionalId,
  optionalInteger,
  optionalText,
  requiredDate,
  requiredId,
  requiredText,
} from "@/lib/validation"
import type { Database } from "@/types/database"

export type HarvestQuality = Database["public"]["Enums"]["harvest_quality"]
export type ProduceUnit = Database["public"]["Enums"]["produce_unit"]
export type ProductionMovementType = Database["public"]["Enums"]["production_movement_type"]

export const HARVEST_QUALITIES = ["primera", "segunda", "tercera", "unica"] as const satisfies readonly HarvestQuality[]

export const QUALITY_LABELS: Record<HarvestQuality, string> = {
  primera: "Primera",
  segunda: "Segunda",
  tercera: "Tercera / rezaga",
  unica: "Calidad única",
}

/** Unidades de captura y venta; la existencia siempre se lleva en kilogramos. */
export const PRODUCE_UNITS = ["kg", "t", "caja", "saco", "arpilla", "reja"] as const satisfies readonly ProduceUnit[]

export const UNIT_LABELS: Record<ProduceUnit, string> = {
  kg: "Kilogramos",
  t: "Toneladas",
  caja: "Cajas",
  saco: "Sacos",
  arpilla: "Arpillas",
  reja: "Rejas",
}

export const UNIT_SHORT: Record<ProduceUnit, string> = {
  kg: "kg",
  t: "t",
  caja: "cajas",
  saco: "sacos",
  arpilla: "arpillas",
  reja: "rejas",
}

/** Las unidades de empaque requieren su peso neto en kg. */
export function needsUnitWeight(unit: string): boolean {
  return unit !== "kg" && unit !== "t"
}

/** Kilogramos de una cantidad capturada, redondeados a gramos como en la BD. */
export function toKg(quantity: number, unit: ProduceUnit, unitWeightKg?: number | null): number {
  const factor = unit === "kg" ? 1 : unit === "t" ? 1000 : (unitWeightKg ?? 0)
  return Math.round(quantity * factor * 1000) / 1000
}

/** Sugerencias de clasificación comercial (texto libre en la BD). */
export const CLASSIFICATION_SUGGESTIONS = ["Exportación", "Nacional", "Congelado", "Industria", "Mercado local", "Rezaga"]

export const ADJUSTMENT_TYPES = ["merma", "perdida", "ajuste_salida", "ajuste_entrada"] as const satisfies readonly ProductionMovementType[]
export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number]

export const MOVEMENT_LABELS: Record<ProductionMovementType, string> = {
  venta: "Venta",
  cancelacion_venta: "Reversión por cancelación de venta",
  merma: "Merma",
  perdida: "Pérdida",
  ajuste_entrada: "Ajuste de entrada",
  ajuste_salida: "Ajuste de salida",
  reverso_ajuste: "Reversión de ajuste",
}

export const ADJUSTMENT_HINTS: Record<AdjustmentType, string> = {
  merma: "Deshidratación, selección o rezaga.",
  perdida: "Daño, descomposición o robo.",
  ajuste_salida: "Conteo físico menor al registrado.",
  ajuste_entrada: "Conteo físico mayor al registrado.",
}

const notFuture = (date: string) => date <= todayISO()

export const harvestSchema = z
  .object({
    id: z.uuid(),
    projectId: requiredId("Selecciona el proyecto"),
    plotId: requiredId("Selecciona la parcela"),
    date: requiredDate(),
    cutNumber: optionalInteger(1, 999),
    quality: z.enum(HARVEST_QUALITIES),
    classification: optionalText(60),
    unit: z.enum(PRODUCE_UNITS, { error: "Selecciona la unidad" }),
    quantity: decimal({ scale: 3, max: 999_999_999 }),
    unitWeightKg: optionalDecimal({ scale: 3, max: 9_999 }),
    packages: optionalInteger(1, 9_999_999),
    responsibleId: optionalId(),
    notes: optionalText(500),
  })
  .superRefine((v, ctx) => {
    if (!notFuture(v.date)) ctx.addIssue({ code: "custom", path: ["date"], message: "No puede ser una fecha futura" })
    if (needsUnitWeight(v.unit) && v.unitWeightKg === null) {
      ctx.addIssue({ code: "custom", path: ["unitWeightKg"], message: "Indica el peso neto por unidad" })
    }
  })

export const adjustmentSchema = z
  .object({
    id: z.uuid(),
    harvestId: z.uuid(),
    type: z.enum(ADJUSTMENT_TYPES, { error: "Selecciona el tipo" }),
    quantityKg: decimal({ scale: 3, max: 999_999_999 }),
    date: requiredDate(),
    reason: requiredText(5, 500, "Justifica el movimiento (mínimo 5 caracteres)"),
  })
  .refine((v) => notFuture(v.date), { path: ["date"], message: "No puede ser una fecha futura" })

export type HarvestInput = z.input<typeof harvestSchema>
export type AdjustmentInput = z.input<typeof adjustmentSchema>
