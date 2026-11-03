import { z } from "zod"

import { BUDGET_CATEGORIES } from "@/features/finance/schemas"
import { IRRIGATION_TYPES } from "@/features/farms/schemas"
import { todayISO } from "@/lib/format"
import {
  decimal,
  optionalDecimal,
  optionalId,
  optionalInteger,
  optionalText,
  optionalTime,
  requiredDate,
  requiredId,
  requiredText,
  requiredTime,
  NONE,
} from "@/lib/validation"
import type { Permission } from "@/lib/auth/roles"

/** Registros de bitácora que admiten cancelación y evidencias. */
export const FIELD_RECORD_KINDS = ["riego", "actividad", "mantenimiento"] as const
export type FieldRecordKind = (typeof FIELD_RECORD_KINDS)[number]

export const ATTACHMENT_ENTITIES = [
  "irrigation_log",
  "chemical_application",
  "field_activity",
  "machinery_maintenance",
  "harvest",
  "payment",
  "expense",
] as const
export type AttachmentEntity = (typeof ATTACHMENT_ENTITIES)[number]

/** Permiso para agregar evidencias a cada tipo de registro (igual que la RLS de Storage). */
export const ATTACHMENT_PERMISSION: Record<AttachmentEntity, Permission> = {
  irrigation_log: "fieldlogs.write",
  chemical_application: "fieldlogs.write",
  field_activity: "fieldlogs.write",
  machinery_maintenance: "fieldlogs.write",
  harvest: "harvest.write",
  payment: "payments.write",
  expense: "expenses.write",
}

/** Comprobantes (pagos y gastos): información financiera, también en PDF. */
export const isReceiptEntity = (entity: AttachmentEntity) => entity === "payment" || entity === "expense"

export const ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const
/** Los comprobantes de pagos y gastos también se aceptan en PDF. */
export const RECEIPT_TYPES = [...ATTACHMENT_TYPES, "application/pdf"] as const
export type AttachmentMime = (typeof RECEIPT_TYPES)[number]

export function attachmentTypes(entity: AttachmentEntity): readonly AttachmentMime[] {
  return isReceiptEntity(entity) ? RECEIPT_TYPES : ATTACHMENT_TYPES
}
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_ATTACHMENTS_PER_UPLOAD = 6

export const TIMELINE_KINDS = ["riego", "aplicacion", "actividad", "mano_obra", "maquinaria", "insumo", "cosecha"] as const
export type TimelineKind = (typeof TIMELINE_KINDS)[number]

export const TIMELINE_LABELS: Record<TimelineKind, string> = {
  riego: "Riego",
  aplicacion: "Aplicación",
  actividad: "Actividad",
  mano_obra: "Mano de obra",
  maquinaria: "Maquinaria",
  insumo: "Insumo",
  cosecha: "Cosecha",
}

const notFuture = (date: string) => date <= todayISO()

/**
 * Minutos entre dos horas HH:MM; si la hora final es menor, el registro cruzó
 * la medianoche (mismo cálculo que la columna duration_minutes).
 */
