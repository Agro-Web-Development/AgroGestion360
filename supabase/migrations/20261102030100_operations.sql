-- =============================================================================
-- AgroGestión 360 · Migración 0004 · Control operativo agrícola
--
-- Amplía los módulos operativos existentes (no los reemplaza):
--   · Inventario: categorías configurables, almacenes, proveedores, lotes con
--     caducidad, existencias por almacén/lote y transferencias. La valoración
--     sigue siendo costo promedio ponderado por producto; cada movimiento
--     conserva su costo histórico.
--   · Bitácoras: riego, aplicaciones de agroquímicos (ligadas a la salida de
--     almacén que generan) y actividades con catálogo configurable.
--   · Maquinaria: ficha técnica, estado, tarifas por hora o jornada,
--     combustible surtido del almacén, mantenimientos y alertas.
--   · Personal: tipo de trabajador, asistencia, cuadrillas y asignaciones.
--   · Evidencias fotográficas en Storage (bucket privado `evidencias`).
--
-- Reglas de costo (sin duplicidad):
--   · El combustible y los agroquímicos surtidos del almacén son costo de
--     insumos (consumo); el uso de maquinaria cobra solo su tarifa, que debe
--     excluir el combustible surtido del almacén.
--   · Los mantenimientos y reparaciones son costo del equipo, NO del proyecto:
--     el proyecto absorbe la maquinaria solo mediante su tarifa de uso.
--   · Las aplicaciones no tienen costo propio: su costo es el del consumo.
--   · El costo de una actividad de campo es solo lo no capturado en otro módulo
--     (p. ej. un servicio contratado) y entra como fuente «actividades».
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.input_kind as enum (
  'semilla', 'fertilizante', 'agroquimico', 'biologico', 'combustible', 'herramienta', 'material', 'otro'
);

create type public.machine_status as enum ('operativa', 'en_mantenimiento', 'fuera_servicio', 'baja');

create type public.machine_rate_basis as enum ('hora', 'jornada');

create type public.maintenance_kind as enum ('preventivo', 'correctivo');

create type public.worker_type as enum ('planta', 'eventual', 'temporal', 'destajista');

create type public.attendance_status as enum ('presente', 'falta', 'permiso', 'incapacidad', 'descanso');

create type public.log_status as enum ('registrado', 'cancelado');

-- Roles por área (mismos conjuntos que lib/auth/roles.ts).
--   inventario: propietario, administrador, almacen
--   bitácoras:  propietario, administrador, agronomo, supervisor
--   maquinaria y personal: propietario, administrador, agronomo

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------

-- La fecha indicada (argumento del trigger) no puede ser futura.
create or replace function public.check_record_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) ->> tg_argv[0])::date > public.mx_today() then
    raise exception 'La fecha no puede ser futura' using errcode = '22023';
  end if;
  return new;
end;
$$;

-- Un registro cancelado ya no se edita (la cancelación es definitiva).
create or replace function public.prevent_cancelled_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'cancelado' then
    raise exception 'El registro está cancelado y ya no se modifica' using errcode = '22023';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Catálogos de inventario
-- -----------------------------------------------------------------------------
create table public.inventory_categories (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null check (char_length(trim(name)) between 2 and 80),
  kind             public.input_kind not null default 'otro',
  description      text check (char_length(description) <= 300),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  unique (organization_id, id)
);

create unique index inventory_categories_org_name_key on public.inventory_categories (organization_id, lower(name));

comment on column public.inventory_categories.kind is
  'Clasificación fija que usan las reglas: aplicaciones (agroquímico, biológico, fertilizante) y combustible de maquinaria.';

