"use server"

import { redirect } from "next/navigation"

import { failure, success, validationFailure, type ActionResult } from "@/lib/actions"
import { env } from "@/lib/env"
import { safeRedirectPath } from "@/lib/safe-redirect"
import { createClient } from "@/lib/supabase/server"
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from "./schemas"


export async function signIn(input: LoginInput, next?: string): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    if (error.code === "email_not_confirmed") {
      return failure("Debes confirmar tu correo electrónico antes de iniciar sesión.")
    }
    return failure("Correo o contraseña incorrectos.")
  }
  redirect(safeRedirectPath(next))
}

export async function signUp(input: RegisterInput): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${env.siteUrl}/auth/callback?next=/dashboard`,
    },
  })
  if (error) {
    if (error.code === "user_already_exists") {
      return failure("Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.")
    }
    if (error.code === "weak_password") return failure("La contraseña es demasiado débil.")
    return failure("No fue posible crear la cuenta. Intenta de nuevo.")
  }

  if (!data.session) {
    return success(
      { needsConfirmation: true },
      "Te enviamos un correo para confirmar tu cuenta."
    )
  }
  redirect("/dashboard")
}

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.siteUrl}/auth/callback?next=/restablecer`,
  })
  // Respuesta idéntica exista o no la cuenta, para no revelar correos registrados.
  return success(
    undefined,
    "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña."
  )
}

export async function updatePassword(
  input: ResetPasswordInput,
  redirectTo?: string
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    if (error.code === "same_password") return failure("La nueva contraseña debe ser diferente a la anterior.")
    if (error.code === "session_not_found" || error.status === 401) {
      return failure("El enlace expiró. Solicita uno nuevo para restablecer tu contraseña.")
    }
    return failure("No fue posible actualizar la contraseña.")
  }
  if (redirectTo) redirect(safeRedirectPath(redirectTo))
  return success(undefined, "Contraseña actualizada.")
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
