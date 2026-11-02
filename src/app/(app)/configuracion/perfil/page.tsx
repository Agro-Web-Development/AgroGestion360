import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form"
import { ProfileForm } from "@/features/profile/components/profile-form"
import { ROLE_LABELS } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"

export const metadata: Metadata = { title: "Mi perfil" }

export default async function ProfilePage() {
  const ctx = await getOrgContext()

  return (
    <>
      <PageHeader title="Mi perfil" description={ctx.user.email} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos personales</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm defaultValues={{ fullName: ctx.user.fullName, phone: ctx.user.phone ?? "" }} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cambiar contraseña</CardTitle>
            <CardDescription>Se aplicará en tu próximo inicio de sesión.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResetPasswordForm submitLabel="Actualizar contraseña" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Mis organizaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {ctx.memberships.map((m) => (
                <li key={m.membershipId} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    {m.organization.name}
                    {m.organization.isDemo && <Badge variant="secondary">Demo</Badge>}
                  </span>
                  <Badge variant="outline">{ROLE_LABELS[m.role]}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
