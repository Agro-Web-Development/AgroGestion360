import { Leaf, Plus } from "lucide-react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CropFormDialog } from "@/features/crops/components/crop-form-dialog"
import { CropsTable } from "@/features/crops/components/crops-table"
import { getCrops } from "@/features/crops/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"

export const metadata: Metadata = { title: "Cultivos" }

export default async function CropsPage() {
  const ctx = await getOrgContext()
  const canWrite = can(ctx.role, "catalogs.write")
  const crops = await getCrops()

  const newCrop = canWrite && (
    <CropFormDialog
      trigger={
        <Button>
          <Plus aria-hidden /> Nuevo cultivo
        </Button>
      }
    />
  )

  return (
    <>
      <PageHeader
        title="Cultivos"
        description="Catálogo de cultivos y variedades que se siembran en la organización."
        actions={newCrop}
      />
      {crops.length === 0 ? (
        <EmptyState
          icon={Leaf}
          title="Aún no hay cultivos registrados"
          description="Cada proyecto agrícola se asocia a un cultivo y variedad del catálogo."
          action={newCrop}
        />
      ) : (
        <Card>
          <CardContent>
            <CropsTable crops={crops} canWrite={canWrite} canDelete={can(ctx.role, "catalogs.delete")} />
          </CardContent>
        </Card>
      )}
    </>
  )
}
