"use client"

import { Copy, Plus, Save, Trash2 } from "lucide-react"
import Link from "next/link"
import { useFieldArray, useWatch, type Control } from "react-hook-form"

import { FormInput } from "@/components/forms/form-input"
import { FormSelect } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { SubmitButton } from "@/components/forms/submit-button"
import { useActionForm } from "@/components/forms/use-action-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup } from "@/components/ui/field"
import { formatMoney, formatNumber } from "@/lib/format"
import { lineAmount, sumMoney } from "@/lib/money"
import { saveBudget } from "../actions"
import {
  BUDGET_CATEGORIES,
  BUDGET_CATEGORY_LABELS,
  budgetSchema,
  type BudgetInput,
  type BudgetLineInput,
} from "../schemas"

const emptyLine = (category: BudgetLineInput["category"] = "preparacion_terreno"): BudgetLineInput => ({
  category,
  concept: "",
  unit: "",
  quantity: "1",
  unitCost: "",
})

function LineRow({
  index,
  control,
  removable,
  onRemove,
  onDuplicate,
}: {
  index: number
  control: Control<BudgetInput>
  removable: boolean
  onRemove: () => void
  onDuplicate: () => void
}) {
  const [quantity, unitCost] = useWatch({ control, name: [`lines.${index}.quantity`, `lines.${index}.unitCost`] })
  const amount = lineAmount(quantity, unitCost)

  return (
    <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-12 sm:items-start">
      <div className="sm:col-span-3">
        <FormSelect
          control={control}
          name={`lines.${index}.category`}
          label="Categoría"
          options={BUDGET_CATEGORIES.map((c) => ({ value: c, label: BUDGET_CATEGORY_LABELS[c] }))}
        />
      </div>
      <FormInput control={control} name={`lines.${index}.concept`} label="Concepto" className="sm:col-span-4" />
      <FormInput control={control} name={`lines.${index}.unit`} label="Unidad" placeholder="ha, kg, jornal" className="sm:col-span-1" />
      <FormInput control={control} name={`lines.${index}.quantity`} label="Cantidad" inputMode="decimal" className="sm:col-span-2" />
      <FormInput control={control} name={`lines.${index}.unitCost`} label="Costo unitario" inputMode="decimal" className="sm:col-span-2" />
      <div className="flex items-center justify-between gap-2 sm:col-span-12">
        <p className="text-sm">
          Importe: <span className="font-semibold tabular-nums">{formatMoney(amount)}</span>
        </p>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="icon" onClick={onDuplicate} aria-label={`Duplicar partida ${index + 1}`}>
            <Copy aria-hidden />
          </Button>
          {removable && (
            <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label={`Quitar partida ${index + 1}`}>
              <Trash2 aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Presupuesto por partidas. Guardar crea la versión original o una revisión
 * nueva: las versiones anteriores nunca se modifican.
 */
export function BudgetForm({
  defaultValues,
  project,
  cancelHref,
}: {
  defaultValues: BudgetInput
  project: { code: string; crop: string; assignedAreaHa: number }
  cancelHref: string
}) {
  const revision = defaultValues.baseVersion !== null
  const { form, onSubmit, pending } = useActionForm<BudgetInput>({
    schema: budgetSchema,
    defaultValues: defaultValues.lines.length ? defaultValues : { ...defaultValues, lines: [emptyLine()] },
    action: saveBudget,
  })
  const { fields, append, insert, remove } = useFieldArray({ control: form.control, name: "lines" })
  const [lines, areaText] = useWatch({ control: form.control, name: ["lines", "areaHa"] })
  const amounts = lines.map((l) => lineAmount(l.quantity, l.unitCost))
  const total = sumMoney(amounts)
  const area = Number((areaText ?? "").replace(/,/g, ""))
  const byCategory = BUDGET_CATEGORIES.map((c) => ({
    category: c,
    amount: sumMoney(amounts.filter((_, i) => lines[i]?.category === c)),
  })).filter((r) => r.amount > 0)
  const linesError = form.formState.errors.lines?.message ?? form.formState.errors.lines?.root?.message

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Partidas</CardTitle>
            <CardDescription>
              Concepto, cantidad estimada y costo unitario por categoría. El importe de cada partida se redondea a centavos igual
              que en la base de datos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.map((field, index) => (
              <LineRow
                key={field.id}
                index={index}
                control={form.control}
                removable={fields.length > 1}
                onRemove={() => remove(index)}
                onDuplicate={() => insert(index + 1, { ...form.getValues(`lines.${index}`), concept: "" })}
              />
            ))}
            {linesError && <p className="text-sm text-destructive">{linesError}</p>}
            <Button
              type="button"
              variant="outline"
              disabled={fields.length >= 200}
              onClick={() => append(emptyLine(lines.at(-1)?.category))}
            >
              <Plus aria-hidden /> Agregar partida
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{revision ? `Revisión de la versión ${defaultValues.baseVersion}` : "Presupuesto original"}</CardTitle>
            <CardDescription>
              {project.code} · {project.crop}.{" "}
              {revision
                ? "Se guardará como una versión nueva; la anterior se conserva sin cambios."
                : "Será la versión 1 y se conservará aunque después se revise."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid grid-cols-2 gap-4">
                <FormInput control={form.control} name="periodStart" label="Inicio del periodo" type="date" />
                <FormInput control={form.control} name="periodEnd" label="Fin del periodo" type="date" />
              </div>
              <FormInput
                control={form.control}
                name="areaHa"
                label="Superficie (ha)"
                inputMode="decimal"
                description={`Asignada al proyecto: ${formatNumber(project.assignedAreaHa, "ha")}.`}
              />
              {revision && (
                <FormTextarea
                  control={form.control}
                  name="reason"
                  label="Motivo de la revisión"
                  rows={2}
                  placeholder="Ej. Aumento en el precio del fertilizante"
                />
              )}
              <FormTextarea control={form.control} name="notes" label="Notas" rows={2} />
            </FieldGroup>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 text-sm">
            {byCategory.map((r) => (
              <div key={r.category} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{BUDGET_CATEGORY_LABELS[r.category]}</span>
                <span className="tabular-nums">{formatMoney(r.amount)}</span>
              </div>
            ))}
            <div className="flex items-baseline justify-between border-t pt-2">
              <span className="font-medium">Presupuesto total</span>
              <span className="text-2xl font-semibold tabular-nums">{formatMoney(total)}</span>
            </div>
            {area > 0 && <p className="text-xs text-muted-foreground">{formatMoney(total / area)} por hectárea</p>}
          </CardContent>
        </Card>
        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="ghost">
            <Link href={cancelHref}>Cancelar</Link>
          </Button>
          <SubmitButton pending={pending}>
            <Save aria-hidden /> {revision ? "Guardar revisión" : "Guardar presupuesto"}
          </SubmitButton>
        </div>
      </div>
    </form>
  )
}
