"use client"

import { Plus } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useFieldArray, useWatch } from "react-hook-form"

import { FormCheckbox } from "@/components/forms/form-checkbox"
import { FormDialog, FormNote } from "@/components/forms/form-dialog"
import { FormInput } from "@/components/forms/form-input"
import { FormSelect } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { useActionForm } from "@/components/forms/use-action-form"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PhotoInput, uploadEvidence } from "@/features/fieldlogs/components/evidence"
import { ProjectPlotFields } from "@/features/projects/components/project-plot-fields"
import type { OpenProject } from "@/features/projects/queries"
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/features/sales/schemas"
import { formatMoney, formatNumber, todayISO } from "@/lib/format"
import { newId } from "@/lib/ids"
import { NONE } from "@/lib/validation"
import { registerExpense } from "../actions"
import {
  ALLOCATION_METHOD_DESCRIPTIONS,
  ALLOCATION_METHOD_LABELS,
  ALLOCATION_METHODS,
  allocateExpense,
  BUDGET_CATEGORY_LABELS,
  COST_CLASS_LABELS,
  defaultBudgetCategory,
  EXPENSE_BUDGET_CATEGORIES,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  expenseCostClass,
  expenseSchema,
  type ExpenseInput,
} from "../schemas"

type Option = { id: string; name: string }

function emptyExpense(responsibleId: string): ExpenseInput {
  return {
    id: newId(),
    paymentId: newId(),
    date: todayISO(),
    category: "renta_tierra",
    costCategory: "otros",
    description: "",
    amount: "",
    supplierId: NONE,
    invoiceRef: "",
    paymentMethod: "transferencia",
    allocationMethod: "directo",
    allocations: [{ projectId: "", plotId: NONE, value: "" }],
    responsibleId,
    notes: "",
    paidNow: false,
    paymentDate: todayISO(),
    paymentReference: "",
  }
}

const projectArea = (p: OpenProject) => p.plots.reduce((s, pl) => s + pl.areaHa, 0)

/**
 * Gasto directo (un proyecto) o compartido (varios proyectos con criterio de
 * reparto). Muestra el reparto exacto que hará la base de datos y permite
 * registrarlo como pagado; si no, queda en cuentas por pagar.
 */
