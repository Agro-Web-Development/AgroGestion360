import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import type { Database } from "@/types/database"
import { env } from "@/lib/env"

const PUBLIC_PATHS = ["/login", "/registro", "/recuperar", "/auth", "/offline"]

export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * Refresca la sesión de Supabase en cada solicitud y hace una verificación
 * optimista de autenticación. La autorización real ocurre en el servidor (DAL + RLS).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
      },
    },
  })

  // No colocar lógica entre createServerClient y getClaims().
  const { data } = await supabase.auth.getClaims()
  const isAuthenticated = Boolean(data?.claims?.sub)
  const { pathname } = request.nextUrl

  if (!isAuthenticated && pathname.startsWith("/api/")) {
    // La API responde en JSON: el dispositivo distingue una sesión vencida de una falla de red.
    return NextResponse.json(
      { error: "Tu sesión expiró. Inicia sesión de nuevo." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } }
    )
  }

  if (!isAuthenticated && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`
    return redirectWithCookies(url, response)
  }

  if (isAuthenticated && (pathname === "/login" || pathname === "/registro")) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    url.search = ""
    return redirectWithCookies(url, response)
  }

  return response
}

function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url)
  from.cookies.getAll().forEach((c) => redirect.cookies.set(c))
  return redirect
}
