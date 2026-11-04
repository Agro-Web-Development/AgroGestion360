import "server-only"

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"
import type { z } from "zod"

import { isDuplicateId } from "@/lib/actions"
import type { Database } from "@/types/database"
import type { activitySchema, applicationSchema, AttachmentEntity, AttachmentFile, irrigationSchema, observationSchema } from "./schemas"

/**
 * Altas de bitácora compartidas por las Server Actions y la sincronización de
 * la captura sin conexión. Reciben datos ya validados con el esquema Zod y la
 * organización ya autorizada; devuelven el error de PostgreSQL (o null). Todas
 * son idempotentes por el id generado en el dispositivo.
 */
type Client = SupabaseClient<Database>
type DbError = PostgrestError | null

const ignoreDuplicate = (error: DbError): DbError => (error && !isDuplicateId(error) ? error : null)

export async function createIrrigation(supabase: Client, orgId: string, v: z.output<typeof irrigationSchema>): Promise<DbError> {
  const { error } = await supabase.from("irrigation_logs").insert({
    id: v.id,
    organization_id: orgId,
    project_id: v.projectId,
    plot_id: v.plotId,
    log_date: v.date,
    start_time: v.startTime,
    end_time: v.endTime,
    // null: un trigger toma el sistema de riego de la parcela.
    irrigation_system: v.system as NonNullable<typeof v.system>,
    water_m3: v.waterM3,
    responsible_id: v.responsibleId,
    notes: v.notes,
  })
  return ignoreDuplicate(error)
}

/** La aplicación y su salida de almacén se registran en una sola transacción (la RPC valida existencias). */
export async function createApplication(supabase: Client, v: z.output<typeof applicationSchema>): Promise<DbError> {
  const { error } = await supabase.rpc("register_chemical_application", {
    p_id: v.id,
    p_project: v.projectId,
    p_plot: v.plotId,
    p_date: v.date,
    p_product: v.productId,
    p_quantity: v.quantity,
    p_treated_area: v.treatedArea,
    p_issue_from_stock: v.issueFromStock,
    p_warehouse: v.issueFromStock ? (v.warehouseId ?? undefined) : undefined,
    p_lot: v.lotId ?? undefined,
    p_lot_number: v.lotNumber ?? undefined,
    p_time: v.time ?? undefined,
    p_active_ingredient: v.activeIngredient ?? undefined,
    p_responsible: v.responsibleId ?? undefined,
    p_machine: v.machineId ?? undefined,
    p_equipment: v.equipment ?? undefined,
    p_reentry_hours: v.reentryHours ?? undefined,
    p_preharvest_days: v.preharvestDays ?? undefined,
    p_notes: v.notes ?? undefined,
  })
  return error
}

export async function createActivity(supabase: Client, orgId: string, v: z.output<typeof activitySchema>): Promise<DbError> {
  const { error } = await supabase.from("field_activities").insert({
    id: v.id,
    organization_id: orgId,
    project_id: v.projectId,
    plot_id: v.plotId,
    activity_type_id: v.activityTypeId,
    activity_date: v.date,
    description: v.description,
    responsible_id: v.responsibleId,
    cost: v.cost,
    notes: v.notes,
  })
  return ignoreDuplicate(error)
}

export async function createObservation(supabase: Client, orgId: string, v: z.output<typeof observationSchema>): Promise<DbError> {
  const { error } = await supabase.from("field_observations").insert({
    id: v.id,
    organization_id: orgId,
    project_id: v.projectId,
    plot_id: v.plotId,
    observation_date: v.date,
    observation_time: v.time,
    category: v.category,
    severity: v.severity,
    title: v.title,
    description: v.description,
    latitude: v.latitude,
    longitude: v.longitude,
    responsible_id: v.responsibleId,
  })
  return ignoreDuplicate(error)
}

/**
 * Registra archivos ya subidos a Storage. Un archivo registrado antes (misma
 * ruta) no es error: así un reintento de carga no duplica evidencias.
 */
export async function insertAttachments(
  supabase: Client,
  orgId: string,
  entity: AttachmentEntity,
  entityId: string,
  files: AttachmentFile[]
): Promise<DbError> {
  const { error } = await supabase.from("attachments").upsert(
    files.map((f) => ({
      organization_id: orgId,
      entity_type: entity,
      entity_id: entityId,
      storage_path: f.path,
      file_name: f.name,
      mime_type: f.type,
      size_bytes: f.size,
    })),
    { onConflict: "storage_path", ignoreDuplicates: true }
  )
  return error
}
