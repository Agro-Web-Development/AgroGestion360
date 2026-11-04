# Manual de solución de errores

## Desarrollo local

| Síntoma | Causa probable | Solución |
| ------- | -------------- | -------- |
| `Falta la variable de entorno NEXT_PUBLIC_SUPABASE_URL` | No existe `.env.local`. | `cp .env.example .env.local` y copia los valores de `npx supabase status`. |
| `supabase start` falla o tarda | Docker no está corriendo o faltan recursos. | Inicia Docker Desktop; `npx supabase stop && npx supabase start`. |
| Los tipos no coinciden con la base | Se agregó una migración. | `npm run db:types` y `npx next typegen`. |
| `PageProps<"/ruta">` no existe | Rutas nuevas sin tipos generados. | `npx next typegen` (o `npm run dev` una vez). |
| `Applying migration … ERROR` en `db reset` | Error en la migración nueva. | Corrige el archivo **no aplicado aún en producción** y repite `npm run db:reset`. |
| Los correos no llegan en local | Se capturan en Mailpit. | http://127.0.0.1:54324 |
| El service worker no se registra con `npm run dev` | Solo se registra en producción. | `npm run build && npm start`, o `NEXT_PUBLIC_ENABLE_SW=1`. |
| Cambios que no aparecen tras probar la PWA | El service worker sirve recursos guardados. | DevTools → Application → Service Workers → *Unregister* y *Clear site data*. |
| Playwright: `error while loading shared libraries: libnspr4.so` | Faltan librerías del sistema para Chromium. | `sudo npx playwright install-deps chromium` (en CI se usa `--with-deps`). |
| E2E falla al iniciar sesión | La base no tiene los datos demo o hay otro servidor en el puerto. | `npm run db:reset`; cambia el puerto con `E2E_PORT=3300`. |

## Usuarios y acceso

| Síntoma | Causa | Solución |
| ------- | ----- | -------- |
| «Debes confirmar tu correo electrónico» | Confirmación activada (producción). | Reenviar desde Supabase → Authentication → Users, o revisar SMTP. |
| El enlace de invitación dice «no es válido o ya expiró» | Venció (14 días) o ya se usó. | Cancelar y volver a invitar desde *Usuarios y roles*. |
| «No tienes permiso…» al guardar | El rol no permite la acción (la RLS lo rechaza aunque la interfaz lo muestre). | Revisar el rol en *Usuarios y roles* (matriz en `lib/auth/roles.ts`). |
| Un usuario ve datos de otra organización | No debería ocurrir. | Revisar la organización activa (selector). Si persiste, es un incidente de seguridad: ver `docs/seguridad.md`. |
| «Tu plan permite N proyectos/usuarios» | Límite del plan. | Cerrar proyectos o desactivar usuarios; o cambiar de plan (`docs/saas-suscripciones.md`). |

## Captura sin conexión

| Estado / mensaje | Significado | Qué hacer |
| ---------------- | ----------- | --------- |
| «Sin catálogos en este dispositivo» | Nunca se abrió `/campo` con red y sesión. | Abrir *Captura en campo* una vez con internet. |
| *Pendiente* | Guardado en el dispositivo, aún sin enviar. | Esperar la red; se envía solo. |
| *Error* — «Sin conexión con el servidor» | Falla temporal. | Se reintenta solo (15 s, 30 s, 1 min… hasta 30 min) o con *Reintentar*. |
| *Error* — «Tu sesión expiró» | La sesión venció mientras estaba sin red. | Iniciar sesión con la **misma cuenta**; se envían solos. |
| *Requiere revisión* — «Existencia insuficiente» | El almacén ya no tiene el producto. | Registrar la entrada al almacén o corregir la cantidad (*Corregir*) y reintentar. Nada se descontó. |
| *Requiere revisión* — «La parcela no está asignada» | La parcela ya no pertenece al proyecto. | Corregir la parcela o pedir al agrónomo que la asigne. |
| *Requiere revisión* — «La fecha no puede ser anterior al inicio del proyecto» | Fecha mal capturada. | *Corregir* la fecha. |
| *Requiere revisión* — proyecto cerrado | El proyecto se cerró después de capturar. | Un administrador lo reabre o un revisor descarta el registro. |
| *Requiere revisión* — «ya se sincronizó con otros datos» | Conflicto: el mismo registro se envió con otro contenido. | Se conserva la versión del servidor; corregir desde la aplicación en línea. |
| *Descartado* | Un revisor lo descartó en *Sincronización*. | Leer el motivo; eliminarlo del dispositivo. |
| Fotos «pendientes de carga» | El registro se sincronizó pero falta subir las fotos. | Se suben en la siguiente sincronización; si se rechazan (p. ej. límite de almacenamiento), el motivo aparece en el registro. |
| «Este registro lo capturó otro usuario» | Otra cuenta inició sesión en el dispositivo. | Iniciar sesión con la cuenta que lo capturó. |

Revisores (propietario, administrador, agrónomo): *Operación → Sincronización* muestra todos los rechazos con su motivo.

## Producción

| Síntoma | Causa | Solución |
| ------- | ----- | -------- |
| 500 en todas las páginas tras desplegar | Falta una variable de entorno. | Revisar Vercel → Settings → Environment Variables y los *Runtime Logs*. |
| Error «column … does not exist» | El código se desplegó antes que la migración. | `npx supabase db push` (la migración es aditiva) y volver a desplegar. |
| Enlaces de correo apuntan a localhost | `NEXT_PUBLIC_SITE_URL` o *Site URL* de Supabase mal configurados. | Ajustarlos al dominio y volver a desplegar. |
| La app no ofrece «Instalar» | Sin HTTPS, ya instalada, o navegador sin soporte (iOS usa *Compartir → Agregar a inicio*). | Verificar HTTPS y `/manifest.webmanifest`. |
| Reportes con totales distintos al expediente | Periodos o filtros distintos. | Los reportes usan la misma vista de costos (`v_project_cost_entries`); comparar con el mismo periodo y proyecto. |
| Lentitud en listados | Periodo muy amplio. | Usar los filtros de fecha; los listados muestran los registros más recientes. |

## Diagnóstico

- Registros de la aplicación: Vercel → *Logs* (filtra por `/api/campo` para la sincronización).
- Base de datos: Supabase → *Logs → Postgres / API*. Las funciones devuelven mensajes en español con códigos:
  `22023` dato inválido, `23503` referencia inválida, `23505` duplicado, `42501` sin permiso, `P0001` límite del plan,
  `P0002` no encontrado.
- Auditoría: tabla `audit_logs` (quién cambió qué y cuándo) y `offline_submissions` (historial de sincronización).
