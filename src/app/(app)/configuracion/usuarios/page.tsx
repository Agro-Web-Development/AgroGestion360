import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InvitationsList } from "@/features/members/components/invitations-list"
import { InviteMemberDialog } from "@/features/members/components/invite-member-dialog"
import { MembersTable } from "@/features/members/components/members-table"
import { getMembers, getPendingInvitations } from "@/features/members/queries"
import { assignableRoles, can, invitableRoles, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"

export const metadata: Metadata = { title: "Usuarios y roles" }

export default async function UsersPage() {
  const ctx = await getOrgContext()
  const canManage = can(ctx.role, "members.manage")
  const [members, invitations] = await Promise.all([getMembers(), getPendingInvitations()])

  return (
    <>
      <PageHeader
        title="Usuarios y roles"
        description="Personas con acceso a la organización y sus permisos."
        actions={canManage && <InviteMemberDialog roles={invitableRoles(ctx.role)} />}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Miembros</CardTitle>
              <CardDescription>
                {members.filter((m) => m.status === "activo").length} activos de {members.length}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MembersTable
                members={members}
                actorRole={ctx.role}
                actorId={ctx.user.id}
                assignable={assignableRoles(ctx.role)}
              />
            </CardContent>
          </Card>
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>Invitaciones pendientes</CardTitle>
                <CardDescription>Se aceptan automáticamente cuando la persona crea su cuenta.</CardDescription>
              </CardHeader>
              <CardContent>
                <InvitationsList invitations={invitations} />
              </CardContent>
            </Card>
          )}
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Roles disponibles</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {ROLES.map((r) => (
                <div key={r}>
                  <dt className="font-medium">{ROLE_LABELS[r]}</dt>
                  <dd className="text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
