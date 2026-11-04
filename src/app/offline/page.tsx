import { CloudOff } from "lucide-react"
import type { Metadata } from "next"

import { Logo } from "@/components/brand/logo"
import { RetryButton } from "./retry-button"

export const metadata: Metadata = { title: "Sin conexión" }

/** Respaldo del service worker cuando una página no está disponible sin conexión. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo />
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <CloudOff className="size-7 text-muted-foreground" aria-hidden />
      </div>
      <div className="max-w-sm space-y-2">
        <h1 className="text-xl font-semibold">Sin conexión</h1>
        <p className="text-sm text-muted-foreground">
          Esta sección necesita internet. Puedes seguir registrando bitácoras, aplicaciones, observaciones y cortes en la
          captura en campo; se enviarán cuando vuelva la señal.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <a
          href="/campo"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Ir a captura en campo
        </a>
        <RetryButton />
      </div>
    </main>
  )
}
