import { z } from "zod"

import { todayISO } from "@/lib/format"
import { decimal, optionalDecimal, optionalId, optionalText, requiredDate, requiredId, requiredText } from "@/lib/validation"
import type { Database } from "@/types/database"

export type PayType = Database["public"]["Enums"]["labor_pay_type"]

export const PAY_TYPES = ["jornal", "destajo"] as const satisfies readonly PayType[]

export const PAY_TYPE_LABELS: Record<PayType, string> = {
  jornal: "Jornal (por día)",
  destajo: "Destajo (por unidad)",
}

export const employeeSchema = z.object({
  id: z.uuid().optional(),
  fullName: requiredText(3, 120, "Indica el nombre completo"),
  position: optionalText(80),
  phone: optionalText(30),
  dailyWage: decimal({ scale: 2, max: 999_999, allowZero: true }),
  notes: optionalText(2000),
})

export const laborSchema = z
  .object({
    id: z.uuid(),
    projectId: requiredId("Selecciona el proyecto"),
    plotId: optionalId(),
    employeeId: optionalId(),
    crew: optionalText(120),
    date: requiredDate(),
    activity: requiredText(3, 150, "Describe la labor"),
    payType: z.enum(PAY_TYPES),
    quantity: decimal({ scale: 2, max: 99_999 }),
    unitLabel: optionalText(30),
    unitRate: optionalDecimal({ scale: 2, max: 999_999, allowZero: true }),
    notes: optionalText(500),
  })
  .superRefine((v, ctx) => {
    if (v.date > todayISO()) ctx.addIssue({ code: "custom", path: ["date"], message: "No puede ser una fecha futura" })
    if (!v.employeeId && !v.crew) {
      ctx.addIssue({ code: "custom", path: ["crew"], message: "Describe la cuadrilla o selecciona un empleado" })
    }
    if ((!v.employeeId || v.payType === "destajo") && v.unitRate === null) {
      ctx.addIssue({ code: "custom", path: ["unitRate"], message: "Indica la tarifa" })
    }
    if (v.employeeId && v.payType === "jornal" && v.quantity > 1) {
      ctx.addIssue({ code: "custom", path: ["quantity"], message: "Un empleado registra máximo 1 jornal por día" })
    }
  })

export type EmployeeInput = z.input<typeof employeeSchema>
export type LaborInput = z.input<typeof laborSchema>
