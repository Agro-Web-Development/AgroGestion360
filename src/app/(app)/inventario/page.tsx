import { AlertTriangle, Boxes, Package, Plus, Wallet } from "lucide-react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { KpiCard } from "@/components/shared/kpi-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MovementDialog } from "@/features/inventory/components/movement-dialog"
import { MovementsTable } from "@/features/inventory/components/movements-table"
import { ProductFormDialog } from "@/features/inventory/components/product-form-dialog"
import { ProductsTable } from "@/features/inventory/components/products-table"
import { getMovements, getProducts } from "@/features/inventory/queries"
import { getOpenProjects } from "@/features/projects/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatMoney, formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Inventario" }

export default async function InventoryPage() {
  const ctx = await getOrgContext()
  const canWrite = can(ctx.role, "inventory.write")
  const [products, movements, projects] = await Promise.all([
    getProducts(),
    getMovements(),
    canWrite ? getOpenProjects() : Promise.resolve([]),
  ])
  const active = products.filter((p) => p.is_active)
  const value = products.reduce((s, p) => s + Number(p.stock_value), 0)
  const low = active.filter((p) => p.lowStock)

  const newProduct = canWrite && (
    <ProductFormDialog
      trigger={
        <Button variant="outline">
          <Plus aria-hidden /> Nuevo producto
        </Button>
      }
    />
  )

  return (
    <>
      <PageHeader
        title="Inventario de insumos"
        description="Existencias valoradas a costo promedio. El costo se carga al proyecto al consumir, no al comprar."
        actions={
          <>
            {newProduct}
            {canWrite && <MovementDialog products={products} projects={projects} />}
          </>
        }
      />
      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Aún no hay productos en el inventario"
          description="Registra semillas, fertilizantes, agroquímicos y combustibles para controlar entradas y consumos por proyecto."
          action={newProduct}
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <KpiCard label="Valor del inventario" value={formatMoney(value)} hint="Existencia × costo promedio" icon={Wallet} />
            <KpiCard
              label="Productos activos"
              value={formatNumber(active.length)}
              hint={`${formatNumber(products.length)} en catálogo`}
              icon={Boxes}
            />
            <KpiCard
              label="Bajo mínimo"
              value={formatNumber(low.length)}
              hint={low.length ? low.slice(0, 3).map((p) => p.name).join(", ") : "Sin alertas de existencia"}
              icon={AlertTriangle}
            />
          </div>
          <Tabs defaultValue="existencias">
            <TabsList>
              <TabsTrigger value="existencias">Existencias</TabsTrigger>
              <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
            </TabsList>
            <TabsContent value="existencias">
              <Card>
                <CardContent>
                  <ProductsTable products={products} canWrite={canWrite} canDelete={can(ctx.role, "catalogs.delete")} />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="movimientos">
              <Card>
                <CardContent>
                  <MovementsTable movements={movements} canWrite={canWrite} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </>
  )
}
