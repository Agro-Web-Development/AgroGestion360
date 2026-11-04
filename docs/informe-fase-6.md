# Informe final · Fase 6: preparación comercial y puesta en producción

AgroGestión 360 · noviembre de 2026

**Resultado:** la plataforma compila, pasa 649 pruebas automatizadas (unitarias, de base de datos, de integración y de
extremo a extremo) y queda lista para **pruebas piloto con productores**, con las condiciones de configuración de
producción descritas en la sección 6.

## 1. Funcionalidades terminadas

### PWA
- Manifiesto (nombre, colores, íconos normal y *maskable*, accesos directos), íconos generados del logotipo.
- Service worker propio: recursos estáticos en caché, navegación con respaldo sin conexión, sin guardar API, Server
  Actions, datos RSC ni nada de Supabase. Versión en `public/sw.js`.
- Botón *Instalar app* (aviso nativo en Chrome/Edge/Android; instrucciones en iPhone/iPad), indicador de conexión y de
  registros por sincronizar en la barra superior, metadatos para iOS y pantalla «Sin conexión».

### Captura sin conexión
- Pantalla **Captura en campo** (`/campo`), utilizable con o sin red, pensada para celular: bitácoras de riego,
  actividades, aplicaciones de agroquímicos, **observaciones** (nuevo registro con categoría, severidad y ubicación),
  cortes de producción y fotografías.
- IndexedDB con id local, organización, usuario, fecha de captura, tipo, datos capturados, estado, intentos, error y fecha
  de sincronización; fotos reducidas y pendientes de carga.
- Estados *Pendiente, Sincronizando, Sincronizado, Error, Requiere revisión*; pantalla de registros con corregir,
  reintentar y eliminar.
- Sincronización idempotente (id local = id del registro), confirmada solo por el servidor, reintentos automáticos con
  espera creciente, un solo envío entre pestañas, Background Sync donde existe.
- Revalidación completa en el servidor (esquema, rol, organización, reglas, existencias). Conflictos detectados por
  huella del contenido. Revisión por usuarios autorizados en **Sincronización** (`/sincronizacion`) con descarte motivado.
- No se capturan sin conexión ventas, pagos, gastos ni movimientos de inventario.

### Seguridad
- Auditoría completa ([seguridad.md](seguridad.md)); 7 hallazgos corregidos (sección 3).
- Encabezados de seguridad, redirecciones seguras, API con 401/403 en JSON y verificación de origen.

### Optimización
- Consultas de más de 1,000 filas paginadas (corrige reportes truncados).
- 22 índices de llaves foráneas; listados con filtros de periodo en el servidor.
- Fotos reducidas a 1920 px antes de subir (en línea y sin conexión).
- Gráficas sin cambios: Recharts ya recibe datos agregados en SQL o en funciones puras.
- Versión móvil verificada en 8 pantallas sin desplazamiento horizontal.

### Comercialización SaaS
- Planes con límites de proyectos vigentes, usuarios, almacenamiento y funciones; plan *Piloto* sin límites; uso visible
  en *Configuración → Organización*. Arquitectura del módulo de suscripciones documentada; sin cobros.

### Documentación y despliegue
- README, arquitectura, base de datos (diagrama ER, migraciones, RLS), PWA y sin conexión, seguridad, despliegue (Vercel +
  Supabase, entornos, dominio, migraciones, respaldos), SaaS, solución de errores, decisiones 75–88.
- Integración continua (`.github/workflows/ci.yml`) con Supabase local.

## 2. Pruebas realizadas

| Tipo | Herramienta | Archivos | Pruebas | Resultado |
| ---- | ----------- | -------- | ------- | --------- |
| Unitarias | Vitest | 9 | 145 | ✅ |
| Base de datos y RLS | pgTAP | 7 | 436 (45 nuevas) | ✅ |
| Integración (usuarios reales, Supabase local) | Vitest | 2 | 45 | ✅ |
| Extremo a extremo (navegador) | Playwright, Chrome escritorio y Pixel 7 | 4 | 23 | ✅ |
| Compilación de producción | `next build` | — | 53 rutas | ✅ |
| Tipos y estilo | `tsc`, ESLint | — | — | ✅ sin errores |
| Dependencias de producción | `npm audit --omit=dev` | — | — | ✅ 0 vulnerabilidades |

