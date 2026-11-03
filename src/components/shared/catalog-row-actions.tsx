"use client"

import { Pencil, Power, PowerOff, Trash2 } from "lucide-react"

import { ConfirmAction } from "@/components/shared/confirm-action"
import { Button } from "@/components/ui/button"
import type { ActionResult } from "@/lib/actions"

/**
 * Acciones de una fila de catálogo: editar, desactivar/reactivar y eliminar
 * (solo sin uso; con historial se desactiva, la base de datos lo garantiza).
 */
export function CatalogRowActions({
  name,
  active,
  editDialog,
  onToggle,
  onDelete,
  deactivateDescription,
}: {
  name: string
  active: boolean
  /** Diálogo de edición con su propio botón disparador (null = sin permiso). */
  editDialog?: (trigger: React.ReactNode) => React.ReactNode
  onToggle?: () => Promise<ActionResult>
  /** Solo se pasa cuando el registro no tiene uso y el usuario puede eliminar. */
  onDelete?: () => Promise<ActionResult>
  deactivateDescription?: string
}) {
  return (
    <div className="flex justify-end gap-1">
      {editDialog?.(
        <Button variant="ghost" size="icon" aria-label={`Editar ${name}`}>
          <Pencil aria-hidden />
        </Button>
      )}
      {onToggle && (
        <ConfirmAction
          title={active ? "Desactivar" : "Reactivar"}
          description={
            active
              ? (deactivateDescription ?? `"${name}" ya no se ofrecerá en nuevos registros. Su historial se conserva.`)
              : `"${name}" volverá a estar disponible.`
          }
          confirmLabel={active ? "Desactivar" : "Reactivar"}
          destructive={active}
          action={onToggle}
          trigger={
            <Button variant="ghost" size="icon" aria-label={active ? `Desactivar ${name}` : `Reactivar ${name}`}>
              {active ? <PowerOff aria-hidden /> : <Power aria-hidden />}
            </Button>
          }
        />
      )}
      {onDelete && (
        <ConfirmAction
          title="Eliminar"
          description={`Se eliminará "${name}" de forma permanente.`}
          confirmLabel="Eliminar"
          action={onDelete}
          trigger={
            <Button variant="ghost" size="icon" aria-label={`Eliminar ${name}`}>
              <Trash2 aria-hidden />
            </Button>
          }
        />
      )}
    </div>
  )
}
