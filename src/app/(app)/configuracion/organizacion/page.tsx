import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { OrganizationForm } from "@/features/organizations/components/organization-form"
import { getOrganizationDetails } from "@/features/organizations/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatDate } from "@/lib/format"

export const metadata: Metadata = { title: "Organización" }

export default async function OrganizationPage() {
  const [ctx, org] = await Promise.all([getOrgContext(), getOrganizationDetails()])
  const canEdit = can(ctx.role, "organization.manage")

  return (
    <>
      <PageHeader title="Organización" description="Datos generales y configuración regional." />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Datos generales</CardTitle>
            <CardDescription>
              {canEdit
                ? "Esta información aparecerá en reportes y documentos."
                : "Solo el propietario o un administrador pueden modificar estos datos."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrganizationForm
              key={org.id}
              readOnly={!canEdit}
              defaultValues={{
                name: org.name,
                legalName: org.legal_name ?? "",
                rfc: org.rfc ?? "",
                email: org.email ?? "",
                phone: org.phone ?? "",
                address: org.address ?? "",
              }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Configuración regional</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm">
              <Row label="Idioma">Español (México)</Row>
              <Row label="Moneda">{org.currency === "MXN" ? "Peso mexicano (MXN)" : org.currency}</Row>
              <Row label="Zona horaria">{org.timezone}</Row>
              <Row label="Sistema de medidas">Métrico (ha, kg, t, L)</Row>
              <Row label="Alta">{formatDate(org.created_at)}</Row>
              {org.is_demo && (
                <Row label="Tipo">
                  <Badge variant="secondary">Demostración</Badge>
                </Row>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  )
}
