import "server-only"

import { createHash } from "node:crypto"

import type { PostgrestError } from "@supabase/supabase-js"

import { applicationFailure, plotFailure } from "@/features/fieldlogs/errors"
import { createActivity, createApplication, createIrrigation, createObservation, insertAttachments } from "@/features/fieldlogs/mutations"
import { harvestFailure } from "@/features/harvests/errors"
import { createHarvest } from "@/features/harvests/mutations"
import { isRetryableDbError, validationFailure, type ActionResult } from "@/lib/actions"
import type { ApiSession } from "@/lib/auth/api-session"
import { can } from "@/lib/auth/roles"
import {
  canonicalJson,
  offlineAttachmentSchema,
  RECORD_ATTACHMENT_ENTITY,
  RECORD_PERMISSION,
  RECORD_SCHEMAS,
  submissionSchema,
  type OfflineRecordType,
  type Submission,
  type SyncResult,
} from "./schemas"

/**
 * Resultado de procesar un envío:
 *   result     → respuesta definitiva (sincronizado o requiere revisión), HTTP 200
 *   invalid    → la solicitud está mal formada, HTTP 400
 *   transient  → falla temporal (BD, red); el dispositivo conserva el registro y reintenta, HTTP 503
 */
export type SyncOutcome =
  | { kind: "result"; result: SyncResult }
  | { kind: "invalid"; error: string }
  | { kind: "transient"; error: string }

const TRANSIENT = "El servidor no pudo confirmar el registro. Se reintentará automáticamente."

/** Huella del contenido: detecta un reenvío distinto de algo ya sincronizado. */
export function payloadHash(type: OfflineRecordType, payload: Record<string, unknown>): string {
  return createHash("sha256").update(canonicalJson({ type, payload })).digest("hex")
}

type Mutation = { error: PostgrestError | null; failure: (error: PostgrestError) => ActionResult<never> }

async function runMutation(session: ApiSession, orgId: string, type: OfflineRecordType, data: unknown): Promise<Mutation> {
  const { supabase } = session
  switch (type) {
    case "riego":
      return { error: await createIrrigation(supabase, orgId, data as never), failure: plotFailure }
    case "actividad":
      return { error: await createActivity(supabase, orgId, data as never), failure: plotFailure }
    case "aplicacion":
      return { error: await createApplication(supabase, data as never), failure: applicationFailure }
    case "observacion":
      return { error: await createObservation(supabase, orgId, data as never), failure: plotFailure }
    case "cosecha":
      return { error: await createHarvest(supabase, orgId, data as never), failure: harvestFailure }
  }
}

/**
 * Procesa un registro capturado sin conexión. Garantías:
 *   · Idempotencia: el id local es el id del registro; reenviar no duplica.
 *   · Solo se responde «sincronizado» cuando la BD confirmó el registro.
 *   · El servidor vuelve a validar todo (esquema, rol, organización, reglas de
 *     negocio y existencias) con la sesión del usuario: la RLS aplica igual que
 *     en línea.
 *   · Los rechazos de negocio quedan en offline_submissions para revisión.
 */
export async function processSubmission(session: ApiSession, input: unknown): Promise<SyncOutcome> {
  const parsed = submissionSchema.safeParse(input)
  if (!parsed.success) return { kind: "invalid", error: "Solicitud de sincronización no válida." }
  const s = parsed.data
  if (s.payload.id !== s.localId) return { kind: "invalid", error: "El identificador del registro no coincide." }

  if (s.userId !== session.userId) {
    return review("Este registro lo capturó otro usuario. Inicia sesión con esa cuenta para enviarlo.")
  }
  const membership = session.memberships.find((m) => m.organizationId === s.organizationId)
  if (!membership) {
    return review("Ya no perteneces a la organización de este registro. Un administrador debe revisarlo.")
  }

  const hash = payloadHash(s.type, s.payload)
  const { data: existing, error: readError } = await session.supabase
    .from("offline_submissions")
    .select("status, payload_hash, synced_at, review_note")
    .eq("id", s.localId)
    .maybeSingle()
  if (readError) return { kind: "transient", error: TRANSIENT }
  if (existing?.status === "descartado") {
    return { kind: "result", result: discarded(existing.review_note) }
  }
  if (existing?.status === "sincronizado") {
    return existing.payload_hash === hash
      ? { kind: "result", result: { status: "sincronizado", syncedAt: existing.synced_at!, message: "El registro ya estaba sincronizado." } }
      : { kind: "result", result: conflict() }
  }

  if (!can(membership.role, RECORD_PERMISSION[s.type])) {
    return record(session, s, hash, { ok: false, error: "Tu rol ya no permite registrar este tipo de información." })
  }

  const validated = RECORD_SCHEMAS[s.type].safeParse(s.payload)
  if (!validated.success) return record(session, s, hash, validationFailure(validated.error))

  const { error, failure } = await runMutation(session, s.organizationId, s.type, validated.data)
  if (error) {
    if (isRetryableDbError(error)) return { kind: "transient", error: TRANSIENT }
    return record(session, s, hash, failure(error))
  }
  return record(session, s, hash, { ok: true, data: undefined })
}

