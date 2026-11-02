"use client"

import { TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <TriangleAlert className="size-10 text-destructive" aria-hidden />
      <h1 className="text-xl font-semibold">Algo salió mal</h1>
      <p className="text-sm text-muted-foreground">
        {error.message || "No fue posible cargar esta sección."}
        {error.digest && <span className="block text-xs">Referencia: {error.digest}</span>}
      </p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  )
}
