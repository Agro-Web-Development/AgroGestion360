"use client"

import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

/**
 * Aceptación de invitaciones. Supabase envía los enlaces de invitación con los
 * tokens en el fragmento (#access_token=…), que solo es visible en el navegador.
 */
export default function AcceptInvitationPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    const accessToken = params.get("access_token")
    const refreshToken = params.get("refresh_token")

    if (!accessToken || !refreshToken) {
      queueMicrotask(() =>
        setError(params.get("error_description") ?? "El enlace de invitación no es válido o ya expiró.")
      )
      return
    }

    createClient()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) setError("El enlace de invitación no es válido o ya expiró.")
        else router.replace("/restablecer")
      })
  }, [router])

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      {error ? (
        <>
          <p className="text-destructive">{error}</p>
          <Button onClick={() => router.push("/login")}>Ir a iniciar sesión</Button>
        </>
      ) : (
        <>
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
          <p className="text-muted-foreground">Activando tu invitación…</p>
        </>
      )}
    </main>
  )
}
