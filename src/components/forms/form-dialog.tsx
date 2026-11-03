"use client"

import { SubmitButton } from "@/components/forms/submit-button"
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
import { cn } from "@/lib/utils"

/**
 * Estructura común de los formularios en diálogo: encabezado, cuerpo con
 * desplazamiento en pantallas pequeñas y pie con Cancelar / Guardar. El estado
 * del formulario (useActionForm) lo maneja cada diálogo.
 */
export function FormDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  pending,
  submitLabel,
  children,
  after,
  wide = true,
}: {
  trigger: React.ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  onSubmit: React.FormEventHandler<HTMLFormElement>
  pending: boolean
  submitLabel: string
  children: React.ReactNode
  /** Contenido entre los campos y el pie (estimaciones, avisos). */
  after?: React.ReactNode
  wide?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={cn("max-h-[90dvh] overflow-y-auto", wide ? "sm:max-w-xl" : "sm:max-w-md")}>
        <form onSubmit={onSubmit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
          {after}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Aviso informativo (estimaciones de costo, existencias) dentro de un formulario. */
export function FormNote({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "warning" }) {
  return (
    <p
      className={cn(
        "rounded-md px-3 py-2 text-sm",
        tone === "muted" ? "bg-muted" : "border border-warning/40 bg-warning/10 text-foreground"
      )}
    >
      {children}
    </p>
  )
}
