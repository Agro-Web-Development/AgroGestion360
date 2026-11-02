import { ArrowLeft, Wheat } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { NoAccess } from "@/components/shared/no-access"
import { Button } from "@/components/ui/button"
import { SaleForm } from "@/features/sales/components/sale-form"
import { getActiveCustomers, getSaleableProjects } from "@/features/sales/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"

export const metadata: Metadata = { title: "Nueva venta" }

export default async function NewSalePage() {
  const ctx = await getOrgContext()
  if (!can(ctx.role, "sales.write")) return <NoAccess title="Nueva venta" />
  const [customers, projects] = await Promise.all([getActiveCustomers(), getSaleableProjects()])

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/ventas">
          <ArrowLeft aria-hidden /> Ventas
        </Link>
      </Button>
      <PageHeader title="Nueva venta" description="La venta y sus partidas se registran en una sola operación." />
      {projects.length === 0 || customers.length === 0 ? (
        <EmptyState
          icon={Wheat}
          title={projects.length === 0 ? "No hay producción disponible para venta" : "No hay clientes activos"}
          description={
            projects.length === 0
              ? "Registra cortes en Cosechas para proyectos vigentes; solo se vende lo cosechado y aún no vendido."
              : "Registra al menos un cliente para emitir ventas."
          }
          action={
            <Button asChild variant="outline">
              <Link href={projects.length === 0 ? "/produccion" : "/clientes"}>
                {projects.length === 0 ? "Ir a cosechas" : "Ir a clientes"}
              </Link>
            </Button>
          }
        />
      ) : (
        <SaleForm customers={customers} projects={projects} />
      )}
    </>
  )
}
