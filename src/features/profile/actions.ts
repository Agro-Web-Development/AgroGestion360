"use server"

import { refresh } from "next/cache"

import { dbErrorMessage, failure, success, validationFailure, type ActionResult } from "@/lib/actions"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { profileSchema, type ProfileInput } from "./schemas"

export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const user = await getCurrentUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone })
    .eq("id", user.id)
  if (error) return failure(dbErrorMessage(error))

  refresh()
  return success(undefined, "Perfil actualizado.")
}
