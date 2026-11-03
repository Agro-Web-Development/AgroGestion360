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
| 24 | El costo de insumos nace en el **consumo**, no en la compra; las salidas se valoran a costo promedio ponderado. | Evita contar dos veces una compra y permite comprar para varios proyectos. Promedio en lugar de PEPS: aún no hay lotes y es el método usual en el campo. |
| 25 | El producto guarda `stock` y `stock_value`; el costo promedio es columna derivada. | Valor de almacén + costo imputado cuadra al centavo con las compras; no se acumulan residuos de redondeo. |
| 26 | Movimientos de inventario, ventas y pagos son **inmutables**: se anulan o cancelan con contrapartida y motivo. | Trazabilidad completa; los saldos siempre se explican con el historial. |
| 27 | Identificadores generados en el cliente como **llave de idempotencia**. | Doble clic o reintentos de red no duplican costos, ventas ni pagos; prepara la captura sin conexión (Fase 6). |
| 28 | Gastos directos con catálogo cerrado de categorías que excluye insumos, maquinaria y mano de obra. | Cada costo tiene una sola vía de captura. |
| 29 | Tarifas de maquinaria y mano de obra **congeladas** en cada registro. | Cambiar una tarifa no reescribe costos históricos. |
| 30 | Un proyecto cerrado o cancelado no admite crear, modificar ni eliminar costos, cosechas ni ventas. | El cierre deja cifras definitivas; para corregir, un administrador reabre el proyecto. Los **pagos** sí se registran después del cierre (son cobranza, no ingreso). |
| 31 | Cosechas y ventas en **kilogramos**; lo vendido por proyecto ≤ lo cosechado. | Base común para costo por kg y disponible para venta, sin importar la unidad comercial del cultivo (cajas, toneladas). |
| 32 | Ventas sin IVA (tasa 0 %). | Productos agrícolas sin transformar; CFDI fuera de alcance. |
| 33 | Clientes, ventas, pagos y gastos solo los leen propietario, administrador, finanzas y consulta; el expediente muestra costos solo a esos roles. | Por la RLS un agrónomo vería cifras incompletas (sin gastos ni ventas); se prefiere no mostrar totales parciales. |
| 34 | Un empleado registra máximo 1 jornal por día entre todos los proyectos; el tiempo extra se registra como destajo. | Evita pagar o costear dos veces la misma jornada. |
| 35 | La Fase 3 **amplía** inventario, maquinaria y personal existentes (columnas y tablas nuevas, datos migrados) en lugar de crear módulos paralelos. | No duplicar tablas ni componentes; los costos de la fase financiera siguen cuadrando al centavo. |
| 36 | Categorías de insumo configurables con una **clasificación fija** (`input_kind`). | La organización nombra sus categorías, pero las reglas (qué se aplica en campo, qué es combustible) no dependen de un texto editable. |
| 37 | Costo promedio ponderado **por producto**, no por almacén; existencias por almacén y lote. | Una transferencia no cambia el valor del inventario ni el costo de ningún proyecto; el promedio por almacén complicaría las transferencias sin beneficio para el usuario. |
| 38 | Lotes opcionales por producto (`track_lots`), obligatorios en entradas y salidas cuando se activan. | Semillas, agroquímicos y biológicos requieren trazabilidad y caducidad; fertilizantes a granel o diésel no. |
| 39 | Movimientos de inventario inmutables también para el dueño de la BD (trigger). | La regla "no eliminar movimientos históricos" no depende solo de los permisos de la API. |
| 40 | La aplicación de agroquímicos genera su propia salida de almacén en la misma transacción; la RPC verifica el rol de campo, no el de almacén. | El aplicador registra una sola vez; el almacén no tiene que capturar el consumo por separado y no puede duplicarse. Para corregirla se cancela (regresa el producto) y no se anula desde el almacén. |
| 41 | El sistema registra lo aplicado (cantidad, superficie, cantidad/ha, reentrada, intervalo de seguridad) y **no recomienda dosis ni tratamientos**. | Requisito explícito; la responsabilidad técnica es del agrónomo y de la etiqueta del producto. |
| 42 | Mantenimientos y reparaciones son costo del equipo, no del proyecto. | El proyecto paga la maquinaria con su tarifa (que incluye mantenimiento); cargar también el mantenimiento lo contaría dos veces. El reporte de maquinaria compara lo cargado con lo gastado. |
| 43 | Tarifa de maquinaria por hora o por jornada, elegida en cada registro; las horas siempre se capturan. | Hay equipos que se rentan por jornada; las horas alimentan las alertas de mantenimiento. |
| 44 | Combustible surtido del almacén al registrar uso de maquinaria (opcional). Eliminar el uso devuelve el combustible. | El combustible queda como insumo del proyecto y su existencia se descuenta, sin capturas dobles. |
| 45 | El costo de una actividad de campo es solo un **costo adicional** (servicio contratado u otro sin módulo propio) y forma la fuente `actividades`. | Las labores con jornales, maquinaria o insumos ya tienen costo en su módulo; la interfaz lo advierte junto al campo. |
| 46 | Bitácoras y mantenimientos se **cancelan** con motivo; no se eliminan ni se editan cancelados. | Trazabilidad; el costo de una actividad cancelada deja de contar. |
| 47 | Asistencia y jornadas coherentes en la BD; registrar trabajo marca asistencia automáticamente. | Evita pagar trabajo a quien faltó y ahorra la doble captura en campo. |
| 48 | Cuadrillas: una jornada por integrante, creada en una sola RPC idempotente (`batch_id`). | Mantiene el costo por persona y la regla de 1 jornal/día; un reintento no duplica la cuadrilla. |
| 49 | Evidencias: el navegador sube directo a Storage (bucket privado) y el servidor registra el archivo; se muestran con URL firmada de 30 min. | Evita el límite de tamaño de las Server Actions; la RLS de Storage valida organización y rol por la ruta y la BD verifica que el archivo exista. Las fotos se suben después de guardar el registro, para que una mala conexión no impida capturar la bitácora. |
| 50 | Filtros de periodo y proyecto en la URL (`next/form`), validados en el servidor; la pestaña activa también va en la URL. | Las consultas traen solo el periodo pedido, la vista se puede compartir o recargar y los parámetros nunca llegan sin validar a PostgREST. |
| 51 | Reportes operativos sin gastos directos ni ventas, visibles para todos los miembros; exportación CSV. | Todo lo que agregan lo pueden leer todos los roles por RLS, así que no hay totales parciales (decisión 33). XLSX/PDF quedan para la Fase 5. |

## Pendientes conocidos

- Las plantillas de correo de Supabase local están en inglés; se traducirán al configurar
  el proyecto de producción (`supabase/templates/`).
- Los registros de costo (uso de maquinaria y jornadas) se corrigen eliminando y volviendo a capturar (mientras el
  proyecto esté vigente); no hay edición en la interfaz. Las bitácoras, catálogos, mantenimientos, asistencia y
  asignaciones sí se editan.
- Las vistas de campo (`v_project_timeline`) muestran importes solo a los roles con `finance.read`, igual que el
  expediente.
- Las listas de movimientos y registros muestran los 200–300 más recientes; falta paginación y filtro por
  fechas.
- `npm audit` reporta vulnerabilidades moderadas en dependencias de desarrollo
  transitivas del generador; se revisarán antes del despliegue (Fase 6).
