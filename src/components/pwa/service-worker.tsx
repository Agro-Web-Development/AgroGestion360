"use client"

import { useEffect } from "react"

/**
 * Registra el service worker en producción. En desarrollo se omite para que
 * la recarga en caliente no compita con la caché (se habilita con
 * NEXT_PUBLIC_ENABLE_SW=1 para probar la PWA localmente).
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ENABLE_SW !== "1") return
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined)
  }, [])
  return null
}

/** Pide al service worker que guarde la captura en campo para usarla sin conexión (requiere sesión). */
export function cacheFieldShell() {
  if (!("serviceWorker" in navigator)) return
  void navigator.serviceWorker.ready.then((registration) => registration.active?.postMessage("ag360:cache-shell")).catch(() => undefined)
}

/** Al cerrar sesión se retira el shell guardado. */
export function clearWorkerCaches() {
  if (!("serviceWorker" in navigator)) return
  navigator.serviceWorker.controller?.postMessage("ag360:clear")
}
