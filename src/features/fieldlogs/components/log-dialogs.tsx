"use client"

import { useState } from "react"
import { useWatch } from "react-hook-form"

import { FormCheckbox } from "@/components/forms/form-checkbox"
import { FormDialog, FormNote } from "@/components/forms/form-dialog"
import { FormInput } from "@/components/forms/form-input"
import { FormSelect, type SelectOption } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { useActionForm } from "@/components/forms/use-action-form"
import { FieldGroup } from "@/components/ui/field"
import { IRRIGATION_LABELS, IRRIGATION_TYPES } from "@/features/farms/schemas"
import { BUDGET_CATEGORIES, BUDGET_CATEGORY_LABELS } from "@/features/finance/schemas"
import type { LotBalance, Product, Warehouse } from "@/features/inventory/queries"
import { APPLICABLE_KINDS } from "@/features/inventory/schemas"
import { ProjectPlotFields } from "@/features/projects/components/project-plot-fields"
import type { OpenProject } from "@/features/projects/queries"
import { formatDate, formatMoney, formatNumber, todayISO } from "@/lib/format"
import { newId } from "@/lib/ids"
import { NONE } from "@/lib/validation"
import { registerApplication, saveActivity, saveActivityType, saveIrrigation, updateApplication } from "../actions"
import {
  activitySchema,
  activityTypeSchema,
  appliedRate,
  applicationSchema,
  applicationUpdateSchema,
  durationMinutes,
  formatDuration,
  irrigationSchema,
  type ActivityInput,
  type ActivityTypeInput,
  type ApplicationInput,
  type ApplicationUpdateInput,
  type AttachmentEntity,
  type IrrigationInput,
} from "../schemas"
import { PhotoInput, uploadEvidence } from "./evidence"

type Common = {
  organizationId: string
  projects: OpenProject[]
  employees: SelectOption[]
  trigger: React.ReactNode
}

/** Estado de fotografías y su carga después de guardar el registro. */
function usePhotos(organizationId: string, entity: AttachmentEntity) {
  const [files, setFiles] = useState<File[]>([])
  return {
    files,
    setFiles,
    upload: (entityId: string) => {
      const pending = files
      setFiles([])
      void uploadEvidence(organizationId, entity, entityId, pending)
    },
  }
}

// -----------------------------------------------------------------------------
// Riego
// -----------------------------------------------------------------------------
export function IrrigationDialog({
  organizationId,
  projects,
  employees,
  trigger,
  record,
}: Common & { record?: IrrigationInput }) {
  const [open, setOpen] = useState(false)
  const photos = usePhotos(organizationId, "irrigation_log")
  const empty = (): IrrigationInput => ({
    id: newId(),
    projectId: "",
    plotId: "",
    date: todayISO(),
    startTime: "",
    endTime: "",
    system: NONE,
    waterM3: "",
    responsibleId: NONE,
    notes: "",
  })
  const { form, onSubmit, pending } = useActionForm<IrrigationInput>({
    schema: irrigationSchema,
    defaultValues: record ?? empty(),
    action: (values) => saveIrrigation(values, Boolean(record)),
    onSuccess: () => {
      photos.upload(form.getValues("id"))
      setOpen(false)
    },
  })
  const [start, end] = useWatch({ control: form.control, name: ["startTime", "endTime"] })
  const minutes = start && end && start !== end ? durationMinutes(start, end) : null

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) {
          form.reset(record ?? empty())
          photos.setFiles([])
        }
      }}
      title={record ? "Editar riego" : "Registrar riego"}
      description="Si la hora de término es menor que la de inicio, el riego cruzó la medianoche."
      onSubmit={onSubmit}
      pending={pending}
      submitLabel={record ? "Guardar cambios" : "Registrar riego"}
      after={
        minutes !== null && (
          <FormNote>
            Duración: <span className="font-semibold">{formatDuration(minutes)}</span>
          </FormNote>
        )
      }
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        {record ? (
          <p className="text-sm text-muted-foreground sm:col-span-2">El proyecto y la parcela no cambian; cancela y registra de nuevo si fueron incorrectos.</p>
        ) : (
          <ProjectPlotFields
            control={form.control}
            setValue={form.setValue}
            projects={projects}
            projectName="projectId"
            plotName="plotId"
            plotRequired
          />
        )}
        <FormInput control={form.control} name="date" label="Fecha" type="date" max={todayISO()} />
        <FormSelect
          control={form.control}
          name="system"
          label="Sistema de riego"
          options={[
            { value: NONE, label: "El de la parcela" },
            ...IRRIGATION_TYPES.map((t) => ({ value: t, label: IRRIGATION_LABELS[t] })),
          ]}
        />
        <FormInput control={form.control} name="startTime" label="Hora de inicio" type="time" />
        <FormInput control={form.control} name="endTime" label="Hora de término" type="time" />
        <FormInput
          control={form.control}
          name="waterM3"
          label="Agua utilizada (m³, opcional)"
          inputMode="decimal"
          description="Solo si se conoce (medidor o aforo)."
        />
        <FormSelect
          control={form.control}
          name="responsibleId"
          label="Responsable"
          options={[{ value: NONE, label: "Sin responsable" }, ...employees]}
        />
        <FormTextarea control={form.control} name="notes" label="Observaciones" rows={2} className="sm:col-span-2" />
        {!record && <PhotoInput files={photos.files} onChange={photos.setFiles} />}
      </FieldGroup>
    </FormDialog>
  )
}

