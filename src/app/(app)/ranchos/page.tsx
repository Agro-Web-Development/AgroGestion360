import { LandPlot, Layers, Map, Plus } from "lucide-react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { KpiCard } from "@/components/shared/kpi-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FarmFormDialog } from "@/features/farms/components/farm-form-dialog"
import { FarmsTable } from "@/features/farms/components/farms-table"
import { getFarms } from "@/features/farms/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Ranchos y parcelas" }

export default async function FarmsPage() {
  const ctx = await getOrgContext()
  const canWrite = can(ctx.role, "catalogs.write")
  const farms = await getFarms()
  const active = farms.filter((f) => f.is_active)

  const newFarm = canWrite && (
    <FarmFormDialog
      trigger={
        <Button>
          <Plus aria-hidden /> Nuevo rancho
        </Button>
      }
    />
  )

  return (
    <>
      <PageHeader
        title="Ranchos y parcelas"
        description="Predios de la organización y su división en parcelas de cultivo."
        actions={newFarm}
      />

      {farms.length === 0 ? (
        <EmptyState
          icon={Map}
          title="Aún no hay ranchos registrados"
          description={
            canWrite
              ? "Registra tu primer rancho y después divídelo en parcelas para asignarlas a proyectos."
              : "Un agrónomo, administrador o propietario puede registrar los ranchos de la organización."
          }
          action={newFarm}
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard label="Ranchos activos" value={formatNumber(active.length)} icon={Map} />
            <KpiCard
              label="Parcelas activas"
              value={formatNumber(active.reduce((s, f) => s + f.plotCount, 0))}
              icon={Layers}
            />
            <KpiCard
              label="Superficie parcelada"
              value={formatNumber(active.reduce((s, f) => s + f.plottedArea, 0), "ha")}
              icon={LandPlot}
            />
          </div>
          <Card>
            <CardContent>
              <FarmsTable farms={farms} />
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
