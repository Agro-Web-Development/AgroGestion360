const BASE = "http://redirect.invalid"

/**
 * Devuelve una ruta interna segura para redirigir después de iniciar sesión o
 * de abrir un enlace de correo. Rechaza destinos que el navegador interpretaría
 * como otro dominio: `//evil.com`, `/\evil.com` (el analizador de URL trata la
 * diagonal invertida como `/`) o rutas con caracteres de control.
 */
export function safeRedirectPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) return fallback
  try {
    const url = new URL(next, BASE)
    if (url.origin !== BASE) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}
