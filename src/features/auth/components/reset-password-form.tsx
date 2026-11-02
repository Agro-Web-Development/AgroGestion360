"use client"

import { FormInput } from "@/components/forms/form-input"
import { SubmitButton } from "@/components/forms/submit-button"
import { useActionForm } from "@/components/forms/use-action-form"
import { FieldGroup } from "@/components/ui/field"
import { updatePassword } from "../actions"
import { resetPasswordSchema, type ResetPasswordInput } from "../schemas"

/** Con `redirectTo` navega al terminar (flujo de recuperación); sin él, solo notifica. */
export function ResetPasswordForm({
  redirectTo,
  submitLabel = "Guardar contraseña",
}: {
  redirectTo?: string
  submitLabel?: string
}) {
  const { form, onSubmit, pending } = useActionForm<ResetPasswordInput>({
    schema: resetPasswordSchema,
    defaultValues: { password: "", confirmPassword: "" },
    action: (values) => updatePassword(values, redirectTo),
    onSuccess: () => form.reset(),
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <FormInput
          control={form.control}
          name="password"
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          description="Mínimo 8 caracteres, con letras y números."
        />
        <FormInput
          control={form.control}
          name="confirmPassword"
          label="Confirmar contraseña"
          type="password"
          autoComplete="new-password"
        />
        <SubmitButton pending={pending} className="w-full sm:w-auto">
          {submitLabel}
        </SubmitButton>
      </FieldGroup>
    </form>
  )
}
