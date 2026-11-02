"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTransition } from "react"
import { useForm, type DefaultValues, type FieldValues, type Path } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

import type { ActionResult } from "@/lib/actions"

type Options<TValues extends FieldValues, TData> = {
  schema: z.ZodType<unknown, TValues>
  defaultValues: DefaultValues<TValues>
  action: (values: TValues) => Promise<ActionResult<TData>>
  onSuccess?: (result: Extract<ActionResult<TData>, { ok: true }>) => void
  /** Muestra un toast con el mensaje de éxito (por defecto true). */
  toastOnSuccess?: boolean
}

/**
 * Formulario con validación Zod en el cliente que envía los valores (sin
 * transformar) a una Server Action, la cual vuelve a validar con el mismo esquema.
 * Los errores por campo devueltos por el servidor se reflejan en el formulario.
 */
export function useActionForm<TValues extends FieldValues, TData = undefined>({
  schema,
  defaultValues,
  action,
  onSuccess,
  toastOnSuccess = true,
}: Options<TValues, TData>) {
  const [pending, startTransition] = useTransition()
  const form = useForm<TValues>({
    // Se valida con el esquema pero se envían los valores de entrada originales.
    resolver: zodResolver(schema as z.ZodType<TValues, TValues>, undefined, { raw: true }),
    defaultValues,
    mode: "onTouched",
  })

  const onSubmit = form.handleSubmit((values) =>
    new Promise<void>((resolve) => {
      startTransition(async () => {
        try {
          const result = await action(values)
          if (!result) return
          if (result.ok) {
            if (toastOnSuccess && result.message) toast.success(result.message)
            onSuccess?.(result)
          } else {
            for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
              form.setError(field as Path<TValues>, { message: messages[0] })
            }
            toast.error(result.error)
          }
        } finally {
          resolve()
        }
      })
    })
  )

  return { form, onSubmit, pending }
}
