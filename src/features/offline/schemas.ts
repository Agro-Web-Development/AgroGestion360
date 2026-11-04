import { z } from "zod"

import { activitySchema, applicationSchema, irrigationSchema, observationSchema, type AttachmentEntity } from "@/features/fieldlogs/schemas"
import { harvestSchema } from "@/features/harvests/schemas"
import type { Permission } from "@/lib/auth/roles"
import type { Database } from "@/types/database"

/**
 * Captura sin conexión. Solo registros de campo: no se capturan ventas, pagos
 * ni movimientos de inventario. Una aplicación que descuenta del almacén se
 * valida de nuevo en el servidor al sincronizar (existencias, lote, proyecto),
 * y nada se confirma por el solo hecho de haberse guardado en el dispositivo.
 */
export const OFFLINE_RECORD_TYPES = ["riego", "actividad", "aplicacion", "observacion", "cosecha"] as const satisfies readonly Database["public"]["Enums"]["offline_record_type"][]
export type OfflineRecordType = (typeof OFFLINE_RECORD_TYPES)[number]

export const RECORD_TYPE_LABELS: Record<OfflineRecordType, string> = {
  riego: "Bitácora de riego",
  actividad: "Actividad agrícola",
  aplicacion: "Aplicación de agroquímicos",
  observacion: "Observación",
  cosecha: "Corte de producción",
}

export const RECORD_SCHEMAS = {
  riego: irrigationSchema,
  actividad: activitySchema,
  aplicacion: applicationSchema,
  observacion: observationSchema,
  cosecha: harvestSchema,
} as const

export const RECORD_PERMISSION: Record<OfflineRecordType, Permission> = {
  riego: "fieldlogs.write",
  actividad: "fieldlogs.write",
  aplicacion: "fieldlogs.write",
  observacion: "fieldlogs.write",
  cosecha: "harvest.write",
}

/** Tipo de evidencia con que se cargan las fotografías de cada registro. */
export const RECORD_ATTACHMENT_ENTITY: Record<OfflineRecordType, AttachmentEntity> = {
  riego: "irrigation_log",
  actividad: "field_activity",
  aplicacion: "chemical_application",
  observacion: "field_observation",
  cosecha: "harvest",
}

/** Estados de un registro en el dispositivo. */
export const OFFLINE_STATUSES = ["pendiente", "sincronizando", "sincronizado", "error", "requiere_revision"] as const
export type OfflineStatus = (typeof OFFLINE_STATUSES)[number]

export const STATUS_LABELS: Record<OfflineStatus, string> = {
  pendiente: "Pendiente",
  sincronizando: "Sincronizando",
  sincronizado: "Sincronizado",
  error: "Error",
  requiere_revision: "Requiere revisión",
}

/** Lo que el dispositivo envía al servidor por cada registro. */
export const submissionSchema = z.object({
  localId: z.uuid(),
  organizationId: z.uuid(),
  userId: z.uuid(),
  type: z.enum(OFFLINE_RECORD_TYPES),
  capturedAt: z.iso.datetime({ offset: true }),
  payload: z.record(z.string(), z.unknown()),
})
export type Submission = z.infer<typeof submissionSchema>

/**
 * Respuesta del servidor. `sincronizado` solo se devuelve cuando el registro
 * quedó confirmado en la base de datos (o ya lo estaba con el mismo contenido).
 */
export type SyncResult =
  | { status: "sincronizado"; syncedAt: string; message: string }
  | {
      status: "requiere_revision"
      message: string
      fieldErrors?: Record<string, string[]>
      /** Un revisor lo descartó: el dispositivo ya no debe reintentarlo. */
      discarded?: boolean
      /** Ya se sincronizó con otro contenido: no se sobrescribe. */
      conflict?: boolean
    }

/** Fotografías: los mismos límites que las evidencias en línea. */
export const offlineAttachmentSchema = z.object({
  organizationId: z.uuid(),
  type: z.enum(OFFLINE_RECORD_TYPES),
  entityId: z.uuid(),
  files: z
    .array(
      z.object({
        path: z.string().min(10).max(400),
        name: z.string().trim().min(1).max(200),
        type: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]),
        size: z.number().int().positive().max(10 * 1024 * 1024),
      })
    )
    .min(1)
    .max(6),
})

/**
 * JSON canónico (llaves ordenadas) para calcular la huella del contenido: el
 * mismo registro produce siempre la misma huella aunque cambie el orden de las
 * propiedades al serializarse en el dispositivo.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null"
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`
}
