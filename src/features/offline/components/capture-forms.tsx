"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { LocateFixed, Save } from "lucide-react"
import { useState } from "react"
import { useForm, useWatch, type DefaultValues, type FieldValues } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

import { FormCheckbox } from "@/components/forms/form-checkbox"
import { FormNote } from "@/components/forms/form-dialog"
import { FormInput } from "@/components/forms/form-input"
import { FormSelect } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { SubmitButton } from "@/components/forms/submit-button"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { IRRIGATION_LABELS, IRRIGATION_TYPES } from "@/features/farms/schemas"
import { PhotoInput } from "@/features/fieldlogs/components/evidence"
import {
  activitySchema,
  applicationSchema,
  appliedRate,
  durationMinutes,
  formatDuration,
  irrigationSchema,
  OBSERVATION_CATEGORIES,
  OBSERVATION_CATEGORY_LABELS,
  OBSERVATION_SEVERITIES,
  observationSchema,
  SEVERITY_LABELS,
  type ActivityInput,
  type ApplicationInput,
  type IrrigationInput,
  type ObservationInput,
} from "@/features/fieldlogs/schemas"
import {
  CLASSIFICATION_SUGGESTIONS,
  HARVEST_QUALITIES,
  harvestSchema,
  needsUnitWeight,
  PRODUCE_UNITS,
  QUALITY_LABELS,
  toKg,
  UNIT_LABELS,
  type HarvestInput,
} from "@/features/harvests/schemas"
import { ProjectPlotFields } from "@/features/projects/components/project-plot-fields"
import { formatDate, formatNumber, todayISO } from "@/lib/format"
import { NONE } from "@/lib/validation"
import type { OfflineCatalog } from "../catalog"
import type { OfflineRecordType } from "../schemas"

export type CaptureSubmit = {
  payload: Record<string, unknown>
  summary: string
  photos: File[]
}

type FormProps<T> = {
  catalog: OfflineCatalog
  id: string
  initial?: T
  allowPhotos: boolean
  onSubmit: (data: CaptureSubmit) => Promise<void>
  onCancel: () => void
}

/**
 * Formulario local: valida con el mismo esquema Zod que el servidor (modo raw,
 * se guardan los valores capturados) y guarda en el dispositivo, sin red.
 */
function useLocalForm<T extends FieldValues>(schema: z.ZodType<unknown, T>, defaultValues: DefaultValues<T>) {
  return useForm<T>({
    resolver: zodResolver(schema as z.ZodType<T, T>, undefined, { raw: true }),
    defaultValues,
    mode: "onTouched",
  })
}

function projectSummary(catalog: OfflineCatalog, projectId: unknown, plotId: unknown, date: unknown) {
  const project = catalog.projects.find((p) => p.id === projectId)
  const plot = project?.plots.find((p) => p.id === plotId)
  return [project ? project.code : "Proyecto", plot ? `${plot.farm} · ${plot.name}` : "Todo el proyecto", formatDate(String(date))].join(" · ")
}

function FormActions({ pending, onCancel, label }: { pending: boolean; onCancel: () => void; label: string }) {
  return (
    <div className="sticky bottom-0 -mx-4 flex gap-2 border-t bg-card/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
      <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={onCancel}>
        Cancelar
      </Button>
      <SubmitButton pending={pending} className="flex-1 sm:flex-none">
        <Save aria-hidden /> {label}
      </SubmitButton>
    </div>
  )
}

function useSubmit<T extends FieldValues>(
  form: ReturnType<typeof useLocalForm<T>>,
  photos: File[],
  onSubmit: FormProps<T>["onSubmit"],
  summary: (values: T) => string
) {
  const [pending, setPending] = useState(false)
  const handle = form.handleSubmit(async (values) => {
    setPending(true)
    try {
      await onSubmit({ payload: values as Record<string, unknown>, summary: summary(values), photos })
    } catch {
      toast.error("No se pudo guardar en el dispositivo. Revisa el espacio disponible.")
    } finally {
      setPending(false)
    }
  })
  return { handle, pending }
}

const employeeOptions = (catalog: OfflineCatalog) => [{ value: NONE, label: "Sin responsable" }, ...catalog.employees]

