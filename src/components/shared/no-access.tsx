import { Lock } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"

/** Página de un módulo al que el rol del usuario no tiene acceso de lectura. */
export function NoAccess({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        icon={Lock}
        title="Sin acceso a este módulo"
        description="La información comercial y financiera está disponible para propietarios, administradores, finanzas y consulta."
      />
    </>
  )
}
