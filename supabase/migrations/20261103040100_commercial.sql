-- =============================================================================
-- AgroGestión 360 · Migración 0005 · Producción y comercialización
--
-- Amplía cosechas, clientes, ventas y pagos existentes (no crea módulos
-- paralelos):
--   · Cada corte registrado es un LOTE de producción (folio LOT-AAAA-0001) con
--     cantidad inicial, vendida, ajustada y disponible. Un corte de varias
--     calidades se captura como varios lotes con el mismo número de corte.
--   · Inventario de producto: libro inmutable production_movements (ventas,
--     reversos por cancelación, mermas, pérdidas y ajustes justificados). Las
--     existencias del lote solo cambian por post_production_movement().
--   · Ventas: borrador → confirmada (descuenta los lotes) → entregada; con pagos
--     pasa a parcialmente_pagada o pagada. Partidas por lote con unidad de
--     venta, precio unitario y descuento. Cancelar restituye los lotes con
--     movimientos de reversión.
--   · Entregas parciales por partida.
--   · Anticipos: se registran contra la venta y solo cuentan como pagado al
--     aplicarlos de forma explícita (advance_applications).
--   · Comprobantes de pago y fotografías de cortes en el bucket de evidencias.
--
-- Concurrencia: venta → lotes (FOR UPDATE, en orden de id) → proyectos
-- (FOR UPDATE). Las ediciones de un corte bloquean el lote y luego el proyecto
-- (trigger check_project_record), mismo orden, sin interbloqueos. La
-- restricción harvests_available_check garantiza además que ningún lote quede
-- con existencia negativa aunque una función omitiera la verificación.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.produce_unit as enum ('kg', 't', 'caja', 'saco', 'arpilla', 'reja');

create type public.customer_type as enum (
  'mayorista', 'minorista', 'empacadora', 'exportadora', 'industria', 'intermediario', 'otro'
);

create type public.production_movement_type as enum (
  'venta',             -- salida por confirmar una venta
  'cancelacion_venta', -- regreso al lote al cancelar la venta (reversa una salida)
  'merma',             -- deshidratación, selección, rezaga
  'perdida',           -- daño, descomposición, robo
  'ajuste_entrada',    -- conteo físico mayor al teórico
  'ajuste_salida',     -- conteo físico menor al teórico
  'reverso_ajuste'     -- anula una merma, pérdida o ajuste capturado por error
);

create type public.payment_kind as enum ('pago', 'anticipo');

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------

