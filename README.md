# AgroGestión 360

Plataforma SaaS multiempresa para la administración integral de proyectos agrícolas:
planeación, insumos, bitácoras de campo, maquinaria, personal, cosechas, ventas,
cobranza y rentabilidad.

**Estado:** Fases 1–6 completas. La Fase 6 prepara la plataforma para pruebas piloto: PWA instalable, captura en campo
sin conexión con sincronización idempotente y revisión de conflictos, auditoría de seguridad, pruebas unitarias, de base
de datos, de integración y de extremo a extremo, optimización de consultas, planes por organización y documentación de
despliegue. Ver el [informe de la Fase 6](docs/informe-fase-6.md).

## Documentación

| Documento | Contenido |
| --------- | --------- |
| [docs/arquitectura.md](docs/arquitectura.md) | Arquitectura, estructura de carpetas, patrones y reglas por módulo. |
| [docs/base-de-datos.md](docs/base-de-datos.md) | Modelo, diagrama entidad-relación, migraciones y políticas RLS. |
| [docs/pwa-offline.md](docs/pwa-offline.md) | PWA, estrategia de caché, captura sin conexión y sincronización. |
| [docs/seguridad.md](docs/seguridad.md) | Auditoría de seguridad, hallazgos y configuración obligatoria. |
| [docs/despliegue.md](docs/despliegue.md) | Entornos, variables, Vercel + Supabase, dominio, migraciones y respaldos. |
| [docs/saas-suscripciones.md](docs/saas-suscripciones.md) | Planes, límites y arquitectura del futuro módulo de suscripciones. |
| [docs/solucion-de-errores.md](docs/solucion-de-errores.md) | Manual de solución de errores. |
| [docs/decisiones.md](docs/decisiones.md) | Registro de decisiones y supuestos. |
| [docs/informe-fase-6.md](docs/informe-fase-6.md) | Informe final: funcionalidades, pruebas, errores, riesgos y recomendaciones. |

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 ·
shadcn/ui · Lucide · Recharts · React Hook Form + Zod · Supabase (PostgreSQL, Auth,
Storage, RLS) · PWA (service worker propio + IndexedDB) · Vitest · pgTAP · Playwright.

## Requisitos

- Node.js 20.9+ (probado con 26) y npm
- Docker (para Supabase local)

## Puesta en marcha (local)

```bash
npm install
npm run db:start          # levanta Supabase en Docker, aplica migraciones y datos demo
cp .env.example .env.local
npx supabase status       # copia la URL, Publishable key y Secret key a .env.local
npm run dev               # http://localhost:3000
```

| Servicio            | URL                       |
| ------------------- | ------------------------- |
| Aplicación          | http://localhost:3000     |
| Supabase Studio     | http://127.0.0.1:54323    |
| Correos (Mailpit)   | http://127.0.0.1:54324    |

### Usuarios de demostración

Organización ficticia **Agropecuaria Los Campos** (marcada como *Demostración*).
Contraseña para todos: `Demo12345!`

| Correo                                 | Rol                  |
| -------------------------------------- | -------------------- |
| propietario@demo.agrogestion360.mx     | Propietario          |
| agronomo@demo.agrogestion360.mx        | Agrónomo             |
| campo@demo.agrogestion360.mx           | Supervisor de campo  |
| consulta@demo.agrogestion360.mx        | Consulta             |

Los datos demo solo se cargan con `supabase/seed.sql` en el entorno local; nunca se
aplican en producción.

**Escenario integral «Producción de jitomate»** (5 ha, presupuesto de $250,000, de la compra de insumos a la cobranza):
`npm run demo:jitomate` lo carga en una organización demo aparte, «Agropecuaria Los Campos · Escenario jitomate», con
usuarios `jitomate.{propietario,agronomo,campo,almacen,finanzas,consulta}@demo.agrogestion360.mx` (misma contraseña).
Cifras esperadas y resultados en [docs/auditoria-integral.md](docs/auditoria-integral.md).

## Scripts

