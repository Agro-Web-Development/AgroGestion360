"use client"

import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

type FormTextareaProps<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
  label: string
  description?: string
} & Omit<React.ComponentProps<typeof Textarea>, "name" | "value" | "onChange" | "onBlur">

export function FormTextarea<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  ...textareaProps
}: FormTextareaProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined} className={className}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Textarea
            id={name}
            aria-invalid={fieldState.invalid || undefined}
            {...textareaProps}
            {...field}
            value={field.value ?? ""}
          />
          {description && !fieldState.error && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}
