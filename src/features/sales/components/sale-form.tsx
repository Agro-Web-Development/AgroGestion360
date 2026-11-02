"use client"

import { Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useFieldArray, useWatch } from "react-hook-form"

import { FormInput } from "@/components/forms/form-input"
import { FormSelect } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { SubmitButton } from "@/components/forms/submit-button"
import { useActionForm } from "@/components/forms/use-action-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup } from "@/components/ui/field"
import { HARVEST_QUALITIES, QUALITY_LABELS } from "@/features/harvests/schemas"
import { formatDate, formatMoney, formatNumber, todayISO } from "@/lib/format"
import { NONE } from "@/lib/validation"
import { newId } from "@/lib/ids"
import { createSale } from "../actions"
import type { CustomerOption, SaleableProject } from "../queries"
import { lineAmount, saleSchema, type SaleInput, type SaleItemInput } from "../schemas"

const toNumber = (v: string | undefined) => Number((v ?? "").replace(/,/g, "")) || 0

function emptyItem(projectId = ""): SaleItemInput {
  return { projectId, description: "", quality: NONE, quantityKg: "", unitPrice: "" }
}

export function SaleForm({ customers, projects }: { customers: CustomerOption[]; projects: SaleableProject[] }) {
  const { form, onSubmit, pending } = useActionForm<SaleInput>({
    schema: saleSchema,
    defaultValues: {
      // Generado una vez por formulario: reenviar no duplica la venta.
      id: newId(),
      customerId: "",
      saleDate: todayISO(),
      dueDate: "",
      notes: "",
      items: [emptyItem(projects.length === 1 ? projects[0].id : "")],
    },
    action: createSale,
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" })
  const items = useWatch({ control: form.control, name: "items" })
  const customer = customers.find((c) => c.id === form.watch("customerId"))
  const saleDate = form.watch("saleDate")

  const total = items.reduce((s, i) => s + lineAmount(toNumber(i.quantityKg), toNumber(i.unitPrice)), 0)
  const kgByProject = new Map<string, number>()
  for (const i of items) kgByProject.set(i.projectId, (kgByProject.get(i.projectId) ?? 0) + toNumber(i.quantityKg))
  const overdrawn = projects.filter((p) => (kgByProject.get(p.id) ?? 0) > p.availableKg)
  const defaultDue =
    customer && /^\d{4}-\d{2}-\d{2}$/.test(saleDate)
      ? new Date(Date.parse(`${saleDate}T12:00:00Z`) + customer.credit_days * 86_400_000).toISOString().slice(0, 10)
      : null

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Partidas</CardTitle>
            <CardDescription>
              Precio por kilogramo. Solo se puede vender la producción cosechada disponible de cada proyecto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => {
              const item = items[index]
              const project = projects.find((p) => p.id === item?.projectId)
              const amount = lineAmount(toNumber(item?.quantityKg), toNumber(item?.unitPrice))
              return (
                <div key={field.id} className="rounded-lg border p-4">
                  <FieldGroup className="grid gap-4 md:grid-cols-6">
                    <div className="md:col-span-3">
                      <FormSelect
                        control={form.control}
                        name={`items.${index}.projectId`}
                        label="Proyecto"
                        options={projects.map((p) => ({
                          value: p.id,
                          label: `${p.code} · ${formatNumber(p.availableKg, "kg")} disponibles`,
                        }))}
                        description={project?.name}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <FormSelect
                        control={form.control}
                        name={`items.${index}.quality`}
                        label="Calidad"
                        options={[
                          { value: NONE, label: "Sin especificar" },
                          ...HARVEST_QUALITIES.map((q) => ({ value: q, label: QUALITY_LABELS[q] })),
                        ]}
                      />
                    </div>
                    <FormInput
                      control={form.control}
                      name={`items.${index}.description`}
                      label="Descripción"
                      placeholder="Ej. Brócoli de exportación"
                      className="md:col-span-6"
                    />
                    <FormInput
                      control={form.control}
                      name={`items.${index}.quantityKg`}
                      label="Kilogramos"
                      inputMode="decimal"
                      className="md:col-span-2"
                    />
                    <FormInput
                      control={form.control}
                      name={`items.${index}.unitPrice`}
                      label="Precio por kg"
                      inputMode="decimal"
                      className="md:col-span-2"
                      description={
                        project?.costPerKg != null ? `Costo de producción: ${formatMoney(project.costPerKg)}/kg` : undefined
                      }
                    />
                    <div className="flex items-end justify-between gap-2 md:col-span-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Importe</p>
                        <p className="text-lg font-semibold tabular-nums">{formatMoney(amount)}</p>
                      </div>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Quitar partida ${index + 1}`}
                          onClick={() => remove(index)}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      )}
                    </div>
                  </FieldGroup>
                </div>
              )
            })}
            {form.formState.errors.items?.root?.message && (
              <p className="text-sm text-destructive">{form.formState.errors.items.root.message}</p>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={fields.length >= 50}
              onClick={() => append(emptyItem(items[items.length - 1]?.projectId))}
            >
              <Plus aria-hidden /> Agregar partida
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Datos de la venta</CardTitle>
            <CardDescription>Se asignará un folio consecutivo al guardar.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <FormSelect
                control={form.control}
                name="customerId"
                label="Cliente"
                placeholder={customers.length ? "Selecciona el cliente" : "No hay clientes activos"}
                options={customers.map((c) => ({
                  value: c.id,
                  label: c.credit_days ? `${c.name} · ${c.credit_days} días` : `${c.name} · contado`,
                }))}
              />
              <FormInput control={form.control} name="saleDate" label="Fecha de venta" type="date" max={todayISO()} />
              <FormInput
                control={form.control}
                name="dueDate"
                label="Vencimiento"
                type="date"
                description={defaultDue ? `Vacío = ${formatDate(defaultDue)} (días de crédito del cliente).` : undefined}
              />
              <FormTextarea control={form.control} name="notes" label="Notas" rows={3} />
            </FieldGroup>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Total de la venta</span>
              <span className="text-2xl font-semibold tabular-nums">{formatMoney(total)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatNumber([...kgByProject.values()].reduce((s, v) => s + v, 0), "kg")} · Productos agrícolas sin
              procesar, tasa 0 % de IVA.
            </p>
            {overdrawn.length > 0 && (
              <p className="text-sm text-destructive">
                Excede lo disponible en {overdrawn.map((p) => `${p.code} (${formatNumber(p.availableKg, "kg")})`).join(", ")}.
              </p>
            )}
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button asChild variant="outline">
            <Link href="/ventas">Cancelar</Link>
          </Button>
          <SubmitButton pending={pending} disabled={overdrawn.length > 0}>
            Registrar venta
          </SubmitButton>
        </div>
      </div>
    </form>
  )
}
