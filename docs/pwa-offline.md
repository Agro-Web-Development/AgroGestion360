# PWA y captura sin conexión

## Instalación (PWA)

| Pieza                    | Archivo                                    | Notas                                                                      |
| ------------------------ | ------------------------------------------ | -------------------------------------------------------------------------- |
| Manifiesto               | `src/app/manifest.ts` → `/manifest.webmanifest` | Nombre, colores, `start_url: /dashboard`, accesos directos (Campo, Bitácoras, Producción). |
| Íconos                   | `public/icons/` (192, 512, maskable 512, apple-touch 180, SVG) | Generados del logotipo (brote) con `sharp`.                    |
| Service worker           | `public/sw.js`                              | Se sirve con `Cache-Control: no-cache` para que cada despliegue se instale. |
| Registro                 | `src/components/pwa/service-worker.tsx`    | Solo en producción (o con `NEXT_PUBLIC_ENABLE_SW=1`).                      |
| Botón «Instalar app»     | `src/components/pwa/install-prompt.tsx`    | Aviso nativo en Chrome/Edge/Android; instrucciones en iPhone/iPad.         |

Requisitos para instalar: HTTPS (Vercel lo da por omisión) y un navegador compatible. En iOS la instalación es desde
Safari → Compartir → *Agregar a pantalla de inicio*.

## Estrategia de caché

| Solicitud                                              | Estrategia                                     |
| ------------------------------------------------------ | ---------------------------------------------- |
| `/_next/static/*`, `/icons/*`, manifiesto, favicon     | Caché primero (archivos con huella, inmutables), máx. 400 entradas. |
| Navegación                                             | Red primero; sin red: `/campo` desde caché o la página `/offline`. |
| `/campo` y `/offline`                                  | Se guardan en `ag360-shell-v1` con sus recursos. Son **estáticas**: no contienen datos de la sesión. |
| `/api/*`, `/auth/*`, Server Actions (POST), RSC (`RSC: 1`, `?_rsc`) | **Nunca** se guardan.                 |
| Otro origen (Supabase: datos, Auth, Storage)           | **Nunca** se interceptan ni guardan.           |

Las respuestas de la API llevan `Cache-Control: private, no-store`. Al cerrar sesión se borran el shell guardado y los
catálogos del dispositivo.

Para publicar un cambio incompatible del service worker, incrementa `VERSION` en `public/sw.js`: la activación borra las
cachés anteriores.

## Captura sin conexión

Pantalla: **`/campo`** («Captura en campo», también en el menú lateral). Funciona con o sin red: con red, cada registro se
envía de inmediato; sin red, se guarda en el dispositivo y se envía al volver la conexión.

Registros admitidos (los mismos esquemas Zod que la aplicación en línea):

| Tipo                       | Tabla destino            | Permiso            |
| -------------------------- | ------------------------ | ------------------ |
| Bitácora de riego          | `irrigation_logs`        | `fieldlogs.write`  |
| Actividad agrícola         | `field_activities`       | `fieldlogs.write`  |
| Aplicación de agroquímicos | `chemical_applications` (+ salida de almacén) | `fieldlogs.write` |
| Observación                | `field_observations`     | `fieldlogs.write`  |
| Corte de producción        | `harvests` (lote)        | `harvest.write`    |
| Fotografías de cualquiera  | Storage + `attachments`  | rol de captura     |

**No** se capturan sin conexión ventas, pagos, gastos ni movimientos de inventario. Una aplicación que «descuenta del
almacén» se valida de nuevo en el servidor (existencia, lote, proyecto vigente) al sincronizar: si ya no alcanza, el
registro queda en revisión y no se descuenta nada.

### Almacenamiento local (IndexedDB `agrogestion360-campo`)