| Script                     | Descripción                                                        |
| -------------------------- | ------------------------------------------------------------------ |
| `npm run dev`              | Servidor de desarrollo                                             |
| `npm run build` / `start`  | Compilación y servidor de producción                               |
| `npm run lint`             | ESLint                                                             |
| `npm run typecheck`        | Verificación de tipos                                              |
| `npm test`                 | Pruebas unitarias (Vitest)                                         |
| `npm run test:db`          | Pruebas de base de datos y RLS (pgTAP)                             |
| `npm run test:integration` | Integración con usuarios reales contra Supabase local (Vitest)     |
| `npm run test:e2e`         | Extremo a extremo en navegador (Playwright; compila la app)         |
| `npm run db:reset`         | Recrea la BD local: migraciones + datos demo                       |
| `npm run db:types`         | Regenera `src/types/database.ts` desde el esquema local            |
| `npm run demo:jitomate`    | Carga el escenario integral de demostración en Supabase local      |

Antes de `test:e2e` la primera vez: `npx playwright install --with-deps chromium`. `E2E_SKIP_BUILD=1` reutiliza la última
compilación. La integración continua (`.github/workflows/ci.yml`) ejecuta todo con Supabase local.

## Cómo probar la Fase 1

1. **Inicio de sesión:** entra con `propietario@demo.agrogestion360.mx`.
2. **Registro y alta de organización:** en `/registro` crea una cuenta nueva; al no
   pertenecer a ninguna organización, la app te lleva a `/bienvenida` para crearla y
   quedas como *Propietario*.
3. **Invitar usuarios:** *Configuración → Usuarios y roles → Invitar usuario*. Si el
   correo no tiene cuenta, el correo de invitación aparece en Mailpit; al abrir el
   enlace se define la contraseña y la membresía queda activa.
4. **Cambiar rol / desactivar:** ícono de lápiz en la tabla de miembros. La BD impide
   quitar al último propietario y que un administrador modifique propietarios.
5. **Recuperar contraseña:** `/recuperar` → enlace en Mailpit → `/restablecer`.
6. **Permisos:** entra como `consulta@…`: no verás acciones de administración y la
   organización aparece en solo lectura (la RLS también rechaza los cambios).
7. **Multiempresa:** con una cuenta en varias organizaciones, cambia de organización
   desde el selector del menú lateral.
8. **Pruebas:** `npm test` y `npm run test:db`.

## Cómo probar la Fase 2

Los datos demo incluyen 2 ranchos, 5 parcelas, 4 cultivos y 4 proyectos en distintos estados.

1. **Dashboard:** proyectos vigentes, superficie cultivada vs. parcelada, presupuesto planeado,
   gráficas por estado y por cultivo, próximas cosechas. Todo se calcula en SQL con los
   registros reales.
2. **Ranchos y parcelas:** crea un rancho con superficie total y agrégale parcelas; intenta
   exceder la superficie (la BD lo rechaza). Desactiva o elimina parcelas sin proyectos.
3. **Cultivos:** alta y edición de cultivos/variedades; un cultivo con proyectos no se elimina,
   solo se desactiva.
4. **Proyectos:** *Nuevo proyecto* → se asigna folio y queda en Planeación. En el expediente
   asigna parcelas (solo se ofrece la superficie libre), cambia de estado y revisa el historial.
   Cancelar exige motivo y libera la superficie; reabrir solo lo hace propietario/administrador.
5. **Permisos:** como `agronomo@…` puedes crear y editar pero no eliminar; como `campo@…` o
   `consulta@…` todo es de solo lectura.

## Cómo probar los módulos financieros

Los datos demo incluyen inventario con compras y consumos, 4 equipos, 4 empleados, gastos directos,
4 cortes de brócoli, 3 clientes y 3 ventas (una pagada, una con pago parcial y una vencida).

1. **Inventario:** registra una *entrada* (compra) y observa que el costo promedio se recalcula pero
   ningún proyecto cambia de costo. Registra un *consumo* a un proyecto/parcela: sale al costo promedio
   y aparece en el detalle de costos del proyecto. Intenta consumir más de la existencia (se rechaza).
   *Anular* crea la contrapartida exacta y solo se permite una vez.
