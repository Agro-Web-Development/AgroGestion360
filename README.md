# AgroGestión 360

Plataforma SaaS multiempresa para la administración integral de proyectos agrícolas:
planeación, insumos, bitácoras de campo, maquinaria, personal, cosechas, ventas,
cobranza y rentabilidad.

**Estado:** Fases 1–4 completas: control operativo (inventario con almacenes, lotes y transferencias; bitácoras;
maquinaria; personal; reportes), módulos financieros (gastos y rentabilidad) y producción y comercialización (cortes y
lotes de producción, inventario de producto con mermas, ventas con borrador y entregas, pagos y anticipos, cuentas por
cobrar, trazabilidad por lote y dashboard comercial). Ver
[docs/arquitectura.md](docs/arquitectura.md) y [docs/decisiones.md](docs/decisiones.md).

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 ·
shadcn/ui · Lucide · Recharts · React Hook Form + Zod · Supabase (PostgreSQL, Auth,
Storage, RLS) · Vitest · pgTAP.

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

## Scripts

| Script               | Descripción                                             |
| -------------------- | ------------------------------------------------------- |
| `npm run dev`        | Servidor de desarrollo                                  |
| `npm run build`      | Compilación de producción                               |
| `npm run lint`       | ESLint                                                  |
| `npm run typecheck`  | Verificación de tipos                                   |
| `npm test`           | Pruebas unitarias (Vitest)                              |
| `npm run test:db`    | Pruebas de base de datos y RLS (pgTAP)                  |
| `npm run db:reset`   | Recrea la BD local: migraciones + datos demo            |
| `npm run db:types`   | Regenera `src/types/database.ts` desde el esquema local |

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
3. **Gastos y rentabilidad:** gastos directos por categoría (sin insumos, maquinaria ni mano de obra, que
   vienen de su módulo); la misma factura no se acepta dos veces en un proyecto. La pestaña de
   rentabilidad muestra costo de producción, costo/ha, costo/kg, ventas y utilidad por proyecto.
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
11. **Pruebas:** `npm test` (101) y `npm run test:db` (315, incluye `05_commercial.test.sql`).

## Seguridad

- En el navegador solo se exponen `NEXT_PUBLIC_SUPABASE_URL` y la clave *publishable*.
- `SUPABASE_SECRET_KEY` solo se usa en el servidor (`src/lib/supabase/admin.ts`, marcado
  con `server-only`) y únicamente tras verificar permisos.
- Todas las tablas tienen RLS; las escrituras sensibles pasan por funciones SQL
  transaccionales que validan rol y organización.
