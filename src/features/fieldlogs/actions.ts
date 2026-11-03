"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { dbErrorMessage, failure, isDuplicateId, success, validationFailure, type ActionResult } from "@/lib/actions"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import {
  activitySchema,
  activityTypeSchema,
  applicationSchema,
  applicationUpdateSchema,
  ATTACHMENT_ENTITIES,
  ATTACHMENT_PERMISSION,
  attachmentFileSchema,
  attachmentTypes,
  FIELD_RECORD_KINDS,
  isReceiptEntity,
  irrigationSchema,
  MAX_ATTACHMENTS_PER_UPLOAD,
  type ActivityInput,
  type ActivityTypeInput,
  type ApplicationInput,
  type ApplicationUpdateInput,
  type AttachmentEntity,
  type AttachmentFile,
  type FieldRecordKind,
  type IrrigationInput,
} from "./schemas"

const idSchema = z.uuid()
const reasonSchema = z.string().trim().min(5, "Indica el motivo").max(500)
const BUCKET = "evidencias"

function plotFailure(error: Parameters<typeof dbErrorMessage>[0]): ActionResult<never> {
  if (error.code === "23503") return failure("La parcela no está asignada al proyecto.", { plotId: ["Parcela no válida"] })
  if (error.code === "22023" && error.message.includes("fecha")) return failure(error.message, { date: [error.message] })
  return failure(dbErrorMessage(error))
}

/** Alta (id del cliente, idempotente) o edición de un riego. */
export async function saveIrrigation(input: IrrigationInput, isUpdate = false): Promise<ActionResult> {
  const parsed = irrigationSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "fieldlogs.write")) return failure("No tienes permiso para registrar bitácoras.")

  const v = parsed.data
  const values = {
    log_date: v.date,
    start_time: v.startTime,
    end_time: v.endTime,
    // null: un trigger toma el sistema de riego de la parcela.
    irrigation_system: v.system as NonNullable<typeof v.system>,
    water_m3: v.waterM3,
    responsible_id: v.responsibleId,
    notes: v.notes,
  }
  const supabase = await createClient()
  if (isUpdate) {
    const { data, error } = await supabase
      .from("irrigation_logs")
      .update(values)
      .eq("id", v.id)
      .eq("organization_id", ctx.organization.id)
      .select("id")
    if (error) return plotFailure(error)
    if (!data?.length) return failure("No tienes permiso para modificar este riego.")
  } else {
    const { error } = await supabase.from("irrigation_logs").insert({
      ...values,
      id: v.id,
      organization_id: ctx.organization.id,
      project_id: v.projectId,
      plot_id: v.plotId,
    })
    if (error && !isDuplicateId(error)) return plotFailure(error)
  }

  refresh()
  return success(undefined, isUpdate ? "Riego actualizado." : "Riego registrado.")
}

/** La aplicación y su salida de almacén se registran en una sola transacción. */
export async function registerApplication(input: ApplicationInput): Promise<ActionResult> {
  const parsed = applicationSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "fieldlogs.write")) return failure("No tienes permiso para registrar aplicaciones.")

  const v = parsed.data
  const supabase = await createClient()
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
  if (error) {
    if (error.code === "22023" && error.message.startsWith("Existencia insuficiente")) {
      return failure(error.message, { quantity: [error.message] })
    }
    if (error.code === "22023" && error.message.includes("superficie")) {
      return failure(error.message, { treatedArea: [error.message] })
    }
    if (error.code === "22023" && /lote/i.test(error.message)) return failure(error.message, { lotId: [error.message] })
    return plotFailure(error)
  }

  refresh()
  return success(undefined, v.issueFromStock ? "Aplicación registrada y descontada del almacén." : "Aplicación registrada.")
}

export async function updateApplication(input: ApplicationUpdateInput): Promise<ActionResult> {
  const parsed = applicationUpdateSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "fieldlogs.write")) return failure("No tienes permiso para modificar aplicaciones.")

  const v = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("chemical_applications")
    .update({
      application_time: v.time,
      active_ingredient: v.activeIngredient,
      treated_area_ha: v.treatedArea,
      responsible_id: v.responsibleId,
      machine_id: v.machineId,
      equipment: v.equipment,
      reentry_hours: v.reentryHours,
      preharvest_days: v.preharvestDays,
      notes: v.notes,
    })
    .eq("id", v.id)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) return failure(dbErrorMessage(error))
  if (!data?.length) return failure("No tienes permiso para modificar esta aplicación.")

  refresh()
  return success(undefined, "Aplicación actualizada.")
}