2. **Maquinaria y personal:** registra horas de un equipo o jornales; la tarifa queda congelada (cambiar la
   tarifa del equipo no altera lo registrado). Un empleado no puede acumular más de 1 jornal por día.
3. **Gastos y rentabilidad:** ampliados en la Fase 5 (ver abajo).
4. **Cosechas, ventas y cobranza:** ampliadas en la Fase 4 (ver abajo).
7. **Expediente del proyecto:** tarjeta *Costos y resultados* y *Detalle de costos* (cuyo total coincide
   siempre con el costo de producción). Al cerrar el proyecto sus costos e ingresos quedan congelados.
8. **Permisos:** `agronomo@…` registra maquinaria y mano de obra pero no ve ventas, clientes ni gastos;
   `consulta@…` ve todo en solo lectura.

## Cómo probar la Fase 3 (control operativo)

Los datos demo agregan 2 almacenes, 5 proveedores, lotes con caducidad (uno vence en 20 días), una transferencia,
3 aplicaciones, 7 riegos, 6 actividades, mantenimientos (el camión tiene el servicio vencido), una cuadrilla de 3
personas con asignaciones y una falta registrada.

1. **Inventario → Catálogos:** crea una categoría (la clasificación define si se ofrece en aplicaciones o como
   combustible), un almacén y un proveedor. Desactivar un almacén con existencias se rechaza.
2. **Movimientos:** registra una *entrada* de un producto con control por lote (pide lote y caducidad), una
   *transferencia* entre almacenes (no cambia el valor ni los costos) y un *consumo* eligiendo el lote. Intenta sacar
   más de lo que hay en un almacén: se rechaza aunque el total alcance. *Anular* una transferencia la regresa.
   *Por almacén y lote* muestra caducidades; los filtros de fecha/almacén/producto consultan en el servidor.
3. **Bitácoras → Aplicación:** elige un agroquímico; con *Descontar del almacén* se genera el consumo (aparece en
   Inventario como *Desde bitácora* y en el costo del proyecto). No ofrece dosis: solo muestra la cantidad/ha
   registrada. *Cancelar* regresa el producto al mismo lote. Agrega fotografías desde el formulario o con el ícono de
   cámara.
4. **Riego y actividades:** un riego de 22:00 a 02:00 dura 4 h. Una actividad con costo adicional suma a la fuente
   *Actividades de campo* del proyecto; al cancelarla deja de sumar. *Cronología* muestra todo lo del proyecto.
5. **Maquinaria:** registra uso por jornada o con combustible del almacén (el diésel va a insumos, la tarifa a
   maquinaria). Registra un preventivo y observa cómo cambia la alerta. Un equipo fuera de servicio no registra uso.
6. **Personal:** *Jornada de cuadrilla* crea un registro por integrante; quien tiene falta ese día lo impide.
   Registrar un jornal marca la asistencia; no se puede marcar falta a quien ya trabajó.
7. **Expediente del proyecto:** tarjetas *Bitácora del proyecto* y *Operación* (riegos, aplicaciones, jornales,
   horas de máquina, personal asignado).
8. **Reportes operativos:** nueve reportes por periodo y proyecto con exportación CSV.
9. **Permisos:** `campo@…` (supervisor) registra bitácoras, asistencia y jornadas pero no mueve inventario ni
   administra equipos; `agronomo@…` administra maquinaria, cuadrillas y asignaciones; `consulta@…` solo consulta.
10. **Pruebas:** `npm test` y `npm run test:db` (incluye `04_operations.test.sql`).

## Cómo probar la Fase 4 (producción y comercialización)

Los datos demo incluyen 5 lotes de brócoli en 4 cortes (capturados en cajas, toneladas y kg; el corte 4 tiene dos
calidades), una merma y una pérdida, 3 clientes con tipo y 4 ventas: exportación con anticipo aplicado, entregada y con
pago parcial; congelado con dos lotes, entregada en dos viajes y pagada; mercado nacional con descuento, vencida y sin
pagar; y un borrador.

