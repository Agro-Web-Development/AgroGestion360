# Preparación comercial SaaS: planes y suscripciones

Estado: **estructura de planes y límites implementada; sin cobros**. No hay pasarela de pago ni facturación automática;
eso requiere una especificación adicional.

## Lo implementado (migración `20261105060000_platform.sql`)

| Elemento | Descripción |
| -------- | ----------- |
| `plans` | Catálogo de planes: `code`, `name`, `description`, `max_projects` (proyectos vigentes), `max_users` (miembros activos + invitaciones pendientes), `max_storage_mb` (evidencias y comprobantes), `features text[]`, `is_active`, `sort_order`. `null` = sin límite. |
| `organizations.plan_code` | Plan de cada organización (por omisión `piloto`) y `plan_started_at`. Los usuarios **no** pueden modificarlo (no tienen privilegio de columna). |
| `organization_usage(org)` | Uso actual frente a los límites (proyectos vigentes, usuarios, invitaciones, almacenamiento). Se muestra en *Configuración → Organización*. |
| Triggers de límite | `projects_plan_limit` (alta de proyecto), `memberships_plan_limit` / `invitations_plan_limit` (usuarios; una invitación reserva su lugar y su aceptación nunca falla), `attachments_plan_limit` (almacenamiento). Mensajes en español con código `P0001`. |

Plan inicial: **`piloto`**, sin límites y con todas las funciones, para las pruebas con productores. Probado en
`supabase/tests/database/07_platform.test.sql` con un plan limitado temporal.

Funciones (`features`) definidas: `operacion`, `offline`, `comercial`, `finanzas`, `reportes_excel`. Hoy son
informativas (todas activas en `piloto`); ver «Siguientes pasos» para aplicarlas.

## Administrar planes (equipo de AgroGestión)

Solo con la clave secreta o desde el editor SQL de Supabase (nunca desde la aplicación):

```sql
-- Crear un plan
insert into public.plans (code, name, description, max_projects, max_users, max_storage_mb, features, sort_order)
values ('basico', 'Básico', 'Un rancho pequeño', 5, 5, 2048, array['operacion', 'offline'], 1);

-- Cambiar el plan de una organización
update public.organizations set plan_code = 'basico', plan_started_at = now() where id = '<org>';
```

Bajar de plan no elimina datos: si el uso ya excede el nuevo límite, solo se bloquean **nuevas** altas (proyectos,
usuarios, archivos) hasta que el uso baje.

## Arquitectura propuesta para el módulo de suscripciones

```
plans ──< subscriptions >── organizations
              │
              ├──< subscription_events   (alta, renovación, cambio de plan, cancelación; idempotente por id del proveedor)
              └──< invoices              (folio, periodo, importe, estado, CFDI)
```

1. **`subscriptions`**: `organization_id`, `plan_code`, `status` (`prueba`, `activa`, `vencida`, `cancelada`),
   `current_period_start/end`, `trial_ends_at`, `cancel_at_period_end`, `provider` y `provider_subscription_id`.
   `organizations.plan_code` pasa a derivarse de la suscripción vigente (trigger), para que los límites sigan
   funcionando igual.
2. **Webhooks del proveedor de pago** (Stripe, Conekta, Mercado Pago u OpenPay): Route Handler
   `/api/facturacion/webhook` que verifica la firma, registra el evento en `subscription_events` (llave única por id del
   evento) y actualiza la suscripción con la clave secreta. Nunca confiar en el navegador para activar un plan.
3. **Estado vencido**: modo de solo lectura (las políticas de escritura agregan `and public.subscription_active(org)`),
   sin borrar datos. La captura sin conexión ya maneja el rechazo: los registros quedan en revisión.
4. **Funciones por plan**: `public.plan_allows(org, feature)` en las políticas y RPC de cada módulo (p. ej. `comercial`
   en ventas) y `can()` en la interfaz para ocultar el menú. Agregar pruebas pgTAP por plan.
5. **Facturación (CFDI 4.0)**: un PAC timbra la factura de la suscripción; se guarda UUID fiscal y XML/PDF en Storage
   en un bucket separado (no en `evidencias`).
6. **Panel interno**: aplicación o sección aparte, con usuarios internos (no miembros de organizaciones), para alta de
   planes, asignaciones y soporte. No mezclar con los roles de las organizaciones.

## Multiempresa

La arquitectura ya soporta múltiples organizaciones agrícolas: aislamiento por `organization_id` con RLS y FKs
compuestas, usuarios con membresías en varias organizaciones y selector de organización, roles por organización,
folios por organización y año, y Storage con la organización en la ruta. Una organización nueva nace con sus catálogos
(categorías de insumo, almacén general y actividades).
