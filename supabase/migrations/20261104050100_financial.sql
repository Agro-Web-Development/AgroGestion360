-- =============================================================================
-- AgroGestión 360 · Migración 0006 · Administración financiera y rentabilidad
--
-- Consolida lo que ya registran los demás módulos; no crea un sistema
-- financiero paralelo:
--   · v_project_cost_entries sigue siendo la ÚNICA fuente de costos. Cada
--     renglón conserva su módulo de origen (source/source_id) y ahora también
--     su clase de costo (7 clases), su categoría presupuestal (12 categorías)
--     y el registro de origen para auditoría (origin_table/origin_id).
--   · Presupuestos por proyecto con partidas por categoría y concepto. Cada
--     modificación es una REVISIÓN nueva e inmutable; la versión 1 (original)
--     se conserva siempre.
--   · Gastos: un encabezado (expenses) con proveedor, comprobante, método de
--     pago y responsable, y su reparto a proyectos en project_expenses (la
--     tabla existente pasa a ser la asignación). Un gasto es directo (un
--     proyecto) o compartido (varios, con criterio de distribución guardado).
--   · Flujo de efectivo: cash_movements registra pagos de gastos, pagos a
--     proveedores y otros ingresos/egresos. Un gasto registrado NO es un egreso
--     hasta que se registra su pago.
--   · Alertas de presupuesto con umbrales configurables por organización.
--
-- Concurrencia: gasto → proyectos (FOR SHARE, en orden de id). Pago de gasto:
-- gasto (FOR UPDATE) → movimiento. Revisión de presupuesto: proyecto
-- (FOR UPDATE), así dos revisiones simultáneas se serializan y la segunda
-- falla si partió de una versión que ya no es la vigente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.budget_category as enum (
  'preparacion_terreno', 'semillas', 'fertilizantes', 'agroquimicos', 'riego', 'mano_obra',
  'maquinaria', 'combustible', 'mantenimiento', 'cosecha', 'transporte', 'otros'
);

create type public.allocation_method as enum (
  'directo',        -- un solo proyecto
  'superficie',     -- proporcional a las hectáreas asignadas a cada proyecto
  'partes_iguales',
  'porcentaje',     -- porcentajes capturados (suman 100)
  'importe'         -- importes capturados (suman el total)
);

create type public.cash_kind as enum (
  'pago_gasto',     -- pago (total o parcial) de un gasto registrado
  'pago_proveedor', -- pago a un proveedor fuera de gastos (p. ej. compras de almacén)
  'otro_ingreso',   -- apoyos, intereses, venta de activos…
  'otro_egreso'     -- comisiones, retiros, otros
);

-- -----------------------------------------------------------------------------
-- Clasificación de costos (funciones puras; reflejadas en features/finance)
--
--   Clase (consolidación)    Categoría presupuestal
--   insumos                  semillas, fertilizantes, agroquímicos, otros (según la clasificación del insumo)
--   combustibles             combustible
--   mano_obra                mano de obra
--   maquinaria               maquinaria (tarifa de uso)
--   mantenimiento            la del gasto (mantenimiento de infraestructura del proyecto)
--   servicios                actividades contratadas y gastos de servicios (agua, energía, fletes, maquila, asesoría)
--   gastos_adicionales       renta, seguros, financiamiento, derechos y otros gastos
-- -----------------------------------------------------------------------------
create or replace function public.input_cost_class(p_kind public.input_kind)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_kind = 'combustible' then 'combustibles' else 'insumos' end;
$$;

create or replace function public.input_budget_category(p_kind public.input_kind)
returns public.budget_category
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'semilla' then 'semillas'
    when 'fertilizante' then 'fertilizantes'
    when 'agroquimico' then 'agroquimicos'
    when 'biologico' then 'agroquimicos'
    when 'combustible' then 'combustible'
    else 'otros'
  end::public.budget_category;
$$;

create or replace function public.expense_cost_class(p_category public.expense_category)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_category = 'mantenimiento' then 'mantenimiento'
    when p_category in ('servicios_profesionales', 'maquila', 'fletes', 'agua_riego', 'energia') then 'servicios'
    else 'gastos_adicionales'
  end;
$$;

-- Categoría presupuestal sugerida para un tipo de gasto (el usuario puede elegir otra permitida).
create or replace function public.expense_default_budget_category(p_category public.expense_category)
returns public.budget_category
language sql
immutable
set search_path = ''
as $$
  select case p_category
    when 'agua_riego' then 'riego'
    when 'energia' then 'riego'
    when 'fletes' then 'transporte'
    when 'maquila' then 'cosecha'
    when 'mantenimiento' then 'mantenimiento'
    else 'otros'
  end::public.budget_category;
$$;

-- Estado de una partida o proyecto frente a su presupuesto. Compara importes
-- exactos (sin redondear el porcentaje) contra los umbrales configurados.
create or replace function public.budget_status(
  p_budget numeric,
  p_actual numeric,
  p_warning numeric,
  p_critical numeric,
  p_exhausted numeric
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_budget, 0) <= 0 then 'sin_presupuesto'
    when coalesce(p_actual, 0) * 100 >= p_budget * p_exhausted then 'agotado'
    when coalesce(p_actual, 0) * 100 >= p_budget * p_critical then 'critico'
    when coalesce(p_actual, 0) * 100 >= p_budget * p_warning then 'aviso'
    else 'normal'
  end;
$$;

-- Las vistas de costos se recrean al final con las columnas nuevas.
drop view public.v_project_costs;
drop view public.v_project_cost_entries;

-- -----------------------------------------------------------------------------
-- Actividades: categoría presupuestal de su costo adicional (servicio contratado)
-- -----------------------------------------------------------------------------
alter table public.activity_types
  add column cost_category public.budget_category not null default 'otros';

update public.activity_types
set cost_category = case lower(name)
  when 'preparación de terreno' then 'preparacion_terreno'
  when 'limpieza' then 'preparacion_terreno'
  when 'siembra' then 'mano_obra'
  when 'trasplante' then 'mano_obra'
  when 'poda' then 'mano_obra'
  when 'deshierbe' then 'mano_obra'
  when 'fertilización' then 'fertilizantes'
  when 'control fitosanitario' then 'agroquimicos'
  when 'mantenimiento' then 'mantenimiento'
  else 'otros'
end::public.budget_category;

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

  insert into public.activity_types (organization_id, name, cost_category) values
    (p_org, 'Preparación de terreno', 'preparacion_terreno'),
    (p_org, 'Limpieza', 'preparacion_terreno'),
    (p_org, 'Siembra', 'mano_obra'),
    (p_org, 'Trasplante', 'mano_obra'),
    (p_org, 'Fertilización', 'fertilizantes'),
    (p_org, 'Poda', 'mano_obra'),
    (p_org, 'Deshierbe', 'mano_obra'),
    (p_org, 'Control fitosanitario', 'agroquimicos'),
    (p_org, 'Mantenimiento', 'mantenimiento'),
    (p_org, 'Otras actividades', 'otros')
  on conflict do nothing;
$$;

-- -----------------------------------------------------------------------------
-- Umbrales de alerta de presupuesto (por organización; sin fila = 70/90/100)
-- -----------------------------------------------------------------------------
create table public.finance_settings (
  id               uuid not null default gen_random_uuid() unique,
  organization_id  uuid primary key references public.organizations (id) on delete cascade,
  warning_pct      numeric(5, 1) not null default 70,
  critical_pct     numeric(5, 1) not null default 90,
  exhausted_pct    numeric(5, 1) not null default 100,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  constraint finance_settings_order_check check (
    warning_pct > 0 and warning_pct < critical_pct and critical_pct < exhausted_pct and exhausted_pct <= 300
  )
);