1. **Producción → Registrar corte:** elige proyecto y parcela (el cultivo se toma del proyecto), unidad *Cajas* con su
   peso neto, calidad, clasificación, responsable y fotografías. Se crea el lote `LOT-AAAA-0006`; si registras otra
   calidad el mismo día, comparte el número de corte. *Indicadores* muestra cortes, producción por parcela, fecha y
   calidad, rendimiento por hectárea, vendido, mermas y disponible; filtra por periodo y proyecto.
2. **Inventario de producto:** existencia por lote (inicial − vendido − mermas). Registra una *merma* o *pérdida* con
   justificación (no puede exceder lo disponible) y revísala en *Movimientos*; *Revertir* crea la contrapartida. Un
   lote con ventas no se elimina ni cambia de origen, y su cantidad no baja de lo vendido.
3. **Trazabilidad:** abre un lote (ícono de ruta): labores de campo de su parcela hasta el corte, movimientos y ventas
   con cliente.
4. **Ventas → Nueva venta:** agrega partidas de lotes distintos (incluso de otro cultivo), en cajas, toneladas o kg,
   con descuento. *Guardar borrador* no descuenta producto; *Confirmar venta* descuenta los lotes en una transacción.
   Prueba confirmar dos borradores que juntos exceden un lote: el segundo se rechaza.
5. **Detalle de venta:** registra una *entrega* parcial y luego el resto (estado *Entregada*); registra un *pago*
   parcial con comprobante (imagen o PDF); en el borrador `VTA-AAAA-0004` registra un *anticipo*, confírmalo y usa
   *Aplicar* para que cuente como pagado. *Cancelar* una venta con pagos se rechaza; cancela primero el pago (queda en
   el historial) y luego la venta: su producción regresa a los lotes con un movimiento de reversión.
6. **Cobranza:** total vendido, pagado, saldo, % de recuperación, último pago, vencidos, antigüedad por cliente,
   anticipos pendientes de aplicar y pagos del periodo con comprobantes.
7. **Clientes:** tipo de cliente y expediente con compras, pagos, saldos y producto comprado por lote.
8. **Dashboard comercial:** indicadores y gráficas de producción por cultivo y proyecto, ventas mensuales, ventas por
   cliente, cobranza por periodo y saldos pendientes, filtrables por fechas, cultivo y proyecto.
9. **Expediente del proyecto:** tarjetas *Producción* (cortes, lotes, disponible) y *Ventas y cobranza* (valor vendido
   vs. cobrado, ventas por lote y parcela, pagos recibidos).
10. **Permisos:** `agronomo@…` y `campo@…` registran cortes y mermas pero no ven ventas, folios ni importes;
    `consulta@…` ve todo sin poder capturar.
11. **Pruebas:** `npm test` y `npm run test:db` (incluye `05_commercial.test.sql`).

## Cómo probar la Fase 5 (administración financiera y rentabilidad)

Los datos demo incluyen presupuestos por categoría de los 4 proyectos (brócoli con una revisión que conserva la versión
original), 9 gastos directos (algunos pagados), 2 gastos compartidos (asesoría por superficie y reparación de bomba por
porcentaje), pagos parciales de gastos, 3 pagos a proveedores de almacén, un apoyo estatal y un egreso cancelado.

1. **Presupuestos:** el listado muestra versión vigente, costo real, % utilizado y alertas (maíz: semilla al 104 %, brócoli:
   plántula al 100 %, transporte al 95 %). En brócoli abre *Versiones* → versión 1 (original) y compárala contra el gasto
   real. *Nueva revisión* parte de la versión vigente y exige motivo; si otra persona guardó antes, se rechaza.
2. **Alertas:** *Alertas* cambia los umbrales (70 / 90 / 100 % por omisión) y los estados se recalculan.
3. **Gastos:** *Registrar gasto* con tipo, categoría presupuestal (solo las que no nacen en otro módulo), proveedor, factura,
   método de pago, responsable y comprobante. Elige *Compartido por superficie* con dos o tres proyectos: la vista previa
   muestra el reparto exacto (centavos incluidos). Marca *Ya está pagado* o déjalo por pagar y usa *Pagar* después. La
   misma factura del mismo proveedor se rechaza; un gasto con pagos no se cancela.