// -----------------------------------------------------------------------------
// Riego
// -----------------------------------------------------------------------------
function IrrigationForm({ catalog, id, initial, allowPhotos, onSubmit, onCancel }: FormProps<IrrigationInput>) {
  const [photos, setPhotos] = useState<File[]>([])
  const form = useLocalForm<IrrigationInput>(
    irrigationSchema,
    initial ?? { id, projectId: "", plotId: "", date: todayISO(), startTime: "", endTime: "", system: NONE, waterM3: "", responsibleId: NONE, notes: "" }
  )
  const [start, end] = useWatch({ control: form.control, name: ["startTime", "endTime"] })
  const minutes = start && end ? durationMinutes(start, end) : null
  const { handle, pending } = useSubmit(form, photos, onSubmit, (v) => projectSummary(catalog, v.projectId, v.plotId, v.date))

  return (
    <form onSubmit={handle} noValidate className="grid gap-6">
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <ProjectPlotFields control={form.control} setValue={form.setValue} projects={catalog.projects} projectName="projectId" plotName="plotId" plotRequired />
        <FormInput control={form.control} name="date" label="Fecha" type="date" max={todayISO()} />
        <FormSelect
          control={form.control}
          name="system"
          label="Sistema de riego"
          options={[{ value: NONE, label: "El de la parcela" }, ...IRRIGATION_TYPES.map((t) => ({ value: t, label: IRRIGATION_LABELS[t] }))]}
        />
        <FormInput control={form.control} name="startTime" label="Hora de inicio" type="time" />
        <FormInput control={form.control} name="endTime" label="Hora de término" type="time" />
        <FormInput control={form.control} name="waterM3" label="Agua aplicada (m³, opcional)" inputMode="decimal" />
        <FormSelect control={form.control} name="responsibleId" label="Responsable" options={employeeOptions(catalog)} />
        <FormTextarea control={form.control} name="notes" label="Observaciones" rows={2} className="sm:col-span-2" />
        {allowPhotos && <PhotoInput files={photos} onChange={setPhotos} entity="irrigation_log" />}
      </FieldGroup>
      {minutes !== null && <FormNote>Duración: <span className="font-semibold">{formatDuration(minutes)}</span></FormNote>}
      <FormActions pending={pending} onCancel={onCancel} label="Guardar riego" />
    </form>
  )
}

// -----------------------------------------------------------------------------
// Actividad agrícola
// -----------------------------------------------------------------------------
function ActivityForm({ catalog, id, initial, allowPhotos, onSubmit, onCancel }: FormProps<ActivityInput>) {
  const [photos, setPhotos] = useState<File[]>([])
  const form = useLocalForm<ActivityInput>(
    activitySchema,
    initial ?? { id, projectId: "", plotId: NONE, activityTypeId: "", date: todayISO(), description: "", responsibleId: NONE, cost: "", notes: "" }
  )
  const { handle, pending } = useSubmit(form, photos, onSubmit, (v) => {
    const type = catalog.activityTypes.find((t) => t.value === v.activityTypeId)?.label
    return `${type ?? "Actividad"} · ${projectSummary(catalog, v.projectId, v.plotId, v.date)}`
  })

  return (
    <form onSubmit={handle} noValidate className="grid gap-6">
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <ProjectPlotFields control={form.control} setValue={form.setValue} projects={catalog.projects} projectName="projectId" plotName="plotId" />
        <FormSelect control={form.control} name="activityTypeId" label="Actividad" options={catalog.activityTypes} />
        <FormInput control={form.control} name="date" label="Fecha" type="date" max={todayISO()} />
        <FormInput control={form.control} name="description" label="Descripción (opcional)" className="sm:col-span-2" />
        <FormSelect control={form.control} name="responsibleId" label="Responsable" options={employeeOptions(catalog)} />
        <FormInput
          control={form.control}
          name="cost"
          label="Costo adicional (opcional)"
          inputMode="decimal"
          description="Solo servicios contratados; jornales, insumos y maquinaria se registran en su módulo."
        />
        <FormTextarea control={form.control} name="notes" label="Observaciones" rows={2} className="sm:col-span-2" />
        {allowPhotos && <PhotoInput files={photos} onChange={setPhotos} entity="field_activity" />}
      </FieldGroup>
      <FormActions pending={pending} onCancel={onCancel} label="Guardar actividad" />
    </form>
  )
}