-- -----------------------------------------------------------------------------
-- Presupuestos: encabezado por versión y partidas. Inmutables; una revisión
-- nueva reemplaza a la vigente (is_current) y conserva todas las anteriores.
-- -----------------------------------------------------------------------------
create table public.project_budgets (
  id               uuid primary key, -- lo genera el cliente: llave de idempotencia
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  project_id       uuid not null,
  version          int not null check (version >= 1),
  is_current       boolean not null,
  crop_id          uuid not null,                                 -- cultivo al elaborar la versión
  area_ha          numeric(12, 2) not null check (area_ha > 0),   -- superficie presupuestada
  period_start     date not null,
  period_end       date not null,
  total            numeric(14, 2) not null check (total > 0),
  revision_reason  text check (char_length(revision_reason) <= 500),
  notes            text check (char_length(notes) <= 2000),
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  unique (organization_id, id),
  unique (project_id, version),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  foreign key (organization_id, crop_id) references public.crops (organization_id, id) on delete restrict,
  check (period_end >= period_start and period_end - period_start <= 1095),
  check (version = 1 or char_length(trim(coalesce(revision_reason, ''))) >= 5)
);

create unique index project_budgets_current_key on public.project_budgets (project_id) where is_current;

create table public.project_budget_lines (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  budget_id        uuid not null,
  line_no          int not null check (line_no between 1 and 200),
  category         public.budget_category not null,
  concept          text not null check (char_length(trim(concept)) between 2 and 150),
  unit             text check (char_length(unit) <= 20),
  quantity         numeric(14, 3) not null check (quantity > 0),
  unit_cost        numeric(14, 4) not null check (unit_cost >= 0),
  amount           numeric(14, 2) generated always as (round(quantity * unit_cost, 2)) stored,
  unique (budget_id, line_no),
  foreign key (organization_id, budget_id) references public.project_budgets (organization_id, id) on delete cascade
);

create index project_budget_lines_budget_idx on public.project_budget_lines (budget_id, category);

create or replace function public.prevent_budget_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then
      return old; -- cascada al eliminar el proyecto o la organización
    end if;
  elsif tg_table_name = 'project_budgets' and (to_jsonb(new) - 'is_current') = (to_jsonb(old) - 'is_current') then
    return new; -- solo cambia cuál versión es la vigente
  end if;
  raise exception 'Los presupuestos no se modifican ni eliminan; registra una nueva revisión' using errcode = '42501';
end;
$$;

create trigger project_budgets_immutable before update or delete on public.project_budgets
  for each row execute function public.prevent_budget_changes();
create trigger project_budget_lines_immutable before update or delete on public.project_budget_lines
  for each row execute function public.prevent_budget_changes();

-- Con presupuesto detallado, el importe del proyecto lo sincroniza save_budget
-- (total de la versión vigente); no se captura a mano.
create or replace function public.guard_project_budget_amount()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.budget_amount is distinct from old.budget_amount
     and coalesce(current_setting('ag360.budget_sync', true), '') <> 'on'
     and exists (select 1 from public.project_budgets where project_id = new.id) then
    raise exception 'El proyecto tiene un presupuesto detallado; modifícalo con una nueva revisión en Presupuestos'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger projects_budget_amount_guard before update of budget_amount on public.projects
  for each row execute function public.guard_project_budget_amount();

-- -----------------------------------------------------------------------------
-- Gastos: encabezado y reparto a proyectos
-- -----------------------------------------------------------------------------
create table public.expenses (
  id                 uuid primary key, -- lo genera el cliente: llave de idempotencia
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  expense_date       date not null,
  category           public.expense_category not null,  -- tipo de gasto
  cost_category      public.budget_category not null,   -- categoría presupuestal
  description        text not null check (char_length(trim(description)) between 3 and 200), -- concepto
  supplier_id        uuid,
  invoice_ref        text check (char_length(invoice_ref) <= 60),
  amount             numeric(14, 2) not null check (amount > 0),
  payment_method     public.payment_method,
  allocation_method  public.allocation_method not null default 'directo',
  responsible_id     uuid references public.profiles (id) on delete set null,
  notes              text check (char_length(notes) <= 1000),
  paid_amount        numeric(14, 2) not null default 0, -- solo lo modifican los pagos (cash_movements)
  status             public.log_status not null default 'registrado',
  cancel_reason      text check (char_length(cancel_reason) <= 500),
  cancelled_at       timestamptz,
  cancelled_by       uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  created_by         uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users (id) on delete set null,
  unique (organization_id, id),
  foreign key (organization_id, supplier_id) references public.suppliers (organization_id, id) on delete restrict,
  -- Insumos, semillas, fertilizantes, agroquímicos, combustible, mano de obra y
  -- maquinaria se cargan desde su módulo: un gasto directo no puede duplicarlos.
  constraint expenses_cost_category_check check (
    cost_category in ('preparacion_terreno', 'riego', 'mantenimiento', 'cosecha', 'transporte', 'otros')
  ),
  constraint expenses_paid_check check (paid_amount >= 0 and paid_amount <= amount),
  constraint expenses_cancel_check check ((status = 'cancelado') = (cancelled_at is not null)),
  constraint expenses_cancel_paid_check check (status = 'registrado' or paid_amount = 0)
);

create index expenses_org_date_idx on public.expenses (organization_id, expense_date desc);
-- Una factura de un proveedor se registra una sola vez (si es de varios
-- proyectos, se registra como gasto compartido).
create unique index expenses_invoice_key
  on public.expenses (organization_id, coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid), upper(invoice_ref))
  where invoice_ref is not null and status = 'registrado';

comment on column public.expenses.paid_amount is
  'Pagado con movimientos de efectivo aplicados. Un gasto registrado no es egreso hasta que se paga.';

-- Datos existentes: proveedores capturados como texto → catálogo de proveedores.
insert into public.suppliers (organization_id, name)
select distinct on (x.organization_id, lower(trim(x.supplier))) x.organization_id, trim(x.supplier)
from public.project_expenses x
where char_length(trim(coalesce(x.supplier, ''))) >= 2
  and not exists (
    select 1 from public.suppliers s where s.organization_id = x.organization_id and lower(s.name) = lower(trim(x.supplier))
  )
order by x.organization_id, lower(trim(x.supplier)), x.created_at;

-- Cada gasto existente se vuelve un encabezado; los renglones con la misma
-- factura del mismo proveedor (prorrateo manual entre proyectos) se agrupan
-- en un solo gasto compartido por importe.
alter table public.project_expenses
  add column expense_id        uuid,
  add column allocation_share  numeric(9, 6),
  add column allocation_basis  numeric(14, 4);

create temporary table tmp_expense_groups as
  select g.id,
         first_value(g.id) over w as header_id,
         count(*) over (partition by g.k) as n,
         sum(g.amount) over (partition by g.k) as total
  from (
    select x.id, x.amount, x.created_at,
           case when x.invoice_ref is null then x.id::text
                else x.organization_id::text || '|' || lower(trim(coalesce(x.supplier, ''))) || '|' || upper(x.invoice_ref)
           end as k
    from public.project_expenses x
  ) g
  window w as (partition by g.k order by g.created_at, g.id);

insert into public.expenses (id, organization_id, expense_date, category, cost_category, description, supplier_id,
                             invoice_ref, amount, allocation_method, notes, created_at, created_by)
select x.id, x.organization_id, x.expense_date, x.category, public.expense_default_budget_category(x.category),
       x.description, s.id, x.invoice_ref, t.total,
       case when t.n > 1 then 'importe' else 'directo' end::public.allocation_method,
       x.notes, x.created_at, x.created_by
from public.project_expenses x
join tmp_expense_groups t on t.id = x.id and t.header_id = x.id
left join public.suppliers s on s.organization_id = x.organization_id and lower(s.name) = lower(trim(x.supplier));

alter table public.project_expenses disable trigger user;
update public.project_expenses x
set expense_id = t.header_id,
    allocation_share = round(x.amount / t.total, 6),
    allocation_basis = case when t.n > 1 then x.amount else 1 end
from tmp_expense_groups t
where t.id = x.id;
alter table public.project_expenses enable trigger user;
drop table tmp_expense_groups;

drop index public.project_expenses_invoice_key;
drop policy project_expenses_insert on public.project_expenses;
drop policy project_expenses_update on public.project_expenses;
drop policy project_expenses_delete on public.project_expenses;

