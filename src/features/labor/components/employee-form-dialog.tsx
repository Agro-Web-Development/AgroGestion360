"use client"

import { useState } from "react"

import { FormInput } from "@/components/forms/form-input"
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
import { saveEmployee } from "../actions"
import { employeeSchema, type EmployeeInput } from "../schemas"

const EMPTY: EmployeeInput = { fullName: "", position: "", phone: "", dailyWage: "", notes: "" }

export function EmployeeFormDialog({ trigger, employee }: { trigger: React.ReactNode; employee?: EmployeeInput }) {
  const [open, setOpen] = useState(false)
  const defaults = employee ?? EMPTY
  const { form, onSubmit, pending } = useActionForm<EmployeeInput>({
    schema: employeeSchema,
    defaultValues: defaults,
    action: saveEmployee,
    onSuccess: () => setOpen(false),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(defaults)
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={onSubmit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>{employee ? "Editar empleado" : "Nuevo empleado"}</DialogTitle>
            <DialogDescription>El salario diario se propone al registrar jornales; cada registro conserva el que tenía.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <FormInput control={form.control} name="fullName" label="Nombre completo" className="sm:col-span-2" />
            <FormInput control={form.control} name="position" label="Puesto" placeholder="Ej. Jornalero, tractorista" />
            <FormInput control={form.control} name="phone" label="Teléfono" type="tel" />
            <FormInput control={form.control} name="dailyWage" label="Salario diario (MXN)" inputMode="decimal" />
            <FormTextarea control={form.control} name="notes" label="Notas" className="sm:col-span-2" />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={pending}>{employee ? "Guardar cambios" : "Registrar empleado"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
