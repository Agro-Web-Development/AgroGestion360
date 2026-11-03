import { ArrowLeft, ClipboardList, SlidersHorizontal } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EvidenceDialog } from "@/features/fieldlogs/components/evidence"
import { ProjectTimeline } from "@/features/fieldlogs/components/timeline"
import { getProjectTimeline } from "@/features/fieldlogs/queries"
import { AdjustmentDialog } from "@/features/harvests/components/adjustment-dialog"
import { MovementsTable } from "@/features/harvests/components/production-tables"
import { getLot, getProductionMovements } from "@/features/harvests/queries"
import { QUALITY_LABELS, UNIT_SHORT } from "@/features/harvests/schemas"
import { isClosed } from "@/features/projects/status"
import { TraceTable } from "@/features/sales/components/trace-table"
import { getLotTrace } from "@/features/sales/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatDate, formatDateTime, formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Trazabilidad del lote" }

const TIMELINE_LIMIT = 150

export default async function LotPage({ params }: PageProps<"/produccion/lotes/[id]">) {
  const { id } = await params
  const ctx = await getOrgContext()
  const canSeeFinance = can(ctx.role, "finance.read")
  const lot = await getLot(id)
  const [timeline, movements, trace] = await Promise.all([
    getProjectTimeline(lot.project.id, { to: lot.harvest_date }, TIMELINE_LIMIT),
    getProductionMovements({ harvestId: lot.id }),
    canSeeFinance ? getLotTrace({ harvestId: lot.id }) : Promise.resolve([]),
  ])
  // Labores de la parcela del lote (o de todo el proyecto) hasta su corte.
  const plotName = lot.assignment.plot.name
  const fieldHistory = timeline.filter(
    (e) => (e.plot === plotName || e.plot === null) && (e.kind !== "cosecha" || e.id === lot.id)
  )
  const product = [lot.project.crop.name, lot.project.crop.variety].filter(Boolean).join(" ")
  const canAdjust = can(ctx.role, "produce.adjust") && !isClosed(lot.project.status)

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/produccion?tab=inventario">
          <ArrowLeft aria-hidden /> Producción
        </Link>
      </Button>
      <PageHeader
        title={`Lote ${lot.lot_code}`}
        description={`${product} · ${QUALITY_LABELS[lot.quality]}${lot.classification ? ` · ${lot.classification}` : ""}`}
        actions={
          <>
            <EvidenceDialog
              organizationId={ctx.organization.id}
              entity="harvest"
              entityId={lot.id}
              title={`${lot.lot_code} · corte ${lot.cut_number}`}
              canAdd={can(ctx.role, "harvest.write")}
            />
            {canAdjust && (
              <AdjustmentDialog
                lot={{ id: lot.id, lotCode: lot.lot_code, availableKg: Number(lot.available_kg), harvestDate: lot.harvest_date }}
                trigger={
                  <Button variant="outline">
                    <SlidersHorizontal aria-hidden /> Merma o ajuste
                  </Button>
                }
              />
            )}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {canSeeFinance && (
            <Card>
              <CardHeader>
                <CardTitle>Ventas del lote</CardTitle>
                <CardDescription>Cada salida de producto con su venta y cliente. Las canceladas regresaron al lote.</CardDescription>
              </CardHeader>
              <CardContent>
                <TraceTable rows={trace} hide={["lot", "origin"]} />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Movimientos del lote</CardTitle>
              <CardDescription>Salidas por venta, reversiones, mermas, pérdidas y ajustes (kg).</CardDescription>
            </CardHeader>
            <CardContent>
              <MovementsTable rows={movements} canAdjust={canAdjust} showLot={false} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Historial agrícola hasta el corte</CardTitle>
              <CardDescription>
                Riegos, aplicaciones, actividades, jornadas, maquinaria e insumos de la parcela {plotName} (y de todo el
                proyecto) hasta el {formatDate(lot.harvest_date)}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {fieldHistory.length === 0 ? (
                <EmptyState icon={ClipboardList} title="Sin registros de campo" description="No hay labores registradas antes del corte." />
              ) : (
                <>
                  <ProjectTimeline entries={fieldHistory} showAmounts={canSeeFinance} />
                  {timeline.length === TIMELINE_LIMIT && (
                    <p className="mt-4 text-xs text-muted-foreground">Se muestran los {TIMELINE_LIMIT} registros más recientes.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Existencia</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Cantidad inicial</dt>
                <dd className="text-right tabular-nums">
                  {formatNumber(lot.quantity_kg, "kg")}
                  {lot.unit !== "kg" && (
                    <span className="block text-xs text-muted-foreground">{formatNumber(lot.quantity, UNIT_SHORT[lot.unit])}</span>
                  )}
                </dd>
                <dt className="text-muted-foreground">Vendido</dt>
                <dd className="text-right tabular-nums">{formatNumber(lot.sold_kg, "kg")}</dd>
                <dt className="text-muted-foreground">Mermas y ajustes</dt>
                <dd className="text-right tabular-nums">{formatNumber(lot.adjusted_kg, "kg")}</dd>
                <dt className="font-medium">Disponible</dt>
                <dd className="text-right text-lg font-semibold tabular-nums">{formatNumber(lot.available_kg, "kg")}</dd>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Origen</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Proyecto</dt>
                <dd className="text-right">
                  <Link href={`/proyectos/${lot.project.id}`} className="hover:underline">
                    {lot.project.code}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{lot.project.name}</span>
                </dd>
                <dt className="text-muted-foreground">Parcela</dt>
                <dd className="text-right">
                  {plotName}
                  <span className="block text-xs text-muted-foreground">{lot.assignment.plot.farm.name}</span>
                </dd>
                <dt className="text-muted-foreground">Cultivo</dt>
                <dd className="text-right">{product}</dd>
                <dt className="text-muted-foreground">Corte</dt>
                <dd className="text-right">
                  Núm. {lot.cut_number} · {formatDate(lot.harvest_date)}
                </dd>
                <dt className="text-muted-foreground">Calidad</dt>
                <dd className="text-right">{QUALITY_LABELS[lot.quality]}</dd>
                <dt className="text-muted-foreground">Responsable</dt>
                <dd className="text-right">{lot.responsible?.full_name ?? "—"}</dd>
                {lot.packages && (
                  <>
                    <dt className="text-muted-foreground">Empaques</dt>
                    <dd className="text-right tabular-nums">{formatNumber(lot.packages)}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">Registrado</dt>
                <dd className="text-right">{formatDateTime(lot.created_at)}</dd>
              </dl>
              {lot.notes && <p className="mt-3 text-sm whitespace-pre-line">{lot.notes}</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
