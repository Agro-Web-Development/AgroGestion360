"use client"

import { FormInput } from "@/components/forms/form-input"
import { SubmitButton } from "@/components/forms/submit-button"
import { useActionForm } from "@/components/forms/use-action-form"
import { FieldGroup } from "@/components/ui/field"
import { updateOrganization } from "../actions"
import { organizationSchema, type OrganizationInput } from "../schemas"

export function OrganizationForm({
  defaultValues,
  readOnly,
}: {
  defaultValues: OrganizationInput
  readOnly: boolean
}) {
  const { form, onSubmit, pending } = useActionForm<OrganizationInput>({
    schema: organizationSchema,
    defaultValues,
    action: updateOrganization,
    onSuccess: () => form.reset(form.getValues()),
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <fieldset disabled={readOnly || pending} className="contents">
        <FieldGroup className="grid gap-5 md:grid-cols-2">
          <FormInput control={form.control} name="name" label="Nombre comercial" />
          <FormInput control={form.control} name="legalName" label="Razón social" />
          <FormInput
            control={form.control}
            name="rfc"
            label="RFC"
            autoCapitalize="characters"
            maxLength={13}
            description="Persona moral (12) o física (13 caracteres)."
          />
          <FormInput control={form.control} name="email" label="Correo de contacto" type="email" />
          <FormInput control={form.control} name="phone" label="Teléfono" type="tel" />
          <FormInput control={form.control} name="address" label="Domicilio" className="md:col-span-2" />
        </FieldGroup>
      </fieldset>
      {!readOnly && (
        <div className="mt-6 flex justify-end">
          <SubmitButton pending={pending} disabled={!form.formState.isDirty}>
            Guardar cambios
          </SubmitButton>
        </div>
      )}
    </form>
  )
}