create table public.suppliers (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null check (char_length(trim(name)) between 2 and 150),
  rfc              text check (rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'),
  contact_name     text check (char_length(contact_name) <= 120),
  phone            text check (char_length(phone) <= 30),
  email            extensions.citext,
  address          text check (char_length(address) <= 300),
  notes            text check (char_length(notes) <= 2000),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  unique (organization_id, id)
);

create unique index suppliers_org_name_key on public.suppliers (organization_id, lower(name));

create table public.warehouses (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null check (char_length(trim(name)) between 2 and 80),
  code             text check (char_length(code) <= 20),
  farm_id          uuid,
  location         text check (char_length(location) <= 200),
  responsible_id   uuid,
  notes            text check (char_length(notes) <= 1000),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  unique (organization_id, id),
  foreign key (organization_id, farm_id) references public.farms (organization_id, id) on delete restrict,
  foreign key (organization_id, responsible_id) references public.employees (organization_id, id) on delete restrict
);

create unique index warehouses_org_name_key on public.warehouses (organization_id, lower(name));

-- Catálogo de actividades agrícolas (bitácora de actividades y mano de obra).
create table public.activity_types (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null check (char_length(trim(name)) between 2 and 80),
  description      text check (char_length(description) <= 300),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  unique (organization_id, id)
);

create unique index activity_types_org_name_key on public.activity_types (organization_id, lower(name));

-- Catálogos iniciales de cada organización (editables después).
create or replace function public.seed_organization_catalogs(p_org uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.inventory_categories (organization_id, name, kind) values
    (p_org, 'Semillas', 'semilla'),
    (p_org, 'Fertilizantes', 'fertilizante'),
    (p_org, 'Agroquímicos', 'agroquimico'),
    (p_org, 'Productos biológicos', 'biologico'),
    (p_org, 'Combustibles', 'combustible'),
    (p_org, 'Herramientas', 'herramienta'),
    (p_org, 'Materiales', 'material'),
    (p_org, 'Otros insumos', 'otro')
  on conflict do nothing;

  insert into public.warehouses (organization_id, name) values (p_org, 'Almacén general')
  on conflict do nothing;

  insert into public.activity_types (organization_id, name) values
    (p_org, 'Preparación de terreno'),
    (p_org, 'Limpieza'),
    (p_org, 'Siembra'),
    (p_org, 'Trasplante'),
    (p_org, 'Fertilización'),
    (p_org, 'Poda'),
    (p_org, 'Deshierbe'),
    (p_org, 'Control fitosanitario'),
    (p_org, 'Mantenimiento'),
    (p_org, 'Otras actividades')
  on conflict do nothing;
$$;

create or replace function public.handle_new_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_organization_catalogs(new.id);
  return null;
end;
$$;

create trigger organizations_seed_catalogs after insert on public.organizations
  for each row execute function public.handle_new_organization();

select public.seed_organization_catalogs(id) from public.organizations;

-- -----------------------------------------------------------------------------
-- Productos: categoría configurable, control por lotes y más unidades
-- -----------------------------------------------------------------------------
alter table public.inventory_products
  add column category_id uuid,
  add column track_lots boolean not null default false;

update public.inventory_products p
set category_id = c.id
from public.inventory_categories c
where c.organization_id = p.organization_id
  and c.kind = (case p.category::text when 'empaque' then 'material' else p.category::text end)::public.input_kind;

alter table public.inventory_products
  alter column category_id set not null,
  add foreign key (organization_id, category_id) references public.inventory_categories (organization_id, id) on delete restrict,
  drop column category,
  drop constraint inventory_products_unit_check,
  add constraint inventory_products_unit_check check (unit in ('kg', 'g', 'l', 'ml', 'pieza', 'saco', 'caja', 'm', 'm3'));

drop type public.input_category;

create index inventory_products_category_idx on public.inventory_products (category_id);

comment on column public.inventory_products.track_lots is
  'Si es verdadero, toda entrada indica lote (con caducidad opcional) y toda salida indica de qué lote sale.';

-- El control por lotes solo cambia con existencia en cero: si no, quedarían
-- existencias sin lote en un producto que exige lote (o al revés).
create or replace function public.prevent_product_lot_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.track_lots is distinct from old.track_lots and old.stock > 0 then
    raise exception 'El control por lotes de "%" solo cambia con existencia en cero', old.name using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger inventory_products_lots_lock before update of track_lots on public.inventory_products
  for each row execute function public.prevent_product_lot_change();

-- -----------------------------------------------------------------------------
-- Lotes y existencias por almacén
--   inventory_balances solo la modifica apply_inventory_balance(); la suma de
--   sus cantidades por producto es igual a inventory_products.stock.
-- -----------------------------------------------------------------------------
create table public.inventory_lots (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  product_id       uuid not null,
  lot_number       text not null check (char_length(trim(lot_number)) between 1 and 60),
  expiry_date      date,
  notes            text check (char_length(notes) <= 300),
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  unique (organization_id, id),
  unique (product_id, id),
  foreign key (organization_id, product_id) references public.inventory_products (organization_id, id) on delete restrict
);

create unique index inventory_lots_product_number_key on public.inventory_lots (product_id, upper(lot_number));
create index inventory_lots_expiry_idx on public.inventory_lots (organization_id, expiry_date) where expiry_date is not null;

create table public.inventory_balances (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  product_id       uuid not null,
  warehouse_id     uuid not null,
  lot_id           uuid,
  quantity         numeric(14, 3) not null default 0 check (quantity >= 0),
  updated_at       timestamptz not null default now(),
  foreign key (organization_id, product_id) references public.inventory_products (organization_id, id) on delete restrict,
  foreign key (organization_id, warehouse_id) references public.warehouses (organization_id, id) on delete restrict,
  foreign key (product_id, lot_id) references public.inventory_lots (product_id, id) on delete restrict,
  unique nulls not distinct (product_id, warehouse_id, lot_id)
);

create index inventory_balances_warehouse_idx on public.inventory_balances (warehouse_id);

-- Un almacén con existencias no se desactiva: primero se transfiere o se da de baja el producto.
create or replace function public.prevent_warehouse_deactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_active and not new.is_active
     and exists (select 1 from public.inventory_balances where warehouse_id = old.id and quantity > 0) then
    raise exception 'El almacén "%" tiene existencias; transfiérelas o dalas de baja antes de desactivarlo', old.name
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger warehouses_deactivation_lock before update of is_active on public.warehouses
  for each row execute function public.prevent_warehouse_deactivation();

-- Existencias actuales al almacén general de cada organización (sin lote).
insert into public.inventory_balances (organization_id, product_id, warehouse_id, quantity)
select p.organization_id, p.id, w.id, p.stock
from public.inventory_products p
join public.warehouses w on w.organization_id = p.organization_id and w.name = 'Almacén general'
where p.stock > 0;

-- -----------------------------------------------------------------------------
-- Movimientos: almacén, transferencia, lote, proveedor, responsable y unidad
-- -----------------------------------------------------------------------------
alter table public.inventory_movements
  add column warehouse_id    uuid,
  add column to_warehouse_id uuid,
  add column lot_id          uuid,
  add column supplier_id     uuid,
  add column responsible_id  uuid,
  add column unit            text;

update public.inventory_movements m
set warehouse_id = w.id, unit = p.unit
from public.warehouses w, public.inventory_products p
where w.organization_id = m.organization_id and w.name = 'Almacén general' and p.id = m.product_id;

-- El proveedor capturado como texto pasa al catálogo de proveedores.
insert into public.suppliers (organization_id, name)
select distinct organization_id, trim(supplier)
from public.inventory_movements
where char_length(trim(coalesce(supplier, ''))) >= 2
on conflict do nothing;

update public.inventory_movements m
set supplier_id = s.id
from public.suppliers s
where s.organization_id = m.organization_id and lower(s.name) = lower(trim(m.supplier));

alter table public.inventory_movements
  drop column supplier,
  alter column warehouse_id set not null,
  alter column unit set not null,
  add foreign key (organization_id, warehouse_id) references public.warehouses (organization_id, id) on delete restrict,
  add foreign key (organization_id, to_warehouse_id) references public.warehouses (organization_id, id) on delete restrict,
  add foreign key (product_id, lot_id) references public.inventory_lots (product_id, id) on delete restrict,
  add foreign key (organization_id, supplier_id) references public.suppliers (organization_id, id) on delete restrict,
  add foreign key (organization_id, responsible_id) references public.employees (organization_id, id) on delete restrict,
  add constraint inventory_movements_transfer_check
    check ((movement_type = 'transferencia') = (to_warehouse_id is not null) and to_warehouse_id is distinct from warehouse_id),
  add constraint inventory_movements_supplier_check check (supplier_id is null or movement_type = 'entrada');

create index inventory_movements_warehouse_idx on public.inventory_movements (warehouse_id, created_at desc);
create index inventory_movements_lot_idx on public.inventory_movements (lot_id) where lot_id is not null;

comment on column public.inventory_movements.unit is 'Unidad del producto al registrar (no cambia mientras haya movimientos).';
comment on column public.inventory_movements.responsible_id is 'Empleado que entrega o recibe; created_by guarda al usuario que capturó.';

-- El historial es inmutable: se corrige con una anulación (contrapartida).
-- Solo se permite el borrado en cascada al eliminar la organización.
create or replace function public.prevent_movement_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'Los movimientos de inventario no se modifican ni eliminan; anúlalos con su contrapartida'
    using errcode = '42501';
end;
$$;

create trigger inventory_movements_immutable before update or delete on public.inventory_movements
  for each row execute function public.prevent_movement_changes();

-- -----------------------------------------------------------------------------
-- Maquinaria: ficha, estado, tarifas por hora o jornada y mantenimiento
-- -----------------------------------------------------------------------------
alter table public.machinery
  add column brand                      text check (char_length(brand) <= 60),
  add column model                      text check (char_length(model) <= 60),
  add column serial_number              text check (char_length(serial_number) <= 60),
  add column acquisition_date           date,
  add column acquisition_cost           numeric(14, 2) check (acquisition_cost >= 0),
  add column status                     public.machine_status not null default 'operativa',
  add column responsible_id             uuid,
  add column rate_basis                 public.machine_rate_basis not null default 'hora',
  add column daily_rate                 numeric(14, 2) check (daily_rate >= 0),
  add column maintenance_interval_hours numeric(8, 1) check (maintenance_interval_hours > 0),
  add column maintenance_interval_days  int check (maintenance_interval_days between 1 and 3650),
  add foreign key (organization_id, responsible_id) references public.employees (organization_id, id) on delete restrict,
  add constraint machinery_daily_rate_required check (rate_basis = 'hora' or daily_rate is not null);

update public.machinery set status = case when is_active then 'operativa'::public.machine_status else 'baja' end;

-- is_active deja de capturarse: se deriva del estado (dado de baja = inactivo).
alter table public.machinery drop column is_active;
alter table public.machinery add column is_active boolean generated always as (status <> 'baja') stored;

comment on column public.machinery.daily_rate is
  'Tarifa por jornada; igual que la horaria, sin combustible surtido del almacén ni mantenimiento ya considerado en ella.';

-- Uso: la tarifa se cobra por hora o por jornada (congelada al registrar). Las
-- horas siempre se registran porque alimentan las alertas de mantenimiento.
drop view public.v_project_costs;
drop view public.v_project_cost_entries;

alter table public.machinery_usage rename column hourly_rate to rate;
alter table public.machinery_usage drop column amount;
alter table public.machinery_usage
  add column rate_basis        public.machine_rate_basis not null default 'hora',
  add column jornadas          numeric(4, 2) check (jornadas > 0 and jornadas <= 1),
  add column operator_id       uuid,
  add column activity_type_id  uuid,
  add column fuel_quantity     numeric(10, 3) check (fuel_quantity > 0),
  add column fuel_movement_id  uuid unique references public.inventory_movements (id) on delete restrict,
  add column amount            numeric(14, 2) generated always as (
                                 round(case when rate_basis = 'jornada' then jornadas else hours end * rate, 2)
                               ) stored,
  add foreign key (organization_id, operator_id) references public.employees (organization_id, id) on delete restrict,
  add foreign key (organization_id, activity_type_id) references public.activity_types (organization_id, id) on delete restrict,
  add constraint machinery_usage_rate_basis_check check ((rate_basis = 'jornada') = (jornadas is not null));

comment on column public.machinery_usage.fuel_quantity is
  'Combustible utilizado. Si fuel_movement_id existe, salió del almacén y su costo está en insumos (no en la tarifa).';

create or replace function public.before_machinery_usage_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_machine public.machinery%rowtype;
  v_hours numeric;
  v_jornadas numeric;
begin
  -- Bloquear el equipo serializa los registros del mismo equipo.
  select * into v_machine from public.machinery
  where id = new.machine_id and organization_id = new.organization_id
  for update;
  if not found then
    raise exception 'Equipo no encontrado' using errcode = 'P0002';
  end if;

  if tg_op = 'INSERT' or new.machine_id is distinct from old.machine_id then
    if v_machine.status in ('fuera_servicio', 'baja') then
      raise exception 'El equipo "%" está %', v_machine.name, replace(v_machine.status::text, '_', ' ')
        using errcode = '22023';
    end if;
  end if;

  if tg_op = 'INSERT' or new.machine_id is distinct from old.machine_id or new.rate_basis is distinct from old.rate_basis then
    if new.rate is null then
      new.rate := case when new.rate_basis = 'jornada' then v_machine.daily_rate else v_machine.hourly_cost end;
      if new.rate is null then
        raise exception 'El equipo "%" no tiene tarifa por jornada; indícala en el registro', v_machine.name
          using errcode = '22023';
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE' and old.fuel_movement_id is not null
     and (new.plot_id is distinct from old.plot_id or new.usage_date is distinct from old.usage_date) then
    raise exception 'El uso tiene combustible surtido del almacén; para cambiar parcela o fecha elimínalo y regístralo de nuevo'
      using errcode = '22023';
  end if;

  -- Un equipo no trabaja más de 24 h ni más de 1 jornada por día (entre todos
  -- los proyectos): evita cobrar dos veces el mismo tiempo de máquina.
  select coalesce(sum(hours), 0), coalesce(sum(jornadas), 0) into v_hours, v_jornadas
  from public.machinery_usage
  where machine_id = new.machine_id and usage_date = new.usage_date and id <> new.id;
  if v_hours + new.hours > 24 then
    raise exception '"%" ya tiene % h registradas el %; no puede exceder 24 h por día',
      v_machine.name, v_hours, to_char(new.usage_date, 'DD/MM/YYYY') using errcode = '22023';
  end if;
  if v_jornadas + coalesce(new.jornadas, 0) > 1 then
    raise exception '"%" ya tiene % jornada(s) registradas el %; no puede exceder 1 por día',
      v_machine.name, v_jornadas, to_char(new.usage_date, 'DD/MM/YYYY') using errcode = '22023';
  end if;

  return new;
end;
$$;

create table public.machinery_maintenance (
  id                uuid primary key, -- lo genera el cliente: llave de idempotencia
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  machine_id        uuid not null,
  maintenance_date  date not null,
  kind              public.maintenance_kind not null default 'preventivo',
  description       text not null check (char_length(trim(description)) between 3 and 300),
  provider          text check (char_length(provider) <= 150),
  cost              numeric(14, 2) not null default 0 check (cost >= 0),
  hour_meter        numeric(10, 1) check (hour_meter >= 0),
  responsible_id    uuid,
  notes             text check (char_length(notes) <= 1000),
  status            public.log_status not null default 'registrado',
  cancel_reason     text check (char_length(cancel_reason) <= 500),
  cancelled_at      timestamptz,
  cancelled_by      uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  created_by        uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at        timestamptz not null default now(),
  updated_by        uuid references auth.users (id) on delete set null,
  unique (organization_id, id),
  foreign key (organization_id, machine_id) references public.machinery (organization_id, id) on delete restrict,
  foreign key (organization_id, responsible_id) references public.employees (organization_id, id) on delete restrict,
  check ((status = 'cancelado') = (cancelled_at is not null))
);

create index machinery_maintenance_machine_idx on public.machinery_maintenance (machine_id, maintenance_date desc);

comment on table public.machinery_maintenance is
  'Mantenimientos y reparaciones (correctivo). Costo del equipo; no se imputa a proyectos para no duplicar la tarifa de uso.';

-- -----------------------------------------------------------------------------
-- Personal: tipo de trabajador, asistencia, cuadrillas y asignaciones
-- -----------------------------------------------------------------------------
alter table public.employees
  add column worker_type public.worker_type not null default 'planta',
  add column hire_date   date;

create table public.crews (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null check (char_length(trim(name)) between 2 and 80),
  leader_id        uuid,
  notes            text check (char_length(notes) <= 1000),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  unique (organization_id, id),
  foreign key (organization_id, leader_id) references public.employees (organization_id, id) on delete restrict
);

create unique index crews_org_name_key on public.crews (organization_id, lower(name));

create table public.crew_members (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  crew_id          uuid not null,
  employee_id      uuid not null,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  unique (crew_id, employee_id),
  foreign key (organization_id, crew_id) references public.crews (organization_id, id) on delete cascade,
  foreign key (organization_id, employee_id) references public.employees (organization_id, id) on delete restrict
);

create index crew_members_employee_idx on public.crew_members (employee_id);

alter table public.labor_records
  add column crew_id          uuid,
  add column activity_type_id uuid,
  add column batch_id         uuid,
  add foreign key (organization_id, crew_id) references public.crews (organization_id, id) on delete restrict,
  add foreign key (organization_id, activity_type_id) references public.activity_types (organization_id, id) on delete restrict;

create index labor_records_batch_idx on public.labor_records (batch_id) where batch_id is not null;
create index labor_records_crew_idx on public.labor_records (crew_id) where crew_id is not null;

comment on column public.labor_records.batch_id is 'Registro de cuadrilla: todas las jornadas creadas en una misma operación (idempotencia).';

create table public.attendance_records (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  employee_id      uuid not null,
  work_date        date not null,
  status           public.attendance_status not null default 'presente',
  check_in         time,
  check_out        time,
  notes            text check (char_length(notes) <= 500),
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  unique (employee_id, work_date),
  foreign key (organization_id, employee_id) references public.employees (organization_id, id) on delete restrict,
  check (check_out is null or (check_in is not null and check_out > check_in)),
  check (status = 'presente' or (check_in is null and check_out is null))
);

create index attendance_records_org_date_idx on public.attendance_records (organization_id, work_date desc);

create table public.employee_assignments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  employee_id      uuid not null,
  project_id       uuid not null,
  plot_id          uuid,
  crew_id          uuid,
  start_date       date not null,
  end_date         date,
  role             text check (char_length(role) <= 80),
  notes            text check (char_length(notes) <= 500),
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  foreign key (organization_id, employee_id) references public.employees (organization_id, id) on delete restrict,
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  foreign key (project_id, plot_id) references public.project_plots (project_id, plot_id) on delete restrict,
  foreign key (organization_id, crew_id) references public.crews (organization_id, id) on delete restrict,
  check (end_date is null or end_date >= start_date)
);

create index employee_assignments_project_idx on public.employee_assignments (project_id);
create index employee_assignments_employee_idx on public.employee_assignments (employee_id);

-- Mano de obra y asistencia son coherentes: no hay jornal ni destajo de un
-- empleado registrado ese día como falta, permiso, incapacidad o descanso.
create or replace function public.before_labor_record_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emp public.employees%rowtype;
  v_used numeric;
  v_absence public.attendance_status;
begin
  if new.employee_id is null then
    if new.unit_rate is null then
      raise exception 'Indica la tarifa de la cuadrilla' using errcode = '22023';
    end if;
    return new;
  end if;

  select * into v_emp from public.employees
  where id = new.employee_id and organization_id = new.organization_id
  for update;
  if not found then
    raise exception 'Empleado no encontrado' using errcode = 'P0002';
  end if;
  if (tg_op = 'INSERT' or new.employee_id is distinct from old.employee_id) and not v_emp.is_active then
    raise exception 'El empleado "%" está inactivo', v_emp.full_name using errcode = '22023';
  end if;

  select status into v_absence from public.attendance_records
  where employee_id = new.employee_id and work_date = new.work_date and status <> 'presente';
  if found then
    raise exception '% está registrado con % el %; corrige la asistencia antes de registrar trabajo',
      v_emp.full_name, v_absence, to_char(new.work_date, 'DD/MM/YYYY') using errcode = '22023';
  end if;

  if new.unit_rate is null then
    if new.pay_type = 'jornal' then
      new.unit_rate := v_emp.daily_wage;
    else
      raise exception 'Indica la tarifa por unidad de destajo' using errcode = '22023';
    end if;
  end if;

  if new.pay_type = 'jornal' then
    select coalesce(sum(quantity), 0) into v_used
    from public.labor_records
    where employee_id = new.employee_id and work_date = new.work_date and pay_type = 'jornal' and id <> new.id;
    if v_used + new.quantity > 1 then
      raise exception '% ya tiene % jornal(es) registrados el %; un empleado no puede exceder 1 jornal por día',
        v_emp.full_name, v_used, to_char(new.work_date, 'DD/MM/YYYY')
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

-- Registrar trabajo de un empleado marca su asistencia del día.
create or replace function public.after_labor_record_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.employee_id is not null then
    insert into public.attendance_records (organization_id, employee_id, work_date, status)
    values (new.organization_id, new.employee_id, new.work_date, 'presente')
    on conflict (employee_id, work_date) do nothing;
  end if;
  return null;
end;
$$;

create trigger labor_records_attendance after insert or update of employee_id, work_date on public.labor_records
  for each row execute function public.after_labor_record_insert();

create or replace function public.before_attendance_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  -- Mismo bloqueo que la mano de obra para que no se crucen registros simultáneos.
  select full_name into v_name from public.employees
  where id = new.employee_id and organization_id = new.organization_id
  for update;
  if not found then
    raise exception 'Empleado no encontrado' using errcode = 'P0002';
  end if;
  if new.work_date > public.mx_today() then
    raise exception 'La fecha no puede ser futura' using errcode = '22023';
  end if;
  if new.status <> 'presente' and exists (
    select 1 from public.labor_records where employee_id = new.employee_id and work_date = new.work_date
  ) then
    raise exception '% tiene trabajo registrado el %; elimínalo antes de marcar %',
      v_name, to_char(new.work_date, 'DD/MM/YYYY'), new.status using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger attendance_records_before_write before insert or update on public.attendance_records
  for each row execute function public.before_attendance_write();

-- Una asignación nueva o modificada requiere proyecto vigente y empleado activo.
create or replace function public.before_assignment_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.lock_open_project(new.organization_id, new.project_id);
  if (tg_op = 'INSERT' or new.employee_id is distinct from old.employee_id)
     and not exists (select 1 from public.employees where id = new.employee_id and is_active) then
    raise exception 'El empleado está inactivo' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger employee_assignments_before_write before insert or update on public.employee_assignments
  for each row execute function public.before_assignment_write();

-- -----------------------------------------------------------------------------
-- Bitácoras de campo
-- -----------------------------------------------------------------------------
create table public.irrigation_logs (
  id                 uuid primary key, -- lo genera el cliente: llave de idempotencia
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  project_id         uuid not null,
  plot_id            uuid not null,
  log_date           date not null,
  start_time         time not null,
  end_time           time not null,
  -- Si termina antes de la hora de inicio, el riego cruzó la medianoche.
  duration_minutes   int generated always as (
                       ((extract(epoch from (end_time - start_time))::int / 60) + 1440) % 1440
                     ) stored,
  irrigation_system  public.irrigation_type not null,
  water_m3           numeric(12, 2) check (water_m3 > 0),
  responsible_id     uuid,
  notes              text check (char_length(notes) <= 1000),
  status             public.log_status not null default 'registrado',
  cancel_reason      text check (char_length(cancel_reason) <= 500),
  cancelled_at       timestamptz,
  cancelled_by       uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  created_by         uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users (id) on delete set null,
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete restrict,
  foreign key (project_id, plot_id) references public.project_plots (project_id, plot_id) on delete restrict,
  foreign key (organization_id, responsible_id) references public.employees (organization_id, id) on delete restrict,
  check (end_time <> start_time),
  check ((status = 'cancelado') = (cancelled_at is not null))
);

create index irrigation_logs_project_idx on public.irrigation_logs (project_id, log_date desc);
create index irrigation_logs_org_date_idx on public.irrigation_logs (organization_id, log_date desc);

-- Sistema de riego por omisión: el de la parcela.
create or replace function public.before_irrigation_log_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.irrigation_system is null then
    select irrigation_type into new.irrigation_system from public.plots where id = new.plot_id;
  end if;
  return new;
end;
$$;

create trigger irrigation_logs_before_write before insert or update on public.irrigation_logs
  for each row execute function public.before_irrigation_log_write();

create table public.chemical_applications (
  id                     uuid primary key, -- lo genera el cliente: llave de idempotencia
  organization_id        uuid not null references public.organizations (id) on delete cascade,
  project_id             uuid not null,
  plot_id                uuid not null,
  application_date       date not null,
  application_time       time,
  product_id             uuid not null,
  active_ingredient      text check (char_length(active_ingredient) <= 150),
  quantity               numeric(14, 3) not null check (quantity > 0),
  unit                   text not null,
  treated_area_ha        numeric(12, 2) not null check (treated_area_ha > 0),
  responsible_id         uuid,
  machine_id             uuid,
  equipment              text check (char_length(equipment) <= 120),
  lot_id                 uuid,
  lot_number             text check (char_length(lot_number) <= 60),
  reentry_hours          int check (reentry_hours between 0 and 2160),
  preharvest_days        int check (preharvest_days between 0 and 365),
  inventory_movement_id  uuid unique references public.inventory_movements (id) on delete restrict,
  notes                  text check (char_length(notes) <= 1000),
  status                 public.log_status not null default 'registrado',
  cancel_reason          text check (char_length(cancel_reason) <= 500),
  cancelled_at           timestamptz,
  cancelled_by           uuid references auth.users (id) on delete set null,
  created_at             timestamptz not null default now(),
  created_by             uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at             timestamptz not null default now(),
  updated_by             uuid references auth.users (id) on delete set null,
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete restrict,
  foreign key (project_id, plot_id) references public.project_plots (project_id, plot_id) on delete restrict,
  foreign key (organization_id, product_id) references public.inventory_products (organization_id, id) on delete restrict,
  foreign key (product_id, lot_id) references public.inventory_lots (product_id, id) on delete restrict,
  foreign key (organization_id, responsible_id) references public.employees (organization_id, id) on delete restrict,
  foreign key (organization_id, machine_id) references public.machinery (organization_id, id) on delete restrict,
  check ((status = 'cancelado') = (cancelled_at is not null))
);

create index chemical_applications_project_idx on public.chemical_applications (project_id, application_date desc);
create index chemical_applications_org_date_idx on public.chemical_applications (organization_id, application_date desc);

comment on table public.chemical_applications is
  'Registro de lo aplicado (no recomienda dosis). Sin costo propio: el costo es el del consumo de inventario ligado.';

create table public.field_activities (
  id                uuid primary key, -- lo genera el cliente: llave de idempotencia
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  project_id        uuid not null,
  plot_id           uuid,
  activity_type_id  uuid not null,
  activity_date     date not null,
  description       text check (char_length(description) <= 200),
  responsible_id    uuid,
  cost              numeric(14, 2) not null default 0 check (cost >= 0),
  notes             text check (char_length(notes) <= 1000),
  status            public.log_status not null default 'registrado',
  cancel_reason     text check (char_length(cancel_reason) <= 500),
  cancelled_at      timestamptz,
  cancelled_by      uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  created_by        uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at        timestamptz not null default now(),
  updated_by        uuid references auth.users (id) on delete set null,
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete restrict,
  foreign key (project_id, plot_id) references public.project_plots (project_id, plot_id) on delete restrict,
  foreign key (organization_id, activity_type_id) references public.activity_types (organization_id, id) on delete restrict,
  foreign key (organization_id, responsible_id) references public.employees (organization_id, id) on delete restrict,
  check ((status = 'cancelado') = (cancelled_at is not null))
);

create index field_activities_project_idx on public.field_activities (project_id, activity_date desc);
create index field_activities_org_date_idx on public.field_activities (organization_id, activity_date desc);

comment on column public.field_activities.cost is
  'Costo adicional no capturado en insumos, maquinaria, mano de obra ni gastos (p. ej. servicio contratado).';

create trigger irrigation_logs_check_project before insert or update or delete on public.irrigation_logs
  for each row execute function public.check_project_record('log_date');
create trigger chemical_applications_check_project before insert or update or delete on public.chemical_applications
  for each row execute function public.check_project_record('application_date');
create trigger field_activities_check_project before insert or update or delete on public.field_activities
  for each row execute function public.check_project_record('activity_date');
create trigger machinery_maintenance_check_date before insert or update on public.machinery_maintenance
  for each row execute function public.check_record_date('maintenance_date');

do $$
declare
  t text;
begin
  foreach t in array array['irrigation_logs', 'chemical_applications', 'field_activities', 'machinery_maintenance'] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.prevent_cancelled_edit()',
      t || '_cancelled_lock', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Evidencias fotográficas (Storage privado: org_id/tipo/registro/archivo)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidencias', 'evidencias', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create table public.attachments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  entity_type      text not null check (entity_type in (
                     'irrigation_log', 'chemical_application', 'field_activity', 'machinery_maintenance')),
  entity_id        uuid not null,
  storage_path     text not null unique,
  file_name        text not null check (char_length(file_name) between 1 and 200),
  mime_type        text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic')),
  size_bytes       int not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  -- La ruta pertenece a la organización y al registro: la RLS de Storage usa la primera carpeta.
  check (
    split_part(storage_path, '/', 1) = organization_id::text
    and split_part(storage_path, '/', 2) = entity_type
    and split_part(storage_path, '/', 3) = entity_id::text
  )
);

