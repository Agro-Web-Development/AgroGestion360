"use client"

import { ArrowLeftRight } from "lucide-react"
import { useState } from "react"

import { FormInput } from "@/components/forms/form-input"
import { FormSelect } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { SubmitButton } from "@/components/forms/submit-button"
import { useActionForm } from "@/components/forms/use-action-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { ProjectPlotFields } from "@/features/projects/components/project-plot-fields"
import type { OpenProject } from "@/features/projects/queries"
import { formatMoney, formatNumber, todayISO } from "@/lib/format"
import { newId } from "@/lib/ids"
import { registerMovement } from "../actions"
import type { Product } from "../queries"
import {
  isProjectMovement,
  MOVEMENT_DESCRIPTIONS,
  MOVEMENT_LABELS,
  MOVEMENT_TYPES,
  movementSchema,
  type MovementInput,
} from "../schemas"

function emptyMovement(): MovementInput {
  return {
    id: newId(),
    productId: "",
    type: "entrada",
    date: todayISO(),
    quantity: "",
    unitCost: "",
    projectId: "",
    plotId: "",
    supplier: "",
    reference: "",
    notes: "",
  }
}

export function MovementDialog({ products, projects }: { products: Product[]; projects: OpenProject[] }) {
  const [open, setOpen] = useState(false)
  const { form, onSubmit, pending } = useActionForm<MovementInput>({
    schema: movementSchema,
    defaultValues: emptyMovement(),
    action: registerMovement,
    onSuccess: () => setOpen(false),
  })
  const type = form.watch("type")
  const product = products.find((p) => p.id === form.watch("productId"))
  const quantity = Number(form.watch("quantity").replace(/,/g, ""))
  const unitCost = Number(form.watch("unitCost")?.replace(/,/g, "") ?? "")
  const options = products.filter((p) => p.is_active || type === "devolucion" || type === "ajuste_salida")

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
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(emptyMovement())
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={products.length === 0}>
          <ArrowLeftRight aria-hidden /> Registrar movimiento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={onSubmit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>Movimiento de inventario</DialogTitle>
            <DialogDescription>{MOVEMENT_DESCRIPTIONS[type]}</DialogDescription>
          </DialogHeader>
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
                options={options.map((p) => ({ value: p.id, label: `${p.name} (${formatNumber(p.stock, p.unit)})` }))}
                description={
                  product
                    ? `Existencia: ${formatNumber(product.stock, product.unit)} · Costo promedio: ${formatMoney(product.avg_cost)}`
                    : undefined
                }
              />
            </div>
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
            <FormInput
              control={form.control}
              name="quantity"
              label={product ? `Cantidad (${product.unit})` : "Cantidad"}
              inputMode="decimal"
            />
            {(type === "entrada" || type === "ajuste_entrada") && (
              <FormInput
                control={form.control}
                name="unitCost"
                label="Costo unitario (MXN)"
                inputMode="decimal"
                description={type === "ajuste_entrada" ? "Vacío = costo promedio actual." : "Sin IVA acreditable."}
              />
            )}
            {type === "entrada" && (
              <>
                <FormInput control={form.control} name="supplier" label="Proveedor" />
                <FormInput control={form.control} name="reference" label="Factura / remisión" />
              </>
            )}
            {type !== "entrada" && <FormInput control={form.control} name="reference" label="Referencia (opcional)" />}
            <FormTextarea control={form.control} name="notes" label="Notas" rows={2} className="sm:col-span-2" />
          </FieldGroup>
          {estimate !== null && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm">
              Valor estimado del movimiento: <span className="font-semibold tabular-nums">{formatMoney(estimate)}</span>
              {type === "devolucion" && " (se usará el costo con el que el proyecto consumió el producto)"}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={pending}>Registrar</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
