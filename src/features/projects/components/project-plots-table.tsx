"use client"

import { Pencil, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { FormInput } from "@/components/forms/form-input"
import { SubmitButton } from "@/components/forms/submit-button"
import { useActionForm } from "@/components/forms/use-action-form"
import { ConfirmAction } from "@/components/shared/confirm-action"
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
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { IRRIGATION_LABELS } from "@/features/farms/schemas"
import { formatNumber } from "@/lib/format"
import { removeProjectPlot, updateProjectPlot } from "../actions"
import type { ProjectDetail } from "../queries"
import { updateProjectPlotSchema, type UpdateProjectPlotInput } from "../schemas"

type Assignment = ProjectDetail["project_plots"][number]

export function ProjectPlotsTable({ assignments, editable }: { assignments: Assignment[]; editable: boolean }) {
  const total = assignments.reduce((s, a) => s + Number(a.assigned_area_ha), 0)

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rancho / parcela</TableHead>
            <TableHead className="hidden sm:table-cell">Riego</TableHead>
            <TableHead className="text-right">Asignado</TableHead>
            <TableHead className="hidden text-right md:table-cell">De la parcela</TableHead>
            {editable && (
              <TableHead className="w-20">
                <span className="sr-only">Acciones</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                <Link href={`/ranchos/${a.plot.farm.id}`} className="text-xs text-muted-foreground hover:underline">
                  {a.plot.farm.name}
                </Link>
                <p className="font-medium">
                  {a.plot.name}
                  {a.plot.code && <span className="font-normal text-muted-foreground"> · {a.plot.code}</span>}
                </p>
              </TableCell>
              <TableCell className="hidden sm:table-cell">{IRRIGATION_LABELS[a.plot.irrigation_type]}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatNumber(a.assigned_area_ha, "ha")}</TableCell>
              <TableCell className="hidden text-right text-muted-foreground tabular-nums md:table-cell">
                {formatNumber(a.plot.area_ha, "ha")}
              </TableCell>
              {editable && (
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <EditAreaDialog assignment={a} />
                    <ConfirmAction
                      title="Retirar parcela"
                      description={`"${a.plot.name}" dejará de formar parte del proyecto y su superficie quedará libre.`}
                      confirmLabel="Retirar"
                      action={() => removeProjectPlot(a.id)}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label={`Retirar ${a.plot.name}`}>
                          <X aria-hidden />
                        </Button>
                      }
                    />
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-medium">Total</TableCell>
            <TableCell className="hidden sm:table-cell" />
            <TableCell className="text-right font-semibold tabular-nums">{formatNumber(total, "ha")}</TableCell>
            <TableCell className="hidden md:table-cell" />
            {editable && <TableCell />}
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}

function EditAreaDialog({ assignment }: { assignment: Assignment }) {
  const [open, setOpen] = useState(false)
  const defaults: UpdateProjectPlotInput = { id: assignment.id, assignedAreaHa: String(assignment.assigned_area_ha) }
  const { form, onSubmit, pending } = useActionForm<UpdateProjectPlotInput>({
    schema: updateProjectPlotSchema,
    defaultValues: defaults,
    action: updateProjectPlot,
    onSuccess: () => setOpen(false),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(defaults)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Editar superficie de ${assignment.plot.name}`}>
          <Pencil aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={onSubmit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>Superficie asignada</DialogTitle>
            <DialogDescription>
              {assignment.plot.farm.name} · {assignment.plot.name} ({formatNumber(assignment.plot.area_ha, "ha")})
            </DialogDescription>
          </DialogHeader>
          <FormInput control={form.control} name="assignedAreaHa" label="Hectáreas" inputMode="decimal" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={pending}>Guardar</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