// -----------------------------------------------------------------------------
// Aplicación de agroquímicos
// -----------------------------------------------------------------------------
function ApplicationForm({ catalog, id, initial, allowPhotos, onSubmit, onCancel }: FormProps<ApplicationInput>) {
  const [photos, setPhotos] = useState<File[]>([])
  const form = useLocalForm<ApplicationInput>(
    applicationSchema,
    initial ?? {
      id,
      projectId: "",
      plotId: "",
      date: todayISO(),
      time: "",
      productId: "",
      activeIngredient: "",
      quantity: "",
      treatedArea: "",
      issueFromStock: true,
      warehouseId: catalog.warehouses.length === 1 ? catalog.warehouses[0].value : "",
      lotId: "",
      lotNumber: "",
      responsibleId: NONE,
      machineId: NONE,
      equipment: "",
      reentryHours: "",
      preharvestDays: "",
      notes: "",
    }
  )
  const [productId, issue, warehouseId, quantityText, areaText] = useWatch({
    control: form.control,
    name: ["productId", "issueFromStock", "warehouseId", "quantity", "treatedArea"],
  })
  const product = catalog.products.find((p) => p.id === productId)
  const balances = catalog.lotBalances.filter((b) => b.productId === productId && b.warehouseId === warehouseId)
  const inWarehouse = balances.reduce((s, b) => s + b.quantity, 0)
  const rate = appliedRate(quantityText.replace(/,/g, ""), areaText.replace(/,/g, ""))
  const { handle, pending } = useSubmit(form, photos, onSubmit, (v) => {
    const name = catalog.products.find((p) => p.id === v.productId)?.name
    return `${name ?? "Producto"} · ${projectSummary(catalog, v.projectId, v.plotId, v.date)}`
  })

  return (
    <form onSubmit={handle} noValidate className="grid gap-6">
      <FormNote>
        El sistema no recomienda dosis ni tratamientos. Si descuentas del almacén, la existencia se vuelve a validar al
        sincronizar: si ya no alcanza, el registro quedará en revisión y no se descontará nada.
      </FormNote>
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <ProjectPlotFields control={form.control} setValue={form.setValue} projects={catalog.projects} projectName="projectId" plotName="plotId" plotRequired />
        <FormInput control={form.control} name="date" label="Fecha" type="date" max={todayISO()} />
        <FormInput control={form.control} name="time" label="Hora" type="time" />
        <div className="sm:col-span-2">
          <FormSelect
            control={form.control}
            name="productId"
            label="Producto del inventario"
            placeholder={catalog.products.length ? "Selecciona el producto" : "Sin agroquímicos, biológicos ni fertilizantes"}
            options={catalog.products.map((p) => ({ value: p.id, label: `${p.name} · ${p.category}` }))}
          />
        </div>
        <FormInput control={form.control} name="activeIngredient" label="Ingrediente activo (opcional)" />
        <FormInput control={form.control} name="quantity" label={product ? `Cantidad aplicada (${product.unit})` : "Cantidad aplicada"} inputMode="decimal" />
        <FormInput control={form.control} name="treatedArea" label="Superficie tratada (ha)" inputMode="decimal" />
        <FormCheckbox
          control={form.control}
          name="issueFromStock"
          label="Descontar del almacén"
          description="Genera la salida por consumo al sincronizar. Desmárcalo si el producto ya salió del almacén."
          className="sm:col-span-2"
        />
        {issue && <FormSelect control={form.control} name="warehouseId" label="Almacén" options={catalog.warehouses} />}
        {issue && product?.trackLots ? (
          <FormSelect
            control={form.control}
            name="lotId"
            label="Lote del producto"
            placeholder={balances.length ? "Selecciona el lote" : "Sin lotes con existencia (al descargar)"}
            options={balances
              .filter((b) => b.lotId)
              .map((b) => ({
                value: b.lotId!,
                label: `${b.lotNumber} · ${formatNumber(b.quantity, product.unit)}${b.expiryDate ? ` · cad. ${formatDate(b.expiryDate)}` : ""}`,
              }))}
          />
        ) : (
          <FormInput control={form.control} name="lotNumber" label="Número de lote (opcional)" />
        )}
        <FormSelect control={form.control} name="responsibleId" label="Responsable" options={employeeOptions(catalog)} />
        <FormSelect control={form.control} name="machineId" label="Maquinaria (opcional)" options={[{ value: NONE, label: "Ninguna" }, ...catalog.machines]} />
        <FormInput control={form.control} name="equipment" label="Equipo utilizado" placeholder="Ej. Mochila manual 20 l" />
        <FormInput control={form.control} name="reentryHours" label="Reentrada (horas)" inputMode="numeric" />
        <FormInput control={form.control} name="preharvestDays" label="Intervalo de seguridad (días)" inputMode="numeric" />
        <FormTextarea control={form.control} name="notes" label="Observaciones" rows={2} className="sm:col-span-2" />
        {allowPhotos && <PhotoInput files={photos} onChange={setPhotos} entity="chemical_application" />}
      </FieldGroup>
      {(product && issue && warehouseId) || (rate !== null && product) ? (
        <FormNote>
          {product && issue && warehouseId && <>Existencia al descargar los catálogos: {formatNumber(inWarehouse, product.unit)}. </>}
          {rate !== null && product && <>Cantidad por hectárea: {formatNumber(rate, `${product.unit}/ha`)}.</>}
        </FormNote>
      ) : null}
      <FormActions pending={pending} onCancel={onCancel} label="Guardar aplicación" />
    </form>
  )
}

