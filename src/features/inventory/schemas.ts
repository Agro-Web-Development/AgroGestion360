import { z } from "zod"

import { todayISO } from "@/lib/format"
import {
  decimal,
  optionalDate,
  optionalDecimal,
  optionalId,
  optionalText,
  requiredDate,
  requiredId,
  requiredText,
} from "@/lib/validation"
import type { Database } from "@/types/database"

export type InputKind = Database["public"]["Enums"]["input_kind"]
export type MovementType = Database["public"]["Enums"]["inventory_movement_type"]

/** Clasificación fija de las categorías: la usan las reglas (aplicaciones, combustible). */
export const INPUT_KINDS = [
  "semilla",
  "fertilizante",
  "agroquimico",
  "biologico",
  "combustible",
  "herramienta",
  "material",
  "otro",
] as const satisfies readonly InputKind[]

export const INPUT_KIND_LABELS: Record<InputKind, string> = {
  semilla: "Semillas y plántulas",
  fertilizante: "Fertilizantes",
  agroquimico: "Agroquímicos",
  biologico: "Productos biológicos",
  combustible: "Combustibles",
  herramienta: "Herramientas",
  material: "Materiales",
  otro: "Otros insumos",
}

/** Categorías cuyos productos se registran en la bitácora de aplicaciones. */
export const APPLICABLE_KINDS: readonly InputKind[] = ["agroquimico", "biologico", "fertilizante"]

export const INVENTORY_UNITS = ["kg", "g", "l", "ml", "pieza", "saco", "caja", "m", "m3"] as const
export type InventoryUnit = (typeof INVENTORY_UNITS)[number]

export const INVENTORY_UNIT_LABELS: Record<InventoryUnit, string> = {
  kg: "Kilogramos (kg)",
  g: "Gramos (g)",
  l: "Litros (l)",
  ml: "Mililitros (ml)",
  pieza: "Piezas",
  saco: "Sacos / bultos",
  caja: "Cajas",
  m: "Metros (m)",
  m3: "Metros cúbicos (m³)",
}

export const MOVEMENT_TYPES = [
  "entrada",
  "consumo",
  "devolucion",
  "ajuste_entrada",
  "ajuste_salida",
  "transferencia",
] as const satisfies readonly MovementType[]

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  entrada: "Entrada por compra",
  consumo: "Salida por consumo",
  devolucion: "Devolución de proyecto",
  ajuste_entrada: "Ajuste positivo",
  ajuste_salida: "Ajuste negativo / merma",
  transferencia: "Transferencia entre almacenes",
}

export const MOVEMENT_DESCRIPTIONS: Record<MovementType, string> = {
  entrada: "Aumenta la existencia y recalcula el costo promedio. No es costo de ningún proyecto hasta consumirse.",
  consumo: "Sale del almacén al costo promedio y se carga como costo al proyecto y parcela.",
  devolucion: "Regresa al almacén lo no aplicado; descuenta del proyecto el costo con que se consumió.",
  ajuste_entrada: "Corrige la existencia tras un conteo físico. Usa el costo promedio si no indicas otro.",
  ajuste_salida: "Merma, caducidad o faltante de conteo. Sale al costo promedio y no se carga a proyectos.",
  transferencia: "Mueve existencia de un almacén a otro. No cambia el valor del inventario ni los costos.",
}

export const isInflow = (type: MovementType) => type === "entrada" || type === "devolucion" || type === "ajuste_entrada"
export const isProjectMovement = (type: MovementType) => type === "consumo" || type === "devolucion"
/** Movimientos que crean lotes nuevos (el resto elige un lote existente). */
export const createsLot = (type: MovementType) => type === "entrada" || type === "ajuste_entrada"
/** El lote se captura por número: al crearlo o al devolver (el lote pudo quedar sin existencia). */
export const usesLotNumber = (type: MovementType) => createsLot(type) || type === "devolucion"

export const productSchema = z.object({
  id: z.uuid().optional(),
  name: requiredText(2, 120, "El nombre debe tener al menos 2 caracteres"),
  sku: optionalText(40).transform((v) => v?.toUpperCase() ?? null),
  categoryId: requiredId("Selecciona la categoría"),
  unit: z.enum(INVENTORY_UNITS, { error: "Selecciona la unidad" }),
  minStock: optionalDecimal({ scale: 3, max: 999_999_999, allowZero: true }),
  trackLots: z.boolean(),
  notes: optionalText(2000),
})

export const movementSchema = z
  .object({
    id: z.uuid(),
    productId: requiredId("Selecciona el producto"),
    type: z.enum(MOVEMENT_TYPES, { error: "Selecciona el tipo de movimiento" }),
    date: requiredDate(),
    warehouseId: requiredId("Selecciona el almacén"),
    toWarehouseId: optionalId(),
    quantity: decimal({ scale: 3, max: 999_999_999 }),
    unitCost: optionalDecimal({ scale: 4, max: 99_999_999, allowZero: true }),
    projectId: optionalId(),
    plotId: optionalId(),
    lotId: optionalId(),
    lotNumber: optionalText(60),
    lotExpiry: optionalDate(),
    supplierId: optionalId(),
    responsibleId: optionalId(),
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
    if (v.type === "transferencia") {
      if (!v.toWarehouseId) {
        ctx.addIssue({ code: "custom", path: ["toWarehouseId"], message: "Selecciona el almacén destino" })
      } else if (v.toWarehouseId === v.warehouseId) {
        ctx.addIssue({ code: "custom", path: ["toWarehouseId"], message: "Debe ser distinto al almacén de origen" })
      }
    }
  })

export const categorySchema = z.object({
  id: z.uuid().optional(),
  name: requiredText(2, 80, "El nombre debe tener al menos 2 caracteres"),
  kind: z.enum(INPUT_KINDS, { error: "Selecciona la clasificación" }),
  description: optionalText(300),
})

export const warehouseSchema = z.object({
  id: z.uuid().optional(),
  name: requiredText(2, 80, "El nombre debe tener al menos 2 caracteres"),
  code: optionalText(20).transform((v) => v?.toUpperCase() ?? null),
  farmId: optionalId(),
  location: optionalText(200),
  responsibleId: optionalId(),
  notes: optionalText(1000),
})

const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/

export const supplierSchema = z.object({
  id: z.uuid().optional(),
  name: requiredText(2, 150, "El nombre debe tener al menos 2 caracteres"),
  rfc: optionalText(13)
    .transform((v) => v?.toUpperCase() ?? null)
    .refine((v) => v === null || RFC_REGEX.test(v), "RFC no válido"),
  contactName: optionalText(120),
  phone: optionalText(30),
  email: optionalText(150).refine((v) => v === null || z.email().safeParse(v).success, "Correo no válido"),
  address: optionalText(300),
  notes: optionalText(2000),
})

export const lotSchema = z.object({
  id: z.uuid(),
  expiryDate: optionalDate(),
  notes: optionalText(300),
})

export type ProductInput = z.input<typeof productSchema>
export type MovementInput = z.input<typeof movementSchema>
export type CategoryInput = z.input<typeof categorySchema>
export type WarehouseInput = z.input<typeof warehouseSchema>
export type SupplierInput = z.input<typeof supplierSchema>
export type LotInput = z.input<typeof lotSchema>

/** Días restantes para caducar: positivo = vigente, 0 = hoy, negativo = caducado. */
export function expiryStatus(days: number | null | undefined, warningDays = 30): "caducado" | "por_caducar" | "vigente" | null {
  if (days === null || days === undefined) return null
  if (days < 0) return "caducado"
  if (days <= warningDays) return "por_caducar"
  return "vigente"
}
