import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

/**
 * Pruebas de integración contra Supabase local (npm run db:start). Usan
 * usuarios reales con la clave publicable: la RLS y las RPC aplican igual que
 * en la aplicación. La clave secreta solo crea y elimina los usuarios de prueba.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/support/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
})
