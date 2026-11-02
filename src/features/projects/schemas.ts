import { z } from "zod"

import { decimal, optionalDate, optionalDecimal, optionalId, optionalText, requiredDate, requiredId, requiredText } from "@/lib/validation"
import { PROJECT_STATUSES } from "./status"

export const projectSchema = z
  .object({
    id: z.uuid().optional(),
    name: requiredText(3, 150, "El nombre debe tener al menos 3 caracteres"),
    cropId: requiredId("Selecciona el cultivo"),
    season: optionalText(60),
    startDate: requiredDate("Indica la fecha de inicio"),
    plantingDate: optionalDate(),
    expectedHarvestDate: optionalDate(),
    expectedYield: optionalDecimal({ scale: 3, max: 99_999_999 }),
    budgetAmount: optionalDecimal({ scale: 2, max: 999_999_999_999, allowZero: true }),
    responsibleId: optionalId(),
    description: optionalText(4000),
  })
  .superRefine((v, ctx) => {
    // Las fechas ISO (AAAA-MM-DD) se comparan correctamente como texto.
    if (v.plantingDate && v.plantingDate < v.startDate) {
      ctx.addIssue({ code: "custom", path: ["plantingDate"], message: "No puede ser anterior al inicio" })
    }
    const base = v.plantingDate ?? v.startDate
    if (v.expectedHarvestDate && v.expectedHarvestDate < base) {
      ctx.addIssue({
        code: "custom",
        path: ["expectedHarvestDate"],
        message: v.plantingDate ? "No puede ser anterior a la siembra" : "No puede ser anterior al inicio",
      })
    }
  })

export const projectPlotSchema = z.object({
  projectId: z.uuid(),
  plotId: requiredId("Selecciona la parcela"),
  assignedAreaHa: decimal({ scale: 2, max: 9_999_999 }),
})

export const updateProjectPlotSchema = z.object({
  id: z.uuid(),
  assignedAreaHa: decimal({ scale: 2, max: 9_999_999 }),
})

export const changeStatusSchema = z
  .object({
    projectId: z.uuid(),
    status: z.enum(PROJECT_STATUSES, { error: "Selecciona el nuevo estado" }),
    note: optionalText(500),
  })
  .refine((v) => v.status !== "cancelado" || (v.note?.length ?? 0) >= 5, {
    path: ["note"],
    message: "Indica el motivo de la cancelación",
  })

export type ProjectInput = z.input<typeof projectSchema>
export type ProjectPlotInput = z.input<typeof projectPlotSchema>
export type UpdateProjectPlotInput = z.input<typeof updateProjectPlotSchema>
export type ChangeStatusInput = z.input<typeof changeStatusSchema>