export async function cancelApplication(applicationId: string, reason: string): Promise<ActionResult> {
  if (!idSchema.safeParse(applicationId).success) return failure("Aplicación no válida.")
  const parsedReason = reasonSchema.safeParse(reason)
  if (!parsedReason.success) return failure("Indica el motivo de la cancelación.")

  const ctx = await getOrgContext()
  if (!can(ctx.role, "fieldlogs.write")) return failure("No tienes permiso para cancelar aplicaciones.")

  const supabase = await createClient()
  const { error } = await supabase.rpc("cancel_chemical_application", { p_id: applicationId, p_reason: parsedReason.data })
  if (error) return failure(dbErrorMessage(error))

  refresh()
  return success(undefined, "Aplicación cancelada; el producto regresó al almacén.")
}

export async function saveActivity(input: ActivityInput, isUpdate = false): Promise<ActionResult> {
  const parsed = activitySchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "fieldlogs.write")) return failure("No tienes permiso para registrar actividades.")

  const v = parsed.data
  const values = {
    plot_id: v.plotId,
    activity_type_id: v.activityTypeId,
    activity_date: v.date,
    description: v.description,
    responsible_id: v.responsibleId,
    cost: v.cost,
    notes: v.notes,
  }
  const supabase = await createClient()
  if (isUpdate) {
    const { data, error } = await supabase
      .from("field_activities")
      .update(values)
      .eq("id", v.id)
      .eq("organization_id", ctx.organization.id)
      .select("id")
    if (error) return plotFailure(error)
    if (!data?.length) return failure("No tienes permiso para modificar esta actividad.")
  } else {
    const { error } = await supabase
      .from("field_activities")
      .insert({ ...values, id: v.id, organization_id: ctx.organization.id, project_id: v.projectId })
    if (error && !isDuplicateId(error)) return plotFailure(error)
  }

  refresh()
  return success(undefined, isUpdate ? "Actividad actualizada." : "Actividad registrada.")
}

/** Cancelación con motivo de riegos, actividades y mantenimientos (no se eliminan). */
export async function cancelFieldRecord(kind: FieldRecordKind, recordId: string, reason: string): Promise<ActionResult> {
  if (!FIELD_RECORD_KINDS.includes(kind) || !idSchema.safeParse(recordId).success) return failure("Registro no válido.")
  const parsedReason = reasonSchema.safeParse(reason)
  if (!parsedReason.success) return failure("Indica el motivo de la cancelación.")

  const ctx = await getOrgContext()
  const allowed = kind === "mantenimiento" ? can(ctx.role, "machinery.write") : can(ctx.role, "fieldlogs.write")
  if (!allowed) return failure("No tienes permiso para cancelar este registro.")

  const supabase = await createClient()
  const { error } = await supabase.rpc("cancel_field_record", { p_kind: kind, p_id: recordId, p_reason: parsedReason.data })
  if (error) return failure(dbErrorMessage(error))

  refresh()
  return success(undefined, "Registro cancelado.")
}

export async function saveActivityType(input: ActivityTypeInput): Promise<ActionResult> {
  const parsed = activityTypeSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "catalogs.write")) return failure("No tienes permiso para administrar el catálogo de actividades.")

  const { id, costCategory, ...rest } = parsed.data
  const v = { ...rest, cost_category: costCategory }
  const supabase = await createClient()
  const { data, error } = id
    ? await supabase
        .from("activity_types")
        .update(v)
        .eq("id", id)
        .eq("organization_id", ctx.organization.id)
        .select("id")
    : await supabase.from("activity_types").insert({ ...v, organization_id: ctx.organization.id }).select("id")
  if (error) {
    if (error.code === "23505") return failure("Ya existe una actividad con ese nombre.")
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para modificar esta actividad.")

  refresh()
  return success(undefined, id ? "Actividad actualizada." : "Actividad agregada al catálogo.")
}

