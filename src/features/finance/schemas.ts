import { z } from "zod"

import { todayISO } from "@/lib/format"
import { decimal, optionalId, optionalText, requiredDate, requiredId, requiredText } from "@/lib/validation"
import type { Database } from "@/types/database"

export type ExpenseCategory = Database["public"]["Enums"]["expense_category"]

/** Sin insumos, maquinaria ni mano de obra: esos costos se capturan en su módulo. */
export const EXPENSE_CATEGORIES = [
  "renta_tierra",
  "agua_riego",
  "energia",
  "fletes",
  "servicios_profesionales",
  "maquila",
  "seguros",
  "financiamiento",
  "derechos_impuestos",
  "otros",
] as const satisfies readonly ExpenseCategory[]

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  renta_tierra: "Renta de tierra",
  agua_riego: "Agua de riego",
  energia: "Energía eléctrica",
  fletes: "Fletes",
  servicios_profesionales: "Servicios profesionales",
  maquila: "Maquila / servicios contratados",
  seguros: "Seguro agrícola",
  financiamiento: "Intereses y comisiones",
  derechos_impuestos: "Derechos e impuestos",
  otros: "Otros",
}

export const COST_SOURCES = ["insumos", "maquinaria", "mano_obra", "gastos", "actividades"] as const
export type CostSource = (typeof COST_SOURCES)[number]

export const COST_SOURCE_LABELS: Record<CostSource, string> = {
  insumos: "Insumos",
  maquinaria: "Maquinaria",
  mano_obra: "Mano de obra",
  gastos: "Gastos directos",
  actividades: "Actividades de campo",
}

export const expenseSchema = z
  .object({
    id: z.uuid(),
    projectId: requiredId("Selecciona el proyecto"),
    plotId: optionalId(),
    date: requiredDate(),
    category: z.enum(EXPENSE_CATEGORIES, { error: "Selecciona la categoría" }),
    description: requiredText(3, 200, "Describe el gasto"),
    supplier: optionalText(150),
    invoiceRef: optionalText(60).transform((v) => v?.toUpperCase() ?? null),
    amount: decimal({ scale: 2, max: 999_999_999_999 }),
    notes: optionalText(500),
  })
  .refine((v) => v.date <= todayISO(), { path: ["date"], message: "No puede ser una fecha futura" })

export type ExpenseInput = z.input<typeof expenseSchema>

/** Divide sin producir Infinity/NaN: sin base devuelve null (se muestra "—"). */
export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null
}
