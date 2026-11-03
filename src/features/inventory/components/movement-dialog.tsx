"use client"

import { ArrowLeftRight } from "lucide-react"
import { useState } from "react"
import { useWatch } from "react-hook-form"

import { FormDialog, FormNote } from "@/components/forms/form-dialog"
import { FormInput } from "@/components/forms/form-input"
import { FormSelect, type SelectOption } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { useActionForm } from "@/components/forms/use-action-form"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { ProjectPlotFields } from "@/features/projects/components/project-plot-fields"
import type { OpenProject } from "@/features/projects/queries"
import { formatDate, formatMoney, formatNumber, todayISO } from "@/lib/format"
import { newId } from "@/lib/ids"
import { NONE } from "@/lib/validation"
import { registerMovement } from "../actions"
import type { LotBalance, Product, Supplier, Warehouse } from "../queries"
import {
  createsLot,
  isProjectMovement,
  MOVEMENT_DESCRIPTIONS,
  MOVEMENT_LABELS,
  MOVEMENT_TYPES,
  movementSchema,
  usesLotNumber,
  type MovementInput,
  type MovementType,
} from "../schemas"

function emptyMovement(warehouseId: string, preset?: Partial<MovementInput>): MovementInput {
  return {
    id: newId(),
    productId: "",
    type: "entrada",
    date: todayISO(),
    warehouseId,
    toWarehouseId: "",
    quantity: "",
    unitCost: "",
    projectId: "",
    plotId: "",
    lotId: "",
    lotNumber: "",
    lotExpiry: "",
    supplierId: NONE,
    responsibleId: NONE,
    reference: "",
    notes: "",
    ...preset,
  }
}

/** Movimientos que sacan producto de un almacén (requieren existencia en él). */
const takesFromWarehouse = (type: MovementType) => type === "consumo" || type === "ajuste_salida" || type === "transferencia"

