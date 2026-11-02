import { Building2, Plus } from "lucide-react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { NoAccess } from "@/components/shared/no-access"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CustomerFormDialog } from "@/features/customers/components/customer-form-dialog"
import { CustomersTable } from "@/features/customers/components/customers-table"
import { getCustomers } from "@/features/customers/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"

export const metadata: Metadata = { title: "Clientes" }

export default async function CustomersPage() {
  const ctx = await getOrgContext()
  if (!can(ctx.role, "finance.read")) return <NoAccess title="Clientes" />
  const canWrite = can(ctx.role, "sales.write")
  const customers = await getCustomers()

  const newCustomer = canWrite && (
    <CustomerFormDialog
      trigger={
        <Button>
          <Plus aria-hidden /> Nuevo cliente
        </Button>
      }
    />
  )

  return (
    <>
      <PageHeader title="Clientes" description="Compradores de la producción con sus condiciones de crédito y saldos." actions={newCustomer} />
      {customers.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Aún no hay clientes registrados"
          description="Registra a tus compradores para emitir ventas y controlar su cobranza."
          action={newCustomer}
        />
      ) : (
        <Card>
          <CardContent>
            <CustomersTable customers={customers} canWrite={canWrite} canDelete={can(ctx.role, "catalogs.delete")} />
          </CardContent>
        </Card>
      )}
    </>
  )
}
