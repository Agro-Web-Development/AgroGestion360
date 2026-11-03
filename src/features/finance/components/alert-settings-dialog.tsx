"use client"

import { BellRing } from "lucide-react"
import { useState } from "react"

import { FormDialog, FormNote } from "@/components/forms/form-dialog"
import { FormInput } from "@/components/forms/form-input"
import { useActionForm } from "@/components/forms/use-action-form"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { saveFinanceSettings } from "../actions"
import { financeSettingsSchema, type AlertThresholds, type FinanceSettingsInput } from "../schemas"

/** Umbrales (% del presupuesto) que disparan las alertas de categorías y proyectos. */
export function AlertSettingsDialog({ thresholds }: { thresholds: AlertThresholds }) {
  const [open, setOpen] = useState(false)
  const defaults = (): FinanceSettingsInput => ({
    warning: String(thresholds.warning),
    critical: String(thresholds.critical),
    exhausted: String(thresholds.exhausted),
  })
  const { form, onSubmit, pending } = useActionForm<FinanceSettingsInput>({
    schema: financeSettingsSchema,
    defaultValues: defaults(),
    action: saveFinanceSettings,
    onSuccess: () => setOpen(false),
  })

  return (
    <FormDialog
      trigger={
        <Button variant="outline">
          <BellRing aria-hidden /> Alertas
        </Button>
      }
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(defaults())
      }}
      title="Alertas de presupuesto"
      description="Porcentaje del presupuesto a partir del cual una categoría o un proyecto cambia de estado. Aplica a toda la organización."
      onSubmit={onSubmit}
      pending={pending}
      submitLabel="Guardar umbrales"
      wide={false}
      after={<FormNote>Valores habituales: 70 %, 90 % y 100 %. Cada umbral debe ser mayor que el anterior.</FormNote>}
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-3">
        <FormInput control={form.control} name="warning" label="Aviso (%)" inputMode="decimal" />
        <FormInput control={form.control} name="critical" label="Crítico (%)" inputMode="decimal" />
        <FormInput control={form.control} name="exhausted" label="Agotado (%)" inputMode="decimal" />
      </FieldGroup>
    </FormDialog>
  )
}