/** Guarda el resultado en offline_submissions y lo traduce para el dispositivo. */
async function record(session: ApiSession, s: Submission, hash: string, outcome: ActionResult): Promise<SyncOutcome> {
  const { data: status, error } = await session.supabase.rpc("save_offline_submission", {
    p_id: s.localId,
    p_org: s.organizationId,
    p_type: s.type,
    p_captured_at: s.capturedAt,
    p_payload: s.payload as never,
    p_hash: hash,
    p_status: outcome.ok ? "sincronizado" : "requiere_revision",
    p_entity: outcome.ok ? s.localId : undefined,
    p_error: outcome.ok ? undefined : outcome.error,
  })
  if (error) return { kind: "transient", error: TRANSIENT }

  switch (status) {
    case "sincronizado":
      return { kind: "result", result: { status: "sincronizado", syncedAt: new Date().toISOString(), message: "Registro sincronizado." } }
    case "conflicto":
      return { kind: "result", result: conflict() }
    case "descartado":
      return { kind: "result", result: discarded(null) }
    default:
      return outcome.ok
        ? { kind: "transient", error: TRANSIENT }
        : review(outcome.error, outcome.fieldErrors)
  }
}

function review(message: string, fieldErrors?: Record<string, string[]>): SyncOutcome {
  return { kind: "result", result: { status: "requiere_revision", message, fieldErrors } }
}

function conflict(): SyncResult {
  return {
    status: "requiere_revision",
    conflict: true,
    message:
      "Este registro ya se sincronizó con otros datos. Se conserva la versión del servidor; corrige desde la aplicación en línea si hace falta.",
  }
}

function discarded(note: string | null): SyncResult {
  return {
    status: "requiere_revision",
    discarded: true,
    message: note ? `Un revisor descartó este registro: ${note}` : "Un revisor descartó este registro.",
  }
}

export type AttachmentOutcome =
  | { kind: "ok"; count: number }
  | { kind: "invalid"; error: string }
  | { kind: "rejected"; error: string }
  | { kind: "transient"; error: string }

/**
 * Registra fotografías ya subidas a Storage para un registro sincronizado. La
 * ruta debe pertenecer a la organización y al registro (también lo exigen el
 * CHECK de attachments y la RLS de Storage).
 */
export async function processAttachments(session: ApiSession, input: unknown): Promise<AttachmentOutcome> {
  const parsed = offlineAttachmentSchema.safeParse(input)
  if (!parsed.success) return { kind: "invalid", error: "Revisa las fotografías: imágenes JPG, PNG, WEBP o HEIC de hasta 10 MB." }
  const { organizationId, type, entityId, files } = parsed.data
  const entity = RECORD_ATTACHMENT_ENTITY[type]
  const prefix = `${organizationId}/${entity}/${entityId}/`
  if (!files.every((f) => f.path.startsWith(prefix) && !f.path.slice(prefix.length).includes("/"))) {
    return { kind: "invalid", error: "Ruta de archivo no válida." }
  }
  const membership = session.memberships.find((m) => m.organizationId === organizationId)
  if (!membership || !can(membership.role, RECORD_PERMISSION[type])) {
    return { kind: "rejected", error: "No tienes permiso para agregar evidencias a este registro." }
  }

  const error = await insertAttachments(session.supabase, organizationId, entity, entityId, files)
  if (error) {
    if (isRetryableDbError(error)) return { kind: "transient", error: TRANSIENT }
    // Si no se pudo registrar, los archivos no deben quedar huérfanos en Storage.
    await session.supabase.storage.from("evidencias").remove(files.map((f) => f.path))
    return { kind: "rejected", error: error.code === "P0001" ? error.message : "No se pudieron registrar las fotografías." }
  }
  return { kind: "ok", count: files.length }
}
