-- =============================================================================
-- AgroGestión 360 · Migración 0003 · Costos, producción, ventas y cobranza
--
-- Fuentes de costo de un proyecto (y solo estas):
--   1. Consumos de insumos (salidas de inventario asignadas a proyecto/parcela).
--   2. Uso de maquinaria (horas × tarifa vigente al momento del registro).
--   3. Mano de obra (jornales o destajo).
--   4. Gastos directos (categorías que NO son insumos, maquinaria ni mano de obra).
-- Las compras/entradas de almacén no son costo de proyecto: el costo nace al
-- consumir, así una misma compra nunca se cuenta dos veces.
--
-- Ingresos: ventas vigentes (kg vendidos ≤ kg cosechados del proyecto).
-- Cobranza: pagos aplicados a una venta (nunca exceden su saldo). El dinero
-- cobrado se reporta por separado de las ventas; no es utilidad.
--
-- Escrituras con efectos en saldos (inventario, ventas, pagos) solo por RPC
-- transaccional, con bloqueo de filas e identificador idempotente generado por
-- el cliente (un reintento no duplica el movimiento).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.input_category as enum (
  'semilla', 'fertilizante', 'agroquimico', 'combustible', 'empaque', 'otro'
);

create type public.inventory_movement_type as enum (
  'entrada',        -- compra o recepción en almacén (no es costo de proyecto)
  'consumo',        -- salida a un proyecto/parcela (costo del proyecto)
  'devolucion',     -- regreso de un proyecto al almacén (reduce su costo)
  'ajuste_entrada', -- conteo físico mayor al teórico
  'ajuste_salida'   -- merma, caducidad o conteo físico menor
);

create type public.machine_kind as enum (
  'tractor', 'cosechadora', 'aspersora', 'implemento', 'vehiculo', 'bomba', 'otro'
);

create type public.labor_pay_type as enum ('jornal', 'destajo');

-- Sin insumos, maquinaria ni mano de obra: esos costos vienen de sus módulos.
create type public.expense_category as enum (
  'renta_tierra', 'agua_riego', 'energia', 'fletes', 'servicios_profesionales',
  'maquila', 'seguros', 'financiamiento', 'derechos_impuestos', 'otros'
);

create type public.harvest_quality as enum ('primera', 'segunda', 'tercera', 'unica');

create type public.sale_status as enum ('vigente', 'cancelada');

create type public.payment_method as enum ('efectivo', 'transferencia', 'cheque', 'deposito', 'otro');

create type public.payment_status as enum ('aplicado', 'cancelado');

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------
create or replace function public.mx_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Mexico_City')::date;
$$;

-- Bloquea el proyecto y verifica que siga vigente. Los costos e ingresos de un
-- proyecto cerrado o cancelado quedan congelados. change_project_status toma
-- FOR UPDATE sobre la misma fila, así que un cierre espera a que terminen los
-- registros en curso (y viceversa).
create or replace function public.lock_open_project(p_org uuid, p_project uuid, p_exclusive boolean default false)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.projects%rowtype;
begin
  if p_exclusive then
    select * into v from public.projects where id = p_project and organization_id = p_org for update;
  else
    select * into v from public.projects where id = p_project and organization_id = p_org for share;
  end if;
  if not found then
    raise exception 'Proyecto no encontrado' using errcode = 'P0002';
  end if;
  if v.status in ('cerrado', 'cancelado') then
    raise exception 'El proyecto % está %; sus costos e ingresos ya no se pueden modificar', v.code, v.status
      using errcode = '22023';
  end if;
  return v;
end;
$$;

-- -----------------------------------------------------------------------------
-- Inventario de insumos
--   stock y stock_value solo los modifica post_inventory_movement(). El costo
--   promedio se deriva (valor / existencia), de modo que la suma de entradas
--   menos salidas valoradas coincide al centavo con el valor del almacén.
-- -----------------------------------------------------------------------------
create table public.inventory_products (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null check (char_length(trim(name)) between 2 and 120),
  sku              text check (char_length(sku) <= 40),
  category         public.input_category not null default 'otro',
  unit             text not null check (unit in ('kg', 'l', 'pieza', 'saco', 'm3')),
  min_stock        numeric(14, 3) check (min_stock >= 0),
  stock            numeric(14, 3) not null default 0 check (stock >= 0),
  stock_value      numeric(14, 2) not null default 0 check (stock_value >= 0),
  avg_cost         numeric(14, 4) generated always as (
                     case when stock > 0 then round(stock_value / stock, 4) end
                   ) stored,
  notes            text check (char_length(notes) <= 2000),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  unique (organization_id, id),
  check (stock > 0 or stock_value = 0)
);

create unique index inventory_products_org_name_key on public.inventory_products (organization_id, lower(name));
create unique index inventory_products_org_sku_key on public.inventory_products (organization_id, upper(sku)) where sku is not null;

