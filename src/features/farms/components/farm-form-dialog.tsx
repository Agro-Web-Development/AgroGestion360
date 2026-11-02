"use client"

import { useRouter } from "next/navigation"
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
import { saveFarm } from "../actions"
import { farmSchema, MX_STATES, type FarmInput } from "../schemas"

const EMPTY: FarmInput = {
  name: "",
  code: "",
  municipality: "",
  state: "",
  address: "",
  totalAreaHa: "",
  latitude: "",
  longitude: "",
  notes: "",
}

export function FarmFormDialog({
  trigger,
  farm,
}: {
  trigger: React.ReactNode
  /** Valores actuales al editar; sin valor se registra un rancho nuevo. */
  farm?: FarmInput
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const defaults = farm ?? EMPTY
  const { form, onSubmit, pending } = useActionForm<FarmInput, { id: string }>({
    schema: farmSchema,
    defaultValues: defaults,
    action: saveFarm,
    onSuccess: (result) => {
      setOpen(false)
      if (!farm) router.push(`/ranchos/${result.data.id}`)
    },
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
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={onSubmit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>{farm ? "Editar rancho" : "Nuevo rancho"}</DialogTitle>
            <DialogDescription>
              La superficie total es opcional; si la indicas, las parcelas no podrán excederla.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <FormInput control={form.control} name="name" label="Nombre" className="sm:col-span-2" />
            <FormInput
              control={form.control}
              name="code"
              label="Clave"
              autoCapitalize="characters"
              maxLength={20}
              description="Opcional. Ej. RMZ-01"
            />
            <FormInput
              control={form.control}
              name="totalAreaHa"
              label="Superficie total (ha)"
              inputMode="decimal"
              placeholder="0.00"
            />
            <FormInput control={form.control} name="municipality" label="Municipio" />
            <FormSelect
              control={form.control}
              name="state"
              label="Estado"
              options={MX_STATES.map((s) => ({ value: s, label: s }))}
            />
            <FormInput control={form.control} name="address" label="Ubicación o referencia" className="sm:col-span-2" />
            <FormInput
              control={form.control}
              name="latitude"
              label="Latitud"
              inputMode="decimal"
              placeholder="20.676700"
            />
            <FormInput
              control={form.control}
              name="longitude"
              label="Longitud"
              inputMode="decimal"
              placeholder="-101.354200"
            />
            <FormTextarea control={form.control} name="notes" label="Notas" className="sm:col-span-2" />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={pending}>{farm ? "Guardar cambios" : "Registrar rancho"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
