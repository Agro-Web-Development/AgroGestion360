# Despliegue: Vercel + Supabase

## Entornos

| Entorno        | Aplicación                          | Base de datos                                  | Datos                          |
| -------------- | ----------------------------------- | ---------------------------------------------- | ------------------------------ |
| Desarrollo     | `npm run dev` (localhost:3000)      | Supabase local en Docker (`npm run db:start`)   | Demostración (`seed.sql`)       |
| Vista previa   | Vercel *Preview* (cada rama / PR)   | Proyecto Supabase **de pruebas** (`agrogestion-staging`) | Ficticios                |
| Producción     | Vercel *Production* (rama `main`)   | Proyecto Supabase **de producción** (`agrogestion-prod`) | Reales; `seed.sql` nunca se aplica |

Las vistas previas **nunca** apuntan a la base de producción.

## Variables de entorno

| Variable                                | Dónde            | Valor                                                    |
| --------------------------------------- | ---------------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`              | Navegador y servidor | `https://<ref>.supabase.co` (Settings → API)          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`  | Navegador y servidor | Clave *publishable* (`sb_publishable_…`)              |
| `NEXT_PUBLIC_SITE_URL`                  | Servidor         | `https://<dominio>` (enlaces de correo)                   |
| `SUPABASE_SECRET_KEY`                   | **Solo servidor** | Clave *secret* (`sb_secret_…`). En Vercel marcar como *Sensitive*. Nunca con prefijo `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_ENABLE_SW`                 | Opcional, desarrollo | `1` para probar el service worker con `next dev`.     |

En Vercel, define cada variable por entorno (*Production* con el proyecto de producción; *Preview* y *Development* con
el de pruebas). `.env.local` está en `.gitignore`; el repositorio solo contiene `.env.example`.

## Primer despliegue

### 1. Supabase (producción)

1. Crea el proyecto en [supabase.com](https://supabase.com) (región más cercana: `us-east-1` o `us-west-1`; plan **Pro**
   para respaldos diarios y PITR). Guarda la contraseña de la base en un gestor de contraseñas.
2. Vincula y aplica las migraciones (sin datos demo):

   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-produccion>
   npx supabase db push --dry-run   # revisa la lista de migraciones
   npx supabase db push             # aplica supabase/migrations/*; NO ejecuta seed.sql
   ```

3. *Authentication → URL Configuration:* Site URL `https://<dominio>`; Redirect URLs `https://<dominio>/**`.
4. *Authentication → Providers → Email:* confirmar correo, *Secure password change*, longitud mínima 8 con letras y
   dígitos, *Leaked password protection*.
5. *Authentication → SMTP:* proveedor propio (Resend, SES, Postmark) con dominio verificado; plantillas en español
   (invitación con enlace a `{{ .SiteURL }}/auth/aceptar`, recuperación a `/auth/callback?next=/restablecer`).
6. *Settings → API:* `Max rows` = 1000 (la aplicación pagina).
7. Storage: el bucket `evidencias` lo crea la migración (privado, 10 MB, tipos permitidos). Verifica que exista.

### 2. Vercel

1. Importa el repositorio; *Framework*: Next.js; *Build*: `npm run build`; *Node*: 22.x.
2. Configura las variables de entorno (tabla anterior).
3. Despliega. La primera cuenta se crea en `/registro` y su organización en `/bienvenida`.

### 3. Dominio propio y HTTPS

1. Vercel → *Settings → Domains* → agrega `app.<dominio>`.
2. En el DNS: `CNAME app → cname.vercel-dns.com` (o los registros que indique Vercel). El certificado HTTPS se emite
   y renueva automáticamente; HSTS lo envía la aplicación en producción.
3. Actualiza `NEXT_PUBLIC_SITE_URL` y la configuración de URLs de Supabase Auth al dominio definitivo y vuelve a desplegar.

La PWA requiere HTTPS: en el dominio de Vercel o el propio ya se puede instalar.

## Despliegues posteriores

```
rama → PR (CI: lint, tipos, unitarias, pgTAP, integración, E2E) → revisión
  → respaldo manual si hay migración → supabase db push (producción) → merge a main → Vercel despliega
```

1. Las migraciones se aplican **antes** de desplegar el código que las usa y deben ser compatibles con la versión
   anterior de la aplicación (cambios aditivos).
2. **Nada destructivo en producción:** no `drop`, `truncate` ni `delete` masivos en migraciones; no `supabase db reset`
   contra producción; nunca editar una migración ya aplicada. Si algo sale mal se corrige con una migración nueva.
3. Para eliminar una columna: primero se deja de usar y se despliega; se elimina en una migración posterior, después de
   un respaldo.
4. Revisa `npx supabase db push --dry-run` y `npx supabase migration list` antes de aplicar.
5. Si cambias `public/sw.js` de forma incompatible, incrementa su `VERSION`.

## Respaldos y restauración

| Mecanismo | Frecuencia | Notas |
| --------- | ---------- | ----- |
| Respaldos diarios de Supabase (Pro) | Diario, 7 días | *Database → Backups*. |
| PITR (complemento) | Continuo | Recomendado al tener clientes en producción. |
| Respaldo lógico manual | Antes de cada migración y semanal | Ver abajo; guardar cifrado fuera de Supabase. |
| Storage (`evidencias`) | Semanal | No lo incluyen los respaldos de la base: copiar con la API S3 de Storage o `supabase storage cp`. |

```bash
# Respaldo lógico (requiere la cadena de conexión de Settings → Database)
npx supabase db dump --linked -f respaldo/esquema-$(date +%F).sql
npx supabase db dump --linked --data-only -f respaldo/datos-$(date +%F).sql
npx supabase db dump --linked --role-only -f respaldo/roles-$(date +%F).sql
```

Restauración de prueba (trimestral): restaurar en un proyecto de pruebas, levantar la aplicación contra él y verificar
conteos de proyectos, movimientos, ventas y saldos. Documentar la fecha y el resultado.

## Verificación después de desplegar

- [ ] `/login` responde por HTTPS con encabezados de seguridad (`curl -I`).
- [ ] Registro, confirmación de correo e inicio de sesión.
- [ ] `/manifest.webmanifest` y `/sw.js` (este con `Cache-Control: no-cache`).
- [ ] Captura en campo: registrar sin red y sincronizar.
- [ ] `npx supabase migration list --linked` sin pendientes.
- [ ] Con la clave secreta solo en Vercel (`grep -r sb_secret` en el repositorio no encuentra nada).