export function ExpenseDialog({
  organizationId,
  projects,
  suppliers,
  members,
  currentUserId,
}: {
  organizationId: string
  projects: OpenProject[]
  suppliers: Option[]
  members: Option[]
  currentUserId: string
}) {
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const { form, onSubmit, pending } = useActionForm<ExpenseInput>({
    schema: expenseSchema,
    defaultValues: emptyExpense(currentUserId),
    action: registerExpense,
    onSuccess: () => {
      const pendingFiles = files
      setFiles([])
      void uploadEvidence(organizationId, "expense", form.getValues("id"), pendingFiles)
      setOpen(false)
    },
  })
  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: "allocations" })
  const [category, method, amount, allocations, paidNow] = useWatch({
    control: form.control,
    name: ["category", "allocationMethod", "amount", "allocations", "paidNow"],
  })

  // La categoría presupuestal sugerida sigue al tipo de gasto (se puede cambiar después).
  const lastCategory = useRef(category)
  useEffect(() => {
    if (lastCategory.current !== category) {
      lastCategory.current = category
      form.setValue("costCategory", defaultBudgetCategory(category))
    }
  }, [category, form])

  // Un gasto directo conserva solo el primer proyecto.
  useEffect(() => {
    if (method === "directo" && fields.length > 1) replace([fields[0]])
  }, [method, fields, replace])

  const shared = method !== "directo"
  const selected = new Map(allocations.map((a, i) => [a.projectId, i]))
  const preview =
    allocations.every((a) => a.projectId) && amount
      ? allocateExpense(
          amount.replace(/,/g, ""),
          method,
          allocations.map((a) => {
            const p = projects.find((x) => x.id === a.projectId)
            return { projectId: a.projectId, areaHa: p ? projectArea(p) : null, value: a.value?.replace(/,/g, "") || null }
          })
        )
      : null
  const allocationError = form.formState.errors.allocations?.message ?? form.formState.errors.allocations?.root?.message

  return (
    <FormDialog
      trigger={
        <Button disabled={projects.length === 0}>
          <Plus aria-hidden /> Registrar gasto
        </Button>
      }
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) {
          form.reset(emptyExpense(currentUserId))
          lastCategory.current = "renta_tierra"
          setFiles([])
        }
      }}
      title="Registrar gasto"
      description="Insumos, combustible, maquinaria y mano de obra no se capturan aquí: se cargan desde su módulo para no duplicar el costo."
      onSubmit={onSubmit}
      pending={pending}
      submitLabel={paidNow ? "Registrar y pagar" : "Registrar gasto"}
      after={
        <FormNote>
          {paidNow
            ? "Se registrará el gasto y su pago (egreso) en la misma operación."
            : "El gasto cuenta como costo desde hoy, pero no es egreso hasta que registres su pago."}
        </FormNote>
      }
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <FormSelect
          control={form.control}
          name="category"
          label="Tipo de gasto"
          description={`Clase de costo: ${COST_CLASS_LABELS[expenseCostClass(category)]}`}
          options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: EXPENSE_CATEGORY_LABELS[c] }))}
        />
        <FormSelect
          control={form.control}
          name="costCategory"
          label="Categoría presupuestal"
          options={EXPENSE_BUDGET_CATEGORIES.map((c) => ({ value: c, label: BUDGET_CATEGORY_LABELS[c] }))}
        />
        <FormInput
          control={form.control}
          name="description"
          label="Concepto"
          placeholder="Ej. Renta ciclo O-I"
          className="sm:col-span-2"
        />
        <FormInput control={form.control} name="date" label="Fecha" type="date" max={todayISO()} />
        <FormInput control={form.control} name="amount" label="Importe (MXN)" inputMode="decimal" />
        <FormSelect
          control={form.control}
          name="supplierId"
          label="Proveedor"
          options={[{ value: NONE, label: "Sin proveedor" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
        />
        <FormInput
          control={form.control}
          name="invoiceRef"
          label="Factura / comprobante"
          description="Una factura del mismo proveedor no se registra dos veces."
        />
        <FormSelect
          control={form.control}
          name="paymentMethod"
          label="Método de pago"
          options={[{ value: NONE, label: "Por definir" }, ...PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))]}
        />
        <FormSelect
          control={form.control}
          name="responsibleId"
          label="Usuario responsable"
          options={members.map((m) => ({ value: m.id, label: m.name }))}
        />
      </FieldGroup>

      <FieldSet className="gap-4 rounded-lg border p-4">
        <FieldLegend variant="label">Proyectos</FieldLegend>
        <FormSelect
          control={form.control}
          name="allocationMethod"
          label="Asignación"
          description={ALLOCATION_METHOD_DESCRIPTIONS[method]}
          options={ALLOCATION_METHODS.map((m) => ({ value: m, label: ALLOCATION_METHOD_LABELS[m] }))}
        />
        {!shared ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <ProjectPlotFields
              control={form.control}
              setValue={form.setValue}
              projects={projects}
              projectName="allocations.0.projectId"
              plotName="allocations.0.plotId"
            />
          </div>
        ) : (
          <ul className="grid gap-2" aria-label="Proyectos del gasto compartido">
            {projects.map((p) => {
              const index = selected.get(p.id)
              const checked = index !== undefined
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2">
                  <Checkbox
                    id={`alloc-${p.id}`}
                    checked={checked}
                    onCheckedChange={(v) => {
                      if (v === true) {
                        const blank = fields.findIndex((f, i) => !allocations[i]?.projectId)
                        if (blank >= 0) remove(blank)
                        append({ projectId: p.id, plotId: NONE, value: "" })
                      } else if (index !== undefined) {
                        remove(index)
                      }
                    }}
                  />
                  <label htmlFor={`alloc-${p.id}`} className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{p.code}</span> · {p.name}
                    <span className="block text-xs text-muted-foreground">{formatNumber(projectArea(p), "ha")}</span>
                  </label>
                  {checked && (method === "porcentaje" || method === "importe") && (
                    <Input
                      aria-label={method === "porcentaje" ? `Porcentaje de ${p.code}` : `Importe de ${p.code}`}
                      inputMode="decimal"
                      className="w-28"
                      placeholder={method === "porcentaje" ? "%" : "$"}
                      aria-invalid={Boolean(form.formState.errors.allocations?.[index]?.value) || undefined}
                      {...form.register(`allocations.${index}.value`)}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {allocationError && <p className="text-sm text-destructive">{allocationError}</p>}
        {preview?.ok && preview.rows.length > 1 && (
          <table className="w-full text-sm">
            <caption className="mb-1 text-left text-xs text-muted-foreground">Reparto que se registrará</caption>
            <tbody>
              {preview.rows.map((r) => (
                <tr key={r.projectId} className="border-t">
                  <td className="py-1">{projects.find((p) => p.id === r.projectId)?.code}</td>
                  <td className="py-1 text-right text-muted-foreground tabular-nums">{formatNumber(r.share * 100)} %</td>
                  <td className="py-1 text-right font-medium tabular-nums">{formatMoney(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {preview && !preview.ok && shared && <p className="text-sm text-muted-foreground">{preview.error}</p>}
      </FieldSet>

      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <FormCheckbox
          control={form.control}
          name="paidNow"
          label="Ya está pagado"
          description="Registra el pago total con el método de pago indicado."
          className="sm:col-span-2"
        />
        {paidNow && (
          <>
            <FormInput control={form.control} name="paymentDate" label="Fecha del pago" type="date" max={todayISO()} />
            <FormInput control={form.control} name="paymentReference" label="Referencia del pago" placeholder="Ej. SPEI 0012" />
          </>
        )}
        <FormTextarea control={form.control} name="notes" label="Observaciones" rows={2} className="sm:col-span-2" />
        <div className="sm:col-span-2">
          <PhotoInput files={files} onChange={setFiles} entity="expense" />
        </div>
      </FieldGroup>
    </FormDialog>
  )
}
