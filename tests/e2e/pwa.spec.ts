import { expect, test } from "@playwright/test"

import { DEMO, login } from "./helpers"

test.describe("PWA", () => {
  test("manifiesto e íconos", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest")
    expect(res.ok()).toBe(true)
    const manifest = await res.json()
    expect(manifest).toMatchObject({ name: "AgroGestión 360", display: "standalone", start_url: "/dashboard", lang: "es-MX" })
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes)
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]))
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true)
    for (const icon of manifest.icons) {
      const file = await request.get(icon.src)
      expect(file.ok(), icon.src).toBe(true)
    }
  })

  test("el service worker no se guarda en caché HTTP", async ({ request }) => {
    const res = await request.get("/sw.js")
    expect(res.ok()).toBe(true)
    expect(res.headers()["cache-control"]).toContain("no-cache")
    expect(res.headers()["content-type"]).toContain("javascript")
  })

  test("instala el service worker y solo guarda recursos públicos", async ({ page, baseURL }) => {
    await login(page, DEMO.campo)
    await page.goto("/campo")
    await expect(page.getByText("Captura en campo").first()).toBeVisible()
    await page.evaluate(() => navigator.serviceWorker.ready)
    await expect
      .poll(async () => page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith("ag360-shell")).length))
      .toBe(1)
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const shell = await caches.open((await caches.keys()).find((k) => k.startsWith("ag360-shell"))!)
          return (await shell.keys()).map((r) => new URL(r.url).pathname).sort()
        })
      )
      .toEqual(["/campo", "/offline"])

    // Navega un poco para que el service worker intercepte solicitudes.
    await page.goto("/dashboard")
    await page.goto("/bitacoras")
    const cached = await page.evaluate(async () => {
      const urls: string[] = []
      for (const key of await caches.keys()) for (const req of await (await caches.open(key)).keys()) urls.push(req.url)
      return urls
    })
    expect(cached.length).toBeGreaterThan(0)
    for (const url of cached) {
      const { pathname, origin, searchParams } = new URL(url)
      expect(origin).toBe(new URL(baseURL!).origin)
      expect(pathname.startsWith("/api/")).toBe(false)
      expect(searchParams.has("_rsc")).toBe(false)
      expect(["/campo", "/offline"].includes(pathname) || /^\/(_next\/static|icons)\//.test(pathname) || pathname === "/manifest.webmanifest").toBe(true)
    }
  })
})
