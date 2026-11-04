import { expect, test, type Page } from "@playwright/test"

import { choose, DEMO, login } from "./helpers"

const stamp = Date.now().toString(36)

async function openFieldApp(page: Page) {
  await page.goto("/campo")
  await expect(page.getByRole("tab", { name: "Nuevo registro" })).toBeVisible()
  // La primera visita instala el service worker; la segunda queda controlada por él.
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect(page.getByRole("tab", { name: "Nuevo registro" })).toBeVisible()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
}

test.describe("Captura sin conexión", () => {
  test("captura una observación sin red y la sincroniza al volver la conexión", async ({ page, context }) => {
    await login(page, DEMO.campo)
    await openFieldApp(page)

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByText("Sin conexión").first()).toBeVisible()

    await page.getByRole("button", { name: /Observación/ }).click()
    await choose(page, "Proyecto", /PRY-/)
    await choose(page, "Severidad", "Alta")
    await page.getByLabel("Qué se observó").fill(`Pulgón E2E ${stamp}`)
    await page.getByRole("button", { name: "Guardar observación" }).click()
    await expect(page.getByText("Guardado en el dispositivo")).toBeVisible()

    await page.getByRole("tab", { name: /Registros/ }).click()
    const item = page.getByRole("listitem").filter({ hasText: `Pulgón E2E ${stamp}` })
    await expect(item).toHaveAttribute("data-status", "pendiente")
    await expect(item.getByText("Pendiente")).toBeVisible()

    await context.setOffline(false)
    await expect(item).toHaveAttribute("data-status", "sincronizado", { timeout: 30_000 })
    await expect(item.getByText(/sincronizado \d/)).toBeVisible()

    await page.goto("/bitacoras?tab=observaciones")
    await expect(page.getByText(`Pulgón E2E ${stamp}`)).toBeVisible()
  })

  test("un rechazo del servidor queda en revisión y se ve en Sincronización", async ({ page }) => {
    await login(page, DEMO.campo)
    await page.goto("/campo")
    await page.getByRole("button", { name: /Bitácora de riego/ }).click()
    await choose(page, "Proyecto", /PRY-/)
    await choose(page, "Parcela", /·/)
    // Fecha anterior al inicio de cualquier proyecto: la BD la rechaza al sincronizar.
    await page.getByLabel("Fecha").fill("2020-01-15")
    await page.getByLabel("Hora de inicio").fill("06:00")
    await page.getByLabel("Hora de término").fill("07:00")
    await page.getByLabel("Observaciones").fill(`Riego E2E ${stamp}`)
    await page.getByRole("button", { name: "Guardar riego" }).click()

    await page.getByRole("tab", { name: /Registros/ }).click()
    const item = page.getByRole("listitem").filter({ hasText: "15 ene 2020" }).first()
    await expect(item).toHaveAttribute("data-status", "requiere_revision", { timeout: 30_000 })
    await expect(item.getByText(/anterior al inicio del proyecto/)).toBeVisible()
    await expect(item.getByRole("button", { name: "Corregir" })).toBeVisible()

    await page.goto("/sincronizacion")
    await expect(page.getByText(/anterior al inicio del proyecto/).first()).toBeVisible()
  })

  test("sin red, las demás páginas muestran el aviso «Sin conexión»", async ({ page, context }) => {
    await login(page, DEMO.campo)
    await openFieldApp(page)
    await context.setOffline(true)
    await page.goto("/dashboard").catch(() => undefined)
    await expect(page.getByRole("heading", { name: "Sin conexión" })).toBeVisible()
    await page.getByRole("link", { name: "Ir a captura en campo" }).click()
    await expect(page.getByRole("tab", { name: "Nuevo registro" })).toBeVisible()
    await context.setOffline(false)
  })

  test("un usuario de consulta no captura", async ({ page }) => {
    await login(page, DEMO.consulta)
    await page.goto("/campo")
    await expect(page.getByText("Solo consulta")).toBeVisible()
  })
})
