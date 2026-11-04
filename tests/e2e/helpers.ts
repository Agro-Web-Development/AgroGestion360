import { expect, type Page } from "@playwright/test"

export const DEMO_PASSWORD = "Demo12345!"
export const DEMO = {
  propietario: "propietario@demo.agrogestion360.mx",
  agronomo: "agronomo@demo.agrogestion360.mx",
  campo: "campo@demo.agrogestion360.mx",
  consulta: "consulta@demo.agrogestion360.mx",
} as const

export async function login(page: Page, email: string, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login")
  await page.getByLabel("Correo electrónico").fill(email)
  await page.getByLabel("Contraseña").fill(DEMO_PASSWORD)
  await page.getByRole("button", { name: "Iniciar sesión" }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

/** Elige una opción de un Select de Radix por la etiqueta del campo. */
export async function choose(page: Page, label: string, option: string | RegExp) {
  await page.getByLabel(label, { exact: true }).click()
  await page.getByRole("option", { name: option }).first().click()
}
