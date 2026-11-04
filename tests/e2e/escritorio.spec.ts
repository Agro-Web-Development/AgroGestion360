import { expect, test } from "@playwright/test"

import { DEMO, login } from "./helpers"

test.describe("Escritorio (laptop de 1280 px)", () => {
  // Pantallas con tablas anchas: deben desplazarse dentro de su tarjeta sin
  // ensanchar la página (antes la desbordaban por el ancho del menú lateral).
  for (const path of ["/rentabilidad", "/flujo-efectivo", "/reportes-financieros", "/reportes", "/finanzas", "/gastos", "/inventario"]) {
    test(`${path} sin desplazamiento horizontal`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      await login(page, DEMO.propietario)
      await page.goto(path)
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(1)
    })
  }

  test("el centro de notificaciones muestra alertas reales y lleva a la pantalla", async ({ page }) => {
    await login(page, DEMO.propietario)
    // Los datos de demostración tienen insumos bajo el mínimo y una venta vencida.
    const bell = page.getByRole("button", { name: /Notificaciones \([1-9]/ })
    await expect(bell).toBeVisible()
    await bell.click()
    await page.getByRole("menuitem", { name: /venta\(s\) con pago vencido/ }).click()
    await expect(page).toHaveURL(/\/pagos/)
  })

  test("un supervisor de campo no recibe alertas financieras", async ({ page }) => {
    await login(page, DEMO.campo)
    await page.getByRole("button", { name: /Notificaciones/ }).click()
    await expect(page.getByRole("menuitem", { name: /pago vencido|Presupuesto/ })).toHaveCount(0)
  })
})