// -----------------------------------------------------------------------------
// Observación
// -----------------------------------------------------------------------------
function ObservationForm({ catalog, id, initial, allowPhotos, onSubmit, onCancel }: FormProps<ObservationInput>) {
  const [photos, setPhotos] = useState<File[]>([])
  const [locating, setLocating] = useState(false)
  const form = useLocalForm<ObservationInput>(
    observationSchema,
    initial ?? {
      id,
      projectId: "",
      plotId: NONE,
      date: todayISO(),
      time: new Date().toTimeString().slice(0, 5),
      category: "plaga",
      severity: "baja",
      title: "",
      description: "",
      latitude: "",
      longitude: "",
      responsibleId: NONE,
    }
  )
  const { handle, pending } = useSubmit(form, photos, onSubmit, (v) => `${v.title} · ${projectSummary(catalog, v.projectId, v.plotId, v.date)}`)

  const locate = () => {
    if (!navigator.geolocation) {
      toast.error("Este dispositivo no permite obtener la ubicación.")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.setValue("latitude", position.coords.latitude.toFixed(6), { shouldValidate: true })
        form.setValue("longitude", position.coords.longitude.toFixed(6), { shouldValidate: true })
        setLocating(false)
      },
      () => {
        toast.error("No se pudo obtener la ubicación. Revisa los permisos del navegador.")
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 }
    )
  }

  return (
    <form onSubmit={handle} noValidate className="grid gap-6">
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <ProjectPlotFields control={form.control} setValue={form.setValue} projects={catalog.projects} projectName="projectId" plotName="plotId" />
        <FormInput control={form.control} name="date" label="Fecha" type="date" max={todayISO()} />
        <FormInput control={form.control} name="time" label="Hora" type="time" />
        <FormSelect
          control={form.control}
          name="category"
          label="Categoría"
          options={OBSERVATION_CATEGORIES.map((c) => ({ value: c, label: OBSERVATION_CATEGORY_LABELS[c] }))}
        />
        <FormSelect
          control={form.control}
          name="severity"
          label="Severidad"
          options={OBSERVATION_SEVERITIES.map((s) => ({ value: s, label: SEVERITY_LABELS[s] }))}
        />
        <FormInput control={form.control} name="title" label="Qué se observó" placeholder="Ej. Pulgón en hojas bajeras" className="sm:col-span-2" />
        <FormTextarea control={form.control} name="description" label="Detalle (opcional)" rows={3} className="sm:col-span-2" />
        <FormInput control={form.control} name="latitude" label="Latitud (opcional)" inputMode="decimal" />
        <FormInput control={form.control} name="longitude" label="Longitud (opcional)" inputMode="decimal" />
        <div className="sm:col-span-2">
          <Button type="button" variant="outline" size="sm" onClick={locate} disabled={locating}>
            <LocateFixed aria-hidden /> {locating ? "Obteniendo ubicación…" : "Usar mi ubicación"}
          </Button>
        </div>
        <FormSelect control={form.control} name="responsibleId" label="Responsable" options={employeeOptions(catalog)} />
        {allowPhotos && <PhotoInput files={photos} onChange={setPhotos} entity="field_observation" />}
      </FieldGroup>
      <FormActions pending={pending} onCancel={onCancel} label="Guardar observación" />
    </form>
  )
}