export async function setActivityTypeActive(typeId: string, active: boolean): Promise<ActionResult> {
  if (!idSchema.safeParse(typeId).success) return failure("Actividad no válida.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "catalogs.write")) return failure("No tienes permiso para administrar el catálogo de actividades.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("activity_types")
    .update({ is_active: active })
    .eq("id", typeId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) return failure(dbErrorMessage(error))
  if (!data?.length) return failure("No tienes permiso para modificar esta actividad.")

  refresh()
  return success(undefined, active ? "Actividad reactivada." : "Actividad desactivada.")
}

export async function deleteActivityType(typeId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(typeId).success) return failure("Actividad no válida.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "catalogs.delete")) return failure("Solo propietarios y administradores pueden eliminar del catálogo.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("activity_types")
    .delete()
    .eq("id", typeId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) {
    if (error.code === "23503") return failure("La actividad tiene registros. Puedes desactivarla en su lugar.")
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para eliminar esta actividad.")

  refresh()
  return success(undefined, "Actividad eliminada del catálogo.")
}

// -----------------------------------------------------------------------------
// Evidencias fotográficas. El navegador sube el archivo a Storage (la RLS valida
// organización y rol por la ruta) y aquí se registra; la BD verifica que el
// archivo exista y que la ruta corresponda a la organización y al registro.
// -----------------------------------------------------------------------------
const entitySchema = z.enum(ATTACHMENT_ENTITIES)

export type AttachmentView = {
  id: string
  name: string
  mimeType: string
  url: string | null
  createdAt: string
  canDelete: boolean
}

export async function registerAttachments(
  entity: AttachmentEntity,
  entityId: string,
  files: AttachmentFile[]
): Promise<ActionResult> {
  if (!entitySchema.safeParse(entity).success || !idSchema.safeParse(entityId).success) return failure("Registro no válido.")
  const parsed = z
    .array(attachmentFileSchema)
    .min(1)
    .max(MAX_ATTACHMENTS_PER_UPLOAD)
    .refine((list) => list.every((f) => attachmentTypes(entity).includes(f.type)))
    .safeParse(files)
  if (!parsed.success) {
    return failure(
      isReceiptEntity(entity)
        ? "Revisa los comprobantes: imágenes o PDF de hasta 10 MB."
        : "Revisa las fotografías: solo imágenes JPG, PNG, WEBP o HEIC de hasta 10 MB."
    )
  }

  const ctx = await getOrgContext()
  if (!can(ctx.role, ATTACHMENT_PERMISSION[entity])) return failure("No tienes permiso para agregar evidencias.")

  const supabase = await createClient()
  const { error } = await supabase.from("attachments").insert(
    parsed.data.map((f) => ({
      organization_id: ctx.organization.id,
      entity_type: entity,
      entity_id: entityId,
      storage_path: f.path,
      file_name: f.name,
      mime_type: f.type,
      size_bytes: f.size,
    }))
  )
  if (error && !(error.code === "23505" && error.message.includes("storage_path"))) {
    // Si no se pudo registrar, el archivo no debe quedar huérfano en Storage.
    await supabase.storage.from(BUCKET).remove(parsed.data.map((f) => f.path))
    return failure(dbErrorMessage(error))
  }

  refresh()
  const noun = isReceiptEntity(entity) ? ["Comprobante agregado.", "comprobantes agregados."] : ["Fotografía agregada.", "fotografías agregadas."]
  return success(undefined, parsed.data.length === 1 ? noun[0] : `${parsed.data.length} ${noun[1]}`)
}

export async function listAttachments(entity: AttachmentEntity, entityId: string): Promise<ActionResult<AttachmentView[]>> {
  if (!entitySchema.safeParse(entity).success || !idSchema.safeParse(entityId).success) return failure("Registro no válido.")
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("attachments")
    .select("id, file_name, mime_type, storage_path, created_at, created_by")
    .eq("organization_id", ctx.organization.id)
    .eq("entity_type", entity)
    .eq("entity_id", entityId)
    .order("created_at")
  if (error) return failure(dbErrorMessage(error))
  if (data.length === 0) return success([])

  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(
    data.map((a) => a.storage_path),
    60 * 30
  )
  const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
  const admin = can(ctx.role, "catalogs.delete")
  return success(
    data.map((a) => ({
      id: a.id,
      name: a.file_name,
      mimeType: a.mime_type,
      url: urls.get(a.storage_path) ?? null,
      createdAt: a.created_at,
      // Un comprobante solo lo retira propietario o administrador (igual que la RLS).
      canDelete: admin || (!isReceiptEntity(entity) && a.created_by === ctx.user.id && can(ctx.role, ATTACHMENT_PERMISSION[entity])),
    }))
  )
}

export async function deleteAttachment(attachmentId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(attachmentId).success) return failure("Evidencia no válida.")
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("organization_id", ctx.organization.id)
    .select("storage_path")
  if (error) return failure(dbErrorMessage(error))
  if (!data?.length) return failure("No tienes permiso para eliminar esta evidencia.")
  await supabase.storage.from(BUCKET).remove(data.map((a) => a.storage_path))

  refresh()
  return success(undefined, "Evidencia eliminada.")
}
