import { expect, test, type Page } from "@playwright/test"

import { DEMO, login } from "./helpers"

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test.describe("Versión móvil", () => {
  for (const path of ["/dashboard", "/proyectos", "/bitacoras", "/produccion", "/ventas", "/rentabilidad", "/sincronizacion"]) {
    test(`${path} sin desplazamiento horizontal`, async ({ page }) => {
      await login(page, DEMO.propietario)
      await page.goto(path)
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
      await noHorizontalScroll(page)
    })
  }

  test("captura en campo usable en el celular", async ({ page }) => {
    await login(page, DEMO.campo)
    await page.goto("/campo")
    await expect(page.getByRole("button", { name: /Bitácora de riego/ })).toBeVisible()
    await noHorizontalScroll(page)
    await page.screenshot({ path: "test-results/movil-campo.png", fullPage: true })
    await page.getByRole("button", { name: /Corte de producción/ }).click()
    await expect(page.getByRole("button", { name: "Guardar corte" })).toBeVisible()
    await noHorizontalScroll(page)
    await page.screenshot({ path: "test-results/movil-corte.png", fullPage: true })
  })

  test("menú lateral en móvil", async ({ page }) => {
    await login(page, DEMO.propietario)
    await page.screenshot({ path: "test-results/movil-dashboard.png" })
    await page.getByRole("button", { name: /Toggle Sidebar|menú/i }).first().click()
    await expect(page.getByRole("link", { name: "Captura en campo" })).toBeVisible()
  })
})
