import type { Metadata } from "next"

import { ResetPasswordForm } from "@/features/auth/components/reset-password-form"

export const metadata: Metadata = { title: "Nueva contraseña" }

/** Requiere sesión: se llega aquí desde el enlace de recuperación o de invitación. */
export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Crea tu nueva contraseña</h1>
        <p className="text-sm text-muted-foreground">Úsala la próxima vez que inicies sesión.</p>
      </header>
      <ResetPasswordForm redirectTo="/dashboard" />
    </div>
  )
}
