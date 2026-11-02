import { z } from "zod"

import { todayISO } from "@/lib/format"
import { decimal, optionalInteger, optionalText, requiredDate, requiredId } from "@/lib/validation"
import type { Database } from "@/types/database"

export type HarvestQuality = Database["public"]["Enums"]["harvest_quality"]

export const HARVEST_QUALITIES = ["primera", "segunda", "tercera", "unica"] as const satisfies readonly HarvestQuality[]

export const QUALITY_LABELS: Record<HarvestQuality, string> = {
  primera: "Primera",
  segunda: "Segunda",
  tercera: "Tercera / rezaga",
  unica: "Calidad única",
}

export const harvestSchema = z
  .object({
    id: z.uuid(),
    projectId: requiredId("Selecciona el proyecto"),
    plotId: requiredId("Selecciona la parcela"),
    date: requiredDate(),
    quality: z.enum(HARVEST_QUALITIES),
    quantityKg: decimal({ scale: 3, max: 999_999_999 }),
    packages: optionalInteger(1, 9_999_999),
    notes: optionalText(500),
  })
  .refine((v) => v.date <= todayISO(), { path: ["date"], message: "No puede ser una fecha futura" })

export type HarvestInput = z.input<typeof harvestSchema>