export function MovementDialog({
  products,
  projects,
  warehouses,
  suppliers,
  employees,
  lotBalances,
  trigger,
  preset,
}: {
  products: Product[]
  projects: OpenProject[]
  warehouses: Warehouse[]
  suppliers: Supplier[]
  employees: SelectOption[]
  lotBalances: LotBalance[]
  trigger?: React.ReactNode
  /** Valores iniciales (p. ej. al registrar una entrada desde un producto). */
  preset?: Partial<MovementInput>
}) {
  const [open, setOpen] = useState(false)
  const activeWarehouses = warehouses.filter((w) => w.is_active)
  const defaultWarehouse = activeWarehouses.length === 1 ? activeWarehouses[0].id : ""
  const { form, onSubmit, pending } = useActionForm<MovementInput>({
    schema: movementSchema,
    defaultValues: emptyMovement(defaultWarehouse, preset),
    action: registerMovement,
    onSuccess: () => setOpen(false),
  })
  const [type, productId, warehouseId, lotId, quantityText, unitCostText] = useWatch({
    control: form.control,
    name: ["type", "productId", "warehouseId", "lotId", "quantity", "unitCost"],
  })
  const product = products.find((p) => p.id === productId)
  const quantity = Number(quantityText.replace(/,/g, ""))
  const unitCost = Number(unitCostText?.replace(/,/g, "") ?? "")

  const productOptions = products
    .filter((p) => p.is_active || type === "devolucion" || type === "ajuste_salida" || type === "transferencia")
    .map((p) => ({ value: p.id, label: `${p.name} (${formatNumber(p.stock, p.unit)})` }))
  // Los almacenes inactivos solo se ofrecen como origen de salidas (para vaciarlos).
  const originOptions = (takesFromWarehouse(type) ? warehouses : activeWarehouses).map((w) => ({ value: w.id, label: w.name }))
  const destinationOptions = activeWarehouses.filter((w) => w.id !== warehouseId).map((w) => ({ value: w.id, label: w.name }))

  const productBalances = lotBalances.filter((b) => b.productId === productId && b.warehouseId === warehouseId)
  const inWarehouse = productBalances.reduce((s, b) => s + b.quantity, 0)
  const selectedLot = productBalances.find((b) => b.lotId === lotId)
  const lotOptions = productBalances
    .filter((b) => b.lotId)
    .sort((a, b) => (a.expiryDate ?? "9999").localeCompare(b.expiryDate ?? "9999"))
    .map((b) => ({
      value: b.lotId!,
      label: `${b.lotNumber} · ${formatNumber(b.quantity, product?.unit)}${b.expiryDate ? ` · cad. ${formatDate(b.expiryDate)}` : ""}`,
    }))

  // Estimación informativa; el valor definitivo lo calcula la base de datos.
  const estimate =
    product && quantity > 0
      ? type === "entrada" || (type === "ajuste_entrada" && unitCost > 0)
        ? quantity * unitCost
        : product.avg_cost !== null
          ? quantity * Number(product.avg_cost)
          : null
      : null

  return (
    <FormDialog
      trigger={
        trigger ?? (
          <Button disabled={products.length === 0 || activeWarehouses.length === 0}>
            <ArrowLeftRight aria-hidden /> Registrar movimiento
          </Button>
        )
      }
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(emptyMovement(defaultWarehouse, preset))
      }}
      title="Movimiento de inventario"
      description={MOVEMENT_DESCRIPTIONS[type]}
      onSubmit={onSubmit}
      pending={pending}
      submitLabel="Registrar"
      after={
        <>
          {product && warehouseId && takesFromWarehouse(type) && (
            <FormNote>
              Existencia en el almacén:{" "}
              <span className="font-semibold tabular-nums">
                {formatNumber(selectedLot ? selectedLot.quantity : inWarehouse, product.unit)}
              </span>
              {selectedLot && " en el lote seleccionado"}
            </FormNote>
          )}
          {estimate !== null && (
            <FormNote>
              {type === "transferencia" ? "Valor transferido (no cambia el inventario): " : "Valor estimado del movimiento: "}
              <span className="font-semibold tabular-nums">{formatMoney(estimate)}</span>
              {type === "devolucion" && " (se usará el costo con el que el proyecto consumió el producto)"}
            </FormNote>
          )}
        </>
      }
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <FormSelect
          control={form.control}
          name="type"
          label="Tipo"
          options={MOVEMENT_TYPES.map((t) => ({ value: t, label: MOVEMENT_LABELS[t] }))}
        />
        <FormInput control={form.control} name="date" label="Fecha" type="date" max={todayISO()} />
        <div className="sm:col-span-2">
          <FormSelect
            control={form.control}
            name="productId"
            label="Producto"
            options={productOptions}
            description={
              product
                ? `Existencia total: ${formatNumber(product.stock, product.unit)} · Costo promedio: ${formatMoney(product.avg_cost)}${product.track_lots ? " · Controlado por lote" : ""}`
                : undefined
            }
          />
        </div>
        <FormSelect
          control={form.control}
          name="warehouseId"
          label={type === "transferencia" ? "Almacén de origen" : takesFromWarehouse(type) ? "Sale de" : "Almacén"}
          options={originOptions}
        />
        {type === "transferencia" ? (
          <FormSelect control={form.control} name="toWarehouseId" label="Almacén destino" options={destinationOptions} />
        ) : (
          <FormSelect
            control={form.control}
            name="responsibleId"
            label={isProjectMovement(type) ? "Entrega / recibe (opcional)" : "Responsable (opcional)"}
            options={[{ value: NONE, label: "Sin responsable" }, ...employees]}
          />
        )}
        {isProjectMovement(type) && (
          <ProjectPlotFields
            control={form.control}
            setValue={form.setValue}
            projects={projects}
            projectName="projectId"
            plotName="plotId"
            plotRequired
          />
        )}
        {product?.track_lots &&
          (usesLotNumber(type) ? (
            <>
              <FormInput
                control={form.control}
                name="lotNumber"
                label="Lote del fabricante"
                placeholder="Ej. L2401-15"
                description={type === "devolucion" ? "Lote que regresa al almacén." : "Si el lote ya existe, se suma a él."}
              />
              {createsLot(type) && <FormInput control={form.control} name="lotExpiry" label="Caducidad (opcional)" type="date" />}
            </>
          ) : (
            <div className="sm:col-span-2">
              <FormSelect
                control={form.control}
                name="lotId"
                label="Lote"
                placeholder={lotOptions.length ? "Selecciona el lote" : "Sin lotes con existencia en este almacén"}
                options={lotOptions}
                description="Ordenados por caducidad: primero el que vence antes."
              />
            </div>
          ))}
        <FormInput
          control={form.control}
          name="quantity"
          label={product ? `Cantidad (${product.unit})` : "Cantidad"}
          inputMode="decimal"
        />
        {createsLot(type) && (
          <FormInput
            control={form.control}
            name="unitCost"
            label="Costo unitario (MXN)"
            inputMode="decimal"
            description={type === "ajuste_entrada" ? "Vacío = costo promedio actual." : "Sin IVA acreditable."}
          />
        )}
        {type === "entrada" && (
          <FormSelect
            control={form.control}
            name="supplierId"
            label="Proveedor"
            options={[
              { value: NONE, label: "Sin proveedor" },
              ...suppliers.filter((s) => s.is_active).map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        )}
        <FormInput
          control={form.control}
          name="reference"
          label={type === "entrada" ? "Factura / remisión" : "Referencia (opcional)"}
        />
        <FormTextarea control={form.control} name="notes" label="Observaciones" rows={2} className="sm:col-span-2" />
      </FieldGroup>
    </FormDialog>
  )
}
