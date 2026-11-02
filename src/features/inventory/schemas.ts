import { z } from "zod"

import { todayISO } from "@/lib/format"
import { decimal, optionalDecimal, optionalId, optionalText, requiredDate, requiredId, requiredText } from "@/lib/validation"
import type { Database } from "@/types/database"

export type InputCategory = Database["public"]["Enums"]["input_category"]
export type MovementType = Database["public"]["Enums"]["inventory_movement_type"]

export const INPUT_CATEGORIES = [
  "semilla",
  "fertilizante",
  "agroquimico",
  "combustible",
  "empaque",
  "otro",
] as const satisfies readonly InputCategory[]

export const INPUT_CATEGORY_LABELS: Record<InputCategory, string> = {
  semilla: "Semilla / plántula",
  fertilizante: "Fertilizante",
  agroquimico: "Agroquímico",
  combustible: "Combustible",
  empaque: "Empaque",
  otro: "Otro",
}

export const INVENTORY_UNITS = ["kg", "l", "pieza", "saco", "m3"] as const
export type InventoryUnit = (typeof INVENTORY_UNITS)[number]

export const INVENTORY_UNIT_LABELS: Record<InventoryUnit, string> = {
  kg: "Kilogramos (kg)",
  l: "Litros (l)",
  pieza: "Piezas",
  saco: "Sacos / bultos",
  m3: "Metros cúbicos (m³)",
}

export const MOVEMENT_TYPES = [
  "entrada",
  "consumo",
  "devolucion",
  "ajuste_entrada",
  "ajuste_salida",
] as const satisfies readonly MovementType[]

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  entrada: "Entrada (compra)",
  consumo: "Consumo en proyecto",
  devolucion: "Devolución de proyecto",
  ajuste_entrada: "Ajuste positivo",
  ajuste_salida: "Ajuste negativo / merma",
}

export const MOVEMENT_DESCRIPTIONS: Record<MovementType, string> = {
  entrada: "Aumenta la existencia y recalcula el costo promedio. No es costo de ningún proyecto.",
  consumo: "Sale del almacén al costo promedio y se carga como costo al proyecto y parcela.",
  devolucion: "Regresa al almacén lo no aplicado; descuenta del proyecto el costo con que se consumió.",
  ajuste_entrada: "Corrige la existencia tras un conteo físico. Usa el costo promedio si no indicas otro.",
  ajuste_salida: "Merma, caducidad o faltante de conteo. Sale al costo promedio y no se carga a proyectos.",
}

export const isInflow = (type: MovementType) => type === "entrada" || type === "devolucion" || type === "ajuste_entrada"
export const isProjectMovement = (type: MovementType) => type === "consumo" || type === "devolucion"

export const productSchema = z.object({
  id: z.uuid().optional(),
  name: requiredText(2, 120, "El nombre debe tener al menos 2 caracteres"),
  sku: optionalText(40).transform((v) => v?.toUpperCase() ?? null),
  category: z.enum(INPUT_CATEGORIES, { error: "Selecciona la categoría" }),
  unit: z.enum(INVENTORY_UNITS, { error: "Selecciona la unidad" }),
  minStock: optionalDecimal({ scale: 3, max: 999_999_999, allowZero: true }),
  notes: optionalText(2000),
})

export const movementSchema = z
  .object({
    id: z.uuid(),
    productId: requiredId("Selecciona el producto"),
    type: z.enum(MOVEMENT_TYPES, { error: "Selecciona el tipo de movimiento" }),
    date: requiredDate(),
    quantity: decimal({ scale: 3, max: 999_999_999 }),
    unitCost: optionalDecimal({ scale: 4, max: 99_999_999, allowZero: true }),
    projectId: optionalId(),
    plotId: optionalId(),
    supplier: optionalText(150),
    reference: optionalText(60),
    notes: optionalText(500),
  })
  .superRefine((v, ctx) => {
    if (v.date > todayISO()) ctx.addIssue({ code: "custom", path: ["date"], message: "No puede ser una fecha futura" })
    if (v.type === "entrada" && v.unitCost === null) {
      ctx.addIssue({ code: "custom", path: ["unitCost"], message: "Indica el costo unitario de compra" })
    }
    if (isProjectMovement(v.type)) {
      if (!v.projectId) ctx.addIssue({ code: "custom", path: ["projectId"], message: "Selecciona el proyecto" })
      if (!v.plotId) ctx.addIssue({ code: "custom", path: ["plotId"], message: "Selecciona la parcela" })
    }
  })

export type ProductInput = z.input<typeof productSchema>
export type MovementInput = z.input<typeof movementSchema>