-- La asignación solo guarda proyecto, parcela, fecha (para las reglas del
-- proyecto vigente), importe y criterio; los datos del gasto viven en el encabezado.
alter table public.project_expenses
  drop column category,
  drop column description,
  drop column supplier,
  drop column invoice_ref,
  drop column notes,
  alter column expense_id set not null,
  alter column allocation_share set not null,
  alter column allocation_basis set not null,
  add constraint project_expenses_expense_fkey foreign key (organization_id, expense_id)
    references public.expenses (organization_id, id) on delete restrict,
  add constraint project_expenses_expense_project_key unique (expense_id, project_id),
  add constraint project_expenses_share_check check (allocation_share > 0 and allocation_share <= 1),
  add constraint project_expenses_basis_check check (allocation_basis > 0);

comment on table public.project_expenses is
  'Asignación de un gasto (expenses) a un proyecto: importe, porcentaje (allocation_share) y base del criterio (ha, %, importe).';

-- -----------------------------------------------------------------------------
-- Movimientos de efectivo (distintos de los cobros de ventas, que viven en payments)
-- -----------------------------------------------------------------------------
create table public.cash_movements (
  id               uuid primary key, -- lo genera el cliente: llave de idempotencia
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  kind             public.cash_kind not null,
  direction        text generated always as (case when kind = 'otro_ingreso' then 'ingreso' else 'egreso' end) stored,
  movement_date    date not null,
  concept          text not null check (char_length(trim(concept)) between 3 and 200),
  amount           numeric(14, 2) not null check (amount > 0),
  method           public.payment_method not null,
  reference        text check (char_length(reference) <= 60),
  expense_id       uuid,
  supplier_id      uuid,
  project_id       uuid,
  notes            text check (char_length(notes) <= 500),
  status           public.payment_status not null default 'aplicado',
  cancel_reason    text check (char_length(cancel_reason) <= 500),
  cancelled_at     timestamptz,
  cancelled_by     uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  foreign key (organization_id, expense_id) references public.expenses (organization_id, id) on delete restrict,
  foreign key (organization_id, supplier_id) references public.suppliers (organization_id, id) on delete restrict,
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete restrict,
  check ((kind = 'pago_gasto') = (expense_id is not null)),
  check (kind <> 'pago_gasto' or project_id is null), -- el proyecto sale del reparto del gasto
  check (kind <> 'pago_proveedor' or supplier_id is not null),
  check ((status = 'cancelado') = (cancelled_at is not null))
);

create index cash_movements_org_date_idx on public.cash_movements (organization_id, movement_date desc);
create index cash_movements_expense_idx on public.cash_movements (expense_id) where expense_id is not null;

-- -----------------------------------------------------------------------------
-- Presupuestos: RPC
-- -----------------------------------------------------------------------------
create or replace function public.parse_budget_lines(p_lines jsonb)
returns table (line_no int, category public.budget_category, concept text, unit text, quantity numeric, unit_cost numeric)
language sql
immutable
set search_path = ''
as $$
  select e.n::int, (e.j ->> 'category')::public.budget_category, trim(e.j ->> 'concept'), nullif(trim(e.j ->> 'unit'), ''),
         (e.j ->> 'quantity')::numeric, (e.j ->> 'unit_cost')::numeric
  from jsonb_array_elements(p_lines) with ordinality as e(j, n);
$$;

-- Elabora el presupuesto (versión 1) o una revisión. p_base_version es la
-- versión desde la que se editó: si otra persona guardó una revisión en el
-- intermedio, se rechaza en lugar de sobrescribirla. p_lines: [{category,
-- concept, unit, quantity, unit_cost}]. Idempotente por p_id.
create or replace function public.save_budget(
  p_id uuid,
  p_project uuid,
  p_lines jsonb,
  p_period_start date,
  p_period_end date,
  p_area_ha numeric default null,
  p_base_version int default null,
  p_reason text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_current public.project_budgets%rowtype;
  v_area numeric;
  v_count int;
  v_total numeric;
begin
  if p_id is null then
    raise exception 'Falta el identificador del presupuesto' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));

  select * into v_project from public.projects where id = p_project;
  if not found or not public.is_member(v_project.organization_id) then
    raise exception 'Proyecto no encontrado' using errcode = 'P0002';
  end if;
  if not public.has_role(v_project.organization_id, array['propietario', 'administrador', 'finanzas']::public.app_role[]) then
    raise exception 'No tienes permiso para elaborar presupuestos' using errcode = '42501';
  end if;

  if exists (select 1 from public.project_budgets where id = p_id) then
    if exists (select 1 from public.project_budgets where id = p_id and project_id = p_project) then
      return p_id; -- reintento: la versión ya se guardó
    end if;
    raise exception 'El identificador del presupuesto ya se usó en otra operación' using errcode = '23505';
  end if;

  -- Bloqueo exclusivo: serializa las revisiones del proyecto (y su cierre).
  v_project := public.lock_open_project(v_project.organization_id, p_project, true);

  select * into v_current from public.project_budgets where project_id = p_project and is_current;
  if v_current.id is not null then
    if p_base_version is distinct from v_current.version then
      raise exception 'El presupuesto cambió mientras lo editabas: la versión vigente es la %. Revísala y vuelve a capturar tus cambios',
        v_current.version using errcode = '22023';
    end if;
    if char_length(trim(coalesce(p_reason, ''))) < 5 then
      raise exception 'Indica el motivo de la revisión' using errcode = '22023';
    end if;
  elsif p_base_version is not null then
    raise exception 'El proyecto aún no tiene presupuesto; captura la versión original' using errcode = '22023';
  end if;

  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'El periodo del presupuesto no es válido: la fecha final debe ser igual o posterior a la inicial'
      using errcode = '22023';
  end if;
  if p_period_end - p_period_start > 1095 then
    raise exception 'El periodo del presupuesto no puede exceder 3 años' using errcode = '22023';
  end if;

  v_area := coalesce(p_area_ha, (select sum(assigned_area_ha) from public.project_plots where project_id = p_project));
  if v_area is null or v_area <= 0 or v_area <> round(v_area, 2) then
    raise exception 'Indica la superficie del presupuesto en hectáreas (mayor que cero, 2 decimales)' using errcode = '22023';
  end if;

  if jsonb_typeof(p_lines) is distinct from 'array' then
    raise exception 'El presupuesto debe incluir partidas' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_lines);
  if v_count = 0 or v_count > 200 then
    raise exception 'El presupuesto debe tener entre 1 y 200 partidas' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.parse_budget_lines(p_lines)
    where category is null
       or char_length(coalesce(concept, '')) not between 2 and 150
       or char_length(coalesce(unit, '')) > 20
       or quantity is null or quantity <= 0 or quantity <> round(quantity, 3)
       or unit_cost is null or unit_cost < 0 or unit_cost <> round(unit_cost, 4)
  ) then
    raise exception 'Revisa las partidas: categoría, concepto, cantidad (>0, 3 decimales) y costo unitario (≥0, 4 decimales)'
      using errcode = '22023';
  end if;

  select sum(round(quantity * unit_cost, 2)) into v_total from public.parse_budget_lines(p_lines);
  if v_total <= 0 then
    raise exception 'El presupuesto debe sumar un importe mayor que cero' using errcode = '22023';
  end if;

  if v_current.id is not null then
    update public.project_budgets set is_current = false where id = v_current.id;
  end if;

  insert into public.project_budgets (id, organization_id, project_id, version, is_current, crop_id, area_ha,
                                      period_start, period_end, total, revision_reason, notes)
  values (p_id, v_project.organization_id, p_project, coalesce(v_current.version, 0) + 1, true, v_project.crop_id, v_area,
          p_period_start, p_period_end, v_total, nullif(trim(p_reason), ''), nullif(trim(p_notes), ''));

  insert into public.project_budget_lines (organization_id, budget_id, line_no, category, concept, unit, quantity, unit_cost)
  select v_project.organization_id, p_id, l.line_no, l.category, l.concept, l.unit, l.quantity, l.unit_cost
  from public.parse_budget_lines(p_lines) l;

  -- El importe del proyecto (dashboard, listados) es el de la versión vigente.
  perform set_config('ag360.budget_sync', 'on', true);
  update public.projects set budget_amount = v_total where id = p_project;
  perform set_config('ag360.budget_sync', 'off', true);

  return p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Movimientos de efectivo: RPC
-- -----------------------------------------------------------------------------

