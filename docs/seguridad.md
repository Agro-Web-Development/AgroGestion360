# Auditoría de seguridad (Fase 6)

Fecha: noviembre de 2026. Alcance: autenticación, autorización, sesiones, roles, RLS, Storage, variables de entorno,
validación en el servidor, exposición de datos, operaciones sensibles, dependencias y PWA.

Método: revisión de código, consultas al catálogo de PostgreSQL (RLS, privilegios, funciones), pruebas pgTAP por rol,
pruebas de integración con **usuarios reales de dos organizaciones** (`tests/integration/`) y pruebas E2E en navegador.

## Hallazgos y correcciones

| # | Severidad | Hallazgo | Corrección |
| - | --------- | -------- | ---------- |
| 1 | Alta | **Redirección abierta.** `/auth/callback?next=/\evil.com` y `/login?next=/\evil.com` pasaban la validación `startsWith("/") && !startsWith("//")`; el navegador interpreta `\` como `/` y enviaba al usuario a otro dominio tras autenticarse (útil para phishing). | `lib/safe-redirect.ts`: rechaza `\`, caracteres de control y verifica que el destino resuelva al mismo origen. Pruebas unitarias y E2E. |
| 2 | Media | **Eliminación en Storage.** El autor de un archivo podía borrarlo del bucket aunque ya no perteneciera a la organización, y un usuario de finanzas podía borrar el archivo de un comprobante (que solo retira propietario/administrador), dejando el registro sin archivo. | Nueva política `evidencias_delete_owner_admin`: el autor necesita membresía vigente con rol de captura y nunca para comprobantes. Pruebas pgTAP. |
| 3 | Media | **Sin encabezados de seguridad.** | `next.config.ts`: CSP (`frame-ancestors 'none'`, `object-src 'none'`, `connect-src` limitado al origen y a Supabase, `form-action 'self'`), `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (cámara y ubicación solo propias), `COOP`, HSTS en producción; se quitó `X-Powered-By`. |
| 4 | Media (integridad) | **Reportes truncados en silencio.** PostgREST devuelve máximo 1,000 filas (`max_rows`); las consultas de reportes pedían 5,000–20,000 y la de cobranza no tenía límite, así que recibían 1,000 sin error y los totales salían incompletos con más datos. | `lib/supabase/rows.ts` (`fetchRows`) pagina con `range` y orden total. Prueba de integración con 1,050 filas. |
| 5 | Baja | `shadcn` (CLI de generación de código) estaba en dependencias de producción con dependencias transitivas vulnerables (`deepmerge`, `minimatch`). | Movido a `devDependencies`; `npm audit --omit=dev`: 0 vulnerabilidades. |
| 6 | Baja | La API sin sesión respondía con redirección HTML a `/login`. | El proxy responde 401 JSON en `/api/*`; las rutas verifican el origen en escrituras. |
| 7 | Baja | `/produccion` y `/personal` leían el reloj antes de la sesión (aviso de Cache Components en producción). | Se lee después de `getOrgContext()`. |

## Verificado sin hallazgos

- **RLS:** las 51 tablas tienen RLS; las 8 vistas son `security_invoker`. `anon` no tiene privilegios sobre tablas.
- **Funciones:** todas las `SECURITY DEFINER` fijan `search_path = ''`; las internas (triggers, procesos) no tienen
  `EXECUTE` para usuarios. Las RPC verifican `has_role` de la organización del registro, no de un parámetro.
- **Separación de organizaciones:** FKs compuestas `(organization_id, id)`; probado con dos cuentas que la otra
  organización no lee, no modifica, no ejecuta RPC y no referencia ids ajenos (proyectos, parcelas, ventas, pagos,
  inventario, bitácoras, auditoría, vistas de costos, Storage).
- **Roles:** consulta no escribe; supervisor no mueve inventario ni ve ventas; almacén no captura bitácoras; nadie se
  asigna rol ni cambia su plan. La interfaz oculta acciones y las Server Actions/RLS las rechazan igualmente.
- **Sesiones:** cookies de Supabase httpOnly con rotación de refresh token; `getUser()` valida el token en el servidor
  (no `getSession()`); la organización activa (`ag360_org`, httpOnly, `secure` en producción) se valida contra las
  membresías en cada solicitud. Las Server Actions tienen la protección de origen de Next.js.
