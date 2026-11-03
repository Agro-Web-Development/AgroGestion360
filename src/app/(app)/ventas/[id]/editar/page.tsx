import { ArrowLeft } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { PageHeader } from "@/components/layout/page-header"
import { NoAccess } from "@/components/shared/no-access"
import { Button } from "@/components/ui/button"
import { getSaleableLots, type SaleableLot } from "@/features/harvests/queries"
import { SaleForm } from "@/features/sales/components/sale-form"
import { getActiveCustomers, getSale } from "@/features/sales/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { toInput } from "@/lib/validation"

export const metadata: Metadata = { title: "Editar borrador" }

export default async function EditSalePage({ params }: PageProps<"/ventas/[id]/editar">) {
  const { id } = await params
  const ctx = await getOrgContext()
  if (!can(ctx.role, "sales.write")) return <NoAccess title="Editar venta" />
  const [sale, customers, available] = await Promise.all([getSale(id), getActiveCustomers(), getSaleableLots()])
  // Solo los borradores se editan; una venta confirmada se cancela y se registra de nuevo.
  if (sale.status !== "borrador") redirect(`/ventas/${sale.id}`)

  // Lotes del borrador que ya no tienen existencia: se muestran para no perder la partida (al confirmar se rechazarán).
  const lots: SaleableLot[] = [...available]
  for (const i of sale.sale_items) {
    if (i.harvest && !lots.some((l) => l.id === i.harvest!.id)) {
      lots.push({
        id: i.harvest.id,
        lotCode: i.harvest.lot_code,
        harvestDate: i.harvest.harvest_date,
        quality: i.quality ?? "unica",
        classification: null,
        unit: i.unit,
        unitWeightKg: i.unit_weight_kg === null ? null : Number(i.unit_weight_kg),
        availableKg: Number(i.harvest.available_kg),
        projectId: i.project.id,
        projectCode: i.project.code,
        product: i.description,
        plot: i.harvest.assignment.plot.name,
      })
    }
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href={`/ventas/${sale.id}`}>
          <ArrowLeft aria-hidden /> {sale.code}
        </Link>
      </Button>
      <PageHeader title={`Editar borrador ${sale.code}`} description="Las partidas se reemplazan completas al guardar." />
      <SaleForm
        customers={customers}
        lots={lots}
        draft={{
          id: sale.id,
          code: sale.code,
          customerId: sale.customer.id,
          saleDate: sale.sale_date,
          dueDate: sale.due_date,
          deliveryDate: sale.delivery_date ?? "",
          notes: sale.notes ?? "",
          items: sale.sale_items.map((i) => ({
            harvestId: i.harvest?.id ?? "",
            description: i.description,
            unit: i.unit,
            quantity: toInput(i.quantity),
            unitWeightKg: toInput(i.unit_weight_kg),
            unitPrice: toInput(i.unit_price),
            discount: Number(i.discount) > 0 ? toInput(i.discount) : "",
          })),
        }}
      />
    </>
  )
}