export function durationMinutes(start: string, end: string): number | null {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number)
    return h * 60 + m
  }
  if (!/^\d{2}:\d{2}/.test(start) || !/^\d{2}:\d{2}/.test(end)) return null
  return (toMin(end.slice(0, 5)) - toMin(start.slice(0, 5)) + 1440) % 1440
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`
}

export const irrigationSchema = z
  .object({
    id: z.uuid(),
    projectId: requiredId("Selecciona el proyecto"),
    plotId: requiredId("Selecciona la parcela"),
    date: requiredDate(),
    startTime: requiredTime("Indica la hora de inicio"),
    endTime: requiredTime("Indica la hora de término"),
    system: z.union([z.enum(IRRIGATION_TYPES), z.literal(NONE)]).transform((v) => (v === NONE ? null : v)),
    waterM3: optionalDecimal({ scale: 2, max: 9_999_999 }),
    responsibleId: optionalId(),
    notes: optionalText(1000),
  })
  .superRefine((v, ctx) => {
    if (!notFuture(v.date)) ctx.addIssue({ code: "custom", path: ["date"], message: "No puede ser una fecha futura" })
    if (v.startTime === v.endTime) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "La hora de término debe ser distinta a la de inicio" })
    }
  })

export const applicationSchema = z
  .object({
    id: z.uuid(),
    projectId: requiredId("Selecciona el proyecto"),
    plotId: requiredId("Selecciona la parcela"),
    date: requiredDate(),
    time: optionalTime(),
    productId: requiredId("Selecciona el producto"),
    activeIngredient: optionalText(150),
    quantity: decimal({ scale: 3, max: 999_999_999 }),
    treatedArea: decimal({ scale: 2, max: 999_999 }),
    issueFromStock: z.boolean(),
    warehouseId: optionalId(),
    lotId: optionalId(),
    lotNumber: optionalText(60),
    responsibleId: optionalId(),
    machineId: optionalId(),
    equipment: optionalText(120),
    reentryHours: optionalInteger(0, 2160),
    preharvestDays: optionalInteger(0, 365),
    notes: optionalText(1000),
  })
  .superRefine((v, ctx) => {
    if (!notFuture(v.date)) ctx.addIssue({ code: "custom", path: ["date"], message: "No puede ser una fecha futura" })
    if (v.issueFromStock && !v.warehouseId) {
      ctx.addIssue({ code: "custom", path: ["warehouseId"], message: "Selecciona el almacén del que sale" })
    }
  })

/** Campos editables de una aplicación (producto, cantidad, fecha y parcela quedan ligados a su salida de almacén). */
export const applicationUpdateSchema = z.object({
  id: z.uuid(),
  time: optionalTime(),
  activeIngredient: optionalText(150),
  treatedArea: decimal({ scale: 2, max: 999_999 }),
  responsibleId: optionalId(),
  machineId: optionalId(),
  equipment: optionalText(120),
  reentryHours: optionalInteger(0, 2160),
  preharvestDays: optionalInteger(0, 365),
  notes: optionalText(1000),
})

export const activitySchema = z
  .object({
    id: z.uuid(),
    projectId: requiredId("Selecciona el proyecto"),
    plotId: optionalId(),
    activityTypeId: requiredId("Selecciona la actividad"),
    date: requiredDate(),
    description: optionalText(200),
    responsibleId: optionalId(),
    cost: optionalDecimal({ scale: 2, max: 99_999_999, allowZero: true }).transform((v) => v ?? 0),
    notes: optionalText(1000),
  })
  .refine((v) => notFuture(v.date), { path: ["date"], message: "No puede ser una fecha futura" })

export const activityTypeSchema = z.object({
  id: z.uuid().optional(),
  name: requiredText(2, 80, "El nombre debe tener al menos 2 caracteres"),
  description: optionalText(300),
  /** Categoría presupuestal del costo adicional (servicio contratado) de la actividad. */
  costCategory: z.enum(BUDGET_CATEGORIES, { error: "Selecciona la categoría" }),
})

export const attachmentFileSchema = z.object({
  path: z.string().min(10).max(400),
  name: z.string().trim().min(1).max(200),
  type: z.enum(RECEIPT_TYPES),
  size: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
})

export type IrrigationInput = z.input<typeof irrigationSchema>
export type ApplicationInput = z.input<typeof applicationSchema>
export type ApplicationUpdateInput = z.input<typeof applicationUpdateSchema>
export type ActivityInput = z.input<typeof activitySchema>
export type ActivityTypeInput = z.input<typeof activityTypeSchema>
export type AttachmentFile = z.infer<typeof attachmentFileSchema>

/** Ruta de Storage: organización/tipo/registro/archivo (la RLS valida la primera carpeta). */
export function attachmentPath(orgId: string, entity: AttachmentEntity, entityId: string, fileId: string, fileName: string) {
  const ext = (fileName.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg"
  return `${orgId}/${entity}/${entityId}/${fileId}.${ext}`
}

/** Dosis registrada (cantidad / superficie). Es un dato de lo aplicado, no una recomendación. */
export function appliedRate(quantity: number | string, area: number | string): number | null {
  const q = Number(quantity)
  const a = Number(area)
  return a > 0 && Number.isFinite(q) ? q / a : null
}
