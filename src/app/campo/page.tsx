import type { Metadata } from "next"

import { FieldCaptureApp } from "@/features/offline/components/field-capture-app"

export const metadata: Metadata = {
  title: "Captura en campo",
  description: "Registro de bitácoras, aplicaciones, observaciones y cortes con o sin conexión.",
}

/**
 * Página estática (sin datos de la sesión en el HTML): el service worker la
 * guarda para abrirla sin conexión. Los datos se leen en el navegador desde
 * IndexedDB o desde /api/campo/contexto.
 */
export default function FieldCapturePage() {
  return <FieldCaptureApp />
}
