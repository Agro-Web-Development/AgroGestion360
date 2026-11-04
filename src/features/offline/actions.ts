"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { dbErrorMessage, failure, success, type ActionResult } from "@/lib/actions"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

const idSchema = z.uuid()
const noteSchema = z.string().trim().min(5).max(500)

/** Un revisor descarta un registro sin conexión que no puede sincronizarse. */
export async function discardSubmission(id: string, note: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return failure("Registro no válido.")
  const parsedNote = noteSchema.safeParse(note)
  if (!parsedNote.success) return failure("Indica el motivo.")

  const ctx = await getOrgContext()
  if (!can(ctx.role, "offline.review")) return failure("No tienes permiso para revisar registros sin conexión.")

  const supabase = await createClient()
  const { error } = await supabase.rpc("discard_offline_submission", { p_id: id, p_note: parsedNote.data })
  if (error) return failure(dbErrorMessage(error))

  refresh()
  return success(undefined, "Registro descartado. El dispositivo lo verá en su siguiente sincronización.")
}
