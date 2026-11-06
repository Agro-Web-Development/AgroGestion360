import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

/**
 * Scripts de demostración (npm run demo:jitomate) contra Supabase local; mismos alias que integración.
 * Con --mode remoto (npm run demo:jitomate:remoto) usan .env.demo, el proyecto de demostración para clientes.
 */
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/support/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["scripts/demo-*.ts"],
    testTimeout: 180_000,
    env: mode === "remoto" ? { DEMO_ENV_FILE: ".env.demo" } : {},
  },
}))
