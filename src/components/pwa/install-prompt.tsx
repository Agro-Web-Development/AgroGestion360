"use client"

import { Download, Share, SquarePlus } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true
}

/**
 * Botón «Instalar». En Chrome, Edge y Android usa el aviso nativo
 * (beforeinstallprompt); en iPhone/iPad explica cómo agregar a la pantalla de
 * inicio desde Compartir. No se muestra si la app ya está instalada.
 */
export function InstallPrompt({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [ios, setIos] = useState(false)
  const [help, setHelp] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setDeferred(null)
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1))
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  if (!deferred && !ios) return null

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={className}
        onClick={async () => {
          if (deferred) {
            await deferred.prompt()
            await deferred.userChoice.catch(() => undefined)
            setDeferred(null)
          } else setHelp(true)
        }}
      >
        <Download aria-hidden /> <span className="hidden sm:inline">Instalar app</span>
        <span className="sr-only sm:hidden">Instalar app</span>
      </Button>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Instalar AgroGestión 360</DialogTitle>
            <DialogDescription>Agrega la aplicación a tu pantalla de inicio para abrirla como app y capturar sin conexión.</DialogDescription>
          </DialogHeader>
          <ol className="grid gap-3 text-sm">
            <li className="flex items-center gap-2">
              <Share className="size-4 shrink-0 text-primary" aria-hidden /> 1. Toca <strong>Compartir</strong> en Safari.
            </li>
            <li className="flex items-center gap-2">
              <SquarePlus className="size-4 shrink-0 text-primary" aria-hidden /> 2. Elige <strong>Agregar a pantalla de inicio</strong>.
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  )
}
