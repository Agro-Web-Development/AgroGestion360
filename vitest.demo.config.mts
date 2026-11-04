import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

/** Scripts de demostración (npm run demo:jitomate) contra Supabase local; mismos alias que integración. */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/support/server-only.ts", import.meta.url)),
    },
  },
  test: { environment: "node", include: ["scripts/demo-*.ts"], testTimeout: 180_000 },
})