4. **Expediente del proyecto:** costo por las 7 clases, presupuesto con estado, costo por ha, kg y t, ventas, cobrado, por
   cobrar, resultado estimado y producto en existencia a costo. El *Detalle de costos* indica origen, clase y categoría.
5. **Rentabilidad:** por proyecto (presupuesto inicial, gastos reales, costo acumulado, producción, rendimiento, costo
   unitario, ventas, cobrado, pendiente, margen) y por cultivo, con los criterios de cálculo.
6. **Flujo de efectivo:** ingresos (cobros, anticipos y otros) contra egresos (pagos de gastos, a proveedores y otros); los
   gastos sin pagar aparecen en *Por pagar*, no como egreso. *Registrar movimiento* captura pagos a proveedor y otros.
   Filtra por proyecto: cobros y pagos compartidos se prorratean.
7. **Dashboard financiero:** inversión, presupuesto, costos del periodo, % utilizado, ventas, cobranza, por cobrar y
   resultado; gráficas de presupuesto contra real, costos por clase y proyecto, evolución, ventas contra cobranza,
   rentabilidad, costo por ha y por kg; comparación de proyectos.
8. **Reportes financieros:** 10 reportes con filtros de periodo, cultivo y proyecto; *CSV*, *Excel* (.xlsx con números y
   fechas reales) y *PDF* (imprime solo el reporte abierto).
9. **Permisos:** `agronomo@…` y `campo@…` no ven el módulo financiero; `consulta@…` lo ve sin botones de captura.
10. **Pruebas:** `npm test` (126) y `npm run test:db` (391, incluye `06_financial.test.sql`).

## Cómo probar la Fase 6 (PWA, sin conexión y producción)

1. **Instalar:** `npm run build && npm start` (el service worker solo se registra en producción). En Chrome aparece
   *Instalar app* en la barra superior; en iPhone, Safari → Compartir → *Agregar a pantalla de inicio*.
2. **Captura en campo:** entra como `campo@demo.agrogestion360.mx` y abre *Operación → Captura en campo* (`/campo`). La
   primera visita descarga proyectos, parcelas y catálogos al dispositivo.
3. **Sin conexión:** DevTools → Network → *Offline* (o modo avión) y recarga `/campo`: abre sin red. Registra un riego,
   una actividad, una aplicación, una observación con foto y un corte: quedan como *Pendiente* en *Registros*.
4. **Sincronizar:** vuelve a poner la red: pasan a *Sincronizado* con su fecha, las fotos se cargan y los registros
   aparecen en Bitácoras (pestaña *Observaciones* para las observaciones) y en Producción.
5. **Conflictos:** registra una aplicación que descuente del almacén más de lo que hay, o un riego con fecha anterior al
   proyecto: queda *Requiere revisión* con el motivo; no se descuenta nada. *Corregir* y *Reintentar* lo resuelven.
6. **Revisión:** como `agronomo@…` o `propietario@…`, *Operación → Sincronización* muestra los rechazos de todo el
   equipo; *Descartar* exige motivo y el dispositivo lo verá en su siguiente intento.
7. **Plan:** *Configuración → Organización* muestra el plan (*Piloto*, sin límites) y el uso.
8. **Pruebas:** `npm test` (145), `npm run test:db` (436), `npm run test:integration` (45), `npm run test:e2e` (23).

## Seguridad

- En el navegador solo se exponen `NEXT_PUBLIC_SUPABASE_URL` y la clave *publishable*.
- `SUPABASE_SECRET_KEY` solo se usa en el servidor (`src/lib/supabase/admin.ts`, marcado
  con `server-only`) y únicamente tras verificar permisos.
- Todas las tablas tienen RLS; las escrituras sensibles pasan por funciones SQL
  transaccionales que validan rol y organización.
- Encabezados de seguridad (CSP, `X-Frame-Options`, `nosniff`, HSTS en producción) en `next.config.ts`.
- El service worker no guarda respuestas de la API ni de Supabase; los datos sin conexión viven en IndexedDB por
  usuario y se limpian al cerrar sesión.
- Auditoría completa en [docs/seguridad.md](docs/seguridad.md).