create index attachments_entity_idx on public.attachments (entity_type, entity_id);

create or replace function public.check_attachment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table text := case new.entity_type
    when 'irrigation_log' then 'irrigation_logs'
    when 'chemical_application' then 'chemical_applications'
    when 'field_activity' then 'field_activities'
    when 'machinery_maintenance' then 'machinery_maintenance'
  end;
  v_found boolean;
begin
  execute format('select exists (select 1 from public.%I where id = $1 and organization_id = $2)', v_table)
    into v_found using new.entity_id, new.organization_id;
  if not v_found then
    raise exception 'Registro no encontrado' using errcode = 'P0002';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'evidencias' and name = new.storage_path) then
    raise exception 'El archivo no se cargó correctamente; intenta de nuevo' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger attachments_check before insert on public.attachments
  for each row execute function public.check_attachment();

-- Organización de un objeto de Storage (primera carpeta de la ruta).
create or replace function public.storage_object_org(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create policy "evidencias_select_members" on storage.objects for select to authenticated
  using (bucket_id = 'evidencias' and public.is_member(public.storage_object_org(name)));
create policy "evidencias_insert_field" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidencias'
    and public.has_role(public.storage_object_org(name),
                        array['propietario', 'administrador', 'agronomo', 'supervisor']::public.app_role[])
  );
create policy "evidencias_delete_owner_admin" on storage.objects for delete to authenticated
  using (
    bucket_id = 'evidencias'
    and (owner_id = auth.uid()::text
         or public.has_role(public.storage_object_org(name), array['propietario', 'administrador']::public.app_role[]))
  );

-- -----------------------------------------------------------------------------
-- Inventario: aplicación de movimientos (interna) y RPCs
-- -----------------------------------------------------------------------------
drop function public.register_inventory_movement(uuid, uuid, public.inventory_movement_type, date, numeric, numeric,
  uuid, uuid, text, text, text);
drop function public.post_inventory_movement(uuid, public.inventory_products, public.inventory_movement_type, date,
  numeric, numeric, uuid, uuid, text, text, text, uuid);

