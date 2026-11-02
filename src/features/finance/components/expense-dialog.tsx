"use client"

import { Plus } from "lucide-react"
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
import { todayISO } from "@/lib/format"
import { newId } from "@/lib/ids"
import { registerExpense } from "../actions"
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, expenseSchema, type ExpenseInput } from "../schemas"

function emptyExpense(): ExpenseInput {
  return {
    id: newId(),
    projectId: "",
    plotId: "",
    date: todayISO(),
    category: "renta_tierra",
    description: "",
    supplier: "",
    invoiceRef: "",
    amount: "",
    notes: "",
  }
}

export function ExpenseDialog({ projects }: { projects: OpenProject[] }) {
  const [open, setOpen] = useState(false)
  const { form, onSubmit, pending } = useActionForm<ExpenseInput>({
    schema: expenseSchema,
    defaultValues: emptyExpense(),
    action: registerExpense,
    onSuccess: () => setOpen(false),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(emptyExpense())
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={projects.length === 0}>
          <Plus aria-hidden /> Registrar gasto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={onSubmit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>Gasto directo</DialogTitle>
            <DialogDescription>
              Insumos, maquinaria y mano de obra no se capturan aquí: se cargan desde su módulo para no duplicar el costo.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <ProjectPlotFields
              control={form.control}
              setValue={form.setValue}
              projects={projects}
              projectName="projectId"
              plotName="plotId"
            />
            <FormSelect
              control={form.control}
              name="category"
              label="Categoría"
              options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: EXPENSE_CATEGORY_LABELS[c] }))}
            />
            <FormInput control={form.control} name="date" label="Fecha" type="date" max={todayISO()} />
            <FormInput
              control={form.control}
              name="description"
              label="Descripción"
              placeholder="Ej. Renta ciclo OI"
              className="sm:col-span-2"
            />
            <FormInput control={form.control} name="supplier" label="Proveedor" />
            <FormInput
              control={form.control}
              name="invoiceRef"
              label="Factura / folio"
              description="No se acepta la misma factura dos veces en un proyecto."
            />
            <FormInput control={form.control} name="amount" label="Importe (MXN)" inputMode="decimal" />
            <FormTextarea control={form.control} name="notes" label="Notas" rows={2} className="sm:col-span-2" />
          </FieldGroup>
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