- **Credenciales:** solo `NEXT_PUBLIC_SUPABASE_URL` y la clave *publishable* llegan al navegador. `SUPABASE_SECRET_KEY`
  solo se usa en `lib/supabase/admin.ts` (`server-only`) para enviar invitaciones, después de autorizar en SQL. `.env*`
  está en `.gitignore` y no hay llaves en el historial de git.
- **Archivos:** bucket privado; 10 MB; JPG/PNG/WEBP/HEIC (PDF solo comprobantes) validado en el bucket, en Zod y en un
  CHECK de `attachments`; la ruta fija organización/tipo/registro; URLs firmadas de 30 min; límite por plan.
- **Validación en el servidor:** cada Server Action y la API de sincronización vuelven a validar con Zod, verifican rol y
  organización; las reglas de negocio viven en PostgreSQL (existencias, saldos, superficie, fechas, proyecto cerrado).
- **PWA:** el service worker no guarda la API, Server Actions, datos RSC ni nada de Supabase; las páginas guardadas no
  contienen datos de la sesión; los datos sin conexión están en IndexedDB y se limpian al cerrar sesión.

## Riesgos aceptados y recomendaciones

| Riesgo | Mitigación actual | Recomendación |
| ------ | ----------------- | ------------- |
| CSP con `script-src 'unsafe-inline'` | Next.js inyecta scripts de hidratación; no hay HTML de usuario renderizado sin escapar ni `dangerouslySetInnerHTML`. | Evaluar nonces cuando Next.js los soporte con prerenderizado parcial. |
| El tipo de archivo se valida por el `Content-Type` declarado, no por su contenido | Se sirve desde el dominio de Supabase (no del de la app) y con URL firmada. | Agregar verificación de firma (magic bytes) en una Edge Function si se abren cargas a terceros. |
| Límite de intentos de inicio de sesión | Límites de Supabase Auth (`sign_in_sign_ups`, `token_verifications`). | En producción: CAPTCHA (Turnstile) en registro y recuperación; activar protección de contraseñas filtradas. |
| Sin MFA | — | Habilitar TOTP para propietarios y administradores antes de clientes con muchos usuarios. |
| Datos en dispositivos compartidos | Se borran sesión y catálogos al cerrar sesión; los registros pendientes solo los ve su autor. | Política de uso: un usuario por dispositivo de campo; bloqueo de pantalla del teléfono. |
| API de sincronización sin límite de solicitudes propio | Requiere sesión, verifica origen y es idempotente. | Límite por usuario en Vercel Firewall (p. ej. 120 solicitudes/min a `/api/campo/*`). |

## Configuración obligatoria en producción (Supabase)

- *Authentication → Providers → Email:* **confirmar correo** activado; *Secure password change* activado; contraseña
  mínima 8 con letras y dígitos; *Leaked password protection* activado.
- *URL Configuration:* Site URL `https://<dominio>` y Redirect URLs `https://<dominio>/**` (sin `localhost`).
- SMTP propio (dominio verificado) y plantillas en español.
- *API → Max rows:* 1000 (la aplicación pagina). No exponer más esquemas que `public` y `graphql_public`.
- La clave secreta solo en Vercel (variable *Sensitive*), nunca en el repositorio ni con prefijo `NEXT_PUBLIC_`.

## Pruebas de seguridad automatizadas

| Archivo | Qué prueba |
| ------- | ---------- |
| `supabase/tests/database/01–07*.test.sql` | RLS por rol y organización, privilegios por columna, RPC, Storage. |
| `tests/integration/platform.test.ts` | Dos organizaciones y cinco roles con sesiones reales: lectura, escritura, RPC, FKs y Storage cruzados. |
| `tests/integration/offline-sync.test.ts` | Sincronización con otro usuario, organización ajena, rol sin permiso, rutas de archivo ajenas. |
| `tests/unit/offline.test.ts` | Redirecciones seguras, clasificación de errores. |
| `tests/e2e/auth.spec.ts` | Redirecciones, 401 de la API, rechazo de otro origen, encabezados de seguridad. |
| `tests/e2e/pwa.spec.ts` | La caché del service worker solo contiene recursos públicos. |
