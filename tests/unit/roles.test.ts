import { describe, expect, it } from "vitest"

import { assignableRoles, can, canManageMember, invitableRoles, ROLES } from "@/lib/auth/roles"

describe("matriz de permisos", () => {
  it("solo propietario y administrador administran usuarios", () => {
    const allowed = ROLES.filter((r) => can(r, "members.manage"))
    expect(allowed).toEqual(["propietario", "administrador"])
  })

  it("consulta no tiene permisos de escritura", () => {
    const writes = [
      "projects.write",
      "inventory.write",
      "sales.write",
      "payments.write",
      "members.manage",
    ] as const
    for (const p of writes) expect(can("consulta", p)).toBe(false)
  })

  it("almacén escribe inventario pero no ventas ni pagos", () => {
    expect(can("almacen", "inventory.write")).toBe(true)
    expect(can("almacen", "sales.write")).toBe(false)
    expect(can("almacen", "payments.write")).toBe(false)
  })

  it("sin rol no hay permisos", () => {
    expect(can(null, "finance.read")).toBe(false)
    expect(can(undefined, "projects.write")).toBe(false)
  })
})

describe("asignación de roles", () => {
  it("el propietario puede asignar cualquier rol", () => {
    expect(assignableRoles("propietario")).toEqual([...ROLES])
  })

  it("el administrador no puede asignar ni administrar propietarios", () => {
    expect(assignableRoles("administrador")).not.toContain("propietario")
    expect(canManageMember("administrador", "propietario")).toBe(false)
    expect(canManageMember("administrador", "agronomo")).toBe(true)
  })

  it("nadie invita como propietario", () => {
    expect(invitableRoles("propietario")).not.toContain("propietario")
  })

  it("roles operativos no asignan roles", () => {
    expect(assignableRoles("agronomo")).toEqual([])
    expect(canManageMember("supervisor", "consulta")).toBe(false)
  })
})