-- Registra un pago de gasto, un pago a proveedor u otro ingreso/egreso. Un
-- pago de gasto bloquea el gasto y nunca excede su saldo. Idempotente por p_id.
create or replace function public.register_cash_movement(
  p_id uuid,
  p_org uuid,
  p_kind public.cash_kind,
  p_date date,
  p_amount numeric,
  p_method public.payment_method,
  p_concept text default null,
  p_reference text default null,
  p_expense uuid default null,
  p_supplier uuid default null,
  p_project uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expense public.expenses%rowtype;
  v_concept text := nullif(trim(p_concept), '');
begin
  if p_id is null then
    raise exception 'Falta el identificador del movimiento' using errcode = '22023';
  end if;
  if p_org is null or not public.is_member(p_org) then
    raise exception 'Organización no encontrada' using errcode = 'P0002';
  end if;
  if not public.has_role(p_org, array['propietario', 'administrador', 'finanzas']::public.app_role[]) then
    raise exception 'No tienes permiso para registrar movimientos de efectivo' using errcode = '42501';
  end if;

  if p_kind = 'pago_gasto' then
    -- Mismo orden de bloqueo que cancel_cash_movement: gasto y luego movimiento.
    select * into v_expense from public.expenses where id = p_expense and organization_id = p_org for update;
    if not found then
      raise exception 'Gasto no encontrado' using errcode = 'P0002';
    end if;
  end if;

  if exists (select 1 from public.cash_movements where id = p_id) then
    if exists (select 1 from public.cash_movements
               where id = p_id and organization_id = p_org and kind = p_kind and amount = p_amount) then
      return p_id; -- reintento: el movimiento ya se registró
    end if;
    raise exception 'El identificador del movimiento ya se usó en otra operación' using errcode = '23505';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'El importe debe ser mayor que cero (máximo 2 decimales)' using errcode = '22023';
  end if;
  if p_date is null or p_date > public.mx_today() then
    raise exception 'La fecha del movimiento no puede ser futura' using errcode = '22023';
  end if;
  if p_method is null then
    raise exception 'Indica el método de pago' using errcode = '22023';
  end if;

  case p_kind
    when 'pago_gasto' then
      if v_expense.status <> 'registrado' then
        raise exception 'El gasto está cancelado' using errcode = '22023';
      end if;
      if p_project is not null then
        raise exception 'El pago de un gasto se reparte entre los proyectos del gasto; no indiques proyecto' using errcode = '22023';
      end if;
      if p_amount > v_expense.amount - v_expense.paid_amount then
        raise exception 'El pago (%) excede el saldo pendiente del gasto (%)',
          '$' || to_char(p_amount, 'FM999,999,999,990.00'),
          '$' || to_char(v_expense.amount - v_expense.paid_amount, 'FM999,999,999,990.00')
          using errcode = '22023';
      end if;
      v_concept := coalesce(v_concept, v_expense.description);
    when 'pago_proveedor' then
      if p_supplier is null or not exists (select 1 from public.suppliers where id = p_supplier and organization_id = p_org) then
        raise exception 'Selecciona el proveedor' using errcode = '22023';
      end if;
    else
      if p_supplier is not null and not exists (select 1 from public.suppliers where id = p_supplier and organization_id = p_org) then
        raise exception 'Proveedor no encontrado' using errcode = 'P0002';
      end if;
  end case;
  if p_kind <> 'pago_gasto' and p_expense is not null then
    raise exception 'Solo los pagos de gasto se ligan a un gasto' using errcode = '22023';
  end if;
  if char_length(coalesce(v_concept, '')) < 3 then
    raise exception 'Describe el concepto del movimiento' using errcode = '22023';
  end if;
  if p_project is not null and not exists (select 1 from public.projects where id = p_project and organization_id = p_org) then
    raise exception 'Proyecto no encontrado' using errcode = 'P0002';
  end if;

  insert into public.cash_movements (id, organization_id, kind, movement_date, concept, amount, method, reference,
                                     expense_id, supplier_id, project_id, notes)
  values (p_id, p_org, p_kind, p_date, left(v_concept, 200), p_amount, p_method, nullif(trim(p_reference), ''),
          p_expense, coalesce(p_supplier, v_expense.supplier_id), p_project, nullif(trim(p_notes), ''));

  if p_kind = 'pago_gasto' then
    update public.expenses set paid_amount = paid_amount + p_amount where id = p_expense;
  end if;
  return p_id;
end;
$$;

-- Cancela (no elimina) un movimiento; si es pago de gasto restituye su saldo.
create or replace function public.cancel_cash_movement(p_movement uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expense_id uuid;
  v_mov public.cash_movements%rowtype;
begin
  select expense_id into v_expense_id from public.cash_movements where id = p_movement;
  if v_expense_id is not null then
    perform 1 from public.expenses where id = v_expense_id for update;
  end if;
  select * into v_mov from public.cash_movements where id = p_movement for update;
  if v_mov.id is null or not public.is_member(v_mov.organization_id) then
    raise exception 'Movimiento no encontrado' using errcode = 'P0002';
  end if;
  if not public.has_role(v_mov.organization_id, array['propietario', 'administrador', 'finanzas']::public.app_role[]) then
    raise exception 'No tienes permiso para cancelar movimientos de efectivo' using errcode = '42501';
  end if;
  if v_mov.status = 'cancelado' then
    raise exception 'El movimiento ya está cancelado' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Indica el motivo de la cancelación' using errcode = '22023';
  end if;

  update public.cash_movements
  set status = 'cancelado', cancel_reason = trim(p_reason), cancelled_at = now(), cancelled_by = auth.uid()
  where id = p_movement;
  if v_mov.expense_id is not null then
    update public.expenses set paid_amount = paid_amount - v_mov.amount where id = v_mov.expense_id;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Gastos: RPC
-- -----------------------------------------------------------------------------

-- Registra un gasto directo o compartido y su reparto en una sola transacción.
-- p_allocations: [{project_id, plot_id, value}] — value es el porcentaje
-- (método porcentaje) o el importe (método importe); los demás métodos lo
-- calculan: superficie asignada a cada proyecto o partes iguales. Los
-- centavos del redondeo se asignan al proyecto con mayor base, de modo que la
-- suma del reparto es exactamente el importe del gasto. p_payment (opcional):
-- {id, date, method, reference} registra el pago total en la misma operación.
-- Idempotente por p_id.
create or replace function public.register_expense(
  p_id uuid,
  p_org uuid,
  p_date date,
  p_category public.expense_category,
  p_cost_category public.budget_category,
  p_description text,
  p_amount numeric,
  p_allocation_method public.allocation_method,
  p_allocations jsonb,
  p_supplier uuid default null,
  p_invoice_ref text default null,
  p_payment_method public.payment_method default null,
  p_responsible uuid default null,
  p_notes text default null,
  p_payment jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice text := upper(nullif(trim(p_invoice_ref), ''));
  v_project public.projects%rowtype;
  v_item record;
  v_projects uuid[] := '{}';
  v_plots uuid[] := '{}';
  v_basis numeric[] := '{}';
  v_amounts numeric[] := '{}';
  v_total_basis numeric;
  v_basis_i numeric;
  v_n int;
  v_max int := 1;
  v_dup public.expenses%rowtype;
begin
  if p_id is null then
    raise exception 'Falta el identificador del gasto' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));

  if p_org is null or not public.is_member(p_org) then
    raise exception 'Organización no encontrada' using errcode = 'P0002';
  end if;
  if not public.has_role(p_org, array['propietario', 'administrador', 'finanzas']::public.app_role[]) then
    raise exception 'No tienes permiso para registrar gastos' using errcode = '42501';
  end if;

  if exists (select 1 from public.expenses where id = p_id) then
    if exists (select 1 from public.expenses where id = p_id and organization_id = p_org and amount = p_amount) then
      return p_id; -- reintento: el gasto ya se registró
    end if;
    raise exception 'El identificador del gasto ya se usó en otra operación' using errcode = '23505';
  end if;

  if p_date is null or p_date > public.mx_today() then
    raise exception 'La fecha del gasto no puede ser futura' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'El importe debe ser mayor que cero (máximo 2 decimales)' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_description, ''))) not between 3 and 200 then
    raise exception 'Describe el concepto del gasto (3 a 200 caracteres)' using errcode = '22023';
  end if;
  if p_category is null or p_cost_category is null then
    raise exception 'Indica el tipo y la categoría del gasto' using errcode = '22023';
  end if;
  if p_cost_category not in ('preparacion_terreno', 'riego', 'mantenimiento', 'cosecha', 'transporte', 'otros') then
    raise exception 'Insumos, combustible, mano de obra y maquinaria se registran en su módulo, no como gasto'
      using errcode = '22023';
  end if;
  if p_supplier is not null and not exists (select 1 from public.suppliers where id = p_supplier and organization_id = p_org) then
    raise exception 'Proveedor no encontrado' using errcode = 'P0002';
  end if;
  if p_responsible is not null and not exists (
    select 1 from public.memberships where organization_id = p_org and user_id = p_responsible and status = 'activo'
  ) then
    raise exception 'El responsable debe ser un usuario activo de la organización' using errcode = '22023';
  end if;

  if v_invoice is not null then
    select * into v_dup from public.expenses
    where organization_id = p_org and status = 'registrado' and upper(invoice_ref) = v_invoice
      and supplier_id is not distinct from p_supplier;
    if found then
      raise exception 'La factura % de ese proveedor ya está registrada (gasto del %). Si es de varios proyectos, regístrala como gasto compartido',
        v_invoice, to_char(v_dup.expense_date, 'DD/MM/YYYY') using errcode = '23505';
    end if;
  end if;

  if jsonb_typeof(p_allocations) is distinct from 'array' then
    raise exception 'Indica los proyectos del gasto' using errcode = '22023';
  end if;
  v_n := jsonb_array_length(p_allocations);
  if p_allocation_method = 'directo' and v_n <> 1 then
    raise exception 'Un gasto directo corresponde a un solo proyecto' using errcode = '22023';
  end if;
  if p_allocation_method <> 'directo' and v_n not between 2 and 50 then
    raise exception 'Un gasto compartido se reparte entre 2 y 50 proyectos' using errcode = '22023';
  end if;
  if (select count(distinct x.project_id) from jsonb_to_recordset(p_allocations) as x(project_id uuid)) <> v_n
     or exists (select 1 from jsonb_to_recordset(p_allocations) as x(project_id uuid) where x.project_id is null) then
    raise exception 'Cada proyecto aparece una sola vez en el reparto' using errcode = '22023';
  end if;

  -- Proyectos en orden de id (evita interbloqueos); cada uno debe estar vigente.
  for v_item in
    select x.project_id, x.plot_id, x.value
    from jsonb_to_recordset(p_allocations) as x(project_id uuid, plot_id uuid, value numeric)
    order by x.project_id
  loop
    v_project := public.lock_open_project(p_org, v_item.project_id);
    if p_date < v_project.start_date then
      raise exception 'La fecha del gasto es anterior al inicio del proyecto % (%)',
        v_project.code, to_char(v_project.start_date, 'DD/MM/YYYY') using errcode = '22023';
    end if;
    if v_item.plot_id is not null then
      if p_allocation_method <> 'directo' then
        raise exception 'Un gasto compartido se asigna a todo el proyecto, no a una parcela' using errcode = '22023';
      end if;
      if not exists (select 1 from public.project_plots where project_id = v_item.project_id and plot_id = v_item.plot_id) then
        raise exception 'La parcela no está asignada al proyecto' using errcode = '22023';
      end if;
    end if;

    v_basis_i := case p_allocation_method
      when 'superficie' then (select sum(assigned_area_ha) from public.project_plots where project_id = v_item.project_id)
      when 'porcentaje' then v_item.value
      when 'importe' then v_item.value
      else 1
    end;
    if v_basis_i is null or v_basis_i <= 0
       or (p_allocation_method in ('porcentaje', 'importe') and v_basis_i <> round(v_basis_i, 2)) then
      raise exception '%', case p_allocation_method
        when 'superficie' then format('El proyecto %s no tiene superficie asignada', v_project.code)
        when 'porcentaje' then format('Indica el porcentaje del proyecto %s (mayor que cero, 2 decimales)', v_project.code)
        else format('Indica el importe del proyecto %s (mayor que cero, 2 decimales)', v_project.code)
      end using errcode = '22023';
    end if;
    v_projects := v_projects || v_item.project_id;
    v_plots := v_plots || v_item.plot_id;
    v_basis := v_basis || v_basis_i;
  end loop;

  select sum(b) into v_total_basis from unnest(v_basis) as b;
  if p_allocation_method = 'porcentaje' and v_total_basis <> 100 then
    raise exception 'Los porcentajes del reparto suman % %%; deben sumar 100 %%', v_total_basis using errcode = '22023';
  end if;
  if p_allocation_method = 'importe' and v_total_basis <> p_amount then
    raise exception 'Los importes del reparto suman %; deben sumar el total del gasto (%)',
      '$' || to_char(v_total_basis, 'FM999,999,999,990.00'), '$' || to_char(p_amount, 'FM999,999,999,990.00')
      using errcode = '22023';
  end if;

  for i in 1 .. v_n loop
    v_amounts := v_amounts || round(p_amount * v_basis[i] / v_total_basis, 2);
    if v_basis[i] > v_basis[v_max] then
      v_max := i;
    end if;
  end loop;
  v_amounts[v_max] := v_amounts[v_max] + (p_amount - (select sum(a) from unnest(v_amounts) as a));
  if exists (select 1 from unnest(v_amounts) as a where a <= 0) then
    raise exception 'El importe es demasiado pequeño para repartirlo entre % proyectos', v_n using errcode = '22023';
  end if;

  insert into public.expenses (id, organization_id, expense_date, category, cost_category, description, supplier_id,
                               invoice_ref, amount, payment_method, allocation_method, responsible_id, notes)
  values (p_id, p_org, p_date, p_category, p_cost_category, trim(p_description), p_supplier, v_invoice, p_amount,
          p_payment_method, p_allocation_method, coalesce(p_responsible, auth.uid()), nullif(trim(p_notes), ''));

  -- El trigger check_project_record vuelve a validar cada proyecto y fecha.
  insert into public.project_expenses (organization_id, project_id, plot_id, expense_date, amount, expense_id,
                                       allocation_share, allocation_basis)
  select p_org, v_projects[i], v_plots[i], p_date, v_amounts[i], p_id, round(v_basis[i] / v_total_basis, 6), v_basis[i]
  from generate_series(1, v_n) as i;

  if p_payment is not null then
    perform public.register_cash_movement(
      (p_payment ->> 'id')::uuid, p_org, 'pago_gasto', coalesce((p_payment ->> 'date')::date, p_date), p_amount,
      coalesce((p_payment ->> 'method')::public.payment_method, p_payment_method),
      null, p_payment ->> 'reference', p_id
    );
  end if;

  return p_id;