create table public.inventory_movements (
  id               uuid primary key, -- lo genera el cliente: llave de idempotencia
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  product_id       uuid not null,
  movement_type    public.inventory_movement_type not null,
  movement_date    date not null,
  quantity         numeric(14, 3) not null check (quantity > 0),
  total_cost       numeric(14, 2) not null check (total_cost >= 0),
  unit_cost        numeric(14, 4) generated always as (round(total_cost / quantity, 4)) stored,
  project_id       uuid,
  plot_id          uuid,
  supplier         text check (char_length(supplier) <= 150),
  reference        text check (char_length(reference) <= 60),
  notes            text check (char_length(notes) <= 500),
  reverses_id      uuid unique references public.inventory_movements (id) on delete restrict,
  stock_after      numeric(14, 3) not null,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  foreign key (organization_id, product_id) references public.inventory_products (organization_id, id) on delete restrict,
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete restrict,
  foreign key (project_id, plot_id) references public.project_plots (project_id, plot_id) on delete restrict,
  -- Solo consumos y devoluciones se imputan a un proyecto, y siempre a una parcela asignada.
  check ((movement_type in ('consumo', 'devolucion')) = (project_id is not null)),
  check ((project_id is null) = (plot_id is null))
);

create index inventory_movements_product_idx on public.inventory_movements (product_id, created_at desc);
create index inventory_movements_project_idx on public.inventory_movements (project_id) where project_id is not null;
create index inventory_movements_org_date_idx on public.inventory_movements (organization_id, movement_date desc);

-- Con movimientos registrados la unidad no cambia: alteraría el significado de
-- la existencia y del costo promedio.
create or replace function public.prevent_product_unit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.unit is distinct from old.unit
     and exists (select 1 from public.inventory_movements where product_id = new.id) then
    raise exception 'El producto "%" tiene movimientos; su unidad de medida no puede cambiar', old.name
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger inventory_products_unit_lock before update of unit on public.inventory_products
  for each row execute function public.prevent_product_unit_change();

-- -----------------------------------------------------------------------------
-- Maquinaria
-- -----------------------------------------------------------------------------
create table public.machinery (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null check (char_length(trim(name)) between 2 and 120),
  code             text check (char_length(code) <= 20),
  kind             public.machine_kind not null default 'tractor',
  hourly_cost      numeric(14, 2) not null check (hourly_cost >= 0),
  notes            text check (char_length(notes) <= 2000),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  unique (organization_id, id)
);

create unique index machinery_org_name_key on public.machinery (organization_id, lower(name));
create unique index machinery_org_code_key on public.machinery (organization_id, upper(code)) where code is not null;

comment on column public.machinery.hourly_cost is
  'Costo por hora sin combustible si el combustible se surte del inventario (si no, se contaría dos veces).';

create table public.machinery_usage (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  machine_id       uuid not null,
  project_id       uuid not null,
  plot_id          uuid,
  usage_date       date not null,
  hours            numeric(8, 2) not null check (hours > 0 and hours <= 24),
  hourly_rate      numeric(14, 2) not null check (hourly_rate >= 0), -- tarifa congelada al registrar
  amount           numeric(14, 2) generated always as (round(hours * hourly_rate, 2)) stored,
  operator         text check (char_length(operator) <= 120),
  activity         text check (char_length(activity) <= 150),
  notes            text check (char_length(notes) <= 500),
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  foreign key (organization_id, machine_id) references public.machinery (organization_id, id) on delete restrict,
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete restrict,
  foreign key (project_id, plot_id) references public.project_plots (project_id, plot_id) on delete restrict
);

create index machinery_usage_project_idx on public.machinery_usage (project_id);
create index machinery_usage_machine_date_idx on public.machinery_usage (machine_id, usage_date);

-- -----------------------------------------------------------------------------
-- Personal y mano de obra
-- -----------------------------------------------------------------------------
create table public.employees (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  full_name        text not null check (char_length(trim(full_name)) between 3 and 120),
  position         text check (char_length(position) <= 80),
  phone            text check (char_length(phone) <= 30),
  daily_wage       numeric(14, 2) not null check (daily_wage >= 0),
  notes            text check (char_length(notes) <= 2000),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  unique (organization_id, id)
);

create unique index employees_org_name_key on public.employees (organization_id, lower(full_name));

create table public.labor_records (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  project_id       uuid not null,
  plot_id          uuid,
  employee_id      uuid, -- null = cuadrilla o eventuales (se describe en crew)
  crew             text check (char_length(crew) <= 120),
  work_date        date not null,
  activity         text not null check (char_length(trim(activity)) between 3 and 150),
  pay_type         public.labor_pay_type not null default 'jornal',
  quantity         numeric(10, 2) not null check (quantity > 0),   -- jornales o unidades de destajo
  unit_label       text check (char_length(unit_label) <= 30),     -- destajo: caja, surco, ha…
  unit_rate        numeric(14, 2) not null check (unit_rate >= 0), -- congelada al registrar
  amount           numeric(14, 2) generated always as (round(quantity * unit_rate, 2)) stored,
  notes            text check (char_length(notes) <= 500),
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete restrict,
  foreign key (project_id, plot_id) references public.project_plots (project_id, plot_id) on delete restrict,
  foreign key (organization_id, employee_id) references public.employees (organization_id, id) on delete restrict,
  check (employee_id is not null or crew is not null),
  check (pay_type = 'destajo' or unit_label is null)
);

create index labor_records_project_idx on public.labor_records (project_id);
create index labor_records_employee_date_idx on public.labor_records (employee_id, work_date) where employee_id is not null;

-- -----------------------------------------------------------------------------
-- Gastos directos del proyecto
-- -----------------------------------------------------------------------------
create table public.project_expenses (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  project_id       uuid not null,
  plot_id          uuid,
  expense_date     date not null,
  category         public.expense_category not null,
  description      text not null check (char_length(trim(description)) between 3 and 200),
  supplier         text check (char_length(supplier) <= 150),
  invoice_ref      text check (char_length(invoice_ref) <= 60),
  amount           numeric(14, 2) not null check (amount > 0),
  notes            text check (char_length(notes) <= 500),
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete restrict,
  foreign key (project_id, plot_id) references public.project_plots (project_id, plot_id) on delete restrict
);