| Almacén   | Contenido                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------- |
| `records` | Registro: id local, organización, usuario, fecha de captura, tipo, datos capturados, estado, intentos, error, fecha de sincronización. |
| `photos`  | Fotografías (Blob, reducidas a 1920 px JPEG) ligadas al registro, con su estado de carga.       |
| `meta`    | Sesión y catálogos descargados (proyectos vigentes y parcelas, actividades, personal, productos aplicables, almacenes, lotes con existencia, maquinaria). Sin importes ni datos financieros. |

### Estados

```
pendiente ──► sincronizando ──► sincronizado        (el servidor confirmó)
                   │
                   ├──► error               falla de red / servidor / sesión: reintento automático con espera creciente (15 s … 30 min)
                   └──► requiere_revision   regla de negocio, conflicto o descartado: espera al usuario
```

### Reglas de sincronización

- **Idempotencia:** el id local es el id del registro en el servidor y la clave de `offline_submissions`. Reenviar
  (doble envío, pestañas, reintentos) nunca duplica.
- **Confirmación:** el dispositivo marca «sincronizado» solo con la respuesta 200 `sincronizado` del servidor.
- **Errores:** los registros con error o en revisión se conservan hasta que el usuario los corrija, reintente o elimine.
- **Conflictos:** si un id ya sincronizado llega con otro contenido (huella SHA-256 del contenido canónico), se conserva
  la versión del servidor y el dispositivo muestra el conflicto.
- **Revisión:** los rechazos quedan en `offline_submissions` con su motivo. En **/sincronizacion** los revisores
  (propietario, administrador, agrónomo) los ven, corrigen la causa (asignar parcela, registrar entrada al almacén,
  reabrir proyecto) para que el dispositivo los reintente, o los **descartan** con motivo.
- **Usuario y organización:** cada registro guarda su autor y organización. Solo se envía con la sesión de su autor; si
  ya no pertenece a la organización o su rol ya no lo permite, queda en revisión.
- **Un solo envío a la vez** entre pestañas (Web Locks). Disparadores: al abrir, al recuperar la red, al volver a la
  pestaña, cada minuto y Background Sync donde el navegador lo soporta.
- **API estable:** la sincronización usa Route Handlers (`/api/campo/*`), no Server Actions, para que una página en caché
  de una versión anterior siga sincronizando después de un despliegue.

### API

| Ruta                          | Método | Respuesta                                                                                     |
| ----------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| `/api/campo/contexto`         | GET    | Sesión, permisos y catálogos de la organización activa. 401 sin sesión.                       |
| `/api/campo/sincronizar`      | POST   | `{localId, organizationId, userId, type, capturedAt, payload}` → 200 `sincronizado` / `requiere_revision`; 400 mal formada; 401 sesión; 403 origen; 503 transitoria. |
| `/api/campo/evidencias`       | POST   | Registra fotos ya subidas a Storage para un registro sincronizado. 422 si se rechaza (p. ej. límite de almacenamiento). |

### Privacidad en dispositivos compartidos

- Al cerrar sesión se borran sesión y catálogos; si hay registros sin sincronizar se avisa y se conservan (son datos de
  campo que no deben perderse) y solo se muestran y envían cuando vuelve a entrar su autor.
- Un registro se puede eliminar del dispositivo desde «Registros»; los no sincronizados piden confirmación.

### Cómo probar

1. `npm run build && npm start` (el service worker solo se registra en producción).
2. Inicia sesión como `campo@demo.agrogestion360.mx` y abre **Captura en campo** (descarga catálogos y guarda la pantalla).
3. En DevTools → Network → *Offline* (o modo avión), recarga `/campo`: abre sin red.
4. Registra una observación con foto: aparece como *Pendiente*.
5. Vuelve a poner la red: pasa a *Sincronizado* y aparece en Bitácoras → Observaciones con su foto.
6. Registra un riego con fecha anterior al proyecto: queda en *Requiere revisión* y aparece en **Sincronización**.

Las pruebas automáticas cubren lo mismo: `tests/unit/offline.test.ts`, `tests/integration/offline-sync.test.ts`,
`supabase/tests/database/07_platform.test.sql` y `tests/e2e/offline.spec.ts`.
