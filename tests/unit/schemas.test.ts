import { describe, expect, it } from "vitest"

import { loginSchema, registerSchema, resetPasswordSchema } from "@/features/auth/schemas"
import { inviteMemberSchema, updateMemberSchema } from "@/features/members/schemas"
import { organizationSchema } from "@/features/organizations/schemas"
import { profileSchema } from "@/features/profile/schemas"

describe("autenticación", () => {
  it("normaliza el correo", () => {
    const r = loginSchema.parse({ email: "  Laura@Campo.MX ", password: "x" })
    expect(r.email).toBe("laura@campo.mx")
  })

  it("exige contraseña con letras y números y que coincida", () => {
    const base = { fullName: "Laura Méndez", email: "l@c.mx" }
    expect(registerSchema.safeParse({ ...base, password: "solotexto", confirmPassword: "solotexto" }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, password: "Campo2026", confirmPassword: "Campo2027" }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, password: "Campo2026", confirmPassword: "Campo2026" }).success).toBe(true)
  })

  it("rechaza contraseñas cortas al restablecer", () => {
    expect(resetPasswordSchema.safeParse({ password: "a1", confirmPassword: "a1" }).success).toBe(false)
  })
})

describe("organización", () => {
  const valid = { name: "Agrícola San Miguel", legalName: "", rfc: "", email: "", phone: "", address: "" }

  it("convierte campos vacíos en null", () => {
    const r = organizationSchema.parse(valid)
    expect(r).toMatchObject({ legalName: null, rfc: null, email: null, phone: null, address: null })
  })

  it("valida y normaliza el RFC", () => {
    expect(organizationSchema.parse({ ...valid, rfc: "asm150301ab1" }).rfc).toBe("ASM150301AB1")
    expect(organizationSchema.parse({ ...valid, rfc: "MERL800101AB1" }).rfc).toBe("MERL800101AB1")
    expect(organizationSchema.safeParse({ ...valid, rfc: "ABC123" }).success).toBe(false)
  })

  it("valida el correo de contacto", () => {
    expect(organizationSchema.safeParse({ ...valid, email: "no-es-correo" }).success).toBe(false)
  })
})

describe("miembros", () => {
  it("no permite invitar como propietario", () => {
    expect(inviteMemberSchema.safeParse({ email: "a@b.mx", role: "propietario" }).success).toBe(false)
    expect(inviteMemberSchema.safeParse({ email: "a@b.mx", role: "agronomo" }).success).toBe(true)
  })

  it("rechaza roles inexistentes", () => {
    expect(inviteMemberSchema.safeParse({ email: "a@b.mx", role: "superadmin" }).success).toBe(false)
  })

  it("exige un id de membresía válido", () => {
    expect(updateMemberSchema.safeParse({ membershipId: "1", role: "consulta", status: "activo" }).success).toBe(false)
  })
})

describe("perfil", () => {
  it("valida el teléfono y permite vacío", () => {
    expect(profileSchema.parse({ fullName: "José Luis", phone: "" }).phone).toBeNull()
    expect(profileSchema.safeParse({ fullName: "José Luis", phone: "abc" }).success).toBe(false)
    expect(profileSchema.parse({ fullName: "José Luis", phone: "+52 462 555 0101" }).phone).toBe("+52 462 555 0101")
  })
})
