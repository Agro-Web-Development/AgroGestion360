"use client"

import { FormInput } from "@/components/forms/form-input"
import { SubmitButton } from "@/components/forms/submit-button"
import { useActionForm } from "@/components/forms/use-action-form"
import { FieldGroup } from "@/components/ui/field"
import { createOrganization } from "../actions"
import { createOrganizationSchema, type CreateOrganizationInput } from "../schemas"

export function CreateOrganizationForm() {
  const { form, onSubmit, pending } = useActionForm<CreateOrganizationInput>({
    schema: createOrganizationSchema,
    defaultValues: { name: "" },
    action: createOrganization,
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <FormInput
          control={form.control}
          name="name"
          label="Nombre de la organización"
          placeholder="Ej. Agrícola San Miguel"
          description="Podrás completar razón social, RFC y datos de contacto después."
        />
        <SubmitButton pending={pending} className="w-full">
          Crear organización
        </SubmitButton>
      </FieldGroup>
    </form>
  )
}
