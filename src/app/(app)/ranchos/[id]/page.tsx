import { ArrowLeft, Layers, MapPin, Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { ConfirmAction } from "@/components/shared/confirm-action"
import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { deleteFarm, setFarmActive } from "@/features/farms/actions"
import { FarmFormDialog } from "@/features/farms/components/farm-form-dialog"
import { PlotFormDialog } from "@/features/farms/components/plot-form-dialog"
import { PlotsTable } from "@/features/farms/components/plots-table"
import { getFarm, getPlots } from "@/features/farms/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatDate, formatNumber } from "@/lib/format"
import { toInput } from "@/lib/validation"

export const metadata: Metadata = { title: "Rancho" }

export default async function FarmPage({ params }: PageProps<"/ranchos/[id]">) {
  const { id } = await params
  const ctx = await getOrgContext()
  const [farm, plots] = await Promise.all([getFarm(id), getPlots(id)])
  const canWrite = can(ctx.role, "catalogs.write")
  const canDelete = can(ctx.role, "catalogs.delete")

  const activePlots = plots.filter((p) => p.is_active)
  const plotted = activePlots.reduce((s, p) => s + Number(p.area_ha), 0)
  const assigned = activePlots.reduce((s, p) => s + p.assignedArea, 0)
  const total = farm.total_area_ha === null ? null : Number(farm.total_area_ha)
  const remaining = total === null ? null : Math.max(total - plotted, 0)

  const addPlot = canWrite && farm.is_active && (
    <PlotFormDialog
      farmId={farm.id}
      availableHint={
        remaining !== null ? `Superficie del rancho aún sin parcelar: ${formatNumber(remaining, "ha")}.` : undefined
      }
      trigger={
        <Button>
          <Plus aria-hidden /> Nueva parcela
        </Button>
      }
    />
  )

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/ranchos">
          <ArrowLeft aria-hidden /> Ranchos
        </Link>
      </Button>
      <PageHeader
        title={farm.name}
        description={[farm.code, farm.municipality, farm.state].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            {canWrite && (
              <FarmFormDialog
                farm={{
                  id: farm.id,
                  name: farm.name,
                  code: farm.code ?? "",
                  municipality: farm.municipality ?? "",
                  state: farm.state ?? "",
                  address: farm.address ?? "",
                  totalAreaHa: toInput(farm.total_area_ha),
                  latitude: toInput(farm.latitude),
                  longitude: toInput(farm.longitude),
                  notes: farm.notes ?? "",
                }}
                trigger={
                  <Button variant="outline">
                    <Pencil aria-hidden /> Editar
                  </Button>
                }
              />
            )}
            {canWrite && (
              <ConfirmAction
                title={farm.is_active ? "Desactivar rancho" : "Reactivar rancho"}
                description={
                  farm.is_active
                    ? "El rancho y sus parcelas dejarán de ofrecerse para nuevos proyectos. El historial se conserva."
                    : "El rancho volverá a estar disponible."
                }
                confirmLabel={farm.is_active ? "Desactivar" : "Reactivar"}
                destructive={farm.is_active}
                action={setFarmActive.bind(null, farm.id, !farm.is_active)}
                trigger={
                  <Button variant="outline">
                    {farm.is_active ? <PowerOff aria-hidden /> : <Power aria-hidden />}
                    {farm.is_active ? "Desactivar" : "Reactivar"}
                  </Button>
                }
              />
            )}
            {canDelete && plots.length === 0 && (
              <ConfirmAction
                title="Eliminar rancho"
                description={`Se eliminará "${farm.name}" de forma permanente.`}
                confirmLabel="Eliminar"
                action={deleteFarm.bind(null, farm.id)}
                trigger={
                  <Button variant="destructive">
                    <Trash2 aria-hidden /> Eliminar
                  </Button>
                }
              />
            )}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Datos generales
              {!farm.is_active && <Badge variant="destructive">Inactivo</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Superficie total</dt>
              <dd className="text-right tabular-nums">{total === null ? "No indicada" : formatNumber(total, "ha")}</dd>
              <dt className="text-muted-foreground">Parcelada</dt>
              <dd className="text-right tabular-nums">{formatNumber(plotted, "ha")}</dd>
              {remaining !== null && (
                <>
                  <dt className="text-muted-foreground">Sin parcelar</dt>
                  <dd className="text-right tabular-nums">{formatNumber(remaining, "ha")}</dd>
                </>
              )}
              <dt className="text-muted-foreground">En proyectos vigentes</dt>
              <dd className="text-right tabular-nums">{formatNumber(assigned, "ha")}</dd>
              <dt className="text-muted-foreground">Alta</dt>
              <dd className="text-right">{formatDate(farm.created_at)}</dd>
            </dl>
            {(farm.address || farm.latitude !== null) && (
              <div className="mt-4 space-y-1 border-t pt-4 text-sm">
                {farm.address && <p>{farm.address}</p>}
                {farm.latitude !== null && farm.longitude !== null && (
                  <a
                    href={`https://www.google.com/maps?q=${farm.latitude},${farm.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <MapPin className="size-4" aria-hidden />
                    {farm.latitude}, {farm.longitude}
                  </a>
                )}
              </div>
            )}
            {farm.notes && <p className="mt-4 border-t pt-4 text-sm whitespace-pre-line text-muted-foreground">{farm.notes}</p>}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle>Parcelas</CardTitle>
              <CardDescription>
                {activePlots.length} activas · la disponibilidad descuenta lo asignado a proyectos vigentes.
              </CardDescription>
            </div>
            {plots.length > 0 && addPlot}
          </CardHeader>
          <CardContent>
            {plots.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="Sin parcelas"
                description="Divide el rancho en parcelas para asignarlas a proyectos agrícolas."
                action={addPlot}
              />
            ) : (
              <PlotsTable plots={plots} canWrite={canWrite} canDelete={canDelete} />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
