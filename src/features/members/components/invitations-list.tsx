"use client"

import { X } from "lucide-react"

import { ConfirmAction } from "@/components/shared/confirm-action"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ROLE_LABELS } from "@/lib/auth/roles"
import { formatDate } from "@/lib/format"
import { cancelInvitation } from "../actions"
import type { PendingInvitation } from "../queries"

export function InvitationsList({ invitations }: { invitations: PendingInvitation[] }) {
  if (invitations.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay invitaciones pendientes.</p>
  }

  return (
    <ul className="divide-y rounded-lg border">
      {invitations.map((inv) => (
        <li key={inv.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{inv.email}</p>
            <p className="text-xs text-muted-foreground">
              Enviada el {formatDate(inv.created_at)} · vence el {formatDate(inv.expires_at)}
            </p>
          </div>
          <Badge variant="secondary">{ROLE_LABELS[inv.role]}</Badge>
          <ConfirmAction
            title="Cancelar invitación"
            description={`${inv.email} ya no podrá unirse a la organización con esta invitación.`}
            confirmLabel="Cancelar invitación"
            action={() => cancelInvitation(inv.id)}
            trigger={
              <Button variant="ghost" size="icon" aria-label={`Cancelar invitación de ${inv.email}`}>
                <X aria-hidden />
              </Button>
            }
          />
        </li>
      ))}
    </ul>
  )
}
