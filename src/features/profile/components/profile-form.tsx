"use client"

import { FormInput } from "@/components/forms/form-input"
import { SubmitButton } from "@/components/forms/submit-button"
import { useActionForm } from "@/components/forms/use-action-form"
import { FieldGroup } from "@/components/ui/field"
import { updateProfile } from "../actions"
import { profileSchema, type ProfileInput } from "../schemas"

export function ProfileForm({ defaultValues }: { defaultValues: ProfileInput }) {
  const { form, onSubmit, pending } = useActionForm<ProfileInput>({
    schema: profileSchema,
    defaultValues,
    action: updateProfile,
    onSuccess: () => form.reset(form.getValues()),
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <FormInput control={form.control} name="fullName" label="Nombre completo" autoComplete="name" />
        <FormInput control={form.control} name="phone" label="Teléfono" type="tel" autoComplete="tel" />
        <SubmitButton pending={pending} disabled={!form.formState.isDirty} className="w-full sm:w-auto">
          Guardar cambios
        </SubmitButton>
      </FieldGroup>
    </form>
  )
}