Procesos validados (integración con cuentas reales de cinco roles y dos organizaciones):

| # | Proceso | # | Proceso |
| - | ------- | - | ------- |
| 1 | Registro e inicio de sesión | 10 | Registro de cortes |
| 2 | Creación de organización | 11 | Control de lotes (folio, kg, disponible) |
| 3 | Proyecto agrícola | 12 | Ventas (confirmación) |
| 4 | Parcelas (superficie) | 13 | Existencias de producto |
| 5 | Entradas y salidas de inventario | 14 | Pagos parciales |
| 6 | Consumo de insumos (costo promedio) | 15 | Cuentas por cobrar |
| 7 | Bitácoras | 16 | Costos de producción |
| 8 | Asignación de trabajadores | 17 | Rentabilidad |
| 9 | Maquinaria (tarifa congelada) | 18 | Separación entre organizaciones (tablas, vistas, RPC, FKs, Storage) |

Situaciones incorrectas probadas: datos incompletos, cantidades y superficies negativas, existencias insuficientes,
ventas superiores a lo disponible, pagos superiores al saldo, más de 24 h de maquinaria por día, usuario sin permisos
(supervisor, consulta, almacén), organización incorrecta, solicitudes duplicadas (movimientos, pagos y registros sin
conexión), conflicto de contenido, fallas de red durante la sincronización, sesión expirada, registros de otro usuario,
rutas de archivo ajenas, formatos de archivo no permitidos, redirecciones a otro dominio, escrituras de otro origen.

En navegador: inicio y cierre de sesión, redirección segura, encabezados, manifiesto e íconos, instalación del service
worker y contenido de la caché, captura sin red → sincronización al volver la conexión → visible en Bitácoras, rechazo
del servidor → *Requiere revisión* → visible en Sincronización, aviso «Sin conexión» en otras páginas, usuario de
consulta sin captura y versión móvil.

## 3. Errores corregidos

| Error | Impacto | Corrección |
| ----- | ------- | ---------- |
| Redirección abierta en `/auth/callback` e inicio de sesión (`next=/\dominio`) | Phishing tras autenticarse | `lib/safe-redirect.ts` |
| Reportes, cobranza y flujo de efectivo truncados a 1,000 filas sin aviso (`max_rows` de PostgREST) | Totales financieros incompletos con más datos (una temporada de jornales lo supera) | `lib/supabase/rows.ts` + orden total |
| Política de Storage permitía borrar archivos sin membresía vigente y comprobantes por finanzas | Pérdida de evidencias | Nueva política + pgTAP |
| Sin encabezados de seguridad | Enmarcado, *sniffing*, orígenes no controlados | `next.config.ts` |
| Registro de varias evidencias: si una ya existía, las demás no se registraban y se reportaba éxito | Fotos huérfanas en Storage | `upsert … ignoreDuplicates` |
| `/produccion` y `/personal` leían el reloj antes de la sesión | Error de prerenderizado en producción | Orden de lectura |
| CLI `shadcn` en dependencias de producción (dependencias transitivas vulnerables) | Superficie de ataque innecesaria | `devDependencies` |
| La API sin sesión redirigía a HTML | El dispositivo no distinguía sesión vencida de falla de red | 401 JSON |

## 4. Errores y limitaciones pendientes

Sin errores críticos conocidos. Limitaciones:

- Listados operativos sin navegación por páginas (filtran por periodo en el servidor y muestran los más recientes).
- Sin conexión no se capturan jornadas ni uso de maquinaria; las observaciones no aparecen todavía en la cronología del
  proyecto; las fotos de un registro pendiente no se editan (se agregan después desde Evidencias).
- Plantillas de correo de Supabase en inglés (se configuran en el proyecto de producción).
- Las pruebas de navegador no recorren con clics los formularios de ventas, pagos y gastos (sí se prueban con usuarios
  reales en la capa de datos y en pgTAP).
- Vulnerabilidades moderadas solo en dependencias de desarrollo (CLI de shadcn).

## 5. Riesgos identificados

