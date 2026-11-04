import { defineConfig, devices } from "@playwright/test"

/**
 * Pruebas de extremo a extremo en navegador contra la compilación de
 * producción (el service worker solo se registra en producción) y Supabase
 * local con los datos de demostración (`npm run db:reset`).
 *
 *   npm run test:e2e                      compila y prueba
 *   E2E_SKIP_BUILD=1 npm run test:e2e     reutiliza la última compilación
 */
const PORT = Number(process.env.E2E_PORT ?? 3217)

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"] }, testIgnore: /movil\.spec\.ts/ },
    { name: "movil", use: { ...devices["Pixel 7"] }, testMatch: /movil\.spec\.ts/ },
  ],
  webServer: {
    command: process.env.E2E_SKIP_BUILD ? `npx next start -p ${PORT}` : `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 600_000,
    reuseExistingServer: false,
  },
})
