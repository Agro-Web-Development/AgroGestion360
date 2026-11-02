import type { Metadata } from "next"
import Link from "next/link"

import { RegisterForm } from "@/features/auth/components/register-form"

export const metadata: Metadata = { title: "Crear cuenta" }

export default function RegisterPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Crea tu cuenta</h1>
        <p className="text-sm text-muted-foreground">
          Después podrás registrar tu organización o unirte a una existente por invitación.
        </p>
      </header>
      <RegisterForm />
      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