-- Kilogramos por unidad: kg y t son fijos; cajas, sacos, arpillas y rejas
-- llevan su peso neto capturado.
create or replace function public.produce_unit_kg(p_unit public.produce_unit, p_unit_weight numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case p_unit when 'kg' then 1::numeric when 't' then 1000::numeric else p_unit_weight end;
$$;

-- Una venta cuenta como venta (ingreso, salida de producto y cuenta por cobrar)
-- desde que se confirma y hasta que se cancela.
create or replace function public.sale_is_active(p_status public.sale_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_status not in ('borrador', 'cancelada');
$$;

-- Las vistas y funciones que dependen de las columnas que cambian se recrean
-- más abajo.
drop view public.v_project_costs;
drop view public.v_sale_balances;
drop trigger harvests_check_sales on public.harvests;
drop function public.check_harvest_vs_sales();
drop function public.project_sold_kg(uuid);
drop function public.project_harvested_kg(uuid);
drop function public.create_sale(uuid, uuid, date, jsonb, date, text);
drop function public.parse_sale_items(jsonb);
drop function public.register_payment(uuid, uuid, date, numeric, public.payment_method, text, text);

-- -----------------------------------------------------------------------------
-- Cortes = lotes de producción
-- -----------------------------------------------------------------------------
alter table public.harvests
  add column lot_code        text,
  add column cut_number      int check (cut_number between 1 and 999),
  add column unit            public.produce_unit not null default 'kg',
  add column quantity        numeric(14, 3) check (quantity > 0),
  add column unit_weight_kg  numeric(10, 3) check (unit_weight_kg > 0),
  add column classification  text check (char_length(classification) between 1 and 60),
  add column responsible_id  uuid,
  add column sold_kg         numeric(14, 3) not null default 0 check (sold_kg >= 0),
  add column adjusted_kg     numeric(14, 3) not null default 0,
  add column available_kg    numeric(14, 3) generated always as (quantity_kg - sold_kg - adjusted_kg) stored,
  add constraint harvests_org_id_key unique (organization_id, id),
  add constraint harvests_responsible_fkey foreign key (organization_id, responsible_id)
    references public.employees (organization_id, id) on delete restrict,
  add constraint harvests_unit_weight_check check ((unit in ('kg', 't')) = (unit_weight_kg is null)),
  add constraint harvests_available_check check (quantity_kg - sold_kg - adjusted_kg >= 0);

comment on column public.harvests.quantity is 'Cantidad en la unidad capturada (kg, t, cajas…).';
comment on column public.harvests.quantity_kg is 'Cantidad inicial del lote en kg (cantidad × kg por unidad). Base de costos y existencias.';
comment on column public.harvests.sold_kg is 'Kg vendidos en ventas confirmadas (solo lo modifica post_production_movement).';
comment on column public.harvests.adjusted_kg is 'Mermas, pérdidas y ajustes netos en kg (positivo = reduce la existencia).';

-- Datos existentes: la cantidad capturada era el peso; un número de corte por
-- fecha dentro de cada proyecto y un folio de lote por organización.
alter table public.harvests disable trigger harvests_check_project;
alter table public.harvests disable trigger harvests_audit;

update public.harvests h
set quantity = h.quantity_kg,
    cut_number = n.cut_number
from (
  select id, dense_rank() over (partition by project_id order by harvest_date)::int as cut_number
  from public.harvests
) n
where n.id = h.id;

do $$
declare
  r record;
begin
  for r in select id, organization_id from public.harvests order by organization_id, harvest_date, created_at, id loop
    update public.harvests set lot_code = public.next_folio(r.organization_id, 'lot', 'LOT') where id = r.id;
  end loop;
end;
$$;

alter table public.harvests enable trigger harvests_audit;

alter table public.harvests
  alter column lot_code set not null,
  alter column cut_number set not null,
  alter column quantity set not null,
  add constraint harvests_quantity_kg_unit_check
    check (quantity_kg = round(quantity * public.produce_unit_kg(unit, unit_weight_kg), 3));

create unique index harvests_org_lot_key on public.harvests (organization_id, upper(lot_code));
create index harvests_org_date_idx on public.harvests (organization_id, harvest_date desc);
create index harvests_responsible_idx on public.harvests (responsible_id) where responsible_id is not null;

-- -----------------------------------------------------------------------------
-- Clientes
-- -----------------------------------------------------------------------------
alter table public.customers add column customer_type public.customer_type not null default 'otro';

-- -----------------------------------------------------------------------------
-- Ventas: borrador, totales con descuento, anticipos y entrega
-- -----------------------------------------------------------------------------
alter table public.sales
  drop constraint sales_check1,
  drop constraint sales_check3,
  add column subtotal         numeric(14, 2) not null default 0 check (subtotal >= 0),
  add column discount         numeric(14, 2) not null default 0 check (discount >= 0),
  add column advance_balance  numeric(14, 2) not null default 0 check (advance_balance >= 0),
  add column delivery_date    date,
  add column confirmed_at     timestamptz,
  add column confirmed_by     uuid references auth.users (id) on delete set null,
  alter column status set default 'borrador';

comment on column public.sales.amount_paid is 'Pagos aplicados más anticipos aplicados.';
comment on column public.sales.advance_balance is 'Anticipos recibidos que aún no se aplican al saldo.';
comment on column public.sales.delivery_date is 'Fecha de entrega programada.';

update public.sales set subtotal = total, confirmed_at = created_at, confirmed_by = created_by;

alter table public.sales
  add constraint sales_totals_check check (total = subtotal - discount),
  add constraint sales_paid_check check (amount_paid >= 0 and amount_paid + advance_balance <= total),
  add constraint sales_draft_paid_check check (public.sale_is_active(status) or amount_paid = 0),
  add constraint sales_cancel_advance_check check (status <> 'cancelada' or advance_balance = 0),
  add constraint sales_confirmed_check check (status = 'cancelada' or (status = 'borrador') = (confirmed_at is null)),
  add constraint sales_delivery_date_check check (delivery_date >= sale_date);

create index sales_org_status_idx on public.sales (organization_id, status);

-- Partidas: lote, unidad de venta, precio por unidad y descuento.
alter table public.sale_items drop column amount;

alter table public.sale_items
  add column harvest_id          uuid,
  add column unit                public.produce_unit not null default 'kg',
  add column quantity            numeric(14, 3) check (quantity > 0),
  add column unit_weight_kg      numeric(10, 3) check (unit_weight_kg > 0),
  add column discount            numeric(14, 2) not null default 0 check (discount >= 0),
  add column delivered_quantity  numeric(14, 3) not null default 0 check (delivered_quantity >= 0),
  add constraint sale_items_org_id_key unique (organization_id, id),
  add constraint sale_items_lot_fkey foreign key (organization_id, harvest_id)
    references public.harvests (organization_id, id),
  add constraint sale_items_unit_weight_check check ((unit in ('kg', 't')) = (unit_weight_kg is null));

update public.sale_items set quantity = quantity_kg;

alter table public.sale_items
  alter column quantity set not null,
  add column gross_amount numeric(14, 2) generated always as (round(quantity * unit_price, 2)) stored,
  add column amount       numeric(14, 2) generated always as (round(quantity * unit_price, 2) - discount) stored,
  add constraint sale_items_quantity_kg_unit_check
    check (quantity_kg = round(quantity * public.produce_unit_kg(unit, unit_weight_kg), 3)),
  add constraint sale_items_discount_max_check check (discount <= round(quantity * unit_price, 2)),
  add constraint sale_items_delivered_max_check check (delivered_quantity <= quantity);

comment on column public.sale_items.unit_price is 'Precio por unidad de venta (kg, t, caja…).';
comment on column public.sale_items.harvest_id is
  'Lote vendido. Las partidas anteriores a la Fase 4 pueden no tenerlo: su origen está en production_movements.';

create index sale_items_lot_idx on public.sale_items (harvest_id) where harvest_id is not null;

-- -----------------------------------------------------------------------------
-- Pagos: anticipos con aplicación explícita
-- -----------------------------------------------------------------------------
alter table public.payments
  add column kind            public.payment_kind not null default 'pago',
  add column applied_amount  numeric(14, 2) not null default 0,
  add constraint payments_org_id_key unique (organization_id, id),
  add constraint payments_applied_check check (
    (kind = 'pago' and applied_amount = 0)
    or (kind = 'anticipo' and applied_amount between 0 and amount and (status = 'aplicado' or applied_amount = 0))
  );

comment on column public.payments.applied_amount is 'Anticipos: importe ya aplicado al saldo de la venta.';

create table public.advance_applications (
  id                uuid primary key, -- lo genera el cliente: llave de idempotencia
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  payment_id        uuid not null,
  sale_id           uuid not null,
  application_date  date not null,
  amount            numeric(14, 2) not null check (amount > 0),
  status            public.payment_status not null default 'aplicado',
  cancel_reason     text check (char_length(cancel_reason) <= 500),
  cancelled_at      timestamptz,
  cancelled_by      uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  created_by        uuid default auth.uid() references auth.users (id) on delete set null,
  foreign key (organization_id, payment_id) references public.payments (organization_id, id),
  foreign key (organization_id, sale_id) references public.sales (organization_id, id),
  check ((status = 'cancelado') = (cancelled_at is not null))
);

create index advance_applications_payment_idx on public.advance_applications (payment_id);
create index advance_applications_sale_idx on public.advance_applications (sale_id);

-- -----------------------------------------------------------------------------
-- Entregas
-- -----------------------------------------------------------------------------
create table public.sale_deliveries (
  id               uuid primary key, -- lo genera el cliente: llave de idempotencia
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  sale_id          uuid not null,
  delivery_date    date not null,
  received_by      text check (char_length(received_by) <= 120),
  transport        text check (char_length(transport) <= 120),
  notes            text check (char_length(notes) <= 500),
  status           public.log_status not null default 'registrado',
  cancel_reason    text check (char_length(cancel_reason) <= 500),
  cancelled_at     timestamptz,
  cancelled_by     uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  unique (organization_id, id),
  foreign key (organization_id, sale_id) references public.sales (organization_id, id),
  check ((status = 'cancelado') = (cancelled_at is not null))
);

create index sale_deliveries_sale_idx on public.sale_deliveries (sale_id);

create table public.sale_delivery_items (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  delivery_id      uuid not null,
  sale_item_id     uuid not null,
  quantity         numeric(14, 3) not null check (quantity > 0), -- en la unidad de la partida
  unique (delivery_id, sale_item_id),
  foreign key (organization_id, delivery_id) references public.sale_deliveries (organization_id, id) on delete cascade,
  foreign key (organization_id, sale_item_id) references public.sale_items (organization_id, id)
);

create index sale_delivery_items_item_idx on public.sale_delivery_items (sale_item_id);

-- -----------------------------------------------------------------------------
-- Inventario de producto cosechado (libro inmutable por lote)
-- -----------------------------------------------------------------------------
create table public.production_movements (
  id               uuid primary key,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  harvest_id       uuid not null,
  movement_type    public.production_movement_type not null,
  movement_date    date not null,
  quantity_kg      numeric(14, 3) not null check (quantity_kg <> 0), -- con signo: + entra al lote, − sale
  available_after  numeric(14, 3) not null check (available_after >= 0),
  sale_id          uuid,
  sale_item_id     uuid,
  reverses_id      uuid unique references public.production_movements (id),
  reason           text check (char_length(reason) between 5 and 500),
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  foreign key (organization_id, harvest_id) references public.harvests (organization_id, id),
  foreign key (organization_id, sale_id) references public.sales (organization_id, id),
  foreign key (organization_id, sale_item_id) references public.sale_items (organization_id, id),
  check ((sale_item_id is null) = (sale_id is null)),
  check (case movement_type
    when 'venta' then quantity_kg < 0 and sale_item_id is not null and reverses_id is null
    when 'cancelacion_venta' then quantity_kg > 0 and sale_item_id is not null and reverses_id is not null
    when 'ajuste_entrada' then quantity_kg > 0 and sale_id is null and reverses_id is null and reason is not null
    when 'reverso_ajuste' then sale_id is null and reverses_id is not null and reason is not null
    else quantity_kg < 0 and sale_id is null and reverses_id is null and reason is not null
  end)
);

create index production_movements_lot_idx on public.production_movements (harvest_id, created_at);
create index production_movements_sale_idx on public.production_movements (sale_id) where sale_id is not null;
create index production_movements_org_date_idx on public.production_movements (organization_id, movement_date desc);

create or replace function public.prevent_production_movement_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old; -- cascada al eliminar la organización
  end if;
  raise exception 'Los movimientos de producto no se modifican ni eliminan; se revierten con su contrapartida'
    using errcode = '42501';
end;
$$;

create trigger production_movements_immutable before update or delete on public.production_movements
  for each row execute function public.prevent_production_movement_changes();

-- -----------------------------------------------------------------------------
-- Reglas del lote (cortes)
-- -----------------------------------------------------------------------------
create or replace function public.before_harvest_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Captura directa en kg (compatibilidad): la cantidad es el peso.
  if new.quantity is null
     or (tg_op = 'UPDATE' and new.quantity_kg is distinct from old.quantity_kg
         and new.quantity is not distinct from old.quantity and new.unit = old.unit) then
    if new.unit <> 'kg' then
      raise exception 'Indica la cantidad en la unidad del corte' using errcode = '22023';
    end if;
    new.quantity := new.quantity_kg;
  end if;
  if new.unit in ('kg', 't') then
    new.unit_weight_kg := null;
  elsif new.unit_weight_kg is null then
    raise exception 'Indica el peso neto por % en kilogramos', new.unit using errcode = '22023';
  end if;
  new.quantity_kg := round(new.quantity * public.produce_unit_kg(new.unit, new.unit_weight_kg), 3);
  if new.quantity_kg <= 0 then
    raise exception 'La cantidad cosechada debe ser mayor que cero' using errcode = '22023';
  end if;
  new.classification := nullif(trim(new.classification), '');

  if new.responsible_id is not null
     and (tg_op = 'INSERT' or new.responsible_id is distinct from old.responsible_id)
     and not exists (
       select 1 from public.employees
       where id = new.responsible_id and organization_id = new.organization_id and is_active
     ) then
    raise exception 'El responsable no existe o está inactivo' using errcode = '22023';
  end if;

  if tg_op = 'INSERT' then
    new.lot_code := public.next_folio(new.organization_id, 'lot', 'LOT');
    new.sold_kg := 0;
    new.adjusted_kg := 0;
    -- Sin número de corte: el mismo del día (otra calidad del mismo corte) o el siguiente.
    if new.cut_number is null then
      new.cut_number := coalesce(
        (select max(cut_number) from public.harvests where project_id = new.project_id and harvest_date = new.harvest_date),
        (select coalesce(max(cut_number), 0) + 1 from public.harvests where project_id = new.project_id)
      );
    end if;
    return new;
  end if;

  -- Un lote con ventas o ajustes conserva su origen para la trazabilidad.
  if (new.project_id, new.plot_id, new.harvest_date, new.quality)
       is distinct from (old.project_id, old.plot_id, old.harvest_date, old.quality)
     and exists (select 1 from public.production_movements where harvest_id = old.id) then
    raise exception 'El lote % ya tiene ventas o ajustes: su proyecto, parcela, fecha y calidad no se modifican', old.lot_code
      using errcode = '22023';
  end if;
  if new.quantity_kg - new.sold_kg - new.adjusted_kg < 0 then
    raise exception 'El lote % tiene % kg vendidos o ajustados; su cantidad no puede quedar en % kg',
      old.lot_code, new.sold_kg + new.adjusted_kg, new.quantity_kg using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger harvests_before_write before insert or update on public.harvests
  for each row execute function public.before_harvest_write();

create or replace function public.before_harvest_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.production_movements where harvest_id = old.id)
     or exists (select 1 from public.sale_items where harvest_id = old.id) then
    raise exception 'El lote % tiene ventas o ajustes registrados y no se elimina', old.lot_code using errcode = '22023';
  end if;
  delete from public.attachments where entity_type = 'harvest' and entity_id = old.id;
  return old;
end;
$$;

create trigger harvests_before_delete before delete on public.harvests
  for each row execute function public.before_harvest_delete();

-- -----------------------------------------------------------------------------
-- Movimiento de producto (interna). El llamador ya bloqueó el lote (FOR UPDATE)
-- y verificó permisos; aquí se valida la existencia y se actualiza el lote.
-- Actualizar el lote dispara check_project_record: el proyecto debe seguir
-- vigente (un proyecto cerrado congela sus lotes, ventas y ajustes).
-- -----------------------------------------------------------------------------
create or replace function public.post_production_movement(
  p_id uuid,
  p_harvest uuid,
  p_type public.production_movement_type,
  p_date date,
  p_quantity_kg numeric,
  p_sale uuid default null,
  p_item uuid default null,
  p_reverses uuid default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot public.harvests%rowtype;
begin
  select * into v_lot from public.harvests where id = p_harvest;
  if v_lot.available_kg + p_quantity_kg < 0 then
    raise exception 'El lote % tiene % kg disponibles y la operación requiere % kg',
      v_lot.lot_code, v_lot.available_kg, -p_quantity_kg using errcode = '22023';
  end if;

  insert into public.production_movements (
    id, organization_id, harvest_id, movement_type, movement_date, quantity_kg, available_after,
    sale_id, sale_item_id, reverses_id, reason
  ) values (
    p_id, v_lot.organization_id, p_harvest, p_type, p_date, p_quantity_kg, v_lot.available_kg + p_quantity_kg,
    p_sale, p_item, p_reverses, nullif(trim(p_reason), '')
  );

  if p_type in ('venta', 'cancelacion_venta') then
    update public.harvests set sold_kg = sold_kg - p_quantity_kg where id = p_harvest;
  else
    update public.harvests set adjusted_kg = adjusted_kg - p_quantity_kg where id = p_harvest;
  end if;
end;
$$;

-- Mermas, pérdidas y ajustes con motivo. Idempotente por p_id.
create or replace function public.register_production_adjustment(
  p_id uuid,
  p_harvest uuid,
  p_type public.production_movement_type,
  p_quantity_kg numeric,
  p_date date,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot public.harvests%rowtype;
begin
  if p_id is null then
    raise exception 'Falta el identificador del movimiento' using errcode = '22023';
  end if;
  select * into v_lot from public.harvests where id = p_harvest for update;
  if not found or not public.is_member(v_lot.organization_id) then
    raise exception 'Lote no encontrado' using errcode = 'P0002';
  end if;
  if not public.has_role(v_lot.organization_id,
       array['propietario', 'administrador', 'agronomo', 'supervisor', 'almacen']::public.app_role[]) then
    raise exception 'No tienes permiso para registrar mermas o ajustes de producto' using errcode = '42501';
  end if;

  if exists (select 1 from public.production_movements where id = p_id) then
    if exists (select 1 from public.production_movements where id = p_id and harvest_id = p_harvest and movement_type = p_type) then
      return p_id; -- reintento
    end if;
    raise exception 'El identificador del movimiento ya se usó en otra operación' using errcode = '23505';
  end if;

  if p_type is null or p_type not in ('merma', 'perdida', 'ajuste_entrada', 'ajuste_salida') then
    raise exception 'Tipo de ajuste no válido' using errcode = '22023';
  end if;
  if p_quantity_kg is null or p_quantity_kg <= 0 or p_quantity_kg <> round(p_quantity_kg, 3) then
    raise exception 'La cantidad debe ser mayor que cero (máximo 3 decimales)' using errcode = '22023';
  end if;
  if p_date is null or p_date < v_lot.harvest_date or p_date > public.mx_today() then
    raise exception 'La fecha debe estar entre la cosecha del lote (%) y hoy', to_char(v_lot.harvest_date, 'DD/MM/YYYY')
      using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Justifica el ajuste (mínimo 5 caracteres)' using errcode = '22023';
  end if;

  perform public.lock_open_project(v_lot.organization_id, v_lot.project_id, true);
  perform public.post_production_movement(
    p_id, p_harvest, p_type, p_date,
    case when p_type = 'ajuste_entrada' then p_quantity_kg else -p_quantity_kg end,
    p_reason => p_reason
  );
  return p_id;
end;
$$;

-- Revierte una merma, pérdida o ajuste con su contrapartida exacta (una vez).
create or replace function public.reverse_production_adjustment(p_id uuid, p_movement uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mv public.production_movements%rowtype;
  v_lot public.harvests%rowtype;
begin
  if p_id is null then
    raise exception 'Falta el identificador del movimiento' using errcode = '22023';
  end if;
  select * into v_mv from public.production_movements where id = p_movement;
  select * into v_lot from public.harvests where id = v_mv.harvest_id for update;
  if v_mv.id is null or not public.is_member(v_mv.organization_id) then
    raise exception 'Movimiento no encontrado' using errcode = 'P0002';
  end if;
  if not public.has_role(v_mv.organization_id,
       array['propietario', 'administrador', 'agronomo', 'supervisor', 'almacen']::public.app_role[]) then
    raise exception 'No tienes permiso para revertir ajustes de producto' using errcode = '42501';
  end if;

  if exists (select 1 from public.production_movements where id = p_id) then
    if exists (select 1 from public.production_movements where id = p_id and reverses_id = p_movement) then
      return p_id;
    end if;
    raise exception 'El identificador del movimiento ya se usó en otra operación' using errcode = '23505';
  end if;

  if v_mv.movement_type not in ('merma', 'perdida', 'ajuste_entrada', 'ajuste_salida') then
    raise exception 'Solo se revierten mermas, pérdidas y ajustes; las ventas se cancelan desde la venta'
      using errcode = '22023';
  end if;
  if exists (select 1 from public.production_movements where reverses_id = p_movement) then
    raise exception 'El movimiento ya fue revertido' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Indica el motivo de la reversión' using errcode = '22023';
  end if;

  perform public.lock_open_project(v_lot.organization_id, v_lot.project_id, true);
  perform public.post_production_movement(
    p_id, v_mv.harvest_id, 'reverso_ajuste', public.mx_today(), -v_mv.quantity_kg,
    p_reverses => p_movement, p_reason => p_reason
  );
  return p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Ventas
-- -----------------------------------------------------------------------------

-- Partidas recibidas como JSON (sin conversión de tipos: se validan antes).
create or replace function public.parse_sale_lines(p_items jsonb)
returns table (
  line int, harvest_id uuid, description text, unit text, quantity numeric, unit_weight_kg numeric,
  unit_price numeric, discount numeric
)
language sql
immutable
set search_path = ''
as $$
  select x.ord::int, (x.item ->> 'harvest_id')::uuid, trim(x.item ->> 'description'), x.item ->> 'unit',
         (x.item ->> 'quantity')::numeric, (x.item ->> 'unit_weight_kg')::numeric,
         (x.item ->> 'unit_price')::numeric, coalesce((x.item ->> 'discount')::numeric, 0)
  from jsonb_array_elements(p_items) with ordinality as x(item, ord);
$$;

-- Estado según cobro y entrega (el borrador y la cancelación no cambian aquí).
create or replace function public.refresh_sale_status(p_sale uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with calc as (
    select s.id,
      case
        when s.total > 0 and s.amount_paid >= s.total then 'pagada'
        when s.amount_paid > 0 then 'parcialmente_pagada'
        when not exists (
          select 1 from public.sale_items i where i.sale_id = s.id and i.delivered_quantity < i.quantity
        ) then 'entregada'
        else 'confirmada'
      end::public.sale_status as status
    from public.sales s
    where s.id = p_sale and public.sale_is_active(s.status)
  )
  update public.sales s set status = calc.status
  from calc
  where s.id = calc.id and s.status is distinct from calc.status;
end;
$$;

-- Confirmación (interna): bloquea la venta (el llamador), sus lotes en orden y
-- sus proyectos; verifica existencias y descuenta cada partida de su lote.
create or replace function public.confirm_sale_internal(p_sale uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
  v_lot record;
  v_project public.projects%rowtype;
  v_project_id uuid;
  v_item record;
begin
  select * into v_sale from public.sales where id = p_sale;
  if not exists (select 1 from public.customers where id = v_sale.customer_id and is_active) then
    raise exception 'El cliente de la venta % está inactivo', v_sale.code using errcode = '22023';
  end if;
  if v_sale.sale_date > public.mx_today() then
    raise exception 'La fecha de venta no puede ser futura' using errcode = '22023';
  end if;

  -- Lotes en orden de id: dos ventas simultáneas del mismo lote se serializan
  -- y la segunda ve la existencia ya descontada.
  perform 1 from public.harvests
  where id in (select harvest_id from public.sale_items where sale_id = p_sale)
  order by id
  for update;

  for v_lot in
    select h.id, h.lot_code, h.available_kg, h.harvest_date, sum(i.quantity_kg) as kg
    from public.sale_items i
    join public.harvests h on h.id = i.harvest_id
    where i.sale_id = p_sale
    group by h.id
    order by h.id
  loop
    if v_lot.kg > v_lot.available_kg then
      raise exception 'El lote % tiene % kg disponibles y la venta requiere % kg',
        v_lot.lot_code, v_lot.available_kg, v_lot.kg using errcode = '22023';
    end if;
    if v_sale.sale_date < v_lot.harvest_date then
      raise exception 'La fecha de venta es anterior a la cosecha del lote %', v_lot.lot_code using errcode = '22023';
    end if;
  end loop;

  for v_project_id in select distinct project_id from public.sale_items where sale_id = p_sale order by project_id loop
    v_project := public.lock_open_project(v_sale.organization_id, v_project_id, true);
    if v_sale.sale_date < v_project.start_date then
      raise exception 'La fecha de venta es anterior al inicio del proyecto %', v_project.code using errcode = '22023';
    end if;
  end loop;

  for v_item in
    select id, harvest_id, quantity_kg from public.sale_items where sale_id = p_sale order by harvest_id, id
  loop
    perform public.post_production_movement(
      gen_random_uuid(), v_item.harvest_id, 'venta', v_sale.sale_date, -v_item.quantity_kg, p_sale, v_item.id
    );
  end loop;

  update public.sales set status = 'confirmada', confirmed_at = now(), confirmed_by = auth.uid() where id = p_sale;
  perform public.refresh_sale_status(p_sale);
end;
$$;

-- Crea o modifica un borrador (encabezado y partidas en una transacción) y,
-- con p_confirm, lo confirma. p_items: [{harvest_id, description, unit,
-- quantity, unit_weight_kg, unit_price, discount}]. Idempotente por p_id: un
-- reintento de confirmación sobre una venta ya confirmada no hace nada.
create or replace function public.save_sale(
  p_id uuid,
  p_customer uuid,
  p_sale_date date,
  p_items jsonb,
  p_due_date date default null,
  p_delivery_date date default null,
  p_notes text default null,
  p_confirm boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
  v_sale public.sales%rowtype;
  v_org uuid;
  v_count int;
  v_lot record;
  v_total numeric;
begin
  if p_id is null then
    raise exception 'Falta el identificador de la venta' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));

  select * into v_customer from public.customers where id = p_customer;
  if not found or not public.is_member(v_customer.organization_id) then
    raise exception 'Cliente no encontrado' using errcode = 'P0002';
  end if;
  v_org := v_customer.organization_id;
  if not public.has_role(v_org, array['propietario', 'administrador', 'finanzas']::public.app_role[]) then
    raise exception 'No tienes permiso para registrar ventas' using errcode = '42501';
  end if;

  select * into v_sale from public.sales where id = p_id for update;
  if found then
    if v_sale.organization_id <> v_org then
      raise exception 'El identificador de la venta ya se usó en otra operación' using errcode = '23505';
    end if;
    if v_sale.status <> 'borrador' then
      if p_confirm and v_sale.status <> 'cancelada' then
        return p_id; -- reintento: la venta ya quedó confirmada
      end if;
      raise exception 'La venta % ya no es un borrador; solo los borradores se modifican', v_sale.code
        using errcode = '22023';
    end if;
  end if;

  if not v_customer.is_active then
    raise exception 'El cliente "%" está inactivo', v_customer.name using errcode = '22023';
  end if;
  if p_sale_date is null or p_sale_date > public.mx_today() then
    raise exception 'La fecha de venta no es válida' using errcode = '22023';
  end if;
  if p_due_date is not null and p_due_date < p_sale_date then
    raise exception 'El vencimiento no puede ser anterior a la fecha de venta' using errcode = '22023';
  end if;
  if p_delivery_date is not null and p_delivery_date < p_sale_date then
    raise exception 'La fecha de entrega no puede ser anterior a la fecha de venta' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'La venta debe incluir partidas' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_items);
  if v_count = 0 or v_count > 50 then
    raise exception 'La venta debe tener entre 1 y 50 partidas' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.parse_sale_lines(p_items) x
    where x.harvest_id is null
       or x.unit is null or x.unit not in ('kg', 't', 'caja', 'saco', 'arpilla', 'reja')
       or (x.unit not in ('kg', 't') and (x.unit_weight_kg is null or x.unit_weight_kg <= 0
                                          or x.unit_weight_kg <> round(x.unit_weight_kg, 3)))
       or x.quantity is null or x.quantity <= 0 or x.quantity <> round(x.quantity, 3)
       or x.unit_price is null or x.unit_price <= 0 or x.unit_price <> round(x.unit_price, 4)
       or x.discount < 0 or x.discount <> round(x.discount, 2) or x.discount > round(x.quantity * x.unit_price, 2)
       or char_length(coalesce(x.description, '')) > 200
  ) then
    raise exception 'Revisa las partidas: lote, unidad, cantidad (>0, 3 decimales), precio (>0, 4 decimales) y descuento (no mayor al importe)'
      using errcode = '22023';
  end if;

  -- Lotes: misma organización, proyecto vigente y existencia suficiente (se
  -- vuelve a verificar con bloqueo al confirmar; el borrador no aparta producto).
  for v_lot in
    select x.harvest_id, h.id, h.lot_code, h.available_kg, h.harvest_date, p.status as project_status, p.code as project_code,
           sum(round(x.quantity * public.produce_unit_kg(x.unit::public.produce_unit,
                     case when x.unit in ('kg', 't') then null else x.unit_weight_kg end), 3)) as kg
    from public.parse_sale_lines(p_items) x
    left join public.harvests h on h.id = x.harvest_id and h.organization_id = v_org
    left join public.projects p on p.id = h.project_id
    group by x.harvest_id, h.id, p.id
  loop
    if v_lot.id is null then
      raise exception 'Lote no encontrado' using errcode = 'P0002';
    end if;
    if v_lot.project_status in ('cerrado', 'cancelado') then
      raise exception 'El proyecto % está %; su producción ya no se vende', v_lot.project_code, v_lot.project_status
        using errcode = '22023';
    end if;
    if p_sale_date < v_lot.harvest_date then
      raise exception 'La fecha de venta es anterior a la cosecha del lote %', v_lot.lot_code using errcode = '22023';
    end if;
    if v_lot.kg > v_lot.available_kg then
      raise exception 'El lote % tiene % kg disponibles y se intentan vender % kg',
        v_lot.lot_code, v_lot.available_kg, v_lot.kg using errcode = '22023';
    end if;
  end loop;

  select sum(round(quantity * unit_price, 2) - discount) into v_total from public.parse_sale_lines(p_items);
  if v_total < coalesce(v_sale.advance_balance, 0) then
    raise exception 'La venta tiene anticipos por %; el total no puede ser menor',
      '$' || to_char(v_sale.advance_balance, 'FM999,999,999,990.00') using errcode = '22023';
  end if;

  if v_sale.id is null then
    insert into public.sales (id, organization_id, code, customer_id, sale_date, due_date, delivery_date, notes, status)
    values (
      p_id, v_org, public.next_folio(v_org, 'sale', 'VTA'), p_customer, p_sale_date,
      coalesce(p_due_date, p_sale_date + v_customer.credit_days), p_delivery_date, nullif(trim(p_notes), ''), 'borrador'
    );
  else
    delete from public.sale_items where sale_id = p_id;
    update public.sales
    set customer_id = p_customer, sale_date = p_sale_date,
        due_date = coalesce(p_due_date, p_sale_date + v_customer.credit_days),
        delivery_date = p_delivery_date, notes = nullif(trim(p_notes), '')
    where id = p_id;
  end if;

  insert into public.sale_items (
    organization_id, sale_id, project_id, harvest_id, description, quality, unit, quantity, unit_weight_kg,
    quantity_kg, unit_price, discount
  )
  select
    v_org, p_id, h.project_id, h.id,
    coalesce(nullif(x.description, ''), c.name || coalesce(' ' || c.variety, '')),
    h.quality, x.unit::public.produce_unit, x.quantity,
    case when x.unit in ('kg', 't') then null else x.unit_weight_kg end,
    round(x.quantity * public.produce_unit_kg(x.unit::public.produce_unit,
          case when x.unit in ('kg', 't') then null else x.unit_weight_kg end), 3),
    x.unit_price, x.discount
  from public.parse_sale_lines(p_items) x
  join public.harvests h on h.id = x.harvest_id
  join public.projects p on p.id = h.project_id
  join public.crops c on c.id = p.crop_id
  order by x.line;

  update public.sales s
  set subtotal = t.gross, discount = t.disc, total = t.gross - t.disc
  from (
    select sum(gross_amount) as gross, sum(discount) as disc from public.sale_items where sale_id = p_id
  ) t
  where s.id = p_id;

  if p_confirm then
    perform public.confirm_sale_internal(p_id);
  end if;
  return p_id;
end;
$$;

create or replace function public.confirm_sale(p_sale uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
begin
  select * into v_sale from public.sales where id = p_sale for update;
  if not found or not public.is_member(v_sale.organization_id) then
    raise exception 'Venta no encontrada' using errcode = 'P0002';
  end if;
  if not public.has_role(v_sale.organization_id, array['propietario', 'administrador', 'finanzas']::public.app_role[]) then
    raise exception 'No tienes permiso para confirmar ventas' using errcode = '42501';
  end if;
  if v_sale.status = 'cancelada' then
    raise exception 'La venta % está cancelada', v_sale.code using errcode = '22023';
  end if;
  if v_sale.status <> 'borrador' then
    return; -- reintento: ya estaba confirmada
  end if;
  perform public.confirm_sale_internal(p_sale);
end;
$$;

-- Cancela un borrador o una venta confirmada sin pagos ni anticipos. Si ya se
-- había confirmado, cada salida de producto se revierte con un movimiento
-- 'cancelacion_venta' ligado a la salida original (una sola vez).
create or replace function public.cancel_sale(p_sale uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
  v_project uuid;
  v_mv record;
begin
  select * into v_sale from public.sales where id = p_sale for update;
  if not found or not public.is_member(v_sale.organization_id) then
    raise exception 'Venta no encontrada' using errcode = 'P0002';
  end if;
  if not public.has_role(v_sale.organization_id, array['propietario', 'administrador', 'finanzas']::public.app_role[]) then
    raise exception 'No tienes permiso para cancelar ventas' using errcode = '42501';
  end if;
  if v_sale.status = 'cancelada' then
    raise exception 'La venta ya está cancelada' using errcode = '22023';
  end if;
  if v_sale.amount_paid > 0 or v_sale.advance_balance > 0 then
    raise exception 'La venta tiene pagos o anticipos; cancélalos antes de cancelar la venta' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Indica el motivo de la cancelación' using errcode = '22023';
  end if;

  if v_sale.status <> 'borrador' then
    perform 1 from public.harvests
    where id in (select harvest_id from public.production_movements where sale_id = p_sale)
    order by id
    for update;
    for v_project in select distinct project_id from public.sale_items where sale_id = p_sale order by project_id loop
      perform public.lock_open_project(v_sale.organization_id, v_project, true);
    end loop;

    for v_mv in
      select m.* from public.production_movements m
      where m.sale_id = p_sale and m.movement_type = 'venta'
        and not exists (select 1 from public.production_movements r where r.reverses_id = m.id)
      order by m.harvest_id, m.id
    loop
      perform public.post_production_movement(
        gen_random_uuid(), v_mv.harvest_id, 'cancelacion_venta', public.mx_today(), -v_mv.quantity_kg,
        p_sale, v_mv.sale_item_id, v_mv.id, p_reason
      );
    end loop;
  end if;

  update public.sales
  set status = 'cancelada', cancel_reason = trim(p_reason), cancelled_at = now(), cancelled_by = auth.uid()
  where id = p_sale;
end;
$$;

-- -----------------------------------------------------------------------------
-- Entregas (parciales por partida). p_items: [{sale_item_id, quantity}] en la
-- unidad de la partida; null = todo lo pendiente.
-- -----------------------------------------------------------------------------
create or replace function public.register_delivery(
  p_id uuid,
  p_sale uuid,
  p_date date,
  p_items jsonb default null,
  p_received_by text default null,
  p_transport text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
  v_lines jsonb;
begin
  if p_id is null then
    raise exception 'Falta el identificador de la entrega' using errcode = '22023';
  end if;
  select * into v_sale from public.sales where id = p_sale for update;
  if not found or not public.is_member(v_sale.organization_id) then
    raise exception 'Venta no encontrada' using errcode = 'P0002';
  end if;
  if not public.has_role(v_sale.organization_id, array['propietario', 'administrador', 'finanzas']::public.app_role[]) then
    raise exception 'No tienes permiso para registrar entregas' using errcode = '42501';
  end if;

  if exists (select 1 from public.sale_deliveries where id = p_id) then
    if exists (select 1 from public.sale_deliveries where id = p_id and sale_id = p_sale) then
      return p_id; -- reintento
    end if;
    raise exception 'El identificador de la entrega ya se usó en otra operación' using errcode = '23505';
  end if;

  if not public.sale_is_active(v_sale.status) then
    raise exception 'Solo se entregan ventas confirmadas' using errcode = '22023';
  end if;
  if p_date is null or p_date < v_sale.sale_date or p_date > public.mx_today() then
    raise exception 'La fecha de entrega debe estar entre la venta (%) y hoy', to_char(v_sale.sale_date, 'DD/MM/YYYY')
      using errcode = '22023';
  end if;

  -- Una línea por partida (las repetidas se suman).
  if p_items is null then
    select jsonb_agg(jsonb_build_object('sale_item_id', id, 'quantity', quantity - delivered_quantity)) into v_lines
    from public.sale_items
    where sale_id = p_sale and delivered_quantity < quantity;
  elsif jsonb_typeof(p_items) = 'array' then
    select jsonb_agg(jsonb_build_object('sale_item_id', item, 'quantity', qty)) into v_lines
    from (
      select (x ->> 'sale_item_id')::uuid as item, sum((x ->> 'quantity')::numeric) as qty
      from jsonb_array_elements(p_items) x
      group by 1
    ) t;
  end if;

  if v_lines is null then
    raise exception 'La venta no tiene producto pendiente de entregar' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(v_lines) as d(sale_item_id uuid, quantity numeric)
    left join public.sale_items i on i.id = d.sale_item_id and i.sale_id = p_sale
    where i.id is null or d.quantity is null or d.quantity <= 0 or d.quantity <> round(d.quantity, 3)
       or d.quantity > i.quantity - i.delivered_quantity
  ) then
    raise exception 'Revisa las cantidades: cada partida se entrega hasta lo pendiente (máximo 3 decimales)'
      using errcode = '22023';
  end if;

  insert into public.sale_deliveries (id, organization_id, sale_id, delivery_date, received_by, transport, notes)
  values (p_id, v_sale.organization_id, p_sale, p_date, nullif(trim(p_received_by), ''), nullif(trim(p_transport), ''),
          nullif(trim(p_notes), ''));
  insert into public.sale_delivery_items (organization_id, delivery_id, sale_item_id, quantity)
  select v_sale.organization_id, p_id, d.sale_item_id, d.quantity
  from jsonb_to_recordset(v_lines) as d(sale_item_id uuid, quantity numeric);
  update public.sale_items i set delivered_quantity = i.delivered_quantity + d.quantity
  from jsonb_to_recordset(v_lines) as d(sale_item_id uuid, quantity numeric)
  where i.id = d.sale_item_id;

  perform public.refresh_sale_status(p_sale);
  return p_id;
end;
$$;

create or replace function public.cancel_delivery(p_delivery uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
  v_delivery public.sale_deliveries%rowtype;
begin
  select * into v_sale from public.sales where id = (select sale_id from public.sale_deliveries where id = p_delivery) for update;
  select * into v_delivery from public.sale_deliveries where id = p_delivery for update;
  if v_delivery.id is null or not public.is_member(v_delivery.organization_id) then
    raise exception 'Entrega no encontrada' using errcode = 'P0002';
  end if;
  if not public.has_role(v_delivery.organization_id, array['propietario', 'administrador', 'finanzas']::public.app_role[]) then
    raise exception 'No tienes permiso para cancelar entregas' using errcode = '42501';
  end if;
  if v_delivery.status = 'cancelado' then
    raise exception 'La entrega ya está cancelada' using errcode = '22023';
  end if;
  if v_sale.status = 'cancelada' then
    raise exception 'La venta está cancelada' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Indica el motivo de la cancelación' using errcode = '22023';
  end if;

  update public.sale_items i set delivered_quantity = i.delivered_quantity - d.quantity
  from public.sale_delivery_items d where d.delivery_id = p_delivery and i.id = d.sale_item_id;
  update public.sale_deliveries
  set status = 'cancelado', cancel_reason = trim(p_reason), cancelled_at = now(), cancelled_by = auth.uid()
  where id = p_delivery;
  perform public.refresh_sale_status(v_sale.id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Pagos y anticipos. Siempre: venta (FOR UPDATE) y luego pago.
-- Lo cobrable de una venta = total − pagado − anticipos sin aplicar; así un
-- pago nunca deja sin saldo a un anticipo pendiente de aplicar.
-- -----------------------------------------------------------------------------
create or replace function public.register_payment(
  p_id uuid,
  p_sale uuid,
  p_date date,
  p_amount numeric,
  p_method public.payment_method,
  p_reference text default null,
  p_notes text default null,
  p_kind public.payment_kind default 'pago'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
  v_available numeric;
begin
  if p_id is null then
    raise exception 'Falta el identificador del pago' using errcode = '22023';
  end if;

  select * into v_sale from public.sales where id = p_sale for update;
  if not found or not public.is_member(v_sale.organization_id) then
    raise exception 'Venta no encontrada' using errcode = 'P0002';
  end if;
  if not public.has_role(v_sale.organization_id, array['propietario', 'administrador', 'finanzas']::public.app_role[]) then
    raise exception 'No tienes permiso para registrar pagos' using errcode = '42501';
  end if;

  if exists (select 1 from public.payments where id = p_id) then
    if exists (select 1 from public.payments where id = p_id and sale_id = p_sale and amount = p_amount and kind = p_kind) then
      return p_id; -- reintento: el pago ya se registró
    end if;
    raise exception 'El identificador del pago ya se usó en otra operación' using errcode = '23505';
  end if;

  if p_kind is null or p_method is null then
    raise exception 'Indica el tipo y la forma de pago' using errcode = '22023';
  end if;
  if v_sale.status = 'cancelada' then
    raise exception 'La venta % está cancelada', v_sale.code using errcode = '22023';
  end if;
  if p_kind = 'pago' and v_sale.status = 'borrador' then
    raise exception 'La venta % es un borrador: confírmala o registra el dinero como anticipo', v_sale.code
      using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'El importe debe ser mayor que cero (máximo 2 decimales)' using errcode = '22023';
  end if;
  if p_date is null or p_date > public.mx_today() or (p_kind = 'pago' and p_date < v_sale.sale_date) then
    raise exception 'La fecha del pago debe estar entre la venta (%) y hoy', to_char(v_sale.sale_date, 'DD/MM/YYYY')
      using errcode = '22023';
  end if;

  v_available := v_sale.total - v_sale.amount_paid - v_sale.advance_balance;
  if v_available <= 0 then
    if v_sale.advance_balance > 0 then
      raise exception 'El saldo de la venta % está cubierto por anticipos sin aplicar; aplícalos', v_sale.code
        using errcode = '22023';
    end if;
    raise exception 'La venta % ya está liquidada', v_sale.code using errcode = '22023';
  end if;
  if p_amount > v_available then
    raise exception 'El % (%) excede el saldo pendiente de la venta (%)',
      case when p_kind = 'anticipo' then 'anticipo' else 'pago' end,
      '$' || to_char(p_amount, 'FM999,999,999,990.00'), '$' || to_char(v_available, 'FM999,999,999,990.00')
      using errcode = '22023';
  end if;

  insert into public.payments (id, organization_id, sale_id, payment_date, amount, method, reference, notes, kind)
  values (p_id, v_sale.organization_id, p_sale, p_date, p_amount, p_method,
          nullif(trim(p_reference), ''), nullif(trim(p_notes), ''), p_kind);

  if p_kind = 'pago' then
    update public.sales set amount_paid = amount_paid + p_amount where id = p_sale;
    perform public.refresh_sale_status(p_sale);
  else
    update public.sales set advance_balance = advance_balance + p_amount where id = p_sale;
  end if;
  return p_id;
end;
$$;

-- Aplica (total o parcialmente) un anticipo al saldo de su venta confirmada.
-- Sin importe: lo que resulte menor entre el anticipo pendiente y el saldo.
create or replace function public.apply_advance(
  p_id uuid,
  p_payment uuid,
  p_amount numeric default null,
  p_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
  v_pay public.payments%rowtype;
  v_amount numeric;
  v_date date := coalesce(p_date, public.mx_today());
begin
  if p_id is null then
    raise exception 'Falta el identificador de la aplicación' using errcode = '22023';
  end if;
  select * into v_sale from public.sales where id = (select sale_id from public.payments where id = p_payment) for update;
  select * into v_pay from public.payments where id = p_payment for update;
  if v_pay.id is null or not public.is_member(v_pay.organization_id) then
    raise exception 'Anticipo no encontrado' using errcode = 'P0002';
  end if;
  if not public.has_role(v_pay.organization_id, array['propietario', 'administrador', 'finanzas']::public.app_role[]) then
    raise exception 'No tienes permiso para aplicar anticipos' using errcode = '42501';
  end if;

  if exists (select 1 from public.advance_applications where id = p_id) then
    if exists (select 1 from public.advance_applications where id = p_id and payment_id = p_payment) then
      return p_id; -- reintento
    end if;
    raise exception 'El identificador de la aplicación ya se usó en otra operación' using errcode = '23505';
  end if;

  if v_pay.kind <> 'anticipo' or v_pay.status <> 'aplicado' then
    raise exception 'Solo se aplican anticipos vigentes' using errcode = '22023';
  end if;
  if not public.sale_is_active(v_sale.status) then
    raise exception 'Confirma la venta % antes de aplicar sus anticipos', v_sale.code using errcode = '22023';
  end if;
  if v_pay.amount - v_pay.applied_amount <= 0 then
    raise exception 'El anticipo ya se aplicó por completo' using errcode = '22023';
  end if;
  if v_sale.total - v_sale.amount_paid <= 0 then
    raise exception 'La venta % ya está liquidada', v_sale.code using errcode = '22023';
  end if;

  v_amount := coalesce(p_amount, least(v_pay.amount - v_pay.applied_amount, v_sale.total - v_sale.amount_paid));
  if v_amount <= 0 or v_amount <> round(v_amount, 2) then
    raise exception 'El importe debe ser mayor que cero (máximo 2 decimales)' using errcode = '22023';
  end if;
  if v_amount > v_pay.amount - v_pay.applied_amount then
    raise exception 'El importe excede el anticipo pendiente de aplicar (%)',
      '$' || to_char(v_pay.amount - v_pay.applied_amount, 'FM999,999,999,990.00') using errcode = '22023';
  end if;
  if v_amount > v_sale.total - v_sale.amount_paid then
    raise exception 'El importe excede el saldo pendiente de la venta (%)',
      '$' || to_char(v_sale.total - v_sale.amount_paid, 'FM999,999,999,990.00') using errcode = '22023';
  end if;
  if v_date < v_pay.payment_date or v_date > public.mx_today() then
    raise exception 'La fecha de aplicación debe estar entre la recepción del anticipo y hoy' using errcode = '22023';
  end if;

  insert into public.advance_applications (id, organization_id, payment_id, sale_id, application_date, amount)
  values (p_id, v_pay.organization_id, p_payment, v_sale.id, v_date, v_amount);
  update public.payments set applied_amount = applied_amount + v_amount where id = p_payment;
  update public.sales
  set amount_paid = amount_paid + v_amount, advance_balance = advance_balance - v_amount
  where id = v_sale.id;
  perform public.refresh_sale_status(v_sale.id);
  return p_id;
end;
$$;

create or replace function public.cancel_advance_application(p_application uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.advance_applications%rowtype;
  v_sale public.sales%rowtype;
begin
  select * into v_sale from public.sales
  where id = (select sale_id from public.advance_applications where id = p_application) for update;
  perform 1 from public.payments where id = (select payment_id from public.advance_applications where id = p_application) for update;
  select * into v_app from public.advance_applications where id = p_application for update;
  if v_app.id is null or not public.is_member(v_app.organization_id) then
    raise exception 'Aplicación no encontrada' using errcode = 'P0002';
  end if;
  if not public.has_role(v_app.organization_id, array['propietario', 'administrador', 'finanzas']::public.app_role[]) then
    raise exception 'No tienes permiso para revertir aplicaciones de anticipos' using errcode = '42501';
  end if;
  if v_app.status = 'cancelado' then
    raise exception 'La aplicación ya está revertida' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Indica el motivo de la reversión' using errcode = '22023';
  end if;

  update public.advance_applications
  set status = 'cancelado', cancel_reason = trim(p_reason), cancelled_at = now(), cancelled_by = auth.uid()
  where id = p_application;
  update public.payments set applied_amount = applied_amount - v_app.amount where id = v_app.payment_id;
  update public.sales
  set amount_paid = amount_paid - v_app.amount, advance_balance = advance_balance + v_app.amount
  where id = v_app.sale_id;
  perform public.refresh_sale_status(v_app.sale_id);
end;
$$;

-- Cancela un pago o un anticipo (nunca se eliminan). Un anticipo con
-- aplicaciones vigentes primero se desaplica.
create or replace function public.cancel_payment(p_payment uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
  v_pay public.payments%rowtype;
begin
  select * into v_sale from public.sales where id = (select sale_id from public.payments where id = p_payment) for update;
  select * into v_pay from public.payments where id = p_payment for update;
  if v_pay.id is null or not public.is_member(v_pay.organization_id) then
    raise exception 'Pago no encontrado' using errcode = 'P0002';
  end if;
  if not public.has_role(v_pay.organization_id, array['propietario', 'administrador', 'finanzas']::public.app_role[]) then
    raise exception 'No tienes permiso para cancelar pagos' using errcode = '42501';
  end if;
  if v_pay.status = 'cancelado' then
    raise exception 'El pago ya está cancelado' using errcode = '22023';
  end if;
  if v_pay.kind = 'anticipo' and v_pay.applied_amount > 0 then
    raise exception 'El anticipo tiene % aplicados a la venta; revierte primero sus aplicaciones',
      '$' || to_char(v_pay.applied_amount, 'FM999,999,999,990.00') using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Indica el motivo de la cancelación' using errcode = '22023';
  end if;

  update public.payments
  set status = 'cancelado', cancel_reason = trim(p_reason), cancelled_at = now(), cancelled_by = auth.uid()
  where id = p_payment;
  if v_pay.kind = 'pago' then
    update public.sales set amount_paid = amount_paid - v_pay.amount where id = v_sale.id;
    perform public.refresh_sale_status(v_sale.id);
  else
    update public.sales set advance_balance = advance_balance - v_pay.amount where id = v_sale.id;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Datos existentes: las ventas confirmadas descuentan sus lotes (el más
-- antiguo primero, preferentemente de la misma calidad) y su estado se
-- recalcula. Se omite la validación de proyecto vigente: las ventas de
-- proyectos ya cerrados también deben quedar trazadas.
-- -----------------------------------------------------------------------------
alter table public.harvests disable trigger harvests_check_project;

do $$
declare
  v_item record;
  v_lot record;
  v_left numeric;
  v_take numeric;
  v_first uuid;
  v_lots int;
begin
  for v_item in
    select i.id, i.organization_id, i.sale_id, i.project_id, i.quality, i.quantity_kg,
           s.sale_date, s.created_at, s.created_by
    from public.sale_items i
    join public.sales s on s.id = i.sale_id
    where s.status <> 'cancelada'
    order by s.sale_date, s.created_at, i.id
  loop
    v_left := v_item.quantity_kg;
    v_lots := 0;
    for v_lot in
      select id, available_kg from public.harvests
      where project_id = v_item.project_id and available_kg > 0
      order by (quality is not distinct from v_item.quality) desc, harvest_date, created_at, id
    loop
      exit when v_left <= 0;
      v_take := least(v_left, v_lot.available_kg);
      insert into public.production_movements (
        id, organization_id, harvest_id, movement_type, movement_date, quantity_kg, available_after,
        sale_id, sale_item_id, created_at, created_by
      ) values (
        gen_random_uuid(), v_item.organization_id, v_lot.id, 'venta', v_item.sale_date, -v_take,
        v_lot.available_kg - v_take, v_item.sale_id, v_item.id, v_item.created_at, v_item.created_by
      );
      update public.harvests set sold_kg = sold_kg + v_take where id = v_lot.id;
      v_left := v_left - v_take;
      v_lots := v_lots + 1;
      v_first := coalesce(case when v_lots = 1 then v_lot.id end, v_first);
    end loop;
    if v_left > 0 then
      raise exception 'La partida % excede la producción registrada de su proyecto', v_item.id;
    end if;
    if v_lots = 1 then
      update public.sale_items set harvest_id = v_first where id = v_item.id;
    end if;
  end loop;
end;
$$;

alter table public.harvests enable trigger harvests_check_project;

select public.refresh_sale_status(id) from public.sales where public.sale_is_active(status);

-- -----------------------------------------------------------------------------
-- Evidencias: fotografías de cortes y comprobantes de pago (imagen o PDF)
-- -----------------------------------------------------------------------------
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
where id = 'evidencias';

alter table public.attachments
  drop constraint attachments_entity_type_check,
  drop constraint attachments_mime_type_check,
  add constraint attachments_entity_type_check check (entity_type in (
    'irrigation_log', 'chemical_application', 'field_activity', 'machinery_maintenance', 'harvest', 'payment')),
  add constraint attachments_mime_type_check check (
    mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic')
    or (entity_type = 'payment' and mime_type = 'application/pdf'));

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
    when 'harvest' then 'harvests'
    when 'payment' then 'payments'
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

-- Roles que leen (p_write = false; null = cualquier miembro) o agregan
-- evidencias según el tipo de registro. Los comprobantes de pago son
-- información financiera.
create or replace function public.attachment_roles(p_entity text, p_write boolean)
returns public.app_role[]
language sql
immutable
set search_path = ''
as $$
  select case
    when p_entity = 'payment' and p_write then array['propietario', 'administrador', 'finanzas']
    when p_entity = 'payment' then array['propietario', 'administrador', 'finanzas', 'consulta']
    when p_write then array['propietario', 'administrador', 'agronomo', 'supervisor']
  end::public.app_role[];
$$;

drop policy attachments_select on public.attachments;
drop policy attachments_insert on public.attachments;
drop policy attachments_delete on public.attachments;

create policy attachments_select on public.attachments for select to authenticated
  using (
    public.is_member(organization_id)
    and (entity_type <> 'payment' or public.has_role(organization_id, public.attachment_roles(entity_type, false)))
  );
create policy attachments_insert on public.attachments for insert to authenticated
  with check (public.has_role(organization_id, public.attachment_roles(entity_type, true)));
-- Un comprobante de pago solo lo retira propietario o administrador.
create policy attachments_delete on public.attachments for delete to authenticated
  using (
    public.is_member(organization_id)
    and ((created_by = auth.uid() and entity_type <> 'payment')
         or public.has_role(organization_id, array['propietario', 'administrador']::public.app_role[]))
  );

drop policy "evidencias_select_members" on storage.objects;
drop policy "evidencias_insert_field" on storage.objects;

create policy "evidencias_select_members" on storage.objects for select to authenticated
  using (
    bucket_id = 'evidencias'
    and public.is_member(public.storage_object_org(name))
    and (split_part(name, '/', 2) <> 'payment'
         or public.has_role(public.storage_object_org(name), public.attachment_roles('payment', false)))
  );
create policy "evidencias_insert_field" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidencias'
    and public.has_role(public.storage_object_org(name), public.attachment_roles(split_part(name, '/', 2), true))
  );

-- -----------------------------------------------------------------------------
-- Vistas (SECURITY INVOKER: respetan la RLS del usuario)
-- -----------------------------------------------------------------------------

-- Igual que en la Fase 3; lo vendido cuenta desde la confirmación y la
-- existencia sale de los lotes (cosechado − vendido − mermas y ajustes).
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
    select project_id, sum(quantity_kg) as kg, sum(available_kg) as available_kg, sum(adjusted_kg) as adjusted_kg,
           count(*) as lots, count(distinct cut_number) as cuts
    from public.harvests
    group by project_id
  ),
  sold as (
    select si.project_id, sum(si.quantity_kg) as kg, sum(si.amount) as amount
    from public.sale_items si
    join public.sales s on s.id = si.sale_id
    where public.sale_is_active(s.status)
    group by si.project_id
  ),
  -- Lo cobrado de cada venta se prorratea entre sus proyectos según el importe
  -- de sus partidas (una venta puede incluir producción de varios proyectos).
  collected as (
    select si.project_id, sum(s.amount_paid * si.amount / s.total) as amount
    from public.sale_items si
    join public.sales s on s.id = si.sale_id
    where public.sale_is_active(s.status) and s.total > 0
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
    coalesce(h.available_kg, 0)       as available_kg,
    coalesce(h.adjusted_kg, 0)        as shrinkage_kg,
    coalesce(h.lots, 0)               as lots,
    coalesce(h.cuts, 0)               as cuts,
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

create view public.v_sale_balances with (security_invoker = true) as
  select
    s.id,
    s.organization_id,
    s.code,
    s.customer_id,
    c.name as customer_name,
    s.sale_date,
    s.due_date,
    s.delivery_date,
    s.status,
    s.subtotal,
    s.discount,
    s.total,
    s.amount_paid,
    s.advance_balance,
    case when public.sale_is_active(s.status) then s.total - s.amount_paid else 0 end as balance,
    case
      when s.status = 'cancelada' then 'cancelada'
      when s.status = 'borrador' then 'borrador'
      when s.amount_paid = 0 then 'pendiente'
      when s.amount_paid < s.total then 'parcial'
      else 'pagada'
    end as payment_status,
    case
      when not public.sale_is_active(s.status) then null
      when it.pending = 0 then 'entregada'
      when it.delivered > 0 then 'parcial'
      else 'pendiente'
    end as delivery_status,
    case
      when public.sale_is_active(s.status) and s.amount_paid < s.total and s.due_date < public.mx_today()
        then public.mx_today() - s.due_date
      else 0
    end as days_overdue,
    case when public.sale_is_active(s.status) and s.total > 0 then round(s.amount_paid * 100 / s.total, 1) end
      as recovery_pct,
    (select max(p.payment_date) from public.payments p where p.sale_id = s.id and p.status = 'aplicado')
      as last_payment_date,
    it.kg as total_kg,
    s.created_at
  from public.sales s
  join public.customers c on c.id = s.customer_id
  left join lateral (
    select sum(i.quantity_kg) as kg,
           count(*) filter (where i.delivered_quantity < i.quantity) as pending,
           count(*) filter (where i.delivered_quantity > 0) as delivered
    from public.sale_items i
    where i.sale_id = s.id
  ) it on true;

-- Trazabilidad venta ↔ lote ↔ parcela ↔ proyecto. Una partida anterior a la
-- Fase 4 puede repartirse entre varios lotes: su importe se prorratea por kg.
create view public.v_sale_lot_trace with (security_invoker = true) as
  select
    m.organization_id,
    m.id as movement_id,
    m.sale_id,
    s.code as sale_code,
    s.status as sale_status,
    s.sale_date,
    s.customer_id,
    cu.name as customer_name,
    m.sale_item_id,
    i.description,
    m.harvest_id,
    h.lot_code,
    h.harvest_date,
    h.quality,
    h.cut_number,
    h.project_id,
    p.code as project_code,
    p.name as project_name,
    h.plot_id,
    pl.name as plot_name,
    f.name as farm_name,
    -m.quantity_kg as quantity_kg,
    round(i.amount * (-m.quantity_kg) / i.quantity_kg, 2) as amount,
    r.id is not null as reversed
  from public.production_movements m
  join public.sales s on s.id = m.sale_id
  join public.customers cu on cu.id = s.customer_id
  join public.sale_items i on i.id = m.sale_item_id
  join public.harvests h on h.id = m.harvest_id
  join public.projects p on p.id = h.project_id
  join public.plots pl on pl.id = h.plot_id
  join public.farms f on f.id = pl.farm_id
  left join public.production_movements r on r.reverses_id = m.id
  where m.movement_type = 'venta';

-- La cronología del proyecto incluye los cortes (lotes) para la trazabilidad
-- desde la labor de campo hasta la cosecha.
create or replace view public.v_project_timeline with (security_invoker = true) as
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
    and not exists (select 1 from public.machinery_usage u where u.fuel_movement_id in (m.id, m.reverses_id))
  union all
  select
    h.organization_id, h.project_id, h.plot_id, 'cosecha', h.id,
    h.harvest_date, null::time,
    'Corte ' || h.cut_number || ' · lote ' || h.lot_code,
    rtrim(to_char(h.quantity_kg, 'FM999,999,990.999'), '.') || ' kg · ' || h.quality::text
      || coalesce(' · ' || h.classification, ''),
    e.full_name, null::numeric, false, h.created_at
  from public.harvests h
  left join public.employees e on e.id = h.responsible_id;

-- Indicadores financieros del dashboard (estados de la Fase 4).
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
    select * from public.v_sale_balances where organization_id = p_org and public.sale_is_active(status)
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

-- Dashboard comercial. Flujos del periodo (producción por fecha de corte,
-- ventas por fecha de venta y cobros por fecha de pago o de aplicación del
-- anticipo) y saldos al día de hoy. Con filtro de cultivo o proyecto, cada
-- venta participa con el importe de sus partidas de ese cultivo/proyecto y sus
-- cobros y saldo se prorratean en la misma proporción.
create or replace function public.commercial_summary(
  p_org uuid,
  p_from date,
  p_to date,
  p_crop uuid default null,
  p_project uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with lots as (
    select h.*, p.code as project_code, p.name as project_name,
           c.name || coalesce(' · ' || c.variety, '') as crop_name
    from public.harvests h
    join public.projects p on p.id = h.project_id
    join public.crops c on c.id = p.crop_id
    where h.organization_id = p_org and h.harvest_date between p_from and p_to
      and (p_crop is null or c.id = p_crop) and (p_project is null or p.id = p_project)
  ),
  sale_share as (
    select s.id, s.customer_id, s.sale_date, s.due_date, s.total, s.amount_paid,
           sum(i.amount) as amount,
           case when s.total > 0 then sum(i.amount) / s.total else 0 end as share
    from public.sales s
    join public.sale_items i on i.sale_id = s.id
    join public.projects p on p.id = i.project_id
    where s.organization_id = p_org and public.sale_is_active(s.status)
      and (p_crop is null or p.crop_id = p_crop) and (p_project is null or p.id = p_project)
    group by s.id
  ),
  period_sales as (
    select * from sale_share where sale_date between p_from and p_to
  ),
  receipts as (
    select ss.customer_id, x.receipt_date, x.amount * ss.share as amount
    from sale_share ss
    join lateral (
      select payment_date as receipt_date, amount from public.payments
      where sale_id = ss.id and status = 'aplicado' and kind = 'pago'
      union all
      select application_date, amount from public.advance_applications
      where sale_id = ss.id and status = 'aplicado'
    ) x on true
    where x.receipt_date between p_from and p_to
  ),
  balances as (
    select ss.customer_id, (ss.total - ss.amount_paid) * ss.share as balance,
           case when ss.due_date < public.mx_today() then (ss.total - ss.amount_paid) * ss.share else 0 end as overdue
    from sale_share ss
    where ss.amount_paid < ss.total
  )
  select jsonb_build_object(
    'production_kg',     (select coalesce(sum(quantity_kg), 0) from lots),
    'available_kg',      (select coalesce(sum(available_kg), 0) from lots),
    'sold_kg',           (select coalesce(sum(sold_kg), 0) from lots),
    'shrinkage_kg',      (select coalesce(sum(adjusted_kg), 0) from lots),
    'lots',              (select count(*) from lots),
    'cuts',              (select count(distinct (project_id, cut_number)) from lots),
    'sales_total',       (select round(coalesce(sum(amount), 0), 2) from period_sales),
    'sales_count',       (select count(*) from period_sales),
    'sales_month',       (
      select round(coalesce(sum(amount), 0), 2) from sale_share
      where sale_date >= date_trunc('month', public.mx_today())::date
    ),
    'collected',         (select round(coalesce(sum(amount), 0), 2) from receipts),
    'period_sales_paid', (select round(coalesce(sum(amount_paid * share), 0), 2) from period_sales),
    'receivable',        (select round(coalesce(sum(balance), 0), 2) from balances),
    'overdue',           (select round(coalesce(sum(overdue), 0), 2) from balances),
    'customers_active',  (select count(*) from public.customers where organization_id = p_org and is_active),
    'customers_with_balance', (select count(distinct customer_id) from balances where balance > 0),
    'production_by_crop', (
      select coalesce(jsonb_agg(jsonb_build_object('label', crop_name, 'value', kg) order by kg desc), '[]'::jsonb)
      from (select crop_name, sum(quantity_kg) as kg from lots group by crop_name) t
    ),
    'production_by_project', (
      select coalesce(jsonb_agg(jsonb_build_object('label', project_code, 'name', project_name, 'value', kg) order by kg desc), '[]'::jsonb)
      from (select project_code, project_name, sum(quantity_kg) as kg from lots group by project_code, project_name) t
    ),
    'production_by_quality', (
      select coalesce(jsonb_agg(jsonb_build_object('label', quality, 'value', kg) order by kg desc), '[]'::jsonb)
      from (select quality, sum(quantity_kg) as kg from lots group by quality) t
    ),
    'sales_by_month', (
      select coalesce(jsonb_agg(jsonb_build_object('month', month, 'value', amount) order by month), '[]'::jsonb)
      from (select to_char(sale_date, 'YYYY-MM') as month, round(sum(amount), 2) as amount from period_sales group by 1) t
    ),
    'sales_by_customer', (
      select coalesce(jsonb_agg(jsonb_build_object('label', name, 'value', amount) order by amount desc), '[]'::jsonb)
      from (
        select c.name, round(sum(ps.amount), 2) as amount
        from period_sales ps join public.customers c on c.id = ps.customer_id
        group by c.name order by 2 desc limit 10
      ) t
    ),
    'collections_by_month', (
      select coalesce(jsonb_agg(jsonb_build_object('month', month, 'value', amount) order by month), '[]'::jsonb)
      from (select to_char(receipt_date, 'YYYY-MM') as month, round(sum(amount), 2) as amount from receipts group by 1) t
    ),
    'balances_by_customer', (
      select coalesce(jsonb_agg(jsonb_build_object('label', name, 'value', balance, 'overdue', overdue) order by balance desc), '[]'::jsonb)
      from (
        select c.name, round(sum(b.balance), 2) as balance, round(sum(b.overdue), 2) as overdue
        from balances b join public.customers c on c.id = b.customer_id
        group by c.name order by 2 desc limit 10
      ) t
    )
  );
$$;

-- -----------------------------------------------------------------------------
-- Auditoría
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['production_movements', 'advance_applications', 'sale_deliveries', 'sale_delivery_items'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.log_audit()',
      t || '_audit', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security: el libro de producto lo leen todos los miembros (kg, sin
-- importes); entregas y anticipos, solo los roles con lectura financiera.
-- Ninguna de estas tablas admite escrituras directas.
-- -----------------------------------------------------------------------------
alter table public.production_movements enable row level security;
alter table public.advance_applications enable row level security;
alter table public.sale_deliveries      enable row level security;
alter table public.sale_delivery_items  enable row level security;

create policy production_movements_select on public.production_movements for select to authenticated
  using (public.is_member(organization_id));
create policy advance_applications_select on public.advance_applications for select to authenticated
  using (public.has_role(organization_id, '{propietario,administrador,finanzas,consulta}'::public.app_role[]));
create policy sale_deliveries_select on public.sale_deliveries for select to authenticated
  using (public.has_role(organization_id, '{propietario,administrador,finanzas,consulta}'::public.app_role[]));
create policy sale_delivery_items_select on public.sale_delivery_items for select to authenticated
  using (public.has_role(organization_id, '{propietario,administrador,finanzas,consulta}'::public.app_role[]));

-- -----------------------------------------------------------------------------
-- Privilegios
-- -----------------------------------------------------------------------------
revoke all on public.production_movements, public.advance_applications, public.sale_deliveries,
  public.sale_delivery_items, public.v_project_costs, public.v_sale_balances, public.v_sale_lot_trace,
  public.v_project_timeline
from anon, authenticated;

grant select on public.production_movements, public.advance_applications, public.sale_deliveries,
  public.sale_delivery_items, public.v_project_costs, public.v_sale_balances, public.v_sale_lot_trace,
  public.v_project_timeline
to authenticated;

-- Lote, existencias y kg se calculan en la BD; el cliente captura cantidad y unidad.
grant insert (cut_number, unit, quantity, unit_weight_kg, classification, responsible_id)
  on public.harvests to authenticated;
grant update (cut_number, unit, quantity, unit_weight_kg, classification, responsible_id)
  on public.harvests to authenticated;

grant insert (customer_type) on public.customers to authenticated;
grant update (customer_type) on public.customers to authenticated;

revoke execute on function
  public.produce_unit_kg(public.produce_unit, numeric),
  public.sale_is_active(public.sale_status),
  public.prevent_production_movement_changes(),
  public.before_harvest_write(),
  public.before_harvest_delete(),
  public.post_production_movement(uuid, uuid, public.production_movement_type, date, numeric, uuid, uuid, uuid, text),
  public.register_production_adjustment(uuid, uuid, public.production_movement_type, numeric, date, text),
  public.reverse_production_adjustment(uuid, uuid, text),
  public.parse_sale_lines(jsonb),
  public.refresh_sale_status(uuid),
  public.confirm_sale_internal(uuid),
  public.save_sale(uuid, uuid, date, jsonb, date, date, text, boolean),
  public.confirm_sale(uuid),
  public.cancel_sale(uuid, text),
  public.register_delivery(uuid, uuid, date, jsonb, text, text, text),
  public.cancel_delivery(uuid, text),
  public.register_payment(uuid, uuid, date, numeric, public.payment_method, text, text, public.payment_kind),
  public.apply_advance(uuid, uuid, numeric, date),
  public.cancel_advance_application(uuid, text),
  public.cancel_payment(uuid, text),
  public.attachment_roles(text, boolean),
  public.finance_summary(uuid),
  public.commercial_summary(uuid, date, date, uuid, uuid)
from public, anon;

revoke execute on function
  public.prevent_production_movement_changes(),
  public.before_harvest_write(),
  public.before_harvest_delete(),
  public.post_production_movement(uuid, uuid, public.production_movement_type, date, numeric, uuid, uuid, uuid, text),
  public.parse_sale_lines(jsonb),
  public.refresh_sale_status(uuid),
  public.confirm_sale_internal(uuid)
from authenticated;

-- produce_unit_kg y sale_is_active se evalúan en restricciones y vistas;
-- attachment_roles, en las políticas de evidencias.
grant execute on function
  public.produce_unit_kg(public.produce_unit, numeric),
  public.sale_is_active(public.sale_status),
  public.attachment_roles(text, boolean),
  public.register_production_adjustment(uuid, uuid, public.production_movement_type, numeric, date, text),
  public.reverse_production_adjustment(uuid, uuid, text),
  public.save_sale(uuid, uuid, date, jsonb, date, date, text, boolean),
  public.confirm_sale(uuid),
  public.cancel_sale(uuid, text),
  public.register_delivery(uuid, uuid, date, jsonb, text, text, text),
  public.cancel_delivery(uuid, text),
  public.register_payment(uuid, uuid, date, numeric, public.payment_method, text, text, public.payment_kind),
  public.apply_advance(uuid, uuid, numeric, date),
  public.cancel_advance_application(uuid, text),
  public.cancel_payment(uuid, text),
  public.finance_summary(uuid),
  public.commercial_summary(uuid, date, date, uuid, uuid)
to authenticated;