// -----------------------------------------------------------------------------
// Aplicación de agroquímicos
// -----------------------------------------------------------------------------
export function ApplicationDialog({
  organizationId,
  projects,
  employees,
  trigger,
  products,
  warehouses,
  lotBalances,
  machines,
}: Common & {
  products: Product[]
  warehouses: Warehouse[]
  lotBalances: LotBalance[]
  machines: SelectOption[]
}) {
  const [open, setOpen] = useState(false)
  const photos = usePhotos(organizationId, "chemical_application")
  const activeWarehouses = warehouses.filter((w) => w.is_active || lotBalances.some((b) => b.warehouseId === w.id))
  const empty = (): ApplicationInput => ({
    id: newId(),
    projectId: "",
    plotId: "",
    date: todayISO(),
    time: "",
    productId: "",
    activeIngredient: "",
    quantity: "",
    treatedArea: "",
    issueFromStock: true,
    warehouseId: activeWarehouses.length === 1 ? activeWarehouses[0].id : "",
    lotId: "",
    lotNumber: "",
    responsibleId: NONE,
    machineId: NONE,
    equipment: "",
    reentryHours: "",
    preharvestDays: "",
    notes: "",
  })
  const { form, onSubmit, pending } = useActionForm<ApplicationInput>({
    schema: applicationSchema,
    defaultValues: empty(),
    action: registerApplication,
    onSuccess: () => {
      photos.upload(form.getValues("id"))
      setOpen(false)
    },
  })
  const [productId, issue, warehouseId, lotId, projectId, plotId, quantityText, areaText] = useWatch({
    control: form.control,
    name: ["productId", "issueFromStock", "warehouseId", "lotId", "projectId", "plotId", "quantity", "treatedArea"],
  })
  const applicable = products.filter((p) => p.is_active && APPLICABLE_KINDS.includes(p.category.kind))
  const product = applicable.find((p) => p.id === productId)
  const balances = lotBalances.filter((b) => b.productId === productId && b.warehouseId === warehouseId)
  const inWarehouse = balances.reduce((s, b) => s + b.quantity, 0)
  const lot = balances.find((b) => b.lotId === lotId)
  const assigned = projects.find((p) => p.id === projectId)?.plots.find((p) => p.id === plotId)
  const quantity = Number(quantityText.replace(/,/g, ""))
  const rate = appliedRate(quantity, areaText.replace(/,/g, ""))
  const estimate = issue && product?.avg_cost != null && quantity > 0 ? quantity * Number(product.avg_cost) : null

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) {
          form.reset(empty())
          photos.setFiles([])
        }
      }}
      title="Aplicación de agroquímicos"
      description="Registro de lo aplicado en campo. El sistema no recomienda dosis ni tratamientos; sigue la etiqueta del producto y la indicación del agrónomo responsable."
      onSubmit={onSubmit}
      pending={pending}
      submitLabel="Registrar aplicación"
      after={
        <>
          {product && issue && warehouseId && (
            <FormNote>
              Existencia en el almacén: <span className="font-semibold tabular-nums">{formatNumber(lot ? lot.quantity : inWarehouse, product.unit)}</span>
              {estimate !== null && (
                <>
                  {" "}· Costo al proyecto: <span className="font-semibold tabular-nums">{formatMoney(estimate)}</span>
                </>
              )}
            </FormNote>
          )}
          {rate !== null && product && (
            <FormNote>
              Cantidad registrada por hectárea: <span className="font-semibold tabular-nums">{formatNumber(rate, `${product.unit}/ha`)}</span>
            </FormNote>
          )}
        </>
      }
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <ProjectPlotFields
          control={form.control}
          setValue={form.setValue}
          projects={projects}
          projectName="projectId"
          plotName="plotId"
          plotRequired
        />
        <FormInput control={form.control} name="date" label="Fecha" type="date" max={todayISO()} />
        <FormInput control={form.control} name="time" label="Hora" type="time" />
        <div className="sm:col-span-2">
          <FormSelect
            control={form.control}
            name="productId"
            label="Producto del inventario"
            placeholder={applicable.length ? "Selecciona el producto" : "No hay agroquímicos, biológicos ni fertilizantes activos"}
            options={applicable.map((p) => ({ value: p.id, label: `${p.name} · ${p.category.name}` }))}
          />
        </div>
        <FormInput control={form.control} name="activeIngredient" label="Ingrediente activo (opcional)" />
        <FormInput
          control={form.control}
          name="quantity"
          label={product ? `Cantidad aplicada (${product.unit})` : "Cantidad aplicada"}
          inputMode="decimal"
        />
        <FormInput
          control={form.control}
          name="treatedArea"
          label="Superficie tratada (ha)"
          inputMode="decimal"
          description={assigned ? undefined : "No excede la superficie asignada de la parcela."}
        />
        <FormCheckbox
          control={form.control}
          name="issueFromStock"
          label="Descontar del almacén"
          description="Genera la salida por consumo y su costo al proyecto. Desmárcalo si el producto ya salió del almacén en otro movimiento."
          className="sm:col-span-2"
        />
        {issue ? (
          <>
            <FormSelect
              control={form.control}
              name="warehouseId"
              label="Almacén"
              options={activeWarehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
            {product?.track_lots ? (
              <FormSelect
                control={form.control}
                name="lotId"
                label="Lote del producto"
                placeholder={balances.length ? "Selecciona el lote" : "Sin lotes con existencia"}
                options={balances
                  .filter((b) => b.lotId)
                  .sort((a, b) => (a.expiryDate ?? "9999").localeCompare(b.expiryDate ?? "9999"))
                  .map((b) => ({
                    value: b.lotId!,
                    label: `${b.lotNumber} · ${formatNumber(b.quantity, product.unit)}${b.expiryDate ? ` · cad. ${formatDate(b.expiryDate)}` : ""}`,
                  }))}
              />
            ) : (
              <FormInput control={form.control} name="lotNumber" label="Número de lote (opcional)" />
            )}
          </>
        ) : (
          <FormInput control={form.control} name="lotNumber" label="Número de lote (opcional)" />
        )}
        <FormSelect
          control={form.control}
          name="responsibleId"
          label="Responsable"
          options={[{ value: NONE, label: "Sin responsable" }, ...employees]}
        />
        <FormSelect
          control={form.control}
          name="machineId"
          label="Equipo de maquinaria (opcional)"
          options={[{ value: NONE, label: "Ninguno" }, ...machines]}
        />
        <FormInput control={form.control} name="equipment" label="Equipo utilizado" placeholder="Ej. Mochila manual 20 l" />
        <FormInput
          control={form.control}
          name="reentryHours"
          label="Reentrada (horas)"
          inputMode="numeric"
          description="Según etiqueta, si está documentado."
        />
        <FormInput
          control={form.control}
          name="preharvestDays"
          label="Intervalo de seguridad (días)"
          inputMode="numeric"
          description="Días antes de cosecha, si está documentado."
        />
        <FormTextarea control={form.control} name="notes" label="Observaciones" rows={2} className="sm:col-span-2" />
        <PhotoInput files={photos.files} onChange={photos.setFiles} />
      </FieldGroup>
    </FormDialog>
  )
}

