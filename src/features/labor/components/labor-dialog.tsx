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
import { formatMoney, todayISO } from "@/lib/format"
import { NONE } from "@/lib/validation"
import { newId } from "@/lib/ids"
import { registerLabor } from "../actions"
import type { Employee } from "../queries"
import { laborSchema, PAY_TYPE_LABELS, PAY_TYPES, type LaborInput } from "../schemas"

function emptyLabor(): LaborInput {
  return {
    id: newId(),
    projectId: "",
    plotId: "",
    employeeId: NONE,
    crew: "",
    date: todayISO(),
    activity: "",
    payType: "jornal",
    quantity: "1",
    unitLabel: "",
    unitRate: "",
    notes: "",
  }
}

export function LaborDialog({ employees, projects }: { employees: Employee[]; projects: OpenProject[] }) {
  const [open, setOpen] = useState(false)
  const active = employees.filter((e) => e.is_active)
  const { form, onSubmit, pending } = useActionForm<LaborInput>({
    schema: laborSchema,
    defaultValues: emptyLabor(),
    action: registerLabor,
    onSuccess: () => setOpen(false),
  })
  const employee = active.find((e) => e.id === form.watch("employeeId"))
  const payType = form.watch("payType")
  const quantity = Number(form.watch("quantity").replace(/,/g, ""))
  const rateText = form.watch("unitRate")?.replace(/,/g, "") ?? ""
  const rate = rateText !== "" ? Number(rateText) : employee && payType === "jornal" ? Number(employee.daily_wage) : NaN
  const estimate = quantity > 0 && Number.isFinite(rate) ? quantity * rate : null

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(emptyLabor())
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={projects.length === 0}>
          <Plus aria-hidden /> Registrar mano de obra
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={onSubmit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>Mano de obra</DialogTitle>
            <DialogDescription>
              Jornales de empleados (máximo uno por día entre todos los proyectos) o destajo de cuadrillas.
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
              name="employeeId"
              label="Empleado"
              options={[
                { value: NONE, label: "Cuadrilla / eventuales" },
                ...active.map((e) => ({ value: e.id, label: `${e.full_name} · ${formatMoney(e.daily_wage)}/día` })),
              ]}
            />
            <FormInput control={form.control} name="date" label="Fecha" type="date" max={todayISO()} />
            {!employee && (
              <FormInput
                control={form.control}
                name="crew"
                label="Cuadrilla"
                placeholder="Ej. Cuadrilla de corte (8 personas)"
                className="sm:col-span-2"
              />
            )}
            <FormInput control={form.control} name="activity" label="Labor" placeholder="Ej. Deshierbe manual" />
            <FormSelect
              control={form.control}
              name="payType"
              label="Forma de pago"
              options={PAY_TYPES.map((t) => ({ value: t, label: PAY_TYPE_LABELS[t] }))}
            />
            <FormInput
              control={form.control}
              name="quantity"
              label={payType === "jornal" ? "Jornales" : "Unidades"}
              inputMode="decimal"
              description={payType === "jornal" && employee ? "1 = día completo; 0.5 = medio día." : undefined}
            />
            {payType === "destajo" && (
              <FormInput control={form.control} name="unitLabel" label="Unidad" placeholder="Ej. caja, surco, ha" />
            )}
            <FormInput
              control={form.control}
              name="unitRate"
              label={payType === "jornal" ? "Pago por jornal (MXN)" : "Pago por unidad (MXN)"}
              inputMode="decimal"
              description={employee && payType === "jornal" ? "Vacío = salario diario del empleado." : undefined}
            />
            <FormTextarea control={form.control} name="notes" label="Notas" rows={2} className="sm:col-span-2" />
          </FieldGroup>
          {estimate !== null && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm">
              Costo a cargar: <span className="font-semibold tabular-nums">{formatMoney(estimate)}</span>
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
