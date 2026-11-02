# AgroGestión 360

Plataforma SaaS multiempresa para la administración integral de proyectos agrícolas:
planeación, insumos, bitácoras de campo, maquinaria, personal, cosechas, ventas,
cobranza y rentabilidad.

**Estado:** Fase 2 (Producción agrícola) completada. Ver [docs/arquitectura.md](docs/arquitectura.md)
y [docs/decisiones.md](docs/decisiones.md).

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

## Seguridad

- En el navegador solo se exponen `NEXT_PUBLIC_SUPABASE_URL` y la clave *publishable*.
- `SUPABASE_SECRET_KEY` solo se usa en el servidor (`src/lib/supabase/admin.ts`, marcado
  con `server-only`) y únicamente tras verificar permisos.
- Todas las tablas tienen RLS; las escrituras sensibles pasan por funciones SQL
  transaccionales que validan rol y organización.