export function ApplicationEditDialog({
  record,
  employees,
  machines,
  trigger,
}: {
  record: ApplicationUpdateInput & { title: string }
  employees: SelectOption[]
  machines: SelectOption[]
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const { title, ...values } = record
  const { form, onSubmit, pending } = useActionForm<ApplicationUpdateInput>({
    schema: applicationUpdateSchema,
    defaultValues: values,
    action: updateApplication,
    onSuccess: () => setOpen(false),
  })

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(values)
      }}
      title="Editar aplicación"
      description={`${title}. Producto, cantidad, fecha y parcela están ligados a la salida de almacén: para cambiarlos cancela la aplicación y regístrala de nuevo.`}
      onSubmit={onSubmit}
      pending={pending}
      submitLabel="Guardar cambios"
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <FormInput control={form.control} name="time" label="Hora" type="time" />
        <FormInput control={form.control} name="treatedArea" label="Superficie tratada (ha)" inputMode="decimal" />
        <FormInput control={form.control} name="activeIngredient" label="Ingrediente activo" />
        <FormSelect
          control={form.control}
          name="responsibleId"
          label="Responsable"
          options={[{ value: NONE, label: "Sin responsable" }, ...employees]}
        />
        <FormSelect
          control={form.control}
          name="machineId"
          label="Equipo de maquinaria"
          options={[{ value: NONE, label: "Ninguno" }, ...machines]}
        />
        <FormInput control={form.control} name="equipment" label="Equipo utilizado" />
        <FormInput control={form.control} name="reentryHours" label="Reentrada (horas)" inputMode="numeric" />
        <FormInput control={form.control} name="preharvestDays" label="Intervalo de seguridad (días)" inputMode="numeric" />
        <FormTextarea control={form.control} name="notes" label="Observaciones" rows={2} className="sm:col-span-2" />
      </FieldGroup>
    </FormDialog>
  )
}

