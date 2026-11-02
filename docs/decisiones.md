# Registro de decisiones y supuestos

| #  | Decisión | Motivo |
| -- | -------- | ------ |
| 1  | Next.js 16.4 con **Cache Components** activado (valor por defecto del generador). | Es la configuración actual recomendada. Implica leer la sesión dentro de `<Suspense>`; el layout `(app)` ya provee ese límite. |
| 2  | `src/proxy.ts` (antes *middleware*) solo refresca la sesión y hace redirecciones optimistas. | En Next 16 el middleware se llama *proxy*; la autorización real vive en el DAL y la RLS. |
| 3  | `createClient()` del servidor llama a `connection()`. | El cliente de Supabase usa la hora actual para validar el token; debe ejecutarse en tiempo de solicitud. |
| 4  | Claves nuevas de Supabase: `publishable` (cliente) y `secret` (servidor). | Reemplazan a `anon`/`service_role` y facilitan la rotación. |
| 5  | Supabase **local** con Docker para desarrollo; producción se vincula con `supabase link` + `supabase db push`. | Entorno reproducible y sin costo; migraciones versionadas. |
| 6  | Las tablas del núcleo **no** permiten INSERT/DELETE directos; las escrituras sensibles usan RPC. Solo columnas específicas son actualizables (`GRANT UPDATE (col…)`). | Evita escalamiento de privilegios (p. ej. un usuario cambiándose el rol). |
| 7  | Siempre debe existir al menos un propietario activo; un administrador no administra propietarios; nadie se desactiva a sí mismo. | Evita organizaciones huérfanas o bloqueos. |
| 8  | Invitaciones: si el correo ya tiene cuenta se agrega directo; si no, se registra la invitación y se envía con `auth.admin.inviteUserByEmail`. Un trigger acepta las invitaciones al crearse el usuario. | Un solo flujo para usuarios nuevos y existentes; la autorización se hace en SQL antes de usar la clave secreta. |
| 9  | Las invitaciones de Supabase llegan con tokens en el fragmento de la URL → página cliente `/auth/aceptar`. | El flujo PKCE no aplica a invitaciones generadas por el administrador. |
| 10 | Organización activa en cookie httpOnly `ag360_org`, validada contra membresías. | Soporta usuarios con varias organizaciones sin exponer datos ajenos. |
| 11 | Usuarios desactivados se marcan `inactivo`; no se eliminan membresías. | Conservar historial de operaciones y responsables. |
| 12 | `citext` para correos. | Comparaciones sin distinción de mayúsculas. |
| 13 | RFC opcional, validado con el patrón SAT (12 o 13 caracteres). | Útil para reportes; CFDI queda fuera de alcance inicial. |
| 14 | Módulos de fases futuras aparecen en el menú como "Pronto" (deshabilitados) y el dashboard muestra sus indicadores como "Sin registros". | No se muestran datos simulados en lugar de consultas reales. |
| 15 | Contraseña mínima de 8 caracteres con letras y números (Zod + `minimum_password_length` en Supabase). | Seguridad básica razonable para usuarios de campo. |
| 16 | `@types/node@24` en lugar de 20. | Vitest 5 requiere tipos de Node ≥ 22. |
| 17 | FKs compuestas `(organization_id, id)` en todas las relaciones agrícolas. | La RLS filtra lecturas, pero una FK simple permitiría *referenciar* un id de otra organización. |
| 18 | Estado del proyecto solo por RPC; historial escrito por trigger. | Garantiza transiciones válidas y un historial que no se puede omitir ni falsificar. |
| 19 | La superficie se compromete solo mientras el proyecto está vigente; cerrar o cancelar la libera. | Permite reutilizar parcelas entre ciclos sin borrar el historial. |
| 20 | Desactivar en lugar de eliminar cuando hay historial (rancho, parcela, cultivo); eliminar solo registros sin uso. | Las FKs `ON DELETE RESTRICT` protegen la trazabilidad; la UI ofrece desactivar. |
| 21 | Se permite insertar `id` desde el cliente. | Necesario para la captura sin conexión de la Fase 6 (ids generados en el dispositivo). |
| 22 | Presupuesto del proyecto como importe total; el desglose por categoría llega en la Fase 5. | Evita duplicar la captura antes de existir el módulo de costos. |
| 23 | Con Partial Prerendering, una página inexistente responde HTTP 200 con la vista 404 transmitida. | El shell estático ya se envió cuando `notFound()` se ejecuta; es el comportamiento de Next 16. |

## Pendientes conocidos

- Las plantillas de correo de Supabase local están en inglés; se traducirán al configurar
  el proyecto de producción (`supabase/templates/`).
- `npm audit` reporta vulnerabilidades moderadas en dependencias de desarrollo
  transitivas del generador; se revisarán antes del despliegue (Fase 6).