// -----------------------------------------------------------------------------
// Corte de producción
// -----------------------------------------------------------------------------
const HARVEST_STATUSES = new Set(["cosecha", "comercializacion"])

function HarvestForm({ catalog, id, initial, allowPhotos, onSubmit, onCancel }: FormProps<HarvestInput>) {
  const [photos, setPhotos] = useState<File[]>([])
  const projects = catalog.projects.filter((p) => HARVEST_STATUSES.has(p.status))
  const form = useLocalForm<HarvestInput>(
    harvestSchema,
    initial ?? {
      id,
      projectId: "",
      plotId: "",
      date: todayISO(),
      cutNumber: "",
      quality: "primera",
      classification: "",
      unit: "caja",
      quantity: "",
      unitWeightKg: "",
      packages: "",
      responsibleId: NONE,
      notes: "",
    }
  )
  const [unit, quantityText, weightText] = useWatch({ control: form.control, name: ["unit", "quantity", "unitWeightKg"] })
  const kg = Number(quantityText.replace(/,/g, "")) > 0 ? toKg(Number(quantityText.replace(/,/g, "")), unit as never, Number(weightText) || null) : null
  const { handle, pending } = useSubmit(form, photos, onSubmit, (v) => {
    const qty = `${v.quantity} ${UNIT_LABELS[v.unit as keyof typeof UNIT_LABELS]?.toLowerCase() ?? v.unit}`
    return `${qty} · ${QUALITY_LABELS[v.quality as keyof typeof QUALITY_LABELS] ?? v.quality} · ${projectSummary(catalog, v.projectId, v.plotId, v.date)}`
  })

  return (
    <form onSubmit={handle} noValidate className="grid gap-6">
      {projects.length === 0 && <FormNote>No hay proyectos en cosecha o comercialización en los catálogos descargados.</FormNote>}
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <ProjectPlotFields control={form.control} setValue={form.setValue} projects={projects} projectName="projectId" plotName="plotId" plotRequired />
        <FormInput control={form.control} name="date" label="Fecha del corte" type="date" max={todayISO()} />
        <FormInput control={form.control} name="cutNumber" label="Número de corte (opcional)" inputMode="numeric" description="Si lo omites, se asigna al sincronizar." />
        <FormSelect control={form.control} name="quality" label="Calidad" options={HARVEST_QUALITIES.map((q) => ({ value: q, label: QUALITY_LABELS[q] }))} />
        <FormInput control={form.control} name="classification" label="Clasificación (opcional)" list="clasificaciones" />
        <datalist id="clasificaciones">
          {CLASSIFICATION_SUGGESTIONS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <FormSelect control={form.control} name="unit" label="Unidad" options={PRODUCE_UNITS.map((u) => ({ value: u, label: UNIT_LABELS[u] }))} />
        <FormInput control={form.control} name="quantity" label="Cantidad" inputMode="decimal" />
        {needsUnitWeight(unit) && <FormInput control={form.control} name="unitWeightKg" label="Peso neto por unidad (kg)" inputMode="decimal" />}
        <FormInput control={form.control} name="packages" label="Empaques (opcional)" inputMode="numeric" />
        <FormSelect control={form.control} name="responsibleId" label="Responsable" options={employeeOptions(catalog)} />
        <FormTextarea control={form.control} name="notes" label="Observaciones" rows={2} className="sm:col-span-2" />
        {allowPhotos && <PhotoInput files={photos} onChange={setPhotos} entity="harvest" />}
      </FieldGroup>
      {kg !== null && kg > 0 && <FormNote>Equivale a <span className="font-semibold">{formatNumber(kg, "kg")}</span>. El lote se genera al sincronizar.</FormNote>}
      <FormActions pending={pending} onCancel={onCancel} label="Guardar corte" />
    </form>
  )
}

export function CaptureForm({
  type,
  ...props
}: { type: OfflineRecordType } & FormProps<Record<string, unknown>>) {
  switch (type) {
    case "riego":
      return <IrrigationForm {...(props as FormProps<IrrigationInput>)} />
    case "actividad":
      return <ActivityForm {...(props as FormProps<ActivityInput>)} />
    case "aplicacion":
      return <ApplicationForm {...(props as FormProps<ApplicationInput>)} />
    case "observacion":
      return <ObservationForm {...(props as FormProps<ObservationInput>)} />
    case "cosecha":
      return <HarvestForm {...(props as FormProps<HarvestInput>)} />
  }
}
