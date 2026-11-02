import { describe, expect, it } from "vitest"

import { dbErrorMessage } from "@/lib/actions"
import { formatMoney, formatNumber, initials } from "@/lib/format"

describe("formato regional", () => {
  it("formatea pesos mexicanos, incluso desde NUMERIC en texto", () => {
    expect(formatMoney(1234.5)).toBe("$1,234.50")
    expect(formatMoney("98765.432")).toBe("$98,765.43")
    expect(formatMoney(null)).toBe("—")
  })

  it("formatea cantidades con unidad", () => {
    expect(formatNumber(5, "ha")).toBe("5 ha")
    expect(formatNumber("1250.75", "kg")).toBe("1,250.75 kg")
  })

  it("obtiene iniciales", () => {
    expect(initials("Laura Méndez Ruiz")).toBe("LR")
    expect(initials("")).toBe("?")
  })
})

describe("mensajes de error de base de datos", () => {
  it("oculta mensajes técnicos de permisos", () => {
    expect(dbErrorMessage({ code: "42501", message: "permission denied for table memberships" })).toBe(
      "No tienes permiso para realizar esta operación."
    )
  })

  it("respeta mensajes de negocio en español", () => {
    expect(dbErrorMessage({ code: "22023", message: "La organización debe conservar al menos un propietario activo" })).toBe(
      "La organización debe conservar al menos un propietario activo"
    )
    expect(dbErrorMessage({ code: "42501", message: "No tienes permiso para invitar usuarios" })).toBe(
      "No tienes permiso para invitar usuarios"
    )
  })

  it("traduce errores genéricos", () => {
    expect(dbErrorMessage({ code: "23505", message: "duplicate key value violates unique constraint" })).toBe(
      "Ya existe un registro con esos datos."
    )
    expect(dbErrorMessage({ code: "XX000", message: "boom" })).toBe("Ocurrió un error inesperado. Intenta de nuevo.")
  })
})
