"use client"

import { Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { useWatch } from "react-hook-form"

import { FormCheckbox } from "@/components/forms/form-checkbox"
import { FormDialog, FormNote } from "@/components/forms/form-dialog"
import { FormInput } from "@/components/forms/form-input"
import { FormSelect, type SelectOption } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { useActionForm } from "@/components/forms/use-action-form"
import { Button } from "@/components/ui/button"
import { FieldGroup, FieldSeparator } from "@/components/ui/field"
import type { LotBalance, Product, Warehouse } from "@/features/inventory/queries"
import { ActivityTypeField } from "@/features/labor/components/labor-dialog"
import { ProjectPlotFields } from "@/features/projects/components/project-plot-fields"
import type { OpenProject } from "@/features/projects/queries"
import { formatMoney, formatNumber, todayISO } from "@/lib/format"
import { newId } from "@/lib/ids"
import { NONE } from "@/lib/validation"
import { registerUsage } from "../actions"
import type { Machine } from "../queries"
import { canRegisterUsage, RATE_BASES, RATE_BASIS_LABELS, usageAmount, usageSchema, type UsageInput } from "../schemas"

function emptyUsage(): UsageInput {
  return {
    id: newId(),
    machineId: "",
    projectId: "",
    plotId: "",
    date: todayISO(),
    hours: "",
    rateBasis: "hora",
    jornadas: "",
    rate: "",
    operatorId: NONE,
    operator: "",
    activityTypeId: NONE,
    activity: "",
    fuelQuantity: "",
    fuelFromStock: false,
    fuelProductId: "",
    fuelWarehouseId: "",
    fuelLotId: "",
    notes: "",
  }
}

export function UsageDialog({
  machines,
  projects,
  employees,
  activityTypes,
  fuels,
  warehouses,
  lotBalances,
}: {
  machines: Machine[]
  projects: OpenProject[]
  employees: SelectOption[]
  activityTypes: SelectOption[]
  /** Productos de la categoría combustibles. */
  fuels: Product[]
  warehouses: Warehouse[]
  lotBalances: LotBalance[]
}) {
  const [open, setOpen] = useState(false)
  const available = machines.filter((m) => canRegisterUsage(m.status))
  const { form, onSubmit, pending } = useActionForm<UsageInput>({
    schema: usageSchema,
    defaultValues: emptyUsage(),
    action: registerUsage,
    onSuccess: () => setOpen(false),
  })
  const [machineId, basis, hoursText, jornadasText, rateText, fromStock, fuelId, fuelWarehouse, fuelQty, operatorId] = useWatch({
    control: form.control,
    name: [
      "machineId",
      "rateBasis",
      "hours",
      "jornadas",
      "rate",
      "fuelFromStock",
      "fuelProductId",
      "fuelWarehouseId",
      "fuelQuantity",
      "operatorId",
    ],
  })
  const machine = available.find((m) => m.id === machineId)

  // Al elegir el equipo se propone su forma de cobro habitual.
  useEffect(() => {
    if (machine) form.setValue("rateBasis", machine.rate_basis)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar de equipo
  }, [machineId])

  const num = (v: string | undefined) => Number((v ?? "").replace(/,/g, ""))
  const machineRate = machine ? Number(basis === "jornada" ? machine.daily_rate : machine.hourly_cost) : NaN
  const rate = (rateText ?? "") !== "" ? num(rateText) : machineRate
  const estimate =
    Number.isFinite(rate) && num(hoursText) > 0
      ? usageAmount(basis, num(hoursText), basis === "jornada" ? num(jornadasText) : null, rate)
      : null
  const fuel = fuels.find((f) => f.id === fuelId)
  const fuelStock = lotBalances.filter((b) => b.productId === fuelId && b.warehouseId === fuelWarehouse)
  const fuelEstimate = fromStock && fuel?.avg_cost != null && num(fuelQty) > 0 ? num(fuelQty) * Number(fuel.avg_cost) : null

  return (
    <FormDialog
      trigger={
        <Button disabled={available.length === 0 || projects.length === 0}>
          <Plus aria-hidden /> Registrar uso
        </Button>
      }
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(emptyUsage())
      }}
      title="Uso de maquinaria"
      description="Las horas se cargan al proyecto con la tarifa vigente del equipo. Un equipo no excede 24 h ni 1 jornada por día."
      onSubmit={onSubmit}
      pending={pending}
      submitLabel="Registrar"
      after={
        (estimate !== null || fuelEstimate !== null) && (
          <FormNote>
            {estimate !== null && (
              <>
                Maquinaria: <span className="font-semibold tabular-nums">{formatMoney(estimate)}</span>
              </>
            )}
            {fuelEstimate !== null && (
              <>
                {estimate !== null && " · "}Combustible (insumos):{" "}
                <span className="font-semibold tabular-nums">{formatMoney(fuelEstimate)}</span>
              </>
            )}
          </FormNote>
        )
      }
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormSelect
            control={form.control}
            name="machineId"
            label="Equipo"
            options={available.map((m) => ({
              value: m.id,
              label: `${m.name} · ${formatMoney(m.hourly_cost)}/h${m.daily_rate !== null ? ` · ${formatMoney(m.daily_rate)}/jornada` : ""}`,
            }))}
          />
        </div>
        <ProjectPlotFields
          control={form.control}
          setValue={form.setValue}
          projects={projects}
          projectName="projectId"
          plotName="plotId"
        />
        <FormInput control={form.control} name="date" label="Fecha" type="date" max={todayISO()} />
        <FormInput
          control={form.control}
          name="hours"
          label="Horas trabajadas"
          inputMode="decimal"
          description="Siempre se registran: alimentan las alertas de mantenimiento."
        />
        <FormSelect
          control={form.control}
          name="rateBasis"
          label="Cobro"
          options={RATE_BASES.map((b) => ({ value: b, label: RATE_BASIS_LABELS[b] }))}
        />
        {basis === "jornada" ? (
          <FormInput control={form.control} name="jornadas" label="Jornadas" inputMode="decimal" description="1 = jornada completa; 0.5 = media." />
        ) : (
          <div className="hidden sm:block" />
        )}
        <FormInput
          control={form.control}
          name="rate"
          label={basis === "jornada" ? "Tarifa por jornada (opcional)" : "Tarifa por hora (opcional)"}
          inputMode="decimal"
          description="Vacío = tarifa del equipo. Úsala para equipo rentado."
        />
        <FormSelect
          control={form.control}
          name="operatorId"
          label="Operador"
          options={[{ value: NONE, label: "Operador externo / sin alta" }, ...employees]}
        />
        {operatorId === NONE && <FormInput control={form.control} name="operator" label="Nombre del operador (opcional)" />}
        <ActivityTypeField
          control={form.control}
          setValue={form.setValue}
          activityTypes={activityTypes}
          typeName="activityTypeId"
          activityName="activity"
        />
        <FormInput control={form.control} name="activity" label="Actividad realizada" placeholder="Ej. Rastreo" />
        <FieldSeparator className="sm:col-span-2">Combustible</FieldSeparator>
        <FormInput
          control={form.control}
          name="fuelQuantity"
          label="Combustible utilizado (l, opcional)"
          inputMode="decimal"
        />
        <FormCheckbox
          control={form.control}
          name="fuelFromStock"
          label="Surtido del almacén"
          description="Genera la salida y su costo como insumo del proyecto (la tarifa del equipo no debe incluir combustible)."
        />
        {fromStock && (
          <>
            <FormSelect
              control={form.control}
              name="fuelProductId"
              label="Combustible"
              placeholder={fuels.length ? "Selecciona el combustible" : "No hay productos de combustible"}
              options={fuels.map((f) => ({ value: f.id, label: `${f.name} (${formatNumber(f.stock, f.unit)})` }))}
            />
            <FormSelect
              control={form.control}
              name="fuelWarehouseId"
              label="Almacén"
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
              description={
                fuel && fuelWarehouse
                  ? `Existencia: ${formatNumber(fuelStock.reduce((s, b) => s + b.quantity, 0), fuel.unit)}`
                  : undefined
              }
            />
            {fuel?.track_lots && (
              <FormSelect
                control={form.control}
                name="fuelLotId"
                label="Lote"
                options={fuelStock.filter((b) => b.lotId).map((b) => ({ value: b.lotId!, label: `${b.lotNumber} · ${formatNumber(b.quantity, fuel.unit)}` }))}
              />
            )}
          </>
        )}
        <FormTextarea control={form.control} name="notes" label="Observaciones" rows={2} className="sm:col-span-2" />
      </FieldGroup>
    </FormDialog>
  )
}