-- Suma o resta existencia de un producto en un almacén/lote. El llamador ya
-- bloqueó el producto (FOR UPDATE), lo que serializa todos sus saldos.
create or replace function public.apply_inventory_balance(
  p_product public.inventory_products,
  p_warehouse uuid,
  p_lot uuid,
  p_delta numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance public.inventory_balances%rowtype;
  v_where text;
begin
  select * into v_balance from public.inventory_balances
  where product_id = p_product.id and warehouse_id = p_warehouse and lot_id is not distinct from p_lot;

  if coalesce(v_balance.quantity, 0) + p_delta < 0 then
    select w.name || coalesce(' · lote ' || l.lot_number, '') into v_where
    from public.warehouses w
    left join public.inventory_lots l on l.id = p_lot
    where w.id = p_warehouse;
    raise exception 'Existencia insuficiente de "%" en %: hay % % y se requieren %',
      p_product.name, v_where, coalesce(v_balance.quantity, 0), p_product.unit, -p_delta using errcode = '22023';
  end if;

  if v_balance.id is null then
    insert into public.inventory_balances (organization_id, product_id, warehouse_id, lot_id, quantity)
    values (p_product.organization_id, p_product.id, p_warehouse, p_lot, p_delta);
  else
    update public.inventory_balances set quantity = quantity + p_delta, updated_at = now() where id = v_balance.id;
  end if;
end;
$$;

-- Aplica un movimiento ya valorado sobre el producto (bloqueado por el
-- llamador) y lo registra. Entradas suman existencia y valor; salidas restan;
-- las transferencias solo cambian el almacén. Devuelve el id del movimiento.
create or replace function public.post_inventory_movement(
  p_id uuid,
  p_product public.inventory_products,
  p_type public.inventory_movement_type,
  p_date date,
  p_quantity numeric,
  p_total numeric,
  p_warehouse uuid,
  p_to_warehouse uuid,
  p_lot uuid,
  p_project uuid,
  p_plot uuid,
  p_supplier uuid,
  p_responsible uuid,
  p_reference text,
  p_notes text,
  p_reverses uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock numeric := p_product.stock;
  v_value numeric := p_product.stock_value;
begin
  if p_type = 'transferencia' then
    perform public.apply_inventory_balance(p_product, p_warehouse, p_lot, -p_quantity);
    perform public.apply_inventory_balance(p_product, p_to_warehouse, p_lot, p_quantity);
  elsif p_type in ('entrada', 'devolucion', 'ajuste_entrada') then
    v_stock := v_stock + p_quantity;
    v_value := v_value + p_total;
    perform public.apply_inventory_balance(p_product, p_warehouse, p_lot, p_quantity);
  else
    v_stock := v_stock - p_quantity;
    v_value := v_value - p_total;
    if v_stock < 0 then
      raise exception 'Existencia insuficiente de "%": hay % % y se requieren %',
        p_product.name, p_product.stock, p_product.unit, p_quantity using errcode = '22023';
    end if;
    if v_value < 0 or (v_stock = 0 and v_value <> 0) then
      raise exception 'El valor del movimiento no corresponde con el valor disponible en almacén' using errcode = '22023';
    end if;
    perform public.apply_inventory_balance(p_product, p_warehouse, p_lot, -p_quantity);
  end if;

  if v_stock <> p_product.stock or v_value <> p_product.stock_value then
    update public.inventory_products set stock = v_stock, stock_value = v_value where id = p_product.id;
  end if;

  insert into public.inventory_movements (
    id, organization_id, product_id, movement_type, movement_date, quantity, unit, total_cost,
    warehouse_id, to_warehouse_id, lot_id, project_id, plot_id, supplier_id, responsible_id,
    reference, notes, reverses_id, stock_after
  ) values (
    p_id, p_product.organization_id, p_product.id, p_type, p_date, p_quantity, p_product.unit, p_total,
    p_warehouse, p_to_warehouse, p_lot, p_project, p_plot, p_supplier, p_responsible,
    nullif(trim(p_reference), ''), nullif(trim(p_notes), ''), p_reverses, v_stock
  );
  return p_id;
end;
$$;

-- Valida y valora un movimiento. Uso interno: el llamador ya verificó que el
-- usuario es miembro de la organización del producto y tiene el rol del área
-- (almacén en register_inventory_movement; campo o maquinaria en las RPC de
-- aplicaciones y uso de maquinaria). Idempotente por p_id.
create or replace function public.process_inventory_movement(
  p_id uuid,
  p_product uuid,
  p_type public.inventory_movement_type,
  p_date date,
  p_quantity numeric,
  p_unit_cost numeric,
  p_project uuid,
  p_plot uuid,
  p_warehouse uuid,
  p_to_warehouse uuid,
  p_lot uuid,
  p_lot_number text,
  p_lot_expiry date,
  p_supplier uuid,
  p_responsible uuid,
  p_reference text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prod public.inventory_products%rowtype;
  v_existing public.inventory_movements%rowtype;
  v_project public.projects%rowtype;
  v_warehouse public.warehouses%rowtype;
  v_lot public.inventory_lots%rowtype;
  v_inflow boolean := p_type in ('entrada', 'ajuste_entrada', 'devolucion');
  v_lot_number text := nullif(trim(p_lot_number), '');
  v_count int;
  v_total numeric;
  v_net_qty numeric;
  v_net_cost numeric;
begin
  if p_id is null then
    raise exception 'Falta el identificador del movimiento' using errcode = '22023';
  end if;

  -- El bloqueo del producto serializa los movimientos y los reintentos.
  select * into v_prod from public.inventory_products where id = p_product for update;
  if not found then
    raise exception 'Producto no encontrado' using errcode = 'P0002';
  end if;

  select * into v_existing from public.inventory_movements where id = p_id;
  if found then
    if v_existing.product_id <> p_product or v_existing.movement_type <> p_type or v_existing.quantity <> p_quantity then
      raise exception 'El identificador del movimiento ya se usó en otra operación' using errcode = '23505';
    end if;
    return p_id; -- reintento: el movimiento ya se aplicó
  end if;

  if p_quantity is null or p_quantity <= 0 or p_quantity <> round(p_quantity, 3) then
    raise exception 'La cantidad debe ser mayor que cero (máximo 3 decimales)' using errcode = '22023';
  end if;
  if p_date is null or p_date > public.mx_today() then
    raise exception 'La fecha del movimiento no es válida' using errcode = '22023';
  end if;

  -- Proyecto y parcela: solo consumos y devoluciones.
  if p_type in ('consumo', 'devolucion') then
    if p_project is null or p_plot is null then
      raise exception 'Los consumos y devoluciones requieren proyecto y parcela' using errcode = '22023';
    end if;
    v_project := public.lock_open_project(v_prod.organization_id, p_project);
    if not exists (select 1 from public.project_plots where project_id = p_project and plot_id = p_plot) then
      raise exception 'La parcela no está asignada al proyecto' using errcode = '22023';
    end if;
    if p_date < v_project.start_date then
      raise exception 'La fecha no puede ser anterior al inicio del proyecto' using errcode = '22023';
    end if;
  elsif p_project is not null or p_plot is not null then
    raise exception 'Solo los consumos y devoluciones se asignan a un proyecto' using errcode = '22023';
  end if;

  if p_type in ('entrada', 'ajuste_entrada', 'consumo') and not v_prod.is_active then
    raise exception 'El producto "%" está inactivo', v_prod.name using errcode = '22023';
  end if;

  -- Almacén: si no se indica y la organización tiene uno solo activo, se usa ese.
  if p_warehouse is null then
    select count(*), (array_agg(id))[1] into v_count, p_warehouse
    from public.warehouses where organization_id = v_prod.organization_id and is_active;
    if v_count <> 1 then
      raise exception 'Selecciona el almacén' using errcode = '22023';
    end if;
  end if;
  select * into v_warehouse from public.warehouses where id = p_warehouse and organization_id = v_prod.organization_id;
  if not found then
    raise exception 'Almacén no encontrado' using errcode = 'P0002';
  end if;
  if v_inflow and not v_warehouse.is_active then
    raise exception 'El almacén "%" está inactivo y no recibe producto', v_warehouse.name using errcode = '22023';
  end if;

  if p_type = 'transferencia' then
    if p_to_warehouse is null or p_to_warehouse = p_warehouse then
      raise exception 'Selecciona un almacén destino distinto al de origen' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.warehouses where id = p_to_warehouse and organization_id = v_prod.organization_id and is_active
    ) then
      raise exception 'El almacén destino no existe o está inactivo' using errcode = '22023';
    end if;
  elsif p_to_warehouse is not null then
    raise exception 'Solo las transferencias indican almacén destino' using errcode = '22023';
  end if;

  if p_supplier is not null then
    if p_type <> 'entrada' then
      raise exception 'Solo las entradas por compra indican proveedor' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.suppliers where id = p_supplier and organization_id = v_prod.organization_id and is_active
    ) then
      raise exception 'El proveedor no existe o está inactivo' using errcode = '22023';
    end if;
  end if;

  if p_responsible is not null and not exists (
    select 1 from public.employees where id = p_responsible and organization_id = v_prod.organization_id and is_active
  ) then
    raise exception 'El responsable no existe o está inactivo' using errcode = '22023';
  end if;

  -- Lotes: obligatorios si el producto se controla por lote, prohibidos si no.
  if v_prod.track_lots then
    if p_lot is not null then
      select * into v_lot from public.inventory_lots where id = p_lot and product_id = v_prod.id;
      if not found then
        raise exception 'El lote no pertenece al producto' using errcode = '22023';
      end if;
    elsif v_lot_number is not null then
      select * into v_lot from public.inventory_lots where product_id = v_prod.id and upper(lot_number) = upper(v_lot_number);
      if not found then
        if p_type not in ('entrada', 'ajuste_entrada') then
          raise exception 'El lote % no existe para "%"', v_lot_number, v_prod.name using errcode = '22023';
        end if;
        insert into public.inventory_lots (organization_id, product_id, lot_number, expiry_date)
        values (v_prod.organization_id, v_prod.id, v_lot_number, p_lot_expiry)
        returning * into v_lot;
      end if;
    else
      raise exception 'Indica el lote de "%"', v_prod.name using errcode = '22023';
    end if;

    if p_lot_expiry is not null and p_type in ('entrada', 'ajuste_entrada') then
      if v_lot.expiry_date is null then
        update public.inventory_lots set expiry_date = p_lot_expiry where id = v_lot.id;
      elsif v_lot.expiry_date <> p_lot_expiry then
        raise exception 'El lote % ya está registrado con caducidad %', v_lot.lot_number,
          to_char(v_lot.expiry_date, 'DD/MM/YYYY') using errcode = '22023';
      end if;
    end if;
    if p_type = 'consumo' and v_lot.expiry_date < p_date then
      raise exception 'El lote % de "%" caducó el %; regístralo como ajuste por merma', v_lot.lot_number, v_prod.name,
        to_char(v_lot.expiry_date, 'DD/MM/YYYY') using errcode = '22023';
    end if;
  elsif p_lot is not null or v_lot_number is not null then
    raise exception '"%" no se controla por lotes', v_prod.name using errcode = '22023';
  end if;

  case p_type
    when 'entrada' then
      if p_unit_cost is null or p_unit_cost < 0 then
        raise exception 'Indica el costo unitario de la entrada' using errcode = '22023';
      end if;
      v_total := round(p_quantity * p_unit_cost, 2);
    when 'ajuste_entrada' then
      v_total := round(p_quantity * coalesce(p_unit_cost, v_prod.avg_cost, 0), 2);
    when 'consumo', 'ajuste_salida', 'transferencia' then
      -- Las salidas se valoran al costo promedio (no se acepta costo manual).
      -- En transferencias el valor es informativo: el producto no cambia de valor.
      v_total := public.inventory_outflow_value(v_prod, p_quantity);
    when 'devolucion' then
      -- Se devuelve al costo neto con el que el proyecto consumió el producto.
      select
        coalesce(sum(case when movement_type = 'consumo' then quantity else -quantity end), 0),
        coalesce(sum(case when movement_type = 'consumo' then total_cost else -total_cost end), 0)
      into v_net_qty, v_net_cost
      from public.inventory_movements
      where project_id = p_project and product_id = p_product;
      if p_quantity > v_net_qty then
        raise exception 'El proyecto solo tiene % % netos consumidos de "%"', v_net_qty, v_prod.unit, v_prod.name
          using errcode = '22023';
      end if;
      v_total := case when p_quantity = v_net_qty then v_net_cost else round(v_net_cost * p_quantity / v_net_qty, 2) end;
  end case;

  return public.post_inventory_movement(
    p_id, v_prod, p_type, p_date, p_quantity, v_total, p_warehouse, p_to_warehouse, v_lot.id,
    p_project, p_plot, p_supplier, p_responsible, p_reference, p_notes, null
  );
end;
$$;

create or replace function public.register_inventory_movement(
  p_id uuid,
  p_product uuid,
  p_type public.inventory_movement_type,
  p_date date,
  p_quantity numeric,
  p_unit_cost numeric default null,
  p_project uuid default null,
  p_plot uuid default null,
  p_warehouse uuid default null,
  p_to_warehouse uuid default null,
  p_lot uuid default null,
  p_lot_number text default null,
  p_lot_expiry date default null,
  p_supplier uuid default null,
  p_responsible uuid default null,
  p_reference text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.inventory_products where id = p_product;
  if v_org is null or not public.is_member(v_org) then
    raise exception 'Producto no encontrado' using errcode = 'P0002';
  end if;
  if not public.has_role(v_org, array['propietario', 'administrador', 'almacen']::public.app_role[]) then
    raise exception 'No tienes permiso para registrar movimientos de inventario' using errcode = '42501';
  end if;
  return public.process_inventory_movement(
    p_id, p_product, p_type, p_date, p_quantity, p_unit_cost, p_project, p_plot, p_warehouse, p_to_warehouse,
    p_lot, p_lot_number, p_lot_expiry, p_supplier, p_responsible, p_reference, p_notes
  );
end;
$$;

-- Anula un movimiento con su contrapartida exacta (misma cantidad, valor,
-- almacén y lote), conservando ambos en el historial. Uso interno.
create or replace function public.process_inventory_reversal(p_id uuid, p_movement uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mov public.inventory_movements%rowtype;
  v_prod public.inventory_products%rowtype;
  v_type public.inventory_movement_type;
  v_total numeric;
begin
  if p_id is null then
    raise exception 'Falta el identificador del movimiento' using errcode = '22023';
  end if;

  select * into v_mov from public.inventory_movements where id = p_movement;
  if not found then
    raise exception 'Movimiento no encontrado' using errcode = 'P0002';
  end if;
  select * into v_prod from public.inventory_products where id = v_mov.product_id for update;

  if exists (select 1 from public.inventory_movements where id = p_id) then
    if exists (select 1 from public.inventory_movements where id = p_id and reverses_id = p_movement) then
      return p_id; -- reintento
    end if;
    raise exception 'El identificador del movimiento ya se usó en otra operación' using errcode = '23505';
  end if;
  if v_mov.reverses_id is not null then
    raise exception 'Un movimiento de anulación no puede anularse' using errcode = '22023';
  end if;
  if exists (select 1 from public.inventory_movements where reverses_id = p_movement) then
    raise exception 'El movimiento ya fue anulado' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Indica el motivo de la anulación' using errcode = '22023';
  end if;
  if v_mov.project_id is not null then
    perform public.lock_open_project(v_mov.organization_id, v_mov.project_id);
  end if;

  v_type := case v_mov.movement_type
    when 'entrada' then 'ajuste_salida'
    when 'ajuste_entrada' then 'ajuste_salida'
    when 'ajuste_salida' then 'ajuste_entrada'
    when 'consumo' then 'devolucion'
    when 'devolucion' then 'consumo'
    when 'transferencia' then 'transferencia'
  end;
  if v_type = 'devolucion' and v_mov.quantity > (
    select coalesce(sum(case when movement_type = 'consumo' then quantity else -quantity end), 0)
    from public.inventory_movements
    where project_id = v_mov.project_id and product_id = v_mov.product_id
  ) then
    raise exception 'Parte de este consumo ya se devolvió; anula primero la devolución' using errcode = '22023';
  end if;

  v_total := v_mov.total_cost;
  -- Si la anulación vacía el almacén, sale exactamente el valor restante.
  if v_type in ('ajuste_salida', 'consumo') and v_mov.quantity = v_prod.stock then
    v_total := v_prod.stock_value;
  end if;

  return public.post_inventory_movement(
    p_id, v_prod, v_type, public.mx_today(), v_mov.quantity, v_total,
    case when v_type = 'transferencia' then v_mov.to_warehouse_id else v_mov.warehouse_id end,
    case when v_type = 'transferencia' then v_mov.warehouse_id end,
    v_mov.lot_id, v_mov.project_id, v_mov.plot_id, null, null,
    v_mov.reference, 'Anulación: ' || trim(p_reason), p_movement
  );
end;
$$;

create or replace function public.reverse_inventory_movement(p_id uuid, p_movement uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.inventory_movements where id = p_movement;
  if v_org is null or not public.is_member(v_org) then
    raise exception 'Movimiento no encontrado' using errcode = 'P0002';
  end if;
  if not public.has_role(v_org, array['propietario', 'administrador', 'almacen']::public.app_role[]) then
    raise exception 'No tienes permiso para anular movimientos de inventario' using errcode = '42501';
  end if;
  -- Los consumos generados por una aplicación o por el combustible de un uso de
  -- maquinaria se revierten desde su registro, para que ambos queden coherentes.
  if exists (select 1 from public.chemical_applications where inventory_movement_id = p_movement) then
    raise exception 'Este consumo pertenece a una aplicación de agroquímicos; cancélala desde Bitácoras' using errcode = '22023';
  end if;
  if exists (select 1 from public.machinery_usage where fuel_movement_id = p_movement) then
    raise exception 'Este consumo es combustible de un uso de maquinaria; elimina ese registro desde Maquinaria' using errcode = '22023';
  end if;
  return public.process_inventory_reversal(p_id, p_movement, p_reason);
end;
$$;

-- -----------------------------------------------------------------------------
-- Maquinaria: uso con combustible del almacén (RPC transaccional)
-- -----------------------------------------------------------------------------
create or replace function public.register_machinery_usage(
  p_id uuid,
  p_machine uuid,
  p_project uuid,
  p_date date,
  p_hours numeric,
  p_plot uuid default null,
  p_rate_basis public.machine_rate_basis default 'hora',
  p_jornadas numeric default null,
  p_rate numeric default null,
  p_operator_id uuid default null,
  p_operator text default null,
  p_activity_type uuid default null,
  p_activity text default null,
  p_fuel_quantity numeric default null,
  p_fuel_product uuid default null,
  p_fuel_warehouse uuid default null,
  p_fuel_lot uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_machine public.machinery%rowtype;
  v_kind public.input_kind;
  v_movement uuid;
begin
  if p_id is null then
    raise exception 'Falta el identificador del registro' using errcode = '22023';
  end if;
  select * into v_machine from public.machinery where id = p_machine;
  if not found or not public.is_member(v_machine.organization_id) then
    raise exception 'Equipo no encontrado' using errcode = 'P0002';
  end if;
  if not public.has_role(v_machine.organization_id, array['propietario', 'administrador', 'agronomo']::public.app_role[]) then
    raise exception 'No tienes permiso para registrar uso de maquinaria' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  if exists (select 1 from public.machinery_usage where id = p_id) then
    if exists (select 1 from public.machinery_usage where id = p_id and machine_id = p_machine and project_id = p_project) then
      return p_id; -- reintento: el uso ya se registró
    end if;
    raise exception 'El identificador del registro ya se usó en otra operación' using errcode = '23505';
  end if;

  if p_fuel_product is not null then
    if p_fuel_quantity is null then
      raise exception 'Indica la cantidad de combustible' using errcode = '22023';
    end if;
    select c.kind into v_kind
    from public.inventory_products p
    join public.inventory_categories c on c.id = p.category_id
    where p.id = p_fuel_product and p.organization_id = v_machine.organization_id;
    if not found then
      raise exception 'Producto no encontrado' using errcode = 'P0002';
    end if;
    if v_kind <> 'combustible' then
      raise exception 'El producto seleccionado no es de la categoría combustibles' using errcode = '22023';
    end if;
    if p_plot is null then
      raise exception 'Para surtir combustible del almacén indica la parcela' using errcode = '22023';
    end if;
    v_movement := public.process_inventory_movement(
      gen_random_uuid(), p_fuel_product, 'consumo', p_date, p_fuel_quantity, null, p_project, p_plot,
      p_fuel_warehouse, null, p_fuel_lot, null, null, null, p_operator_id, null, 'Combustible · ' || v_machine.name
    );
  end if;

  insert into public.machinery_usage (
    id, organization_id, machine_id, project_id, plot_id, usage_date, hours, rate_basis, jornadas, rate,
    operator_id, operator, activity_type_id, activity, fuel_quantity, fuel_movement_id, notes
  ) values (
    p_id, v_machine.organization_id, p_machine, p_project, p_plot, p_date, p_hours, p_rate_basis, p_jornadas, p_rate,
    p_operator_id, nullif(trim(p_operator), ''), p_activity_type, nullif(trim(p_activity), ''), p_fuel_quantity,
    v_movement, nullif(trim(p_notes), '')
  );
  return p_id;
end;
$$;

-- Eliminar un uso con combustible del almacén regresa el combustible (y su costo).
create or replace function public.after_machinery_usage_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.fuel_movement_id is not null then
    perform public.process_inventory_reversal(gen_random_uuid(), old.fuel_movement_id, 'Se eliminó el uso de maquinaria');
  end if;
  return null;
end;
$$;

create trigger machinery_usage_return_fuel after delete on public.machinery_usage
  for each row execute function public.after_machinery_usage_delete();

-- -----------------------------------------------------------------------------
-- Bitácoras: aplicación de agroquímicos (con salida de almacén) y cancelaciones
-- -----------------------------------------------------------------------------
create or replace function public.register_chemical_application(
  p_id uuid,
  p_project uuid,
  p_plot uuid,
  p_date date,
  p_product uuid,
  p_quantity numeric,
  p_treated_area numeric,
  p_issue_from_stock boolean default true,
  p_warehouse uuid default null,
  p_lot uuid default null,
  p_lot_number text default null,
  p_time time default null,
  p_active_ingredient text default null,
  p_responsible uuid default null,
  p_machine uuid default null,
  p_equipment text default null,
  p_reentry_hours int default null,
  p_preharvest_days int default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_prod public.inventory_products%rowtype;
  v_kind public.input_kind;
  v_area numeric;
  v_movement uuid;
  v_lot uuid;
  v_lot_number text := nullif(trim(p_lot_number), '');
begin
  if p_id is null then
    raise exception 'Falta el identificador del registro' using errcode = '22023';
  end if;
  select * into v_project from public.projects where id = p_project;
  if not found or not public.is_member(v_project.organization_id) then
    raise exception 'Proyecto no encontrado' using errcode = 'P0002';
  end if;
  if not public.has_role(v_project.organization_id,
                         array['propietario', 'administrador', 'agronomo', 'supervisor']::public.app_role[]) then
    raise exception 'No tienes permiso para registrar aplicaciones' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  if exists (select 1 from public.chemical_applications where id = p_id) then
    if exists (select 1 from public.chemical_applications where id = p_id and project_id = p_project and product_id = p_product) then
      return p_id; -- reintento: la aplicación ya se registró
    end if;
    raise exception 'El identificador del registro ya se usó en otra operación' using errcode = '23505';
  end if;

  select * into v_prod from public.inventory_products where id = p_product and organization_id = v_project.organization_id;
  if not found then
    raise exception 'Producto no encontrado' using errcode = 'P0002';
  end if;
  select kind into v_kind from public.inventory_categories where id = v_prod.category_id;
  if v_kind not in ('agroquimico', 'biologico', 'fertilizante') then
    raise exception 'Solo se registran aplicaciones de agroquímicos, productos biológicos o fertilizantes' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity <> round(p_quantity, 3) then
    raise exception 'La cantidad aplicada debe ser mayor que cero (máximo 3 decimales)' using errcode = '22023';
  end if;

  select assigned_area_ha into v_area from public.project_plots where project_id = p_project and plot_id = p_plot;
  if not found then
    raise exception 'La parcela no está asignada al proyecto' using errcode = '22023';
  end if;
  if p_treated_area is null or p_treated_area <= 0 or p_treated_area > v_area then
    raise exception 'La superficie tratada debe ser mayor que cero y no exceder % ha asignadas', v_area using errcode = '22023';
  end if;

  if p_issue_from_stock then
    v_movement := public.process_inventory_movement(
      gen_random_uuid(), p_product, 'consumo', p_date, p_quantity, null, p_project, p_plot,
      p_warehouse, null, p_lot, case when v_prod.track_lots then v_lot_number end, null, null, p_responsible, null,
      'Aplicación en campo'
    );
    select m.lot_id, l.lot_number into v_lot, v_lot_number
    from public.inventory_movements m
    left join public.inventory_lots l on l.id = m.lot_id
    where m.id = v_movement;
    v_lot_number := coalesce(v_lot_number, nullif(trim(p_lot_number), ''));
  elsif p_lot is not null then
    select id, lot_number into v_lot, v_lot_number from public.inventory_lots where id = p_lot and product_id = p_product;
    if not found then
      raise exception 'El lote no pertenece al producto' using errcode = '22023';
    end if;
  end if;

  insert into public.chemical_applications (
    id, organization_id, project_id, plot_id, application_date, application_time, product_id, active_ingredient,
    quantity, unit, treated_area_ha, responsible_id, machine_id, equipment, lot_id, lot_number,
    reentry_hours, preharvest_days, inventory_movement_id, notes
  ) values (
    p_id, v_project.organization_id, p_project, p_plot, p_date, p_time, p_product, nullif(trim(p_active_ingredient), ''),
    p_quantity, v_prod.unit, p_treated_area, p_responsible, p_machine, nullif(trim(p_equipment), ''), v_lot, v_lot_number,
    p_reentry_hours, p_preharvest_days, v_movement, nullif(trim(p_notes), '')
  );
  return p_id;
end;
$$;

-- Cancela la aplicación y, si salió del almacén, regresa el producto y su costo.
create or replace function public.cancel_chemical_application(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.chemical_applications%rowtype;
begin
  select * into v_app from public.chemical_applications where id = p_id for update;
  if not found or not public.is_member(v_app.organization_id) then
    raise exception 'Aplicación no encontrada' using errcode = 'P0002';
  end if;
  if not public.has_role(v_app.organization_id,
                         array['propietario', 'administrador', 'agronomo', 'supervisor']::public.app_role[]) then
    raise exception 'No tienes permiso para cancelar aplicaciones' using errcode = '42501';
  end if;
  if v_app.status = 'cancelado' then
    raise exception 'La aplicación ya está cancelada' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Indica el motivo de la cancelación' using errcode = '22023';
  end if;

  update public.chemical_applications
  set status = 'cancelado', cancel_reason = trim(p_reason), cancelled_at = now(), cancelled_by = auth.uid()
  where id = p_id;
  if v_app.inventory_movement_id is not null then
    perform public.process_inventory_reversal(gen_random_uuid(), v_app.inventory_movement_id,
                                              'Cancelación de aplicación: ' || trim(p_reason));
  end if;
end;
$$;

-- Cancelación con motivo de riegos, actividades y mantenimientos.
create or replace function public.cancel_field_record(p_kind text, p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table text := case p_kind
    when 'riego' then 'irrigation_logs'
    when 'actividad' then 'field_activities'
    when 'mantenimiento' then 'machinery_maintenance'
  end;
  v_roles public.app_role[] := case p_kind
    when 'mantenimiento' then array['propietario', 'administrador', 'agronomo']::public.app_role[]
    else array['propietario', 'administrador', 'agronomo', 'supervisor']::public.app_role[]
  end;
  v_org uuid;
  v_status public.log_status;
begin
  if v_table is null then
    raise exception 'Tipo de registro no válido' using errcode = '22023';
  end if;
  execute format('select organization_id, status from public.%I where id = $1 for update', v_table)
    into v_org, v_status using p_id;
  if v_org is null or not public.is_member(v_org) then
    raise exception 'Registro no encontrado' using errcode = 'P0002';
  end if;
  if not public.has_role(v_org, v_roles) then
    raise exception 'No tienes permiso para cancelar este registro' using errcode = '42501';
  end if;
  if v_status = 'cancelado' then
    raise exception 'El registro ya está cancelado' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Indica el motivo de la cancelación' using errcode = '22023';
  end if;
  execute format(
    'update public.%I set status = ''cancelado'', cancel_reason = $2, cancelled_at = now(), cancelled_by = auth.uid() where id = $1',
    v_table) using p_id, trim(p_reason);
end;
$$;

-- -----------------------------------------------------------------------------
-- Personal: registro de una cuadrilla (una jornada por integrante, atómico)
-- -----------------------------------------------------------------------------
create or replace function public.register_crew_labor(
  p_id uuid,
  p_crew uuid,
  p_project uuid,
  p_date date,
  p_activity text,
  p_quantity numeric,
  p_pay_type public.labor_pay_type default 'jornal',
  p_plot uuid default null,
  p_activity_type uuid default null,
  p_unit_label text default null,
  p_unit_rate numeric default null,
  p_employees uuid[] default null,
  p_notes text default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_crew public.crews%rowtype;
  v_count int;
begin
  if p_id is null then
    raise exception 'Falta el identificador del registro' using errcode = '22023';
  end if;
  select * into v_crew from public.crews where id = p_crew;
  if not found or not public.is_member(v_crew.organization_id) then
    raise exception 'Cuadrilla no encontrada' using errcode = 'P0002';
  end if;
  if not public.has_role(v_crew.organization_id,
                         array['propietario', 'administrador', 'agronomo', 'supervisor']::public.app_role[]) then
    raise exception 'No tienes permiso para registrar mano de obra' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  select count(*) into v_count from public.labor_records where batch_id = p_id;
  if v_count > 0 then
    return v_count; -- reintento: la cuadrilla ya se registró
  end if;

  if not v_crew.is_active then
    raise exception 'La cuadrilla "%" está inactiva', v_crew.name using errcode = '22023';
  end if;
  if p_employees is not null and exists (
    select 1 from unnest(p_employees) e(id)
    where not exists (select 1 from public.crew_members cm where cm.crew_id = p_crew and cm.employee_id = e.id)
  ) then
    raise exception 'Algún trabajador seleccionado no pertenece a la cuadrilla' using errcode = '22023';
  end if;

  -- El orden por empleado evita interbloqueos con otros registros simultáneos.
  insert into public.labor_records (
    organization_id, project_id, plot_id, employee_id, crew_id, batch_id, work_date, activity, activity_type_id,
    pay_type, quantity, unit_label, unit_rate, notes
  )
  select v_crew.organization_id, p_project, p_plot, cm.employee_id, p_crew, p_id, p_date, trim(p_activity), p_activity_type,
         p_pay_type, p_quantity, case when p_pay_type = 'destajo' then nullif(trim(p_unit_label), '') end, p_unit_rate,
         nullif(trim(p_notes), '')
  from public.crew_members cm
  join public.employees e on e.id = cm.employee_id
  where cm.crew_id = p_crew and e.is_active and (p_employees is null or cm.employee_id = any (p_employees))
  order by cm.employee_id;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'La cuadrilla no tiene trabajadores activos seleccionados' using errcode = '22023';
  end if;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Vistas
-- -----------------------------------------------------------------------------

-- Fuente única de costos (se recrea para incluir actividades y tarifas por jornada).
create view public.v_project_cost_entries with (security_invoker = true) as
  select
    m.organization_id, m.project_id, m.plot_id, 'insumos'::text as source, m.id as source_id,
    m.movement_date as entry_date, p.name as concept,
    (case when m.movement_type = 'devolucion' then 'Devolución · ' else '' end) || trim(to_char(m.quantity, 'FM999,999,990.999')) || ' ' || m.unit as detail,
    case when m.movement_type = 'devolucion' then -m.total_cost else m.total_cost end as amount,
    null::public.expense_category as expense_category, m.created_at
  from public.inventory_movements m
  join public.inventory_products p on p.id = m.product_id
  where m.movement_type in ('consumo', 'devolucion')
  union all
  select
    u.organization_id, u.project_id, u.plot_id, 'maquinaria', u.id,
    u.usage_date, mc.name,
    case when u.rate_basis = 'jornada'
      then trim(to_char(u.jornadas, 'FM990.99')) || ' jornada(s)'
      else trim(to_char(u.hours, 'FM9,990.99')) || ' h'
    end || ' × $' || to_char(u.rate, 'FM999,999,990.00') || coalesce(' · ' || u.activity, ''),
    u.amount, null, u.created_at
  from public.machinery_usage u
  join public.machinery mc on mc.id = u.machine_id
  union all
  select
    l.organization_id, l.project_id, l.plot_id, 'mano_obra', l.id,
    l.work_date, l.activity,
    coalesce(e.full_name, l.crew) || ' · ' || trim(to_char(l.quantity, 'FM999,990.99')) || ' ' ||
      case when l.pay_type = 'jornal' then 'jornal(es)' else coalesce(l.unit_label, 'unidad(es)') end,
    l.amount, null, l.created_at
  from public.labor_records l
  left join public.employees e on e.id = l.employee_id
  union all
  select
    x.organization_id, x.project_id, x.plot_id, 'gastos', x.id,
    x.expense_date, x.description,
    concat_ws(' · ', x.supplier, x.invoice_ref),
    x.amount, x.category, x.created_at
  from public.project_expenses x
  union all
  select
    a.organization_id, a.project_id, a.plot_id, 'actividades', a.id,
    a.activity_date, t.name,
    coalesce(a.description, 'Costo adicional de la actividad'),
    a.cost, null, a.created_at
  from public.field_activities a
  join public.activity_types t on t.id = a.activity_type_id
  where a.status = 'registrado' and a.cost > 0;

create view public.v_project_costs with (security_invoker = true) as
  with costs as (
    select
      project_id,
      sum(amount) filter (where source = 'insumos')     as inputs_cost,
      sum(amount) filter (where source = 'maquinaria')  as machinery_cost,
      sum(amount) filter (where source = 'mano_obra')   as labor_cost,
      sum(amount) filter (where source = 'gastos')      as expenses_cost,
      sum(amount) filter (where source = 'actividades') as activities_cost,
      sum(amount)                                       as total_cost
    from public.v_project_cost_entries
    group by project_id
  ),
  area as (
    select project_id, sum(assigned_area_ha) as area_ha from public.project_plots group by project_id
  ),
  harvested as (
    select project_id, sum(quantity_kg) as kg from public.harvests group by project_id
  ),
  sold as (
    select si.project_id, sum(si.quantity_kg) as kg, sum(si.amount) as amount
    from public.sale_items si
    join public.sales s on s.id = si.sale_id
    where s.status = 'vigente'
    group by si.project_id
  ),
  collected as (
    select si.project_id, sum(s.amount_paid * si.amount / s.total) as amount
    from public.sale_items si
    join public.sales s on s.id = si.sale_id
    where s.status = 'vigente' and s.total > 0
    group by si.project_id
  )
  select
    p.id as project_id,
    p.organization_id,
    p.code,
    p.name,
    p.status,
    p.budget_amount,
    coalesce(a.area_ha, 0)            as area_ha,
    coalesce(c.inputs_cost, 0)        as inputs_cost,
    coalesce(c.machinery_cost, 0)     as machinery_cost,
    coalesce(c.labor_cost, 0)         as labor_cost,
    coalesce(c.expenses_cost, 0)      as expenses_cost,
    coalesce(c.activities_cost, 0)    as activities_cost,
    coalesce(c.total_cost, 0)         as total_cost,
    case when a.area_ha > 0 then round(coalesce(c.total_cost, 0) / a.area_ha, 2) end as cost_per_ha,
    coalesce(h.kg, 0)                 as harvested_kg,
    case when h.kg > 0 then round(coalesce(c.total_cost, 0) / h.kg, 4) end as cost_per_kg,
    case when a.area_ha > 0 then round(coalesce(h.kg, 0) / a.area_ha, 3) end as yield_kg_per_ha,
    coalesce(so.kg, 0)                as sold_kg,
    coalesce(h.kg, 0) - coalesce(so.kg, 0) as available_kg,
    coalesce(so.amount, 0)            as sales_amount,
    round(coalesce(co.amount, 0), 2)  as collected_amount,
    coalesce(so.amount, 0) - round(coalesce(co.amount, 0), 2) as receivable_amount,
    coalesce(so.amount, 0) - coalesce(c.total_cost, 0) as gross_profit,
    case when p.budget_amount > 0 then round(coalesce(c.total_cost, 0) * 100 / p.budget_amount, 1) end as budget_used_pct
  from public.projects p
  left join costs c on c.project_id = p.id
  left join area a on a.project_id = p.id
  left join harvested h on h.project_id = p.id
  left join sold so on so.project_id = p.id
  left join collected co on co.project_id = p.id;

-- Existencias por almacén y lote, con días a caducidad.
create view public.v_inventory_stock with (security_invoker = true) as
  select
    b.id,
    b.organization_id,
    b.product_id,
    p.name as product_name,
    p.sku,
    p.unit,
    p.category_id,
    c.name as category_name,
    c.kind as category_kind,
    p.is_active as product_active,
    b.warehouse_id,
    w.name as warehouse_name,
    b.lot_id,
    l.lot_number,
    l.expiry_date,
    case when l.expiry_date is not null then l.expiry_date - public.mx_today() end as days_to_expiry,
    b.quantity,
    p.avg_cost,
    -- Estimado: el valor exacto del producto es inventory_products.stock_value.
    round(b.quantity * coalesce(p.avg_cost, 0), 2) as estimated_value,
    b.updated_at
  from public.inventory_balances b
  join public.inventory_products p on p.id = b.product_id
  join public.inventory_categories c on c.id = p.category_id
  join public.warehouses w on w.id = b.warehouse_id
  left join public.inventory_lots l on l.id = b.lot_id
  where b.quantity > 0;

-- Horas, costos y alertas de mantenimiento por equipo. Las horas desde el
-- último servicio cuentan los usos posteriores al último preventivo.
create view public.v_machinery_status with (security_invoker = true) as
  with last_service as (
    select machine_id, max(maintenance_date) as last_date
    from public.machinery_maintenance
    where status = 'registrado' and kind = 'preventivo'
    group by machine_id
  ),
  usage_totals as (
    select
      u.machine_id,
      count(*) as usage_count,
      sum(u.hours) as total_hours,
      sum(u.amount) as usage_amount,
      max(u.usage_date) as last_usage_date,
      coalesce(sum(u.hours) filter (where ls.last_date is null or u.usage_date > ls.last_date), 0) as hours_since_service
    from public.machinery_usage u
    left join last_service ls on ls.machine_id = u.machine_id
    group by u.machine_id
  ),
  maintenance as (
    select
      machine_id,
      count(*) as maintenance_count,
      sum(cost) as maintenance_cost,
      sum(cost) filter (where kind = 'correctivo') as repair_cost
    from public.machinery_maintenance
    where status = 'registrado'
    group by machine_id
  ),
  base as (
    select
      m.id as machine_id,
      m.organization_id,
      m.name,
      m.status,
      m.maintenance_interval_hours,
      m.maintenance_interval_days,
      coalesce(u.usage_count, 0) as usage_count,
      coalesce(u.total_hours, 0) as total_hours,
      coalesce(u.usage_amount, 0) as usage_amount,
      u.last_usage_date,
      coalesce(u.hours_since_service, 0) as hours_since_service,
      coalesce(mt.maintenance_count, 0) as maintenance_count,
      coalesce(mt.maintenance_cost, 0) as maintenance_cost,
      coalesce(mt.repair_cost, 0) as repair_cost,
      ls.last_date as last_service_date,
      case when m.maintenance_interval_days is not null
        then coalesce(ls.last_date, m.acquisition_date, m.created_at::date) + m.maintenance_interval_days
      end as next_service_date
    from public.machinery m
    left join usage_totals u on u.machine_id = m.id
    left join maintenance mt on mt.machine_id = m.id
    left join last_service ls on ls.machine_id = m.id
  )
  select
    b.*,
    case when b.maintenance_interval_hours is not null
      then b.maintenance_interval_hours - b.hours_since_service
    end as hours_to_service,
    case
      when b.status = 'baja' then 'no_aplica'
      when b.maintenance_interval_hours is null and b.maintenance_interval_days is null then 'sin_programa'
      when b.hours_since_service >= b.maintenance_interval_hours or b.next_service_date <= public.mx_today() then 'vencido'
      when b.hours_since_service >= b.maintenance_interval_hours * 0.9 or b.next_service_date <= public.mx_today() + 7 then 'proximo'
      else 'al_dia'
    end as maintenance_alert
  from base b;

-- Bitácora cronológica del proyecto: riegos, aplicaciones, actividades, mano
-- de obra, maquinaria y consumos de insumos (los consumos generados por una
-- aplicación o por combustible se muestran dentro de su registro).
create view public.v_project_timeline with (security_invoker = true) as
  select
    r.organization_id, r.project_id, r.plot_id, 'riego'::text as kind, r.id as source_id,
    r.log_date as event_date, r.start_time as event_time,
    'Riego · ' || replace(r.irrigation_system::text, '_', ' ') as title,
    trim(to_char(r.duration_minutes / 60.0, 'FM9,990.0')) || ' h'
      || coalesce(' · ' || trim(to_char(r.water_m3, 'FM999,999,990.00')) || ' m³', '') as detail,
    e.full_name as responsible, null::numeric as amount, r.status = 'cancelado' as cancelled, r.created_at
  from public.irrigation_logs r
  left join public.employees e on e.id = r.responsible_id
  union all
  select
    a.organization_id, a.project_id, a.plot_id, 'aplicacion', a.id,
    a.application_date, a.application_time,
    'Aplicación · ' || p.name,
    trim(to_char(a.quantity, 'FM999,999,990.999')) || ' ' || a.unit || ' en '
      || trim(to_char(a.treated_area_ha, 'FM999,990.00')) || ' ha' || coalesce(' · lote ' || a.lot_number, ''),
    e.full_name, m.total_cost, a.status = 'cancelado', a.created_at
  from public.chemical_applications a
  join public.inventory_products p on p.id = a.product_id
  left join public.employees e on e.id = a.responsible_id
  left join public.inventory_movements m on m.id = a.inventory_movement_id
  union all
  select
    f.organization_id, f.project_id, f.plot_id, 'actividad', f.id,
    f.activity_date, null::time,
    t.name, f.description, e.full_name, nullif(f.cost, 0), f.status = 'cancelado', f.created_at
  from public.field_activities f
  join public.activity_types t on t.id = f.activity_type_id
  left join public.employees e on e.id = f.responsible_id
  union all
  select
    l.organization_id, l.project_id, l.plot_id, 'mano_obra', l.id,
    l.work_date, null::time,
    'Mano de obra · ' || l.activity,
    trim(to_char(l.quantity, 'FM999,990.99')) || ' ' ||
      case when l.pay_type = 'jornal' then 'jornal(es)' else coalesce(l.unit_label, 'unidad(es)') end
      || coalesce(' · ' || c.name, ''),
    coalesce(e.full_name, l.crew), l.amount, false, l.created_at
  from public.labor_records l
  left join public.employees e on e.id = l.employee_id
  left join public.crews c on c.id = l.crew_id
  union all
  select
    u.organization_id, u.project_id, u.plot_id, 'maquinaria', u.id,
    u.usage_date, null::time,
    'Maquinaria · ' || mc.name,
    trim(to_char(u.hours, 'FM9,990.99')) || ' h' || coalesce(' · ' || u.activity, '')
      || coalesce(' · ' || trim(to_char(u.fuel_quantity, 'FM999,990.0')) || ' l combustible', ''),
    coalesce(op.full_name, u.operator), u.amount + coalesce(fm.total_cost, 0), false, u.created_at
  from public.machinery_usage u
  join public.machinery mc on mc.id = u.machine_id
  left join public.employees op on op.id = u.operator_id
  left join public.inventory_movements fm on fm.id = u.fuel_movement_id
  union all
  select
    m.organization_id, m.project_id, m.plot_id, 'insumo', m.id,
    m.movement_date, null::time,
    case when m.movement_type = 'devolucion' then 'Devolución · ' else 'Consumo · ' end || p.name,
    trim(to_char(m.quantity, 'FM999,999,990.999')) || ' ' || m.unit,
    e.full_name, case when m.movement_type = 'devolucion' then -m.total_cost else m.total_cost end, false, m.created_at
  from public.inventory_movements m
  join public.inventory_products p on p.id = m.product_id
  left join public.employees e on e.id = m.responsible_id
  where m.movement_type in ('consumo', 'devolucion')
    and not exists (select 1 from public.chemical_applications a where a.inventory_movement_id in (m.id, m.reverses_id))
    and not exists (select 1 from public.machinery_usage u where u.fuel_movement_id in (m.id, m.reverses_id));

-- Indicadores financieros del dashboard (agrega el costo de actividades).
create or replace function public.finance_summary(p_org uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with pc as (
    select * from public.v_project_costs where organization_id = p_org
  ),
  sb as (
    select * from public.v_sale_balances where organization_id = p_org and status = 'vigente'
  )
  select jsonb_build_object(
    'total_cost',      (select coalesce(sum(total_cost), 0) from pc),
    'inputs_cost',     (select coalesce(sum(inputs_cost), 0) from pc),
    'machinery_cost',  (select coalesce(sum(machinery_cost), 0) from pc),
    'labor_cost',      (select coalesce(sum(labor_cost), 0) from pc),
    'expenses_cost',   (select coalesce(sum(expenses_cost), 0) from pc),
    'activities_cost', (select coalesce(sum(activities_cost), 0) from pc),
    'period_cost',     (
      select coalesce(sum(amount), 0) from public.v_project_cost_entries
      where organization_id = p_org and entry_date >= date_trunc('month', public.mx_today())::date
    ),
    'harvested_kg',    (select coalesce(sum(harvested_kg), 0) from pc),
    'available_kg',    (select coalesce(sum(available_kg), 0) from pc),
    'sales_total',     (select coalesce(sum(total), 0) from sb),
    'sales_count',     (select count(*) from sb),
    'collected',       (select coalesce(sum(amount_paid), 0) from sb),
    'receivable',      (select coalesce(sum(balance), 0) from sb),
    'overdue',         (select coalesce(sum(balance), 0) from sb where days_overdue > 0),
    'overdue_count',   (select count(*) from sb where days_overdue > 0),
    'inventory_value', (select coalesce(sum(stock_value), 0) from public.inventory_products where organization_id = p_org)
  );
$$;

-- -----------------------------------------------------------------------------
-- Campos de auditoría y bitácora
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['inventory_categories', 'suppliers', 'warehouses', 'activity_types', 'inventory_lots',
                           'machinery_maintenance', 'crews', 'attendance_records', 'employee_assignments',
                           'irrigation_logs', 'chemical_applications', 'field_activities'] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_fields()',
      t || '_set_updated', t);
  end loop;

  foreach t in array array['inventory_categories', 'suppliers', 'warehouses', 'activity_types', 'inventory_lots',
                           'machinery_maintenance', 'crews', 'crew_members', 'attendance_records',
                           'employee_assignments', 'irrigation_logs', 'chemical_applications', 'field_activities',
                           'attachments'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.log_audit()',
      t || '_audit', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security (operación: lectura para todos los miembros)
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  -- tabla, roles de alta, roles de edición, roles de eliminación (null = sin acceso directo)
  for r in
    select * from (values
      ('inventory_categories',  '{propietario,administrador,almacen}',                '{propietario,administrador,almacen}',                '{propietario,administrador}'),
      ('suppliers',             '{propietario,administrador,almacen}',                '{propietario,administrador,almacen}',                '{propietario,administrador}'),
      ('warehouses',            '{propietario,administrador,almacen}',                '{propietario,administrador,almacen}',                '{propietario,administrador}'),
      ('inventory_lots',        null,                                                 '{propietario,administrador,almacen}',                null),
      ('inventory_balances',    null,                                                 null,                                                 null),
      ('activity_types',        '{propietario,administrador,agronomo}',               '{propietario,administrador,agronomo}',               '{propietario,administrador}'),
      ('machinery_maintenance', '{propietario,administrador,agronomo}',               '{propietario,administrador,agronomo}',               null),
      ('crews',                 '{propietario,administrador,agronomo}',               '{propietario,administrador,agronomo}',               '{propietario,administrador}'),
      ('crew_members',          '{propietario,administrador,agronomo}',               null,                                                 '{propietario,administrador,agronomo}'),
      ('employee_assignments',  '{propietario,administrador,agronomo}',               '{propietario,administrador,agronomo}',               '{propietario,administrador,agronomo}'),
      ('attendance_records',    '{propietario,administrador,agronomo,supervisor}',    '{propietario,administrador,agronomo,supervisor}',    '{propietario,administrador,agronomo,supervisor}'),
      ('irrigation_logs',       '{propietario,administrador,agronomo,supervisor}',    '{propietario,administrador,agronomo,supervisor}',    null),
      ('chemical_applications', null,                                                 '{propietario,administrador,agronomo,supervisor}',    null),
      ('field_activities',      '{propietario,administrador,agronomo,supervisor}',    '{propietario,administrador,agronomo,supervisor}',    null),
      ('attachments',           '{propietario,administrador,agronomo,supervisor}',    null,                                                 null)
    ) as t(tbl, inserters, updaters, deleters)
  loop
    execute format('alter table public.%I enable row level security', r.tbl);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_member(organization_id))',
      r.tbl || '_select', r.tbl);
    if r.inserters is not null then
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (public.has_role(organization_id, %L::public.app_role[]))',
        r.tbl || '_insert', r.tbl, r.inserters);
    end if;
    if r.updaters is not null then
      execute format(
        'create policy %I on public.%I for update to authenticated
           using (public.has_role(organization_id, %L::public.app_role[]))
           with check (public.has_role(organization_id, %L::public.app_role[]))',
        r.tbl || '_update', r.tbl, r.updaters, r.updaters);
    end if;
    if r.deleters is not null then
      execute format(
        'create policy %I on public.%I for delete to authenticated using (public.has_role(organization_id, %L::public.app_role[]))',
        r.tbl || '_delete', r.tbl, r.deleters);
    end if;
  end loop;
end;
$$;

-- Una evidencia la elimina quien la subió o un propietario/administrador.
create policy attachments_delete on public.attachments for delete to authenticated
  using (
    public.is_member(organization_id)
    and (created_by = auth.uid() or public.has_role(organization_id, array['propietario', 'administrador']::public.app_role[]))
  );

-- -----------------------------------------------------------------------------
-- Privilegios por columna. Existencias, lotes, saldos, estados de cancelación
-- y ligas a movimientos solo cambian por las funciones de esta migración.
-- -----------------------------------------------------------------------------
revoke all on public.inventory_categories, public.suppliers, public.warehouses, public.inventory_lots,
  public.inventory_balances, public.activity_types, public.machinery_maintenance, public.crews, public.crew_members,
  public.attendance_records, public.employee_assignments, public.irrigation_logs, public.chemical_applications,
  public.field_activities, public.attachments,
  public.v_project_cost_entries, public.v_project_costs, public.v_inventory_stock, public.v_machinery_status,
  public.v_project_timeline
from anon, authenticated;

grant select on public.inventory_categories, public.suppliers, public.warehouses, public.inventory_lots,
  public.inventory_balances, public.activity_types, public.machinery_maintenance, public.crews, public.crew_members,
  public.attendance_records, public.employee_assignments, public.irrigation_logs, public.chemical_applications,
  public.field_activities, public.attachments,
  public.v_project_cost_entries, public.v_project_costs, public.v_inventory_stock, public.v_machinery_status,
  public.v_project_timeline
to authenticated;

grant delete on public.inventory_categories, public.suppliers, public.warehouses, public.activity_types, public.crews,
  public.crew_members, public.employee_assignments, public.attendance_records, public.attachments
to authenticated;

grant insert (id, organization_id, name, kind, description, is_active) on public.inventory_categories to authenticated;
grant update (name, kind, description, is_active) on public.inventory_categories to authenticated;

grant insert (id, organization_id, name, rfc, contact_name, phone, email, address, notes, is_active)
  on public.suppliers to authenticated;
grant update (name, rfc, contact_name, phone, email, address, notes, is_active) on public.suppliers to authenticated;

grant insert (id, organization_id, name, code, farm_id, location, responsible_id, notes, is_active)
  on public.warehouses to authenticated;
grant update (name, code, farm_id, location, responsible_id, notes, is_active) on public.warehouses to authenticated;

grant update (expiry_date, notes) on public.inventory_lots to authenticated;

grant insert (id, organization_id, name, description, is_active) on public.activity_types to authenticated;
grant update (name, description, is_active) on public.activity_types to authenticated;

grant insert (id, organization_id, name, sku, category_id, unit, min_stock, track_lots, notes, is_active)
  on public.inventory_products to authenticated;
grant update (name, sku, category_id, unit, min_stock, track_lots, notes, is_active)
  on public.inventory_products to authenticated;

grant insert (id, organization_id, name, code, kind, brand, model, serial_number, acquisition_date, acquisition_cost,
  status, responsible_id, rate_basis, hourly_cost, daily_rate, maintenance_interval_hours, maintenance_interval_days, notes)
  on public.machinery to authenticated;
grant update (name, code, kind, brand, model, serial_number, acquisition_date, acquisition_cost, status, responsible_id,
  rate_basis, hourly_cost, daily_rate, maintenance_interval_hours, maintenance_interval_days, notes)
  on public.machinery to authenticated;

-- Con combustible del almacén el uso se registra por RPC; sin él, también por
-- inserción directa (fuel_movement_id nunca lo escribe el cliente).
grant insert (rate_basis, jornadas, operator_id, activity_type_id, fuel_quantity) on public.machinery_usage to authenticated;
grant update (rate_basis, jornadas, operator_id, activity_type_id) on public.machinery_usage to authenticated;

grant insert (id, organization_id, machine_id, maintenance_date, kind, description, provider, cost, hour_meter,
  responsible_id, notes)
  on public.machinery_maintenance to authenticated;
grant update (maintenance_date, kind, description, provider, cost, hour_meter, responsible_id, notes)
  on public.machinery_maintenance to authenticated;

grant insert (worker_type, hire_date) on public.employees to authenticated;
grant update (worker_type, hire_date) on public.employees to authenticated;

grant insert (crew_id, activity_type_id) on public.labor_records to authenticated;
grant update (activity_type_id) on public.labor_records to authenticated;

grant insert (id, organization_id, name, leader_id, notes, is_active) on public.crews to authenticated;
grant update (name, leader_id, notes, is_active) on public.crews to authenticated;

grant insert (id, organization_id, crew_id, employee_id) on public.crew_members to authenticated;

grant insert (id, organization_id, employee_id, work_date, status, check_in, check_out, notes)
  on public.attendance_records to authenticated;
grant update (status, check_in, check_out, notes) on public.attendance_records to authenticated;

grant insert (id, organization_id, employee_id, project_id, plot_id, crew_id, start_date, end_date, role, notes)
  on public.employee_assignments to authenticated;
grant update (plot_id, crew_id, start_date, end_date, role, notes) on public.employee_assignments to authenticated;

grant insert (id, organization_id, project_id, plot_id, log_date, start_time, end_time, irrigation_system, water_m3,
  responsible_id, notes)
  on public.irrigation_logs to authenticated;
grant update (log_date, start_time, end_time, irrigation_system, water_m3, responsible_id, notes)
  on public.irrigation_logs to authenticated;

-- Producto, cantidad, fecha y parcela quedan ligados a la salida de almacén;
-- para cambiarlos se cancela y se registra de nuevo.
grant update (application_time, active_ingredient, treated_area_ha, responsible_id, machine_id, equipment,
  reentry_hours, preharvest_days, notes)
  on public.chemical_applications to authenticated;

grant insert (id, organization_id, project_id, plot_id, activity_type_id, activity_date, description, responsible_id,
  cost, notes)
  on public.field_activities to authenticated;
grant update (plot_id, activity_type_id, activity_date, description, responsible_id, cost, notes)
  on public.field_activities to authenticated;

grant insert (id, organization_id, entity_type, entity_id, storage_path, file_name, mime_type, size_bytes)
  on public.attachments to authenticated;

revoke execute on function
  public.check_record_date(),
  public.prevent_cancelled_edit(),
  public.seed_organization_catalogs(uuid),
  public.handle_new_organization(),
  public.prevent_product_lot_change(),
  public.prevent_warehouse_deactivation(),
  public.prevent_movement_changes(),
  public.before_machinery_usage_write(),
  public.before_labor_record_write(),
  public.after_labor_record_insert(),
  public.before_attendance_write(),
  public.before_assignment_write(),
  public.before_irrigation_log_write(),
  public.check_attachment(),
  public.storage_object_org(text),
  public.apply_inventory_balance(public.inventory_products, uuid, uuid, numeric),
  public.post_inventory_movement(uuid, public.inventory_products, public.inventory_movement_type, date, numeric, numeric,
    uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, uuid),
  public.process_inventory_movement(uuid, uuid, public.inventory_movement_type, date, numeric, numeric, uuid, uuid, uuid,
    uuid, uuid, text, date, uuid, uuid, text, text),
  public.register_inventory_movement(uuid, uuid, public.inventory_movement_type, date, numeric, numeric, uuid, uuid, uuid,
    uuid, uuid, text, date, uuid, uuid, text, text),
  public.process_inventory_reversal(uuid, uuid, text),
  public.reverse_inventory_movement(uuid, uuid, text),
  public.register_machinery_usage(uuid, uuid, uuid, date, numeric, uuid, public.machine_rate_basis, numeric, numeric,
    uuid, text, uuid, text, numeric, uuid, uuid, uuid, text),
  public.after_machinery_usage_delete(),
  public.register_chemical_application(uuid, uuid, uuid, date, uuid, numeric, numeric, boolean, uuid, uuid, text, time,
    text, uuid, uuid, text, int, int, text),
  public.cancel_chemical_application(uuid, text),
  public.cancel_field_record(text, uuid, text),
  public.register_crew_labor(uuid, uuid, uuid, date, text, numeric, public.labor_pay_type, uuid, uuid, text, numeric,
    uuid[], text),
  public.finance_summary(uuid)
from public, anon;

revoke execute on function
  public.check_record_date(),
  public.prevent_cancelled_edit(),
  public.seed_organization_catalogs(uuid),
  public.handle_new_organization(),
  public.prevent_product_lot_change(),
  public.prevent_warehouse_deactivation(),
  public.prevent_movement_changes(),
  public.before_machinery_usage_write(),
  public.before_labor_record_write(),
  public.after_labor_record_insert(),
  public.before_attendance_write(),
  public.before_assignment_write(),
  public.before_irrigation_log_write(),
  public.check_attachment(),
  public.apply_inventory_balance(public.inventory_products, uuid, uuid, numeric),
  public.post_inventory_movement(uuid, public.inventory_products, public.inventory_movement_type, date, numeric, numeric,
    uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, uuid),
  public.process_inventory_movement(uuid, uuid, public.inventory_movement_type, date, numeric, numeric, uuid, uuid, uuid,
    uuid, uuid, text, date, uuid, uuid, text, text),
  public.process_inventory_reversal(uuid, uuid, text),
  public.after_machinery_usage_delete()
from authenticated;

-- storage_object_org se evalúa dentro de las políticas de Storage.
grant execute on function
  public.storage_object_org(text),
  public.register_inventory_movement(uuid, uuid, public.inventory_movement_type, date, numeric, numeric, uuid, uuid, uuid,
    uuid, uuid, text, date, uuid, uuid, text, text),
  public.reverse_inventory_movement(uuid, uuid, text),
  public.register_machinery_usage(uuid, uuid, uuid, date, numeric, uuid, public.machine_rate_basis, numeric, numeric,
    uuid, text, uuid, text, numeric, uuid, uuid, uuid, text),
  public.register_chemical_application(uuid, uuid, uuid, date, uuid, numeric, numeric, boolean, uuid, uuid, text, time,
    text, uuid, uuid, text, int, int, text),
  public.cancel_chemical_application(uuid, text),
  public.cancel_field_record(text, uuid, text),
  public.register_crew_labor(uuid, uuid, uuid, date, text, numeric, public.labor_pay_type, uuid, uuid, text, numeric,
    uuid[], text),
  public.finance_summary(uuid)
to authenticated;