// -----------------------------------------------------------------------------
// Actividades agrícolas
// -----------------------------------------------------------------------------
export function ActivityDialog({
  organizationId,
  projects,
  employees,
  trigger,
  activityTypes,
  record,
}: Common & { activityTypes: SelectOption[]; record?: ActivityInput }) {
  const [open, setOpen] = useState(false)
  const photos = usePhotos(organizationId, "field_activity")
  const empty = (): ActivityInput => ({
    id: newId(),
    projectId: "",
    plotId: NONE,
    activityTypeId: "",
    date: todayISO(),
    description: "",
    responsibleId: NONE,
    cost: "",
    notes: "",
  })
  const { form, onSubmit, pending } = useActionForm<ActivityInput>({
    schema: activitySchema,
    defaultValues: record ?? empty(),
    action: (values) => saveActivity(values, Boolean(record)),
    onSuccess: () => {
      photos.upload(form.getValues("id"))
      setOpen(false)
    },
  })
  const editingPlots = record ? (projects.find((p) => p.id === record.projectId)?.plots ?? []) : []

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) {
          form.reset(record ?? empty())
          photos.setFiles([])
        }
      }}
      title={record ? "Editar actividad" : "Registrar actividad"}
      description="Bitácora de labores del proyecto. Jornales, maquinaria e insumos se registran en sus módulos y aparecen en la cronología."
      onSubmit={onSubmit}
      pending={pending}
      submitLabel={record ? "Guardar cambios" : "Registrar actividad"}
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        {record ? (
          <FormSelect
            control={form.control}
            name="plotId"
            label="Parcela (opcional)"
            options={[
              { value: NONE, label: "Todo el proyecto" },
              ...editingPlots.map((p) => ({ value: p.id, label: `${p.farm} · ${p.name}` })),
            ]}
          />
        ) : (
          <ProjectPlotFields
            control={form.control}
            setValue={form.setValue}
            projects={projects}
            projectName="projectId"
            plotName="plotId"
          />
        )}
        <FormSelect control={form.control} name="activityTypeId" label="Actividad" options={activityTypes} />
        <FormInput control={form.control} name="date" label="Fecha" type="date" max={todayISO()} />
        <FormInput control={form.control} name="description" label="Descripción" placeholder="Ej. Poda de formación" />
        <FormSelect
          control={form.control}
          name="responsibleId"
          label="Responsable"
          options={[{ value: NONE, label: "Sin responsable" }, ...employees]}
        />
        <FormInput
          control={form.control}
          name="cost"
          label="Costo adicional (MXN, opcional)"
          inputMode="decimal"
          description="Solo lo no registrado en Personal, Maquinaria, Inventario o Gastos (p. ej. servicio contratado). Se suma al costo del proyecto."
          className="sm:col-span-2"
        />
        <FormTextarea control={form.control} name="notes" label="Observaciones" rows={2} className="sm:col-span-2" />
        {!record && <PhotoInput files={photos.files} onChange={photos.setFiles} />}
      </FieldGroup>
    </FormDialog>
  )
}

export function ActivityTypeDialog({ trigger, activityType }: { trigger: React.ReactNode; activityType?: ActivityTypeInput }) {
  const [open, setOpen] = useState(false)
  const defaults: ActivityTypeInput = activityType ?? { name: "", description: "", costCategory: "otros" }
  const { form, onSubmit, pending } = useActionForm<ActivityTypeInput>({
    schema: activityTypeSchema,
    defaultValues: defaults,
    action: saveActivityType,
    onSuccess: () => setOpen(false),
  })

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(defaults)
      }}
      title={activityType ? "Editar actividad" : "Nueva actividad"}
      onSubmit={onSubmit}
      pending={pending}
      submitLabel={activityType ? "Guardar cambios" : "Agregar al catálogo"}
      wide={false}
    >
      <FieldGroup className="grid gap-5">
        <FormInput control={form.control} name="name" label="Nombre" placeholder="Ej. Tutoreo" />
        <FormTextarea control={form.control} name="description" label="Descripción" rows={2} />
        <FormSelect
          control={form.control}
          name="costCategory"
          label="Categoría presupuestal"
          description="Para comparar contra el presupuesto el costo adicional (servicio contratado) de estas actividades."
          options={BUDGET_CATEGORIES.map((c) => ({ value: c, label: BUDGET_CATEGORY_LABELS[c] }))}
        />
      </FieldGroup>
    </FormDialog>
  )
}