end;
$$;

-- Cancela un gasto (no se elimina): deja de contar como costo en todos sus
-- proyectos. Requiere cancelar antes sus pagos y que los proyectos sigan vigentes.
create or replace function public.cancel_expense(p_expense uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exp public.expenses%rowtype;
  v_project uuid;
begin
  select * into v_exp from public.expenses where id = p_expense for update;
  if not found or not public.is_member(v_exp.organization_id) then
    raise exception 'Gasto no encontrado' using errcode = 'P0002';
  end if;
  if not public.has_role(v_exp.organization_id, array['propietario', 'administrador', 'finanzas']::public.app_role[]) then
    raise exception 'No tienes permiso para cancelar gastos' using errcode = '42501';
  end if;
  if v_exp.status = 'cancelado' then
    raise exception 'El gasto ya está cancelado' using errcode = '22023';
  end if;
  if v_exp.paid_amount > 0 then
    raise exception 'El gasto tiene pagos registrados; cancélalos antes de cancelar el gasto' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Indica el motivo de la cancelación' using errcode = '22023';
  end if;

  for v_project in select project_id from public.project_expenses where expense_id = p_expense order by project_id loop
    perform public.lock_open_project(v_exp.organization_id, v_project);
  end loop;

  update public.expenses
  set status = 'cancelado', cancel_reason = trim(p_reason), cancelled_at = now(), cancelled_by = auth.uid()
  where id = p_expense;
end;
$$;

-- -----------------------------------------------------------------------------
-- Comprobantes de gastos (imagen o PDF), con la misma protección que los de pagos
-- -----------------------------------------------------------------------------
alter table public.attachments
  drop constraint attachments_entity_type_check,
  drop constraint attachments_mime_type_check,
  add constraint attachments_entity_type_check check (entity_type in (
    'irrigation_log', 'chemical_application', 'field_activity', 'machinery_maintenance', 'harvest', 'payment', 'expense')),
  add constraint attachments_mime_type_check check (
    mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic')
    or (entity_type in ('payment', 'expense') and mime_type = 'application/pdf'));

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
    when 'expense' then 'expenses'
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
-- evidencias. Los comprobantes de pagos y gastos son información financiera.
create or replace function public.attachment_roles(p_entity text, p_write boolean)
returns public.app_role[]
language sql
immutable
set search_path = ''
as $$
  select case
    when p_entity in ('payment', 'expense') and p_write then array['propietario', 'administrador', 'finanzas']
    when p_entity in ('payment', 'expense') then array['propietario', 'administrador', 'finanzas', 'consulta']
    when p_write then array['propietario', 'administrador', 'agronomo', 'supervisor']
  end::public.app_role[];
$$;

drop policy attachments_select on public.attachments;
drop policy attachments_delete on public.attachments;

create policy attachments_select on public.attachments for select to authenticated
  using (
    public.is_member(organization_id)
    and (public.attachment_roles(entity_type, false) is null
         or public.has_role(organization_id, public.attachment_roles(entity_type, false)))
  );
-- Un comprobante (pago o gasto) solo lo retira propietario o administrador.
create policy attachments_delete on public.attachments for delete to authenticated
  using (
    public.is_member(organization_id)
    and ((created_by = auth.uid() and entity_type not in ('payment', 'expense'))
         or public.has_role(organization_id, array['propietario', 'administrador']::public.app_role[]))
  );

drop policy "evidencias_select_members" on storage.objects;
create policy "evidencias_select_members" on storage.objects for select to authenticated
  using (
    bucket_id = 'evidencias'
    and public.is_member(public.storage_object_org(name))
    and (public.attachment_roles(split_part(name, '/', 2), false) is null
         or public.has_role(public.storage_object_org(name), public.attachment_roles(split_part(name, '/', 2), false)))
  );

-- -----------------------------------------------------------------------------
-- Vistas (SECURITY INVOKER: respetan la RLS del usuario)
-- -----------------------------------------------------------------------------

-- Fuente única de costos. source/source_id: módulo y registro que genera el
-- costo; origin_table/origin_id: documento de origen para auditoría (el gasto
-- completo en un gasto compartido). cost_class: 7 clases de consolidación;
-- budget_category: categoría con la que se compara contra el presupuesto.
create view public.v_project_cost_entries with (security_invoker = true) as
  select
    m.organization_id, m.project_id, m.plot_id, 'insumos'::text as source, m.id as source_id,
    m.movement_date as entry_date, p.name as concept,
    (case when m.movement_type = 'devolucion' then 'Devolución · ' else '' end) || trim(to_char(m.quantity, 'FM999,999,990.999')) || ' ' || m.unit as detail,
    case when m.movement_type = 'devolucion' then -m.total_cost else m.total_cost end as amount,
    null::public.expense_category as expense_category, m.created_at,
    public.input_cost_class(c.kind) as cost_class,
    public.input_budget_category(c.kind) as budget_category,
    'inventory_movements'::text as origin_table, m.id as origin_id
  from public.inventory_movements m
  join public.inventory_products p on p.id = m.product_id
  join public.inventory_categories c on c.id = p.category_id
  where m.movement_type in ('consumo', 'devolucion')
  union all
  select
    u.organization_id, u.project_id, u.plot_id, 'maquinaria', u.id,
    u.usage_date, mc.name,
    case when u.rate_basis = 'jornada'
      then trim(to_char(u.jornadas, 'FM990.99')) || ' jornada(s)'
      else trim(to_char(u.hours, 'FM9,990.99')) || ' h'
    end || ' × $' || to_char(u.rate, 'FM999,999,990.00') || coalesce(' · ' || u.activity, ''),
    u.amount, null, u.created_at,
    'maquinaria', 'maquinaria'::public.budget_category, 'machinery_usage', u.id
  from public.machinery_usage u
  join public.machinery mc on mc.id = u.machine_id
  union all
  select
    l.organization_id, l.project_id, l.plot_id, 'mano_obra', l.id,
    l.work_date, l.activity,
    coalesce(e.full_name, l.crew) || ' · ' || trim(to_char(l.quantity, 'FM999,990.99')) || ' ' ||
      case when l.pay_type = 'jornal' then 'jornal(es)' else coalesce(l.unit_label, 'unidad(es)') end,
    l.amount, null, l.created_at,
    'mano_obra', 'mano_obra'::public.budget_category, 'labor_records', l.id
  from public.labor_records l
  left join public.employees e on e.id = l.employee_id
  union all
  select
    x.organization_id, x.project_id, x.plot_id, 'gastos', x.id,
    x.expense_date, g.description,
    concat_ws(' · ', s.name, g.invoice_ref,
      case when g.allocation_method <> 'directo'
        then 'Compartido ' || rtrim(rtrim(to_char(x.allocation_share * 100, 'FM990.0000'), '0'), '.') || ' %'
      end),
    x.amount, g.category, x.created_at,
    public.expense_cost_class(g.category), g.cost_category, 'expenses', g.id
  from public.project_expenses x
  join public.expenses g on g.id = x.expense_id
  left join public.suppliers s on s.id = g.supplier_id
  where g.status = 'registrado'
  union all
  select
    a.organization_id, a.project_id, a.plot_id, 'actividades', a.id,
    a.activity_date, t.name,
    coalesce(a.description, 'Costo adicional de la actividad'),
    a.cost, null, a.created_at,
    'servicios', t.cost_category, 'field_activities', a.id
  from public.field_activities a
  join public.activity_types t on t.id = a.activity_type_id
  where a.status = 'registrado' and a.cost > 0;

-- Costos, producción, ventas, cobranza y presupuesto por proyecto. Cada métrica
-- se agrega en su propia subconsulta antes de unir (ninguna unión multiplica
-- renglones). Las columnas por módulo de origen (inputs_cost…activities_cost)
-- se conservan; las de clase (materials_cost…other_cost) suman lo mismo.
create view public.v_project_costs with (security_invoker = true) as
  with costs as (
    select
      project_id,
      sum(amount) filter (where source = 'insumos')     as inputs_cost,
      sum(amount) filter (where source = 'maquinaria')  as machinery_cost,
      sum(amount) filter (where source = 'mano_obra')   as labor_cost,
      sum(amount) filter (where source = 'gastos')      as expenses_cost,
      sum(amount) filter (where source = 'actividades') as activities_cost,
      sum(amount) filter (where cost_class = 'insumos')            as materials_cost,
      sum(amount) filter (where cost_class = 'combustibles')       as fuel_cost,
      sum(amount) filter (where cost_class = 'mantenimiento')      as maintenance_cost,
      sum(amount) filter (where cost_class = 'servicios')          as services_cost,
      sum(amount) filter (where cost_class = 'gastos_adicionales') as other_cost,
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
  ),
  base as (
    select
      p.id as project_id,
      p.organization_id,
      p.code,
      p.name,
      p.status,
      p.crop_id,
      cr.name || coalesce(' · ' || cr.variety, '') as crop_name,
      p.start_date,
      coalesce(b.total, p.budget_amount) as budget_amount,
      b.id as budget_id,
      b.version as budget_version,
      coalesce(a.area_ha, 0)            as area_ha,
      coalesce(c.inputs_cost, 0)        as inputs_cost,
      coalesce(c.machinery_cost, 0)     as machinery_cost,
      coalesce(c.labor_cost, 0)         as labor_cost,
      coalesce(c.expenses_cost, 0)      as expenses_cost,
      coalesce(c.activities_cost, 0)    as activities_cost,
      coalesce(c.materials_cost, 0)     as materials_cost,
      coalesce(c.fuel_cost, 0)          as fuel_cost,
      coalesce(c.maintenance_cost, 0)   as maintenance_cost,
      coalesce(c.services_cost, 0)      as services_cost,
      coalesce(c.other_cost, 0)         as other_cost,
      coalesce(c.total_cost, 0)         as total_cost,
      coalesce(h.kg, 0)                 as harvested_kg,
      coalesce(h.available_kg, 0)       as available_kg,
      coalesce(h.adjusted_kg, 0)        as shrinkage_kg,
      coalesce(h.lots, 0)               as lots,
      coalesce(h.cuts, 0)               as cuts,
      coalesce(so.kg, 0)                as sold_kg,
      coalesce(so.amount, 0)            as sales_amount,
      round(coalesce(co.amount, 0), 2)  as collected_amount,
      coalesce(fs.warning_pct, 70)      as warning_pct,
      coalesce(fs.critical_pct, 90)     as critical_pct,
      coalesce(fs.exhausted_pct, 100)   as exhausted_pct
    from public.projects p
    join public.crops cr on cr.id = p.crop_id
    left join public.project_budgets b on b.project_id = p.id and b.is_current
    left join costs c on c.project_id = p.id
    left join area a on a.project_id = p.id
    left join harvested h on h.project_id = p.id
    left join sold so on so.project_id = p.id
    left join collected co on co.project_id = p.id
    left join public.finance_settings fs on fs.organization_id = p.organization_id
  )
  select
    project_id, organization_id, code, name, status, budget_amount, area_ha,
    inputs_cost, machinery_cost, labor_cost, expenses_cost, activities_cost, total_cost,
    case when area_ha > 0 then round(total_cost / area_ha, 2) end as cost_per_ha,
    harvested_kg,
    case when harvested_kg > 0 then round(total_cost / harvested_kg, 4) end as cost_per_kg,
    case when area_ha > 0 then round(harvested_kg / area_ha, 3) end as yield_kg_per_ha,
    sold_kg, available_kg, shrinkage_kg, lots, cuts,
    sales_amount,
    collected_amount,
    sales_amount - collected_amount as receivable_amount,
    sales_amount - total_cost as gross_profit,
    case when budget_amount > 0 then round(total_cost * 100 / budget_amount, 1) end as budget_used_pct,
    -- Columnas de la Fase 5
    crop_id, crop_name, start_date, budget_id, budget_version,
    materials_cost, fuel_cost, maintenance_cost, services_cost, other_cost,
    case when harvested_kg > 0 then round(total_cost * 1000 / harvested_kg, 2) end as cost_per_ton,
    case when budget_amount > 0 then budget_amount - total_cost end as budget_variance,
    case when budget_amount > 0 then greatest(budget_amount - total_cost, 0) end as budget_remaining,
    public.budget_status(budget_amount, total_cost, warning_pct, critical_pct, exhausted_pct) as budget_status,
    -- Producto cosechado sin vender, valuado al costo de producción por kg (no es ingreso).
    case when harvested_kg > 0 then round(available_kg * total_cost / harvested_kg, 2) else 0 end as stock_value_at_cost,
    -- Resultado estimado = ventas reconocidas (confirmadas) − costo de producción acumulado.
    sales_amount - total_cost as estimated_result,
    case when sales_amount > 0 then round((sales_amount - total_cost) * 100 / sales_amount, 1) end as margin_pct
  from base;

-- Presupuesto vigente contra costo real por proyecto y categoría presupuestal.
-- Incluye categorías con costo real pero sin presupuesto (sin_presupuesto).
create view public.v_budget_comparison with (security_invoker = true) as
  with budgeted as (
    select b.organization_id, b.project_id, l.category, sum(l.amount) as budget_amount
    from public.project_budgets b
    join public.project_budget_lines l on l.budget_id = b.id
    where b.is_current
    group by b.organization_id, b.project_id, l.category
  ),
  actual as (
    select organization_id, project_id, budget_category as category, sum(amount) as actual_amount
    from public.v_project_cost_entries
    group by organization_id, project_id, budget_category
  ),
  merged as (
    select coalesce(b.organization_id, a.organization_id) as organization_id,
           coalesce(b.project_id, a.project_id) as project_id,
           coalesce(b.category, a.category) as category,
           coalesce(b.budget_amount, 0) as budget_amount,
           coalesce(a.actual_amount, 0) as actual_amount
    from budgeted b
    full join actual a on a.project_id = b.project_id and a.category = b.category
  )
  select
    m.organization_id, m.project_id, p.code, p.name, p.status as project_status, m.category,
    m.budget_amount, m.actual_amount,
    m.budget_amount - m.actual_amount as difference,
    case when m.budget_amount > 0 then round(m.actual_amount * 100 / m.budget_amount, 1) end as used_pct,
    public.budget_status(m.budget_amount, m.actual_amount, coalesce(fs.warning_pct, 70), coalesce(fs.critical_pct, 90),
                         coalesce(fs.exhausted_pct, 100)) as status
  from merged m
  join public.projects p on p.id = m.project_id
  left join public.finance_settings fs on fs.organization_id = m.organization_id;

-- -----------------------------------------------------------------------------
-- Flujo de efectivo: dinero efectivamente recibido o pagado en el periodo.
--   Ingresos: cobros de ventas (pagos y anticipos, en la fecha en que se
--   reciben) y otros ingresos. Egresos: pagos de gastos, pagos a proveedores y
--   otros egresos. Los movimientos cancelados no cuentan.
--   Sin filtro de proyecto cada movimiento aparece completo (proyecto nulo si
--   abarca varios). Con filtro, cobros y pagos de gastos se prorratean por las
--   partidas de la venta o por el reparto del gasto.
-- -----------------------------------------------------------------------------
create or replace function public.cash_flow_entries(p_org uuid, p_from date, p_to date, p_project uuid default null)
returns table (
  entry_id uuid,
  entry_date date,
  direction text,
  kind text,
  concept text,
  counterparty text,
  project_id uuid,
  amount numeric,
  method public.payment_method,
  reference text,
  source text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with sale_projects as (
    select i.sale_id, i.project_id, sum(i.amount) as amount
    from public.sale_items i
    where i.organization_id = p_org
    group by i.sale_id, i.project_id
  ),
  sale_meta as (
    select sale_id, count(*) as n, (array_agg(project_id))[1] as only_project, sum(amount) as total
    from sale_projects group by sale_id
  )
  select p.id, p.payment_date, 'ingreso',
         case when p.kind = 'anticipo' then 'anticipo_cliente' else 'cobro_venta' end,
         case when p.kind = 'anticipo' then 'Anticipo · ' else 'Cobro · ' end || s.code,
         c.name,
         case when p_project is not null then p_project when sm.n = 1 then sm.only_project end,
         case when p_project is null then p.amount else round(p.amount * sp.amount / nullif(sm.total, 0), 2) end,
         p.method, p.reference, 'payments'
  from public.payments p
  join public.sales s on s.id = p.sale_id
  join public.customers c on c.id = s.customer_id
  left join sale_meta sm on sm.sale_id = s.id
  left join sale_projects sp on sp.sale_id = s.id and sp.project_id = p_project
  where p.organization_id = p_org and p.status = 'aplicado' and p.payment_date between p_from and p_to
    and (p_project is null or sp.project_id is not null)
  union all
  select m.id, m.movement_date, m.direction, m.kind::text, m.concept,
         sup.name,
         case when m.kind = 'pago_gasto'
              then case when p_project is not null then p_project
                        when (select count(*) from public.project_expenses x where x.expense_id = m.expense_id) = 1
                          then (select x.project_id from public.project_expenses x where x.expense_id = m.expense_id)
                   end
              else m.project_id end,
         case when m.kind = 'pago_gasto' and p_project is not null
              then round(m.amount * x.amount / g.amount, 2)
              else m.amount end,
         m.method, m.reference, 'cash_movements'
  from public.cash_movements m
  left join public.suppliers sup on sup.id = m.supplier_id
  left join public.expenses g on g.id = m.expense_id
  left join public.project_expenses x on x.expense_id = m.expense_id and x.project_id = p_project
  where m.organization_id = p_org and m.status = 'aplicado' and m.movement_date between p_from and p_to
    and (p_project is null
         or (m.kind = 'pago_gasto' and x.id is not null)
         or (m.kind <> 'pago_gasto' and m.project_id = p_project));
$$;

-- Series del dashboard financiero (flujos por fecha dentro del periodo). Con
-- filtro de cultivo o proyecto, cada venta participa con sus partidas de ese
-- filtro y su cobranza se prorratea en la misma proporción (como en el
-- dashboard comercial).
create or replace function public.financial_series(
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
  with scope as (
    select id from public.projects
    where organization_id = p_org and (p_crop is null or crop_id = p_crop) and (p_project is null or id = p_project)
  ),
  entries as (
    select e.entry_date, e.amount, e.cost_class
    from public.v_project_cost_entries e
    where e.organization_id = p_org and e.project_id in (select id from scope) and e.entry_date between p_from and p_to
  ),
  sale_share as (
    select s.id, s.sale_date, sum(i.amount) as amount,
           case when s.total > 0 then sum(i.amount) / s.total else 0 end as share
    from public.sales s
    join public.sale_items i on i.sale_id = s.id
    where s.organization_id = p_org and public.sale_is_active(s.status) and i.project_id in (select id from scope)
    group by s.id
  ),
  receipts as (
    select x.receipt_date, x.amount * ss.share as amount
    from sale_share ss
    join lateral (
      select payment_date as receipt_date, amount from public.payments
      where sale_id = ss.id and status = 'aplicado' and kind = 'pago'
      union all
      select application_date, amount from public.advance_applications
      where sale_id = ss.id and status = 'aplicado'
    ) x on true
    where x.receipt_date between p_from and p_to
  )
  select jsonb_build_object(
    'period_cost',      (select coalesce(sum(amount), 0) from entries),
    'period_sales',     (select round(coalesce(sum(amount), 0), 2) from sale_share where sale_date between p_from and p_to),
    'period_collected', (select round(coalesce(sum(amount), 0), 2) from receipts),
    'costs_by_month', (
      select coalesce(jsonb_agg(jsonb_build_object('month', month, 'value', amount) order by month), '[]'::jsonb)
      from (select to_char(entry_date, 'YYYY-MM') as month, sum(amount) as amount from entries group by 1) t
    ),
    'sales_by_month', (
      select coalesce(jsonb_agg(jsonb_build_object('month', month, 'value', amount) order by month), '[]'::jsonb)
      from (
        select to_char(sale_date, 'YYYY-MM') as month, round(sum(amount), 2) as amount
        from sale_share where sale_date between p_from and p_to group by 1
      ) t
    ),
    'collections_by_month', (
      select coalesce(jsonb_agg(jsonb_build_object('month', month, 'value', amount) order by month), '[]'::jsonb)
      from (select to_char(receipt_date, 'YYYY-MM') as month, round(sum(amount), 2) as amount from receipts group by 1) t
    )
  );
$$;

-- -----------------------------------------------------------------------------
-- Campos de auditoría y bitácora
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['expenses', 'cash_movements', 'finance_settings'] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_fields()',
      t || '_set_updated', t);
  end loop;

  foreach t in array array['expenses', 'cash_movements', 'finance_settings', 'project_budgets', 'project_budget_lines'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.log_audit()',
      t || '_audit', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security: información financiera solo para propietario,
-- administrador, finanzas y consulta. Las escrituras van por RPC, salvo los
-- umbrales de alerta.
-- -----------------------------------------------------------------------------
alter table public.finance_settings     enable row level security;
alter table public.project_budgets      enable row level security;
alter table public.project_budget_lines enable row level security;
alter table public.expenses             enable row level security;
alter table public.cash_movements       enable row level security;

create policy finance_settings_select on public.finance_settings for select to authenticated
  using (public.is_member(organization_id));
create policy finance_settings_insert on public.finance_settings for insert to authenticated
  with check (public.has_role(organization_id, '{propietario,administrador,finanzas}'::public.app_role[]));
create policy finance_settings_update on public.finance_settings for update to authenticated
  using (public.has_role(organization_id, '{propietario,administrador,finanzas}'::public.app_role[]))
  with check (public.has_role(organization_id, '{propietario,administrador,finanzas}'::public.app_role[]));

create policy project_budgets_select on public.project_budgets for select to authenticated
  using (public.has_role(organization_id, '{propietario,administrador,finanzas,consulta}'::public.app_role[]));
create policy project_budget_lines_select on public.project_budget_lines for select to authenticated
  using (public.has_role(organization_id, '{propietario,administrador,finanzas,consulta}'::public.app_role[]));
create policy expenses_select on public.expenses for select to authenticated
  using (public.has_role(organization_id, '{propietario,administrador,finanzas,consulta}'::public.app_role[]));
create policy cash_movements_select on public.cash_movements for select to authenticated
  using (public.has_role(organization_id, '{propietario,administrador,finanzas,consulta}'::public.app_role[]));

-- -----------------------------------------------------------------------------
-- Privilegios
-- -----------------------------------------------------------------------------
revoke all on public.finance_settings, public.project_budgets, public.project_budget_lines, public.expenses,
  public.cash_movements, public.v_project_cost_entries, public.v_project_costs, public.v_budget_comparison
from anon, authenticated;

grant select on public.finance_settings, public.project_budgets, public.project_budget_lines, public.expenses,
  public.cash_movements, public.v_project_cost_entries, public.v_project_costs, public.v_budget_comparison
to authenticated;

grant insert (organization_id, warning_pct, critical_pct, exhausted_pct) on public.finance_settings to authenticated;
grant update (warning_pct, critical_pct, exhausted_pct) on public.finance_settings to authenticated;

-- Las asignaciones de gasto solo se escriben con register_expense.
revoke insert, update, delete on public.project_expenses from authenticated;

grant insert (cost_category) on public.activity_types to authenticated;
grant update (cost_category) on public.activity_types to authenticated;

revoke execute on function
  public.input_cost_class(public.input_kind),
  public.input_budget_category(public.input_kind),
  public.expense_cost_class(public.expense_category),
  public.expense_default_budget_category(public.expense_category),
  public.budget_status(numeric, numeric, numeric, numeric, numeric),
  public.prevent_budget_changes(),
  public.guard_project_budget_amount(),
  public.parse_budget_lines(jsonb),
  public.save_budget(uuid, uuid, jsonb, date, date, numeric, int, text, text),
  public.register_cash_movement(uuid, uuid, public.cash_kind, date, numeric, public.payment_method, text, text, uuid, uuid,
    uuid, text),
  public.cancel_cash_movement(uuid, text),
  public.register_expense(uuid, uuid, date, public.expense_category, public.budget_category, text, numeric,
    public.allocation_method, jsonb, uuid, text, public.payment_method, uuid, text, jsonb),
  public.cancel_expense(uuid, text),
  public.cash_flow_entries(uuid, date, date, uuid),
  public.financial_series(uuid, date, date, uuid, uuid)
from public, anon;

revoke execute on function
  public.prevent_budget_changes(),
  public.guard_project_budget_amount(),
  public.parse_budget_lines(jsonb)
from authenticated;

-- Las funciones de clasificación se evalúan dentro de las vistas (SECURITY INVOKER).
grant execute on function
  public.input_cost_class(public.input_kind),
  public.input_budget_category(public.input_kind),
  public.expense_cost_class(public.expense_category),
  public.expense_default_budget_category(public.expense_category),
  public.budget_status(numeric, numeric, numeric, numeric, numeric),
  public.save_budget(uuid, uuid, jsonb, date, date, numeric, int, text, text),
  public.register_cash_movement(uuid, uuid, public.cash_kind, date, numeric, public.payment_method, text, text, uuid, uuid,
    uuid, text),
  public.cancel_cash_movement(uuid, text),
  public.register_expense(uuid, uuid, date, public.expense_category, public.budget_category, text, numeric,
    public.allocation_method, jsonb, uuid, text, public.payment_method, uuid, text, jsonb),
  public.cancel_expense(uuid, text),
  public.cash_flow_entries(uuid, date, date, uuid),
  public.financial_series(uuid, date, date, uuid, uuid)
to authenticated;