| Riesgo | Probabilidad | Impacto | Mitigación |
| ------ | ------------ | ------- | ---------- |
| El navegador borra datos sin sincronizar (Safari borra datos de sitios no instalados tras 7 días sin uso; espacio lleno) | Media en iPhone | Alto | Instalar la PWA (obligatorio en iOS para el personal de campo); se solicita almacenamiento persistente; indicador de pendientes; sincronizar diario. |
| iOS sin Background Sync | Alta | Bajo | Se sincroniza al abrir la app o recuperar la red. |
| Dispositivos compartidos | Media | Medio | Un usuario por dispositivo; la sesión y catálogos se borran al salir; pendientes solo visibles para su autor. |
| Catálogos desactualizados en campo (proyecto cerrado, existencia agotada) | Media | Bajo | El servidor revalida; queda en revisión sin efecto; botón *Actualizar*. |
| Configuración de producción incompleta (confirmación de correo, SMTP, URLs) | Media | Alto | Lista de verificación en [despliegue.md](despliegue.md) y [seguridad.md](seguridad.md). |
| Volumen de datos de un cliente grande | Baja en piloto | Medio | Índices, paginación de reportes, límites por plan; monitorear tiempos en Supabase. |
| Plan gratuito de Supabase (pausa por inactividad, sin respaldos) | — | Alto | Usar plan Pro en producción. |
| CSP con scripts en línea | Baja | Medio | Sin HTML de usuario sin escapar; revisar al soportar nonces con prerenderizado. |

## 6. Configuración necesaria para producción

- Supabase **Pro** (respaldos diarios; PITR recomendado), región `us-east-1` o `us-west-1`.
- Migraciones con `supabase db push` (sin `seed.sql`).
- Auth: confirmación de correo, cambio seguro de contraseña, protección de contraseñas filtradas, Site URL y Redirect URLs
  del dominio, SMTP propio con plantillas en español; `max_rows` = 1000.
- Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` y
  `SUPABASE_SECRET_KEY` (*Sensitive*), por entorno; proyecto Supabase separado para vistas previas.
- Dominio propio con HTTPS (Vercel) y actualización de URLs en Supabase.
- Recomendado: Vercel Firewall con límite a `/api/campo/*`, CAPTCHA en registro, MFA para propietarios.

## 7. Instrucciones para desplegar

Resumen (detalle en [despliegue.md](despliegue.md)):

```bash
npx supabase login
npx supabase link --project-ref <ref-produccion>
npx supabase db push --dry-run && npx supabase db push
# Vercel: importar el repositorio, configurar variables, desplegar main
# Dominio: Vercel → Domains → CNAME; actualizar NEXT_PUBLIC_SITE_URL y URLs de Supabase Auth
```

Cada despliegue posterior: CI en verde → respaldo si hay migración → `db push` → merge a `main`. Nada destructivo en
producción; las correcciones son migraciones nuevas.

## 8. Recomendaciones para comercializar

1. **Piloto de 6–8 semanas con 2 o 3 productores** de distinto tamaño, en el plan *Piloto*, con un responsable de campo
   por productor y la PWA instalada en sus teléfonos. Medir: registros capturados sin conexión, conflictos en revisión,
   tiempo de captura, cortes y ventas registrados, y diferencias entre el costo calculado y su control actual.
2. **Capacitación corta por rol** (supervisor: captura en campo; almacén: entradas; finanzas: ventas y cobranza;
   propietario: rentabilidad). El manual de errores sirve de guía de soporte.
3. **Migración inicial de datos**: plantilla de importación de ranchos, parcelas, insumos y personal (hoy la captura es
   manual) para acortar el alta de un cliente.
4. **Planes por valor, no por módulo técnico**: por ejemplo por hectáreas o proyectos vigentes y usuarios; la estructura
   de `plans` ya lo permite. Definir precios con los resultados del piloto.
5. **Antes de cobrar**: módulo de suscripciones (proveedor de pago con webhooks, modo de solo lectura al vencer, CFDI),
   aviso de privacidad y términos de servicio, contrato de tratamiento de datos, y soporte con tiempos de respuesta.
6. **Diferenciadores para la venta**: funcionamiento sin señal en campo, costo real por hectárea y por kilo sin doble
   captura, trazabilidad lote → parcela → aplicaciones → cliente (útil para exportación e inocuidad), y separación
   estricta de datos por empresa.
7. **Siguientes funciones con más valor**: jornadas y maquinaria sin conexión, importación de datos, cronología con
   observaciones, reportes de inocuidad (intervalos de seguridad por lote vendido) y notificaciones de alertas.
