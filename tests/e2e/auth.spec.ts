import { expect, test } from "@playwright/test"

import { DEMO, login } from "./helpers"

test.describe("Autenticación y sesión", () => {
  test("sin sesión redirige al inicio de sesión", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/)
  })

  test("contraseña incorrecta muestra un error genérico", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Correo electrónico").fill(DEMO.propietario)
    await page.getByLabel("Contraseña").fill("Incorrecta123")
    await page.getByRole("button", { name: "Iniciar sesión" }).click()
    await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible()
  })

  test("inicia y cierra sesión", async ({ page }) => {
    await login(page, DEMO.propietario)
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await page.getByRole("button", { name: "Menú de usuario" }).click()
    await page.getByRole("menuitem", { name: "Cerrar sesión" }).click()
    await expect(page).toHaveURL(/\/login/)
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login/)
  })

  test("no redirige a otro dominio después de iniciar sesión", async ({ page, baseURL }) => {
    await login(page, DEMO.propietario, "/\\evil.example/ruta")
    expect(new URL(page.url()).host).toBe(new URL(baseURL!).host)
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test("la API responde 401 sin sesión", async ({ request }) => {
    const res = await request.get("/api/campo/contexto")
    expect(res.status()).toBe(401)
    expect(res.headers()["cache-control"]).toContain("no-store")
    const post = await request.post("/api/campo/sincronizar", { data: {} })
    expect(post.status()).toBe(401)
  })

  test("la API rechaza escrituras de otro origen", async ({ page }) => {
    await login(page, DEMO.campo)
    const res = await page.request.post("/api/campo/sincronizar", { data: {}, headers: { Origin: "https://evil.example" } })
    expect(res.status()).toBe(403)
  })

  test("encabezados de seguridad", async ({ request }) => {
    const res = await request.get("/login")
    const headers = res.headers()
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'")
    expect(headers["content-security-policy"]).toContain("object-src 'none'")
    expect(headers["x-frame-options"]).toBe("DENY")
    expect(headers["x-content-type-options"]).toBe("nosniff")
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin")
    expect(headers["x-powered-by"]).toBeUndefined()
  })
})
