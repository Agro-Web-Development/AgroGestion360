"use client"

import { Plus } from "lucide-react"

import type { SelectOption } from "@/components/forms/form-select"
import { CatalogRowActions } from "@/components/shared/catalog-row-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatNumber } from "@/lib/format"
import { NONE } from "@/lib/validation"
import { deleteCatalog, setCatalogActive } from "../actions"
import type { Category, Supplier, Warehouse } from "../queries"
import { INPUT_KIND_LABELS } from "../schemas"
import { CategoryFormDialog, SupplierFormDialog, WarehouseFormDialog } from "./catalog-dialogs"

type Perms = { canWrite: boolean; canDelete: boolean }

function Section({ title, description, action, children }: { title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      <div className="overflow-x-auto rounded-lg border">{children}</div>
    </section>
  )
}

function Name({ name, active, sub }: { name: string; active: boolean; sub?: string | null }) {
  return (
    <>
      <p className="font-medium">
        {name}
        {!active && (
          <Badge variant="destructive" className="ml-2">
            Inactivo
          </Badge>
        )}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </>
  )
}

const newButton = (label: string) => (
  <Button variant="outline" size="sm">
    <Plus aria-hidden /> {label}
  </Button>
)

export function CategoriesTable({ categories, canWrite, canDelete }: { categories: Category[] } & Perms) {
  return (
    <Section
      title="Categorías"
      description="Agrupan los productos. La clasificación habilita aplicaciones de campo y combustible de maquinaria."
      action={canWrite && <CategoryFormDialog trigger={newButton("Nueva categoría")} />}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Categoría</TableHead>
            <TableHead className="hidden sm:table-cell">Clasificación</TableHead>
            <TableHead className="text-right">Productos</TableHead>
            {(canWrite || canDelete) && <TableHead className="w-28"><span className="sr-only">Acciones</span></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((c) => (
            <TableRow key={c.id} className={c.is_active ? undefined : "opacity-60"}>
              <TableCell>
                <Name name={c.name} active={c.is_active} sub={c.description} />
              </TableCell>
              <TableCell className="hidden sm:table-cell">{INPUT_KIND_LABELS[c.kind]}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(c.productCount)}</TableCell>
              {(canWrite || canDelete) && (
                <TableCell>
                  <CatalogRowActions
                    name={c.name}
                    active={c.is_active}
                    editDialog={
                      canWrite
                        ? (trigger) => (
                            <CategoryFormDialog
                              trigger={trigger}
                              category={{ id: c.id, name: c.name, kind: c.kind, description: c.description ?? "" }}
                            />
                          )
                        : undefined
                    }
                    onToggle={canWrite ? () => setCatalogActive("inventory_categories", c.id, !c.is_active) : undefined}
                    onDelete={canDelete && c.productCount === 0 ? () => deleteCatalog("inventory_categories", c.id) : undefined}
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  )
}

export function WarehousesTable({
  warehouses,
  farms,
  employees,
  canWrite,
  canDelete,
}: { warehouses: Warehouse[]; farms: SelectOption[]; employees: SelectOption[] } & Perms) {
  return (
    <Section
      title="Almacenes"
      description="Cada almacén lleva su propia existencia; un almacén con producto no se desactiva hasta vaciarlo o transferirlo."
      action={canWrite && <WarehouseFormDialog trigger={newButton("Nuevo almacén")} farms={farms} employees={employees} />}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Almacén</TableHead>
            <TableHead className="hidden sm:table-cell">Rancho / ubicación</TableHead>
            <TableHead className="hidden md:table-cell">Responsable</TableHead>
            {(canWrite || canDelete) && <TableHead className="w-28"><span className="sr-only">Acciones</span></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {warehouses.map((w) => (
            <TableRow key={w.id} className={w.is_active ? undefined : "opacity-60"}>
              <TableCell>
                <Name name={w.name} active={w.is_active} sub={w.code} />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {w.farm?.name ?? "—"}
                {w.location && <p className="text-xs text-muted-foreground">{w.location}</p>}
              </TableCell>
              <TableCell className="hidden md:table-cell">{w.responsible?.full_name ?? "—"}</TableCell>
              {(canWrite || canDelete) && (
                <TableCell>
                  <CatalogRowActions
                    name={w.name}
                    active={w.is_active}
                    editDialog={
                      canWrite
                        ? (trigger) => (
                            <WarehouseFormDialog
                              trigger={trigger}
                              farms={farms}
                              employees={employees}
                              warehouse={{
                                id: w.id,
                                name: w.name,
                                code: w.code ?? "",
                                farmId: w.farm_id ?? NONE,
                                location: w.location ?? "",
                                responsibleId: w.responsible_id ?? NONE,
                                notes: w.notes ?? "",
                              }}
                            />
                          )
                        : undefined
                    }
                    onToggle={
                      canWrite && (!w.is_active || !w.hasStock)
                        ? () => setCatalogActive("warehouses", w.id, !w.is_active)
                        : undefined
                    }
                    onDelete={canDelete && w.usedCount === 0 ? () => deleteCatalog("warehouses", w.id) : undefined}
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  )
}

export function SuppliersTable({ suppliers, canWrite, canDelete }: { suppliers: Supplier[] } & Perms) {
  return (
    <Section
      title="Proveedores"
      description="Se eligen al registrar entradas por compra."
      action={canWrite && <SupplierFormDialog trigger={newButton("Nuevo proveedor")} />}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Proveedor</TableHead>
            <TableHead className="hidden sm:table-cell">Contacto</TableHead>
            <TableHead className="hidden text-right md:table-cell">Compras</TableHead>
            {(canWrite || canDelete) && <TableHead className="w-28"><span className="sr-only">Acciones</span></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                Sin proveedores registrados.
              </TableCell>
            </TableRow>
          )}
          {suppliers.map((s) => (
            <TableRow key={s.id} className={s.is_active ? undefined : "opacity-60"}>
              <TableCell>
                <Name name={s.name} active={s.is_active} sub={s.rfc} />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {s.contact_name ?? "—"}
                {(s.phone || s.email) && <p className="text-xs text-muted-foreground">{[s.phone, s.email].filter(Boolean).join(" · ")}</p>}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">{formatNumber(s.movementCount)}</TableCell>
              {(canWrite || canDelete) && (
                <TableCell>
                  <CatalogRowActions
                    name={s.name}
                    active={s.is_active}
                    editDialog={
                      canWrite
                        ? (trigger) => (
                            <SupplierFormDialog
                              trigger={trigger}
                              supplier={{
                                id: s.id,
                                name: s.name,
                                rfc: s.rfc ?? "",
                                contactName: s.contact_name ?? "",
                                phone: s.phone ?? "",
                                email: s.email ?? "",
                                address: s.address ?? "",
                                notes: s.notes ?? "",
                              }}
                            />
                          )
                        : undefined
                    }
                    onToggle={canWrite ? () => setCatalogActive("suppliers", s.id, !s.is_active) : undefined}
                    onDelete={canDelete && s.movementCount === 0 ? () => deleteCatalog("suppliers", s.id) : undefined}
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  )
}