create index project_expenses_project_idx on public.project_expenses (project_id);
-- Una misma factura del mismo proveedor no se captura dos veces en un proyecto
-- (sí puede prorratearse entre proyectos distintos).
create unique index project_expenses_invoice_key
  on public.project_expenses (project_id, lower(coalesce(supplier, '')), upper(invoice_ref))
  where invoice_ref is not null;

-- -----------------------------------------------------------------------------
-- Cosechas (producción en kg; base del costo por kilogramo y del disponible)
-- -----------------------------------------------------------------------------
create table public.harvests (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  project_id       uuid not null,
  plot_id          uuid not null,
  harvest_date     date not null,
  quality          public.harvest_quality not null default 'unica',
  quantity_kg      numeric(14, 3) not null check (quantity_kg > 0),
  packages         int check (packages > 0), -- cajas, sacos o arpillas (opcional)
  notes            text check (char_length(notes) <= 500),
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete restrict,
  foreign key (project_id, plot_id) references public.project_plots (project_id, plot_id) on delete restrict
);

create index harvests_project_idx on public.harvests (project_id);

-- -----------------------------------------------------------------------------
-- Clientes, ventas y pagos
-- -----------------------------------------------------------------------------
create table public.customers (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null check (char_length(trim(name)) between 2 and 150),
  rfc              text check (rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'),
  contact_name     text check (char_length(contact_name) <= 120),
  phone            text check (char_length(phone) <= 30),
  email            extensions.citext,
  address          text check (char_length(address) <= 300),
  credit_days      int not null default 0 check (credit_days between 0 and 365),
  notes            text check (char_length(notes) <= 2000),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  unique (organization_id, id)
);

create unique index customers_org_name_key on public.customers (organization_id, lower(name));

create table public.sales (
  id               uuid primary key, -- lo genera el cliente: llave de idempotencia
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  code             text not null,
  customer_id      uuid not null,
  sale_date        date not null,
  due_date         date not null,
  status           public.sale_status not null default 'vigente',
  total            numeric(14, 2) not null default 0 check (total >= 0),
  amount_paid      numeric(14, 2) not null default 0,
  notes            text check (char_length(notes) <= 1000),
  cancel_reason    text check (char_length(cancel_reason) <= 500),
  cancelled_at     timestamptz,
  cancelled_by     uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  unique (organization_id, id),
  unique (organization_id, code),
  foreign key (organization_id, customer_id) references public.customers (organization_id, id) on delete restrict,
  check (due_date >= sale_date),
  check (amount_paid >= 0 and amount_paid <= total),
  check ((status = 'cancelada') = (cancelled_at is not null)),
  check (status = 'vigente' or amount_paid = 0)
);

create index sales_org_date_idx on public.sales (organization_id, sale_date desc);
create index sales_customer_idx on public.sales (customer_id);

create table public.sale_items (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  sale_id          uuid not null,
  project_id       uuid not null,
  description      text not null check (char_length(trim(description)) between 2 and 200),
  quality          public.harvest_quality,
  quantity_kg      numeric(14, 3) not null check (quantity_kg > 0),
  unit_price       numeric(14, 4) not null check (unit_price > 0), -- precio por kg
  amount           numeric(14, 2) generated always as (round(quantity_kg * unit_price, 2)) stored,
  foreign key (organization_id, sale_id) references public.sales (organization_id, id) on delete cascade,
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete restrict
);

create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_project_idx on public.sale_items (project_id);

create table public.payments (
  id               uuid primary key, -- lo genera el cliente: llave de idempotencia
  organization_id  uuid not null,
  sale_id          uuid not null,
  payment_date     date not null,
  amount           numeric(14, 2) not null check (amount > 0),
  method           public.payment_method not null,
  reference        text check (char_length(reference) <= 60),
  notes            text check (char_length(notes) <= 500),
  status           public.payment_status not null default 'aplicado',
  cancel_reason    text check (char_length(cancel_reason) <= 500),
  cancelled_at     timestamptz,
  cancelled_by     uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  foreign key (organization_id, sale_id) references public.sales (organization_id, id) on delete restrict,
  check ((status = 'cancelado') = (cancelled_at is not null))
);

create index payments_sale_idx on public.payments (sale_id);
create index payments_org_date_idx on public.payments (organization_id, payment_date desc);

-- -----------------------------------------------------------------------------
-- Campos de auditoría y bitácora
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['inventory_products', 'machinery', 'machinery_usage', 'employees', 'labor_records',
                           'project_expenses', 'harvests', 'customers', 'sales', 'payments'] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_fields()',
      t || '_set_updated', t);
  end loop;

  foreach t in array array['inventory_products', 'inventory_movements', 'machinery', 'machinery_usage', 'employees',
                           'labor_records', 'project_expenses', 'harvests', 'customers', 'sales', 'sale_items',
                           'payments'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.log_audit()',
      t || '_audit', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Registros de costo con captura directa (maquinaria, mano de obra, gastos,
-- cosechas): el proyecto debe estar vigente al crear, modificar o eliminar, y
-- la fecha dentro del periodo del proyecto (no futura). La columna de fecha se
-- recibe como argumento del trigger.
-- -----------------------------------------------------------------------------
create or replace function public.check_project_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exclusive boolean := tg_table_name = 'harvests';
  v_project public.projects%rowtype;
  v_date date;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.lock_open_project(old.organization_id, old.project_id, v_exclusive);
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;

  v_project := public.lock_open_project(new.organization_id, new.project_id, v_exclusive);
  v_date := (to_jsonb(new) ->> tg_argv[0])::date;
  if v_date < v_project.start_date then
    raise exception 'La fecha no puede ser anterior al inicio del proyecto (%)', to_char(v_project.start_date, 'DD/MM/YYYY')
      using errcode = '22023';
  end if;
  if v_date > public.mx_today() then
    raise exception 'La fecha no puede ser futura' using errcode = '22023';
  end if;

  if tg_table_name = 'harvests'
     and (tg_op = 'INSERT' or new.project_id is distinct from old.project_id)
     and v_project.status not in ('cosecha', 'comercializacion') then
    raise exception 'Solo se registran cortes en proyectos en cosecha o comercialización' using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger machinery_usage_check_project before insert or update or delete on public.machinery_usage
  for each row execute function public.check_project_record('usage_date');
create trigger labor_records_check_project before insert or update or delete on public.labor_records
  for each row execute function public.check_project_record('work_date');
create trigger project_expenses_check_project before insert or update or delete on public.project_expenses
  for each row execute function public.check_project_record('expense_date');
create trigger harvests_check_project before insert or update or delete on public.harvests
  for each row execute function public.check_project_record('harvest_date');

-- Tarifa de maquinaria: si no se indica, se toma la del equipo y queda
-- congelada; cambiar la tarifa del equipo no altera costos ya registrados.
create or replace function public.before_machinery_usage_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_machine public.machinery%rowtype;
begin
  if tg_op = 'INSERT' or new.machine_id is distinct from old.machine_id then
    select * into v_machine from public.machinery
    where id = new.machine_id and organization_id = new.organization_id;
    if not found then
      raise exception 'Equipo no encontrado' using errcode = 'P0002';
    end if;
    if not v_machine.is_active then
      raise exception 'El equipo "%" está inactivo', v_machine.name using errcode = '22023';
    end if;
    if new.hourly_rate is null then
      new.hourly_rate := v_machine.hourly_cost;
    end if;
  end if;
  return new;
end;
$$;

create trigger machinery_usage_before_write before insert or update on public.machinery_usage
  for each row execute function public.before_machinery_usage_write();

-- Mano de obra: tarifa por omisión del empleado y, para jornales de un mismo
-- empleado, máximo un jornal por día sumando todos los proyectos (evita pagar
-- o costear dos veces la misma jornada).
create or replace function public.before_labor_record_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emp public.employees%rowtype;
  v_used numeric;
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

create trigger labor_records_before_write before insert or update on public.labor_records
  for each row execute function public.before_labor_record_write();

-- Lo vendido de un proyecto nunca excede lo cosechado.
create or replace function public.project_sold_kg(p_project uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(si.quantity_kg), 0)
  from public.sale_items si
  join public.sales s on s.id = si.sale_id
  where si.project_id = p_project and s.status = 'vigente';
$$;

create or replace function public.project_harvested_kg(p_project uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(quantity_kg), 0) from public.harvests where project_id = p_project;
$$;

create or replace function public.check_harvest_vs_sales()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sold numeric := public.project_sold_kg(old.project_id);
  v_harvested numeric := public.project_harvested_kg(old.project_id);
begin
  if v_harvested < v_sold then
    raise exception 'El proyecto tiene % kg vendidos; la producción registrada no puede quedar en % kg',
      v_sold, v_harvested using errcode = '22023';
  end if;
  return null;
end;
$$;

create trigger harvests_check_sales after update of quantity_kg, project_id or delete on public.harvests
  for each row execute function public.check_harvest_vs_sales();

-- -----------------------------------------------------------------------------
-- Inventario: aplicación de movimientos (interna) y RPCs
-- -----------------------------------------------------------------------------

-- Aplica un movimiento ya valorado sobre el producto (que el llamador bloqueó
-- con FOR UPDATE) y lo registra. Entradas suman existencia y valor; salidas
-- restan. Devuelve el id del movimiento.
create or replace function public.post_inventory_movement(
  p_id uuid,
  p_product public.inventory_products,
  p_type public.inventory_movement_type,
  p_date date,
  p_quantity numeric,
  p_total numeric,
  p_project uuid,
  p_plot uuid,
  p_supplier text,
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
  v_inflow boolean := p_type in ('entrada', 'devolucion', 'ajuste_entrada');
  v_stock numeric;
  v_value numeric;
begin
  if v_inflow then
    v_stock := p_product.stock + p_quantity;
    v_value := p_product.stock_value + p_total;
  else
    v_stock := p_product.stock - p_quantity;
    v_value := p_product.stock_value - p_total;
    if v_stock < 0 then
      raise exception 'Existencia insuficiente de "%": hay % % y se requieren %',
        p_product.name, p_product.stock, p_product.unit, p_quantity using errcode = '22023';
    end if;
    if v_value < 0 or (v_stock = 0 and v_value <> 0) then
      raise exception 'El valor del movimiento no corresponde con el valor disponible en almacén' using errcode = '22023';
    end if;
  end if;

  update public.inventory_products
  set stock = v_stock, stock_value = v_value
  where id = p_product.id;

  insert into public.inventory_movements (
    id, organization_id, product_id, movement_type, movement_date, quantity, total_cost,
    project_id, plot_id, supplier, reference, notes, reverses_id, stock_after
  ) values (
    p_id, p_product.organization_id, p_product.id, p_type, p_date, p_quantity, p_total,
    p_project, p_plot, nullif(trim(p_supplier), ''), nullif(trim(p_reference), ''), nullif(trim(p_notes), ''),
    p_reverses, v_stock
  );
  return p_id;
end;
$$;

-- Valor de una salida al costo promedio. Si sale toda la existencia, sale todo
-- el valor (sin residuos de redondeo).
create or replace function public.inventory_outflow_value(p_product public.inventory_products, p_quantity numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_product.stock <= 0 then 0
    when p_quantity >= p_product.stock then p_product.stock_value
    else round(p_product.stock_value * p_quantity / p_product.stock, 2)
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
  p_supplier text default null,
  p_reference text default null,
  p_notes text default null
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
  v_total numeric;
  v_net_qty numeric;
  v_net_cost numeric;
begin
  if p_id is null then
    raise exception 'Falta el identificador del movimiento' using errcode = '22023';
  end if;

  -- El bloqueo del producto serializa los movimientos y los reintentos.
  select * into v_prod from public.inventory_products where id = p_product for update;
  if not found or not public.is_member(v_prod.organization_id) then
    raise exception 'Producto no encontrado' using errcode = 'P0002';
  end if;
  if not public.has_role(v_prod.organization_id, array['propietario', 'administrador', 'almacen']::public.app_role[]) then
    raise exception 'No tienes permiso para registrar movimientos de inventario' using errcode = '42501';
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

  case p_type
    when 'entrada' then
      if p_unit_cost is null or p_unit_cost < 0 then
        raise exception 'Indica el costo unitario de la entrada' using errcode = '22023';
      end if;
      v_total := round(p_quantity * p_unit_cost, 2);
    when 'ajuste_entrada' then
      v_total := round(p_quantity * coalesce(p_unit_cost, v_prod.avg_cost, 0), 2);
    when 'consumo', 'ajuste_salida' then
      -- Las salidas siempre se valoran al costo promedio (no se acepta costo manual).
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
    p_id, v_prod, p_type, p_date, p_quantity, v_total,
    p_project, p_plot, p_supplier, p_reference, p_notes, null
  );
end;
$$;

-- Anula un movimiento con su contrapartida exacta (misma cantidad y valor),
-- conservando ambos en el historial. Cada movimiento se anula una sola vez.
create or replace function public.reverse_inventory_movement(p_id uuid, p_movement uuid, p_reason text)
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
  if not found or not public.is_member(v_mov.organization_id) then
    raise exception 'Movimiento no encontrado' using errcode = 'P0002';
  end if;
  if not public.has_role(v_mov.organization_id, array['propietario', 'administrador', 'almacen']::public.app_role[]) then
    raise exception 'No tienes permiso para anular movimientos de inventario' using errcode = '42501';
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
    v_mov.project_id, v_mov.plot_id, null, v_mov.reference, 'Anulación: ' || trim(p_reason), p_movement
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Ventas y pagos (RPC transaccionales)
-- -----------------------------------------------------------------------------

-- Partidas de venta recibidas como JSON.
create or replace function public.parse_sale_items(p_items jsonb)
returns table (project_id uuid, description text, quality public.harvest_quality, quantity_kg numeric, unit_price numeric)
language sql
immutable
set search_path = ''
as $$
  select x.project_id, trim(x.description), x.quality, x.quantity_kg, x.unit_price
  from jsonb_to_recordset(p_items) as x(
    project_id uuid, description text, quality public.harvest_quality, quantity_kg numeric, unit_price numeric
  );
$$;

-- Crea la venta con sus partidas en una sola transacción. Bloquea los proyectos
-- involucrados (en orden, para evitar interbloqueos) y verifica que lo vendido
-- no exceda lo cosechado. p_items: [{project_id, description, quality,
-- quantity_kg, unit_price}]. Idempotente por p_id.
create or replace function public.create_sale(
  p_id uuid,
  p_customer uuid,
  p_sale_date date,
  p_items jsonb,
  p_due_date date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
  v_org uuid;
  v_project public.projects%rowtype;
  v_item record;
  v_available numeric;
  v_count int;
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

  if exists (select 1 from public.sales where id = p_id) then
    if exists (select 1 from public.sales where id = p_id and organization_id = v_org and customer_id = p_customer) then
      return p_id; -- reintento: la venta ya existe
    end if;
    raise exception 'El identificador de la venta ya se usó en otra operación' using errcode = '23505';
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
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'La venta debe incluir partidas' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_items);
  if v_count = 0 or v_count > 50 then
    raise exception 'La venta debe tener entre 1 y 50 partidas' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.parse_sale_items(p_items)
    where project_id is null
       or char_length(coalesce(description, '')) < 2
       or quantity_kg is null or quantity_kg <= 0 or quantity_kg <> round(quantity_kg, 3)
       or unit_price is null or unit_price <= 0 or unit_price <> round(unit_price, 4)
  ) then
    raise exception 'Revisa las partidas: proyecto, descripción, kilos (>0, 3 decimales) y precio (>0, 4 decimales)'
      using errcode = '22023';
  end if;

  for v_item in
    select project_id, sum(quantity_kg) as kg from public.parse_sale_items(p_items) group by project_id order by project_id
  loop
    v_project := public.lock_open_project(v_org, v_item.project_id, true);
    if p_sale_date < v_project.start_date then
      raise exception 'La fecha de venta es anterior al inicio del proyecto %', v_project.code using errcode = '22023';
    end if;
    v_available := public.project_harvested_kg(v_item.project_id) - public.project_sold_kg(v_item.project_id);
    if v_item.kg > v_available then
      raise exception 'El proyecto % tiene % kg disponibles para venta y se intentan vender % kg',
        v_project.code, greatest(v_available, 0), v_item.kg using errcode = '22023';
    end if;
  end loop;

  insert into public.sales (id, organization_id, code, customer_id, sale_date, due_date, notes)
  values (
    p_id, v_org, public.next_folio(v_org, 'sale', 'VTA'), p_customer, p_sale_date,
    coalesce(p_due_date, p_sale_date + v_customer.credit_days), nullif(trim(p_notes), '')
  );

  insert into public.sale_items (organization_id, sale_id, project_id, description, quality, quantity_kg, unit_price)
  select v_org, p_id, i.project_id, i.description, i.quality, i.quantity_kg, i.unit_price from public.parse_sale_items(p_items) i;

  update public.sales
  set total = (select sum(amount) from public.sale_items where sale_id = p_id)
  where id = p_id;

  return p_id;
end;
$$;

create or replace function public.cancel_sale(p_sale uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
  v_project uuid;
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
  if v_sale.amount_paid > 0 then
    raise exception 'La venta tiene pagos aplicados; cancélalos antes de cancelar la venta' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Indica el motivo de la cancelación' using errcode = '22023';
  end if;

  for v_project in select distinct project_id from public.sale_items where sale_id = p_sale order by project_id loop
    perform public.lock_open_project(v_sale.organization_id, v_project, true);
  end loop;

  update public.sales
  set status = 'cancelada', cancel_reason = trim(p_reason), cancelled_at = now(), cancelled_by = auth.uid()
  where id = p_sale;
end;
$$;

-- Aplica un pago parcial o total. Bloquea la venta para que dos cobros
-- simultáneos no rebasen el saldo. Idempotente por p_id.
create or replace function public.register_payment(
  p_id uuid,
  p_sale uuid,
  p_date date,
  p_amount numeric,
  p_method public.payment_method,
  p_reference text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
  v_balance numeric;
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
    if exists (select 1 from public.payments where id = p_id and sale_id = p_sale and amount = p_amount) then
      return p_id; -- reintento: el pago ya se aplicó
    end if;
    raise exception 'El identificador del pago ya se usó en otra operación' using errcode = '23505';
  end if;

  if v_sale.status <> 'vigente' then
    raise exception 'La venta % está cancelada' , v_sale.code using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'El importe debe ser mayor que cero (máximo 2 decimales)' using errcode = '22023';
  end if;
  if p_date is null or p_date < v_sale.sale_date or p_date > public.mx_today() then
    raise exception 'La fecha del pago debe estar entre la venta (%) y hoy', to_char(v_sale.sale_date, 'DD/MM/YYYY')
      using errcode = '22023';
  end if;
  v_balance := v_sale.total - v_sale.amount_paid;
  if v_balance <= 0 then
    raise exception 'La venta % ya está liquidada', v_sale.code using errcode = '22023';
  end if;
  if p_amount > v_balance then
    raise exception 'El pago (%) excede el saldo pendiente de la venta (%)',
      '$' || to_char(p_amount, 'FM999,999,999,990.00'), '$' || to_char(v_balance, 'FM999,999,999,990.00')
      using errcode = '22023';
  end if;

  insert into public.payments (id, organization_id, sale_id, payment_date, amount, method, reference, notes)
  values (p_id, v_sale.organization_id, p_sale, p_date, p_amount, p_method,
          nullif(trim(p_reference), ''), nullif(trim(p_notes), ''));

  update public.sales set amount_paid = amount_paid + p_amount where id = p_sale;
  return p_id;
end;
$$;

create or replace function public.cancel_payment(p_payment uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale_id uuid;
  v_sale public.sales%rowtype;
  v_pay public.payments%rowtype;
begin
  select sale_id into v_sale_id from public.payments where id = p_payment;
  -- Mismo orden de bloqueo que register_payment: venta y luego pago.
  select * into v_sale from public.sales where id = v_sale_id for update;
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
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Indica el motivo de la cancelación' using errcode = '22023';
  end if;

  update public.payments
  set status = 'cancelado', cancel_reason = trim(p_reason), cancelled_at = now(), cancelled_by = auth.uid()
  where id = p_payment;
  update public.sales set amount_paid = amount_paid - v_pay.amount where id = v_sale.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Vistas de costos y saldos (SECURITY INVOKER: respetan la RLS del usuario)
--
-- v_project_cost_entries es la ÚNICA fuente de costos: cada registro aparece
-- una vez y v_project_costs agrega sobre ella, de modo que el total siempre es
-- la suma del detalle. Las métricas por proyecto se agregan en subconsultas
-- independientes antes de unirse (sin multiplicar filas entre tablas hijas).
-- -----------------------------------------------------------------------------
create view public.v_project_cost_entries with (security_invoker = true) as
  select
    m.organization_id, m.project_id, m.plot_id, 'insumos'::text as source, m.id as source_id,
    m.movement_date as entry_date, p.name as concept,
    (case when m.movement_type = 'devolucion' then 'Devolución · ' else '' end) || trim(to_char(m.quantity, 'FM999,999,990.999')) || ' ' || p.unit as detail,
    case when m.movement_type = 'devolucion' then -m.total_cost else m.total_cost end as amount,
    null::public.expense_category as expense_category, m.created_at
  from public.inventory_movements m
  join public.inventory_products p on p.id = m.product_id
  where m.movement_type in ('consumo', 'devolucion')
  union all
  select
    u.organization_id, u.project_id, u.plot_id, 'maquinaria', u.id,
    u.usage_date, mc.name,
    trim(to_char(u.hours, 'FM9,990.99')) || ' h × $' || to_char(u.hourly_rate, 'FM999,999,990.00') || coalesce(' · ' || u.activity, ''),
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
  from public.project_expenses x;

create view public.v_project_costs with (security_invoker = true) as
  with costs as (
    select
      project_id,
      sum(amount) filter (where source = 'insumos')   as inputs_cost,
      sum(amount) filter (where source = 'maquinaria') as machinery_cost,
      sum(amount) filter (where source = 'mano_obra')  as labor_cost,
      sum(amount) filter (where source = 'gastos')     as expenses_cost,
      sum(amount)                                      as total_cost
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
  -- Lo cobrado de cada venta se prorratea entre sus proyectos según el importe
  -- de sus partidas (una venta puede incluir producción de varios proyectos).
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

create view public.v_sale_balances with (security_invoker = true) as
  select
    s.id,
    s.organization_id,
    s.code,
    s.customer_id,
    c.name as customer_name,
    s.sale_date,
    s.due_date,
    s.status,
    s.total,
    s.amount_paid,
    case when s.status = 'vigente' then s.total - s.amount_paid else 0 end as balance,
    case
      when s.status = 'cancelada' then 'cancelada'
      when s.amount_paid = 0 then 'pendiente'
      when s.amount_paid < s.total then 'parcial'
      else 'pagada'
    end as payment_status,
    case
      when s.status = 'vigente' and s.amount_paid < s.total and s.due_date < public.mx_today()
        then public.mx_today() - s.due_date
      else 0
    end as days_overdue,
    s.created_at
  from public.sales s
  join public.customers c on c.id = s.customer_id;

-- Indicadores financieros del dashboard.
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
-- Row Level Security
--   Operación (inventario, maquinaria, personal, cosechas): lectura para todos
--   los miembros; escritura según el área.
--   Comercial y financiero (clientes, ventas, pagos, gastos): lectura solo
--   para propietario, administrador, finanzas y consulta.
-- -----------------------------------------------------------------------------
alter table public.inventory_products  enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.machinery           enable row level security;
alter table public.machinery_usage     enable row level security;
alter table public.employees           enable row level security;
alter table public.labor_records       enable row level security;
alter table public.project_expenses    enable row level security;
alter table public.harvests            enable row level security;
alter table public.customers           enable row level security;
alter table public.sales               enable row level security;
alter table public.sale_items          enable row level security;
alter table public.payments            enable row level security;

do $$
declare
  r record;
begin
  -- tabla, roles de lectura (null = cualquier miembro), roles de escritura, roles de eliminación
  for r in
    select * from (values
      ('inventory_products',  null,                                                      '{propietario,administrador,almacen}',                '{propietario,administrador}'),
      ('inventory_movements', null,                                                      null,                                                 null),
      ('machinery',           null,                                                      '{propietario,administrador,agronomo}',               '{propietario,administrador}'),
      ('machinery_usage',     null,                                                      '{propietario,administrador,agronomo}',               '{propietario,administrador,agronomo}'),
      ('employees',           null,                                                      '{propietario,administrador,agronomo}',               '{propietario,administrador}'),
      ('labor_records',       null,                                                      '{propietario,administrador,agronomo,supervisor}',    '{propietario,administrador,agronomo,supervisor}'),
      ('harvests',            null,                                                      '{propietario,administrador,agronomo,supervisor}',    '{propietario,administrador,agronomo,supervisor}'),
      ('project_expenses',    '{propietario,administrador,finanzas,consulta}',           '{propietario,administrador,finanzas}',               '{propietario,administrador,finanzas}'),
      ('customers',           '{propietario,administrador,finanzas,consulta}',           '{propietario,administrador,finanzas}',               '{propietario,administrador}'),
      ('sales',               '{propietario,administrador,finanzas,consulta}',           null,                                                 null),
      ('sale_items',          '{propietario,administrador,finanzas,consulta}',           null,                                                 null),
      ('payments',            '{propietario,administrador,finanzas,consulta}',           null,                                                 null)
    ) as t(tbl, readers, writers, deleters)
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (%s)',
      r.tbl || '_select', r.tbl,
      case when r.readers is null then 'public.is_member(organization_id)'
           else format('public.has_role(organization_id, %L::public.app_role[])', r.readers) end);
    if r.writers is not null then
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (public.has_role(organization_id, %L::public.app_role[]))',
        r.tbl || '_insert', r.tbl, r.writers);
      execute format(
        'create policy %I on public.%I for update to authenticated
           using (public.has_role(organization_id, %L::public.app_role[]))
           with check (public.has_role(organization_id, %L::public.app_role[]))',
        r.tbl || '_update', r.tbl, r.writers, r.writers);
    end if;
    if r.deleters is not null then
      execute format(
        'create policy %I on public.%I for delete to authenticated using (public.has_role(organization_id, %L::public.app_role[]))',
        r.tbl || '_delete', r.tbl, r.deleters);
    end if;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Privilegios: columnas específicas. Existencias, valores, totales, saldos,
-- folios y estados solo cambian por las funciones de esta migración.
-- -----------------------------------------------------------------------------
revoke all on public.inventory_products, public.inventory_movements, public.machinery, public.machinery_usage,
  public.employees, public.labor_records, public.project_expenses, public.harvests, public.customers,
  public.sales, public.sale_items, public.payments,
  public.v_project_cost_entries, public.v_project_costs, public.v_sale_balances
from anon, authenticated;

grant select on public.inventory_products, public.inventory_movements, public.machinery, public.machinery_usage,
  public.employees, public.labor_records, public.project_expenses, public.harvests, public.customers,
  public.sales, public.sale_items, public.payments,
  public.v_project_cost_entries, public.v_project_costs, public.v_sale_balances
to authenticated;

grant delete on public.inventory_products, public.machinery, public.machinery_usage, public.employees,
  public.labor_records, public.project_expenses, public.harvests, public.customers
to authenticated;

grant insert (id, organization_id, name, sku, category, unit, min_stock, notes, is_active)
  on public.inventory_products to authenticated;
grant update (name, sku, category, unit, min_stock, notes, is_active)
  on public.inventory_products to authenticated;

grant insert (id, organization_id, name, code, kind, hourly_cost, notes, is_active) on public.machinery to authenticated;
grant update (name, code, kind, hourly_cost, notes, is_active) on public.machinery to authenticated;

grant insert (id, organization_id, machine_id, project_id, plot_id, usage_date, hours, hourly_rate, operator, activity, notes)
  on public.machinery_usage to authenticated;
grant update (machine_id, plot_id, usage_date, hours, hourly_rate, operator, activity, notes)
  on public.machinery_usage to authenticated;

grant insert (id, organization_id, full_name, position, phone, daily_wage, notes, is_active) on public.employees to authenticated;
grant update (full_name, position, phone, daily_wage, notes, is_active) on public.employees to authenticated;

grant insert (id, organization_id, project_id, plot_id, employee_id, crew, work_date, activity, pay_type, quantity,
  unit_label, unit_rate, notes)
  on public.labor_records to authenticated;
grant update (plot_id, employee_id, crew, work_date, activity, pay_type, quantity, unit_label, unit_rate, notes)
  on public.labor_records to authenticated;

grant insert (id, organization_id, project_id, plot_id, expense_date, category, description, supplier, invoice_ref, amount, notes)
  on public.project_expenses to authenticated;
grant update (plot_id, expense_date, category, description, supplier, invoice_ref, amount, notes)
  on public.project_expenses to authenticated;

grant insert (id, organization_id, project_id, plot_id, harvest_date, quality, quantity_kg, packages, notes)
  on public.harvests to authenticated;
grant update (plot_id, harvest_date, quality, quantity_kg, packages, notes) on public.harvests to authenticated;

grant insert (id, organization_id, name, rfc, contact_name, phone, email, address, credit_days, notes, is_active)
  on public.customers to authenticated;
grant update (name, rfc, contact_name, phone, email, address, credit_days, notes, is_active)
  on public.customers to authenticated;

revoke execute on function
  public.mx_today(),
  public.prevent_product_unit_change(),
  public.lock_open_project(uuid, uuid, boolean),
  public.check_project_record(),
  public.before_machinery_usage_write(),
  public.before_labor_record_write(),
  public.project_sold_kg(uuid),
  public.project_harvested_kg(uuid),
  public.check_harvest_vs_sales(),
  public.post_inventory_movement(uuid, public.inventory_products, public.inventory_movement_type, date, numeric,
    numeric, uuid, uuid, text, text, text, uuid),
  public.inventory_outflow_value(public.inventory_products, numeric),
  public.register_inventory_movement(uuid, uuid, public.inventory_movement_type, date, numeric, numeric, uuid, uuid,
    text, text, text),
  public.reverse_inventory_movement(uuid, uuid, text),
  public.parse_sale_items(jsonb),
  public.create_sale(uuid, uuid, date, jsonb, date, text),
  public.cancel_sale(uuid, text),
  public.register_payment(uuid, uuid, date, numeric, public.payment_method, text, text),
  public.cancel_payment(uuid, text),
  public.finance_summary(uuid)
from public, anon;

revoke execute on function
  public.prevent_product_unit_change(),
  public.lock_open_project(uuid, uuid, boolean),
  public.check_project_record(),
  public.before_machinery_usage_write(),
  public.before_labor_record_write(),
  public.project_sold_kg(uuid),
  public.project_harvested_kg(uuid),
  public.check_harvest_vs_sales(),
  public.post_inventory_movement(uuid, public.inventory_products, public.inventory_movement_type, date, numeric,
    numeric, uuid, uuid, text, text, text, uuid),
  public.inventory_outflow_value(public.inventory_products, numeric),
  public.parse_sale_items(jsonb)
from authenticated;

-- mx_today se usa dentro de las vistas (SECURITY INVOKER).
grant execute on function
  public.mx_today(),
  public.register_inventory_movement(uuid, uuid, public.inventory_movement_type, date, numeric, numeric, uuid, uuid,
    text, text, text),
  public.reverse_inventory_movement(uuid, uuid, text),
  public.create_sale(uuid, uuid, date, jsonb, date, text),
  public.cancel_sale(uuid, text),
  public.register_payment(uuid, uuid, date, numeric, public.payment_method, text, text),
  public.cancel_payment(uuid, text),
  public.finance_summary(uuid)
to authenticated;
