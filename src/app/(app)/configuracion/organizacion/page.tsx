import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { OrganizationForm } from "@/features/organizations/components/organization-form"
import { getOrganizationDetails, getPlanUsage, type PlanUsage } from "@/features/organizations/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatDate, formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Organización" }

export default async function OrganizationPage() {
  const [ctx, org, plan] = await Promise.all([getOrgContext(), getOrganizationDetails(), getPlanUsage()])
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
        <PlanCard plan={plan} />
      </div>
    </>
  )
}

const FEATURE_LABELS: Record<string, string> = {
  operacion: "Operación agrícola",
  offline: "Captura sin conexión",
  comercial: "Ventas y cobranza",
  finanzas: "Finanzas y rentabilidad",
  reportes_excel: "Reportes en Excel y PDF",
}

function PlanCard({ plan }: { plan: PlanUsage }) {
  const limit = (used: number, max: number | null, unit?: string) =>
    max === null ? `${formatNumber(used, unit)} · sin límite` : `${formatNumber(used, unit)} de ${formatNumber(max, unit)}`
  return (
    <Card className="xl:col-span-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Plan <Badge variant="secondary">{plan.plan_name}</Badge>
        </CardTitle>
        <CardDescription>Uso de la organización frente a los límites de su plan. Para cambiar de plan contacta a AgroGestión 360.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Row label="Proyectos vigentes">{limit(plan.projects, plan.max_projects)}</Row>
          <Row label="Usuarios">
            {limit(plan.users + plan.pending_invitations, plan.max_users)}
          </Row>
          <Row label="Almacenamiento">{limit(Math.round((plan.storage_bytes / 1048576) * 10) / 10, plan.max_storage_mb, "MB")}</Row>
          <Row label="Funciones">{plan.features.map((f) => FEATURE_LABELS[f] ?? f).join(", ") || "—"}</Row>
        </dl>
      </CardContent>
    </Card>
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
