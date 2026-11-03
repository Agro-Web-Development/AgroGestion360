import { AlertTriangle, Boxes, CalendarClock, Package, Plus, Wallet } from "lucide-react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterBar } from "@/components/shared/filter-bar"
import { KpiCard } from "@/components/shared/kpi-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { UrlTabs } from "@/components/shared/url-tabs"
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getFarms } from "@/features/farms/queries"
import { CategoriesTable, SuppliersTable, WarehousesTable } from "@/features/inventory/components/catalog-tables"
import { MovementDialog } from "@/features/inventory/components/movement-dialog"
import { MovementsTable } from "@/features/inventory/components/movements-table"
import { ProductFormDialog } from "@/features/inventory/components/product-form-dialog"
import { ProductsTable } from "@/features/inventory/components/products-table"
import { StockTable } from "@/features/inventory/components/stock-table"
import {
  getCategories,
  getLotBalances,
  getMovements,
  getProducts,
  getStock,
  getSuppliers,
  getWarehouses,
} from "@/features/inventory/queries"
import { expiryStatus } from "@/features/inventory/schemas"
import { getEmployeeOptions } from "@/features/labor/queries"
import { getOpenProjects } from "@/features/projects/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatMoney, formatNumber } from "@/lib/format"
import { dateParam, idParam, param } from "@/lib/search-params"

export const metadata: Metadata = { title: "Inventario" }

const TABS = ["existencias", "almacenes", "movimientos", "catalogos"] as const

export default async function InventoryPage({ searchParams }: PageProps<"/inventario">) {
  const sp = await searchParams
  const filters = { from: dateParam(sp.desde), to: dateParam(sp.hasta), warehouseId: idParam(sp.almacen), productId: idParam(sp.producto) }
  const filtering = Object.values(filters).some(Boolean)
  const tab = TABS.find((t) => t === param(sp.tab)) ?? (filtering ? "movimientos" : "existencias")

  const ctx = await getOrgContext()
  const canWrite = can(ctx.role, "inventory.write")
  const canDelete = can(ctx.role, "catalogs.delete")
  const [products, movements, stock, categories, warehouses, suppliers, lotBalances, employees, farms, projects] =
    await Promise.all([
      getProducts(),
      getMovements(filters),
      getStock(),
      getCategories(),
      getWarehouses(),
      getSuppliers(),
      canWrite ? getLotBalances() : Promise.resolve([]),
      getEmployeeOptions(),
      canWrite ? getFarms() : Promise.resolve([]),
      canWrite ? getOpenProjects() : Promise.resolve([]),
    ])
  const active = products.filter((p) => p.is_active)
  const value = products.reduce((s, p) => s + Number(p.stock_value), 0)
  const low = active.filter((p) => p.lowStock)
  const expiring = stock.filter((s) => {
    const status = expiryStatus(s.daysToExpiry)
    return status === "caducado" || status === "por_caducar"
  })
  const farmOptions = farms.map((f) => ({ value: f.id, label: f.name }))

  const newProduct = canWrite && (
    <ProductFormDialog
      categories={categories}
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
        description="Existencias por almacén y lote, valoradas a costo promedio ponderado. El costo se carga al proyecto al consumir, no al comprar."
        actions={
          <>
            {newProduct}
            {canWrite && (
              <MovementDialog
                products={products}
                projects={projects}
                warehouses={warehouses}
                suppliers={suppliers}
                employees={employees}
                lotBalances={lotBalances}
              />
            )}
          </>
        }
      />
      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Aún no hay productos en el inventario"
          description="Registra semillas, fertilizantes, agroquímicos, biológicos, combustibles y materiales para controlar entradas y consumos por proyecto."
          action={newProduct}
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Valor del inventario" value={formatMoney(value)} hint="Existencia × costo promedio" icon={Wallet} />
            <KpiCard
              label="Productos activos"
              value={formatNumber(active.length)}
              hint={`${formatNumber(warehouses.filter((w) => w.is_active).length)} almacenes activos`}
              icon={Boxes}
            />
            <KpiCard
              label="Bajo mínimo"
              value={formatNumber(low.length)}
              hint={low.length ? low.slice(0, 3).map((p) => p.name).join(", ") : "Sin alertas de existencia"}
              icon={AlertTriangle}
              tone={low.length ? "warning" : "default"}
            />
            <KpiCard
              label="Lotes por caducar"
              value={formatNumber(expiring.length)}
              hint={
                expiring.length
                  ? expiring.slice(0, 2).map((s) => `${s.productName} (${s.lotNumber})`).join(", ")
                  : "Ningún lote vence en 30 días"
              }
              icon={CalendarClock}
              tone={expiring.some((s) => (s.daysToExpiry ?? 0) < 0) ? "negative" : expiring.length ? "warning" : "default"}
            />
          </div>
          <UrlTabs defaultValue={tab}>
            <TabsList className="max-w-full overflow-x-auto">
              <TabsTrigger value="existencias">Existencias</TabsTrigger>
              <TabsTrigger value="almacenes">Por almacén y lote</TabsTrigger>
              <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
              <TabsTrigger value="catalogos">Catálogos</TabsTrigger>
            </TabsList>
            <TabsContent value="existencias">
              <Card>
                <CardContent>
                  <ProductsTable products={products} categories={categories} canWrite={canWrite} canDelete={canDelete} />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="almacenes">
              <Card>
                <CardContent>
                  <StockTable rows={stock} canWrite={canWrite} />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="movimientos" className="space-y-3">
              <FilterBar
                action="/inventario"
                from={filters.from}
                to={filters.to}
                selects={[
                  {
                    name: "almacen",
                    label: "Almacén",
                    allLabel: "Todos los almacenes",
                    value: filters.warehouseId,
                    options: warehouses.map((w) => ({ value: w.id, label: w.name })),
                  },
                  {
                    name: "producto",
                    label: "Producto",
                    allLabel: "Todos los productos",
                    value: filters.productId,
                    options: products.map((p) => ({ value: p.id, label: p.name })),
                  },
                ]}
              />
              <Card>
                <CardContent>
                  <MovementsTable movements={movements} canWrite={canWrite} />
                  {movements.length === 300 && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Se muestran los 300 movimientos más recientes; usa los filtros de fecha para consultar periodos anteriores.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="catalogos">
              <Card>
                <CardContent className="space-y-8">
                  <CategoriesTable categories={categories} canWrite={canWrite} canDelete={canDelete} />
                  <WarehousesTable
                    warehouses={warehouses}
                    farms={farmOptions}
                    employees={employees}
                    canWrite={canWrite}
                    canDelete={canDelete}
                  />
                  <SuppliersTable suppliers={suppliers} canWrite={canWrite} canDelete={canDelete} />
                </CardContent>
              </Card>
            </TabsContent>
          </UrlTabs>
        </>
      )}
    </>
  )
}
