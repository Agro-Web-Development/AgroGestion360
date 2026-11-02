"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { FormInput } from "@/components/forms/form-input"
import { SubmitButton } from "@/components/forms/submit-button"
import { useActionForm } from "@/components/forms/use-action-form"
import { FieldGroup } from "@/components/ui/field"
import { signIn } from "../actions"
import { loginSchema, type LoginInput } from "../schemas"

export function LoginForm() {
  const next = useSearchParams().get("next") ?? undefined
  const { form, onSubmit, pending } = useActionForm<LoginInput>({
    schema: loginSchema,
    defaultValues: { email: "", password: "" },
    action: (values) => signIn(values, next),
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <FormInput
          control={form.control}
          name="email"
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          placeholder="nombre@empresa.mx"
        />
        <div className="grid gap-1">
          <FormInput
            control={form.control}
            name="password"
            label="Contraseña"
            type="password"
            autoComplete="current-password"
          />
          <Link href="/recuperar" className="ml-auto text-sm text-primary underline-offset-4 hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <SubmitButton pending={pending} className="w-full">
          Iniciar sesión
        </SubmitButton>
      </FieldGroup>
    </form>
  )
}
