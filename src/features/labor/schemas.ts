import { z } from "zod"

import { todayISO } from "@/lib/format"
import {
  decimal,
  optionalDate,
  optionalDecimal,
  optionalId,
  optionalText,
  optionalTime,
  requiredDate,
  requiredId,
  requiredText,
} from "@/lib/validation"
import type { Database } from "@/types/database"

export type PayType = Database["public"]["Enums"]["labor_pay_type"]
export type WorkerType = Database["public"]["Enums"]["worker_type"]
export type AttendanceStatus = Database["public"]["Enums"]["attendance_status"]

export const PAY_TYPES = ["jornal", "destajo"] as const satisfies readonly PayType[]

export const PAY_TYPE_LABELS: Record<PayType, string> = {
  jornal: "Jornal (por día)",
  destajo: "Destajo (por unidad)",
}

export const WORKER_TYPES = ["planta", "eventual", "temporal", "destajista"] as const satisfies readonly WorkerType[]

export const WORKER_TYPE_LABELS: Record<WorkerType, string> = {
  planta: "De planta",
  eventual: "Eventual",
  temporal: "Temporal (por ciclo)",
  destajista: "Destajista",
}

export const ATTENDANCE_STATUSES = [
  "presente",
  "falta",
  "permiso",
  "incapacidad",
  "descanso",
] as const satisfies readonly AttendanceStatus[]

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  presente: "Presente",
  falta: "Falta",
  permiso: "Permiso",
  incapacidad: "Incapacidad",
  descanso: "Descanso",
}

const notFuture = (path: string) => (v: { [k: string]: unknown }, ctx: z.RefinementCtx) => {
  if (typeof v[path] === "string" && (v[path] as string) > todayISO()) {
    ctx.addIssue({ code: "custom", path: [path], message: "No puede ser una fecha futura" })
  }
}

export const employeeSchema = z.object({
  id: z.uuid().optional(),
  fullName: requiredText(3, 120, "Indica el nombre completo"),
  position: optionalText(80),
  workerType: z.enum(WORKER_TYPES, { error: "Selecciona el tipo de trabajador" }),
  phone: optionalText(30),
  hireDate: optionalDate(),
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
    activityTypeId: optionalId(),
    activity: requiredText(3, 150, "Describe la labor"),
    payType: z.enum(PAY_TYPES),
    quantity: decimal({ scale: 2, max: 99_999 }),
    unitLabel: optionalText(30),
    unitRate: optionalDecimal({ scale: 2, max: 999_999, allowZero: true }),
    notes: optionalText(500),
  })
  .superRefine((v, ctx) => {
    notFuture("date")(v, ctx)
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

/** Jornada de una cuadrilla registrada: un registro por integrante seleccionado. */
export const crewLaborSchema = z
  .object({
    id: z.uuid(),
    crewId: requiredId("Selecciona la cuadrilla"),
    projectId: requiredId("Selecciona el proyecto"),
    plotId: optionalId(),
    date: requiredDate(),
    activityTypeId: optionalId(),
    activity: requiredText(3, 150, "Describe la labor"),
    payType: z.enum(PAY_TYPES),
    quantity: decimal({ scale: 2, max: 99_999 }),
    unitLabel: optionalText(30),
    unitRate: optionalDecimal({ scale: 2, max: 999_999, allowZero: true }),
    employeeIds: z.array(z.uuid()).min(1, "Selecciona al menos un integrante"),
    notes: optionalText(500),
  })
  .superRefine((v, ctx) => {
    notFuture("date")(v, ctx)
    if (v.payType === "destajo" && v.unitRate === null) {
      ctx.addIssue({ code: "custom", path: ["unitRate"], message: "Indica la tarifa por unidad" })
    }
    if (v.payType === "jornal" && v.quantity > 1) {
      ctx.addIssue({ code: "custom", path: ["quantity"], message: "Máximo 1 jornal por integrante y día" })
    }
  })

export const attendanceSchema = z
  .object({
    id: z.uuid().optional(),
    employeeId: requiredId("Selecciona al empleado"),
    date: requiredDate(),
    status: z.enum(ATTENDANCE_STATUSES),
    checkIn: optionalTime(),
    checkOut: optionalTime(),
    notes: optionalText(500),
  })
  .superRefine((v, ctx) => {
    notFuture("date")(v, ctx)
    if (v.status !== "presente" && (v.checkIn || v.checkOut)) {
      ctx.addIssue({ code: "custom", path: ["checkIn"], message: "Solo se registran horas si está presente" })
    }
    if (v.checkOut && !v.checkIn) ctx.addIssue({ code: "custom", path: ["checkIn"], message: "Indica la hora de entrada" })
    if (v.checkIn && v.checkOut && v.checkOut <= v.checkIn) {
      ctx.addIssue({ code: "custom", path: ["checkOut"], message: "Debe ser posterior a la entrada" })
    }
  })

export const crewSchema = z.object({
  id: z.uuid().optional(),
  name: requiredText(2, 80, "El nombre debe tener al menos 2 caracteres"),
  leaderId: optionalId(),
  memberIds: z.array(z.uuid()),
  notes: optionalText(1000),
})

export const assignmentSchema = z
  .object({
    id: z.uuid().optional(),
    employeeId: requiredId("Selecciona al empleado"),
    projectId: requiredId("Selecciona el proyecto"),
    plotId: optionalId(),
    crewId: optionalId(),
    startDate: requiredDate(),
    endDate: optionalDate(),
    role: optionalText(80),
    notes: optionalText(500),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { path: ["endDate"], message: "Debe ser posterior al inicio" })

export type EmployeeInput = z.input<typeof employeeSchema>
export type LaborInput = z.input<typeof laborSchema>
export type CrewLaborInput = z.input<typeof crewLaborSchema>
export type AttendanceInput = z.input<typeof attendanceSchema>
export type CrewInput = z.input<typeof crewSchema>
export type AssignmentInput = z.input<typeof assignmentSchema>
