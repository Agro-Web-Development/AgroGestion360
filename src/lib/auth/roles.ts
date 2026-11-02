import type { Database } from "@/types/database"

export type AppRole = Database["public"]["Enums"]["app_role"]
export type MembershipStatus = Database["public"]["Enums"]["membership_status"]

export const ROLES = [
  "propietario",
  "administrador",
  "agronomo",
  "supervisor",
  "almacen",
  "finanzas",
  "consulta",
] as const satisfies readonly AppRole[]

export const ROLE_LABELS: Record<AppRole, string> = {
  propietario: "Propietario",
  administrador: "Administrador",
  agronomo: "Agrónomo",
  supervisor: "Supervisor de campo",
  almacen: "Almacén",
  finanzas: "Finanzas y ventas",
  consulta: "Consulta",
}

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  propietario: "Acceso completo a la organización.",
  administrador: "Gestión general de operaciones y usuarios.",
  agronomo: "Administración de proyectos y actividades agrícolas.",
  supervisor: "Consulta y captura de actividades de campo.",
  almacen: "Control de inventarios y movimientos.",
  finanzas: "Clientes, ventas, pagos y cuentas por cobrar.",
  consulta: "Acceso de solo lectura.",
}

/**
 * Matriz de permisos por área funcional. La interfaz la usa para mostrar u
 * ocultar acciones; la base de datos aplica las mismas reglas mediante RLS.
 */
export const PERMISSIONS = {
  "organization.manage": ["propietario", "administrador"],
  "members.manage": ["propietario", "administrador"],
  "audit.read": ["propietario", "administrador"],
  "projects.write": ["propietario", "administrador", "agronomo"],
  "fieldlogs.write": ["propietario", "administrador", "agronomo", "supervisor"],
  "inventory.write": ["propietario", "administrador", "almacen"],
  "machinery.write": ["propietario", "administrador", "agronomo"],
  "labor.write": ["propietario", "administrador", "agronomo", "supervisor"],
  "harvest.write": ["propietario", "administrador", "agronomo", "supervisor"],
  "sales.write": ["propietario", "administrador", "finanzas"],
  "payments.write": ["propietario", "administrador", "finanzas"],
  "finance.read": ["propietario", "administrador", "finanzas", "consulta"],
} as const satisfies Record<string, readonly AppRole[]>

export type Permission = keyof typeof PERMISSIONS

export function can(role: AppRole | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return (PERMISSIONS[permission] as readonly AppRole[]).includes(role)
}

/** Roles que el rol indicado puede asignar a otros miembros. */
export function assignableRoles(actor: AppRole | null | undefined): AppRole[] {
  if (actor === "propietario") return [...ROLES]
  if (actor === "administrador") return ROLES.filter((r) => r !== "propietario")
  return []
}

/** Roles que se pueden asignar al invitar (propietario nunca por invitación). */
export function invitableRoles(actor: AppRole | null | undefined): AppRole[] {
  return assignableRoles(actor).filter((r) => r !== "propietario")
}

/** Indica si `actor` puede modificar la membresía de alguien con rol `target`. */
export function canManageMember(actor: AppRole | null | undefined, target: AppRole): boolean {
  if (actor === "propietario") return true
  if (actor === "administrador") return target !== "propietario"
  return false
}
