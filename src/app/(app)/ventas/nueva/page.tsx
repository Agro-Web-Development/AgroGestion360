import { ArrowLeft, Wheat } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { NoAccess } from "@/components/shared/no-access"
import { Button } from "@/components/ui/button"
import { getSaleableLots } from "@/features/harvests/queries"
import { SaleForm } from "@/features/sales/components/sale-form"
import { getActiveCustomers } from "@/features/sales/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"

export const metadata: Metadata = { title: "Nueva venta" }

export default async function NewSalePage() {
  const ctx = await getOrgContext()
  if (!can(ctx.role, "sales.write")) return <NoAccess title="Nueva venta" />
  const [customers, lots] = await Promise.all([getActiveCustomers(), getSaleableLots()])

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/ventas">
          <ArrowLeft aria-hidden /> Ventas
        </Link>
      </Button>
      <PageHeader
        title="Nueva venta"
        description="Guárdala como borrador o confírmala: al confirmar se descuentan los lotes en una sola operación."
      />
      {lots.length === 0 || customers.length === 0 ? (
        <EmptyState
          icon={Wheat}
          title={lots.length === 0 ? "No hay producto disponible para venta" : "No hay clientes activos"}
          description={
            lots.length === 0
              ? "Registra cortes en Producción para proyectos vigentes; solo se vende la existencia de los lotes."
              : "Registra al menos un cliente para emitir ventas."
          }
          action={
            <Button asChild variant="outline">
              <Link href={lots.length === 0 ? "/produccion" : "/clientes"}>
                {lots.length === 0 ? "Ir a producción" : "Ir a clientes"}
              </Link>
            </Button>
          }
        />
      ) : (
        <SaleForm customers={customers} lots={lots} />
      )}
    </>
  )
}
