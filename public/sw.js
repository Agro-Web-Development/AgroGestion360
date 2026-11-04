/*
 * Service worker de AgroGestión 360.
 *
 * Estrategia de caché (ver docs/pwa-offline.md):
 *   · Recursos estáticos con huella (/_next/static, íconos, manifiesto): caché primero.
 *   · Navegación: red primero. Sin red se sirve la captura en campo (/campo) o
 *     la página «Sin conexión» (/offline).
 *   · NUNCA se guardan: la API (/api/*), las Server Actions (POST), los datos de
 *     React Server Components (encabezado RSC / ?_rsc), ni nada de otro origen
 *     (Supabase: datos, autenticación y archivos privados). Las páginas que se
 *     guardan (/campo, /offline) son estáticas y no contienen datos de la sesión;
 *     los registros y catálogos viven en IndexedDB, por usuario.
 */
const VERSION = "v1"
const STATIC_CACHE = `ag360-static-${VERSION}`
const SHELL_CACHE = `ag360-shell-${VERSION}`
const SHELL_PAGES = ["/campo", "/offline"]
const MAX_STATIC_ENTRIES = 400

const isStatic = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/icons/") ||
  url.pathname === "/manifest.webmanifest" ||
  url.pathname === "/favicon.ico"

const isRscRequest = (request, url) =>
  request.headers.get("RSC") === "1" || request.headers.has("Next-Router-State-Tree") || url.searchParams.has("_rsc")

/** Guarda una página del shell y los recursos estáticos que referencia. */
async function cacheShellPage(path, response) {
  if (!response.ok || response.redirected || response.type !== "basic") return
  const html = await response.clone().text()
  const shell = await caches.open(SHELL_CACHE)
  await shell.put(path, response)
  const assets = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])
  const cache = await caches.open(STATIC_CACHE)
  await Promise.all(
    [...assets].map(async (asset) => {
      if (await cache.match(asset)) return
      try {
        const res = await fetch(asset, { credentials: "same-origin" })
        if (res.ok) await cache.put(asset, res)
      } catch {
        // Se intentará en la siguiente visita con conexión.
      }
    })
  )
}

async function precacheShell() {
  await Promise.all(
    SHELL_PAGES.map(async (path) => {
      try {
        // Sin sesión, /campo redirige al inicio de sesión: no se guarda.
        const res = await fetch(path, { credentials: "same-origin", cache: "no-store", redirect: "follow" })
        await cacheShellPage(path, res)
      } catch {
        // Sin conexión durante la instalación.
      }
    })
  )
}

async function trimStatic() {
  const cache = await caches.open(STATIC_CACHE)
  const keys = await cache.keys()
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_STATIC_ENTRIES))) await cache.delete(key)
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()))
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, SHELL_CACHE])
      for (const key of await caches.keys()) {
        if (key.startsWith("ag360-") && !keep.has(key)) await caches.delete(key)
      }
      await self.clients.claim()
    })()
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return
  if (isRscRequest(request, url)) return

  if (isStatic(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE)
        const cached = await cache.match(request)
        if (cached) return cached
        const response = await fetch(request)
        if (response.ok && response.type === "basic") {
          await cache.put(request, response.clone())
          void trimStatic()
        }
        return response
      })()
    )
    return
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request)
          if (SHELL_PAGES.includes(url.pathname)) event.waitUntil(cacheShellPage(url.pathname, response.clone()))
          return response
        } catch {
          const shell = await caches.open(SHELL_CACHE)
          const fallback =
            (url.pathname === "/campo" && (await shell.match("/campo"))) || (await shell.match("/offline"))
          return fallback || Response.error()
        }
      })()
    )
  }
})

self.addEventListener("message", (event) => {
  if (event.origin && event.origin !== self.location.origin) return
  if (event.data === "ag360:cache-shell") event.waitUntil(precacheShell())
  // Al cerrar sesión: se retira el shell guardado (se vuelve a descargar con la siguiente sesión).
  if (event.data === "ag360:clear") event.waitUntil(caches.delete(SHELL_CACHE))
})

// Background Sync: al volver la conexión, pide a las pestañas abiertas que sincronicen.
self.addEventListener("sync", (event) => {
  if (event.tag !== "ag360-sync") return
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) client.postMessage("ag360:sync")
    })
  )
})
