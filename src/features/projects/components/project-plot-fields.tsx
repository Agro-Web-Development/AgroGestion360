"use client"

import { useEffect } from "react"
import { useWatch, type Control, type FieldPath, type FieldValues, type UseFormSetValue } from "react-hook-form"

import { FormSelect } from "@/components/forms/form-select"
import { NONE } from "@/lib/validation"
import type { OpenProject } from "../queries"

/**
 * Proyecto vigente y parcela asignada a él. Al cambiar de proyecto se limpia la
 * parcela, porque solo se aceptan parcelas del proyecto seleccionado.
 */
export function ProjectPlotFields<T extends FieldValues>({
  control,
  setValue,
  projects,
  projectName,
  plotName,
  plotRequired = false,
}: {
  control: Control<T>
  setValue: UseFormSetValue<T>
  projects: OpenProject[]
  projectName: FieldPath<T>
  plotName: FieldPath<T>
  plotRequired?: boolean
}) {
  const projectId = useWatch({ control, name: projectName }) as string
  const plotId = useWatch({ control, name: plotName }) as string
  const project = projects.find((p) => p.id === projectId)
  const plots = project?.plots ?? []

  useEffect(() => {
    const belongs = projects.find((p) => p.id === projectId)?.plots.some((p) => p.id === plotId)
    if (plotId && plotId !== NONE && !belongs) setValue(plotName, "" as never)
  }, [plotId, projectId, projects, plotName, setValue])

  return (
    <>
      <FormSelect
        control={control}
        name={projectName}
        label="Proyecto"
        placeholder={projects.length ? "Selecciona el proyecto" : "No hay proyectos vigentes"}
        options={projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))}
      />
      <FormSelect
        control={control}
        name={plotName}
        label={plotRequired ? "Parcela" : "Parcela (opcional)"}
        placeholder={!project ? "Primero elige el proyecto" : plots.length ? "Selecciona la parcela" : "El proyecto no tiene parcelas"}
        disabled={!project}
        options={[
          ...(plotRequired ? [] : [{ value: NONE, label: "Todo el proyecto" }]),
          ...plots.map((p) => ({ value: p.id, label: `${p.farm} · ${p.name}` })),
        ]}
      />
    </>
  )
}
