import type { Database } from "@/types/database"

export type ProjectStatus = Database["public"]["Enums"]["project_status"]

export const PROJECT_STATUSES = [
  "planeacion",
  "preparacion",
  "siembra",
  "desarrollo",
  "cosecha",
  "comercializacion",
  "cerrado",
  "cancelado",
] as const satisfies readonly ProjectStatus[]

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  planeacion: "Planeación",
  preparacion: "Preparación de suelo",
  siembra: "Siembra",
  desarrollo: "Desarrollo del cultivo",
  cosecha: "Cosecha",
  comercializacion: "Comercialización",
  cerrado: "Cerrado",
  cancelado: "Cancelado",
}

export const STATUS_BADGE_CLASS: Record<ProjectStatus, string> = {
  planeacion: "bg-muted text-foreground",
  preparacion: "bg-warning/20 text-foreground",
  siembra: "bg-secondary text-secondary-foreground",
  desarrollo: "bg-success/20 text-foreground",
  cosecha: "bg-primary text-primary-foreground",
  comercializacion: "bg-accent text-accent-foreground",
  cerrado: "border border-border text-muted-foreground",
  cancelado: "bg-destructive/10 text-destructive",
}

export const CLOSED_STATUSES: readonly ProjectStatus[] = ["cerrado", "cancelado"]

export function isClosed(status: ProjectStatus): boolean {
  return CLOSED_STATUSES.includes(status)
}

/** Debe coincidir con public.project_transition_allowed() en la base de datos. */
export const TRANSITIONS: Record<ProjectStatus, readonly ProjectStatus[]> = {
  planeacion: ["preparacion", "siembra", "cancelado"],
  preparacion: ["planeacion", "siembra", "cancelado"],
  siembra: ["preparacion", "desarrollo", "cancelado"],
  desarrollo: ["siembra", "cosecha", "cancelado"],
  cosecha: ["desarrollo", "comercializacion", "cerrado", "cancelado"],
  comercializacion: ["cosecha", "cerrado"],
  cerrado: ["comercializacion"],
  cancelado: ["planeacion"],
}

/**
 * Estados a los que puede pasar un proyecto. Reabrir (salir de cerrado o
 * cancelado) solo está permitido a quien tiene `projects.reopen`.
 */
export function nextStatuses(current: ProjectStatus, canReopen: boolean): ProjectStatus[] {
  if (isClosed(current) && !canReopen) return []
  return [...TRANSITIONS[current]]
}

/** Etapas del ciclo productivo, para la línea de avance (sin estados terminales alternos). */
export const LIFECYCLE: readonly ProjectStatus[] = [
  "planeacion",
  "preparacion",
  "siembra",
  "desarrollo",
  "cosecha",
  "comercializacion",
  "cerrado",
]
