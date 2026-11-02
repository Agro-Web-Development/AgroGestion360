-- =============================================================================
-- AgroGestión 360 · Migración 0002 · Catálogos agrícolas y proyectos
-- Ranchos → parcelas, cultivos, proyectos (8 estados) con asignación de
-- parcelas (N:M con superficie) e historial de estados.
--
-- Integridad multiempresa: las llaves foráneas son compuestas
-- (organization_id, id), así una fila nunca puede apuntar a datos de otra
-- organización aunque se conozca su id.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.irrigation_type as enum (
  'temporal', 'goteo', 'aspersion', 'microaspersion', 'gravedad', 'pivote', 'otro'
);

create type public.project_status as enum (
  'planeacion',
  'preparacion',
  'siembra',
  'desarrollo',
  'cosecha',
  'comercializacion',
  'cerrado',
  'cancelado'
);

-- -----------------------------------------------------------------------------
-- Folios consecutivos por organización (proyectos ahora; ventas en Fase 4)
-- -----------------------------------------------------------------------------
create table public.organization_counters (
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  scope            text not null,
  year             int not null,
  value            int not null default 0,
  primary key (organization_id, scope, year)
);

create or replace function public.next_folio(p_org uuid, p_scope text, p_prefix text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year int := extract(year from now() at time zone 'America/Mexico_City')::int;
  v_value int;
begin
  insert into public.organization_counters as c (organization_id, scope, year, value)
  values (p_org, p_scope, v_year, 1)
  on conflict (organization_id, scope, year) do update set value = c.value + 1
  returning value into v_value;

  return format('%s-%s-%s', p_prefix, v_year, lpad(v_value::text, 4, '0'));
end;
$$;

-- -----------------------------------------------------------------------------
-- Ranchos
-- -----------------------------------------------------------------------------
create table public.farms (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null check (char_length(trim(name)) between 2 and 120),
  code             text check (char_length(code) <= 20),
  municipality     text check (char_length(municipality) <= 120),
  state            text check (char_length(state) <= 60),
  address          text check (char_length(address) <= 300),
  total_area_ha    numeric(12, 2) check (total_area_ha > 0),
  latitude         numeric(9, 6) check (latitude between -90 and 90),
  longitude        numeric(9, 6) check (longitude between -180 and 180),
  notes            text check (char_length(notes) <= 2000),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  unique (organization_id, id),
  check ((latitude is null) = (longitude is null))
);

create unique index farms_org_name_key on public.farms (organization_id, lower(name));
create unique index farms_org_code_key on public.farms (organization_id, upper(code)) where code is not null;

-- -----------------------------------------------------------------------------
-- Parcelas
-- -----------------------------------------------------------------------------
create table public.plots (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  farm_id          uuid not null,
  name             text not null check (char_length(trim(name)) between 1 and 120),
  code             text check (char_length(code) <= 20),
  area_ha          numeric(12, 2) not null check (area_ha > 0),
  soil_type        text check (char_length(soil_type) <= 60),
  irrigation_type  public.irrigation_type not null default 'temporal',
  notes            text check (char_length(notes) <= 2000),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  unique (organization_id, id),
  foreign key (organization_id, farm_id) references public.farms (organization_id, id) on delete restrict
);

create index plots_farm_idx on public.plots (farm_id);
create unique index plots_farm_name_key on public.plots (farm_id, lower(name));

-- -----------------------------------------------------------------------------
-- Cultivos (catálogo)
-- -----------------------------------------------------------------------------
create table public.crops (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null check (char_length(trim(name)) between 2 and 80),
  variety          text check (char_length(variety) <= 80),
  scientific_name  text check (char_length(scientific_name) <= 120),
  cycle_days       int check (cycle_days between 1 and 1825),
  yield_unit       text not null default 'ton' check (yield_unit in ('ton', 'kg', 'caja', 'saco', 'pieza')),
  notes            text check (char_length(notes) <= 2000),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  unique (organization_id, id)
);

create unique index crops_org_name_variety_key
  on public.crops (organization_id, lower(name), lower(coalesce(variety, '')));

-- -----------------------------------------------------------------------------
-- Proyectos agrícolas
-- -----------------------------------------------------------------------------
create table public.projects (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations (id) on delete cascade,
  code                   text not null default '', -- lo asigna before_project_write()
  name                   text not null check (char_length(trim(name)) between 3 and 150),
  crop_id                uuid not null,
  season                 text check (char_length(season) <= 60),
  status                 public.project_status not null default 'planeacion',
  start_date             date not null,
  planting_date          date,
  expected_harvest_date  date,
  end_date               date,
  expected_yield         numeric(14, 3) check (expected_yield > 0),
  budget_amount          numeric(14, 2) check (budget_amount >= 0),
  responsible_id         uuid references public.profiles (id) on delete set null,
  description            text check (char_length(description) <= 4000),
  created_at             timestamptz not null default now(),
  created_by             uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at             timestamptz not null default now(),
  updated_by             uuid references auth.users (id) on delete set null,
  unique (organization_id, id),
  unique (organization_id, code),
  foreign key (organization_id, crop_id) references public.crops (organization_id, id) on delete restrict,
  constraint projects_planting_after_start check (planting_date is null or planting_date >= start_date),
  constraint projects_harvest_after_planting check (
    expected_harvest_date is null or expected_harvest_date >= coalesce(planting_date, start_date)
  ),
  constraint projects_end_after_start check (end_date is null or end_date >= start_date)
);

create index projects_org_status_idx on public.projects (organization_id, status);
create index projects_crop_idx on public.projects (crop_id);
create index projects_responsible_idx on public.projects (responsible_id);

create table public.project_plots (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  project_id        uuid not null,
  plot_id           uuid not null,
  assigned_area_ha  numeric(12, 2) not null check (assigned_area_ha > 0),
  created_at        timestamptz not null default now(),
  created_by        uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at        timestamptz not null default now(),
  updated_by        uuid references auth.users (id) on delete set null,
  unique (project_id, plot_id),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  foreign key (organization_id, plot_id) references public.plots (organization_id, id) on delete restrict
);

create index project_plots_plot_idx on public.project_plots (plot_id);

create table public.project_status_history (
  id               bigint generated always as identity primary key,
  organization_id  uuid not null,
  project_id       uuid not null,
  from_status      public.project_status,
  to_status        public.project_status not null,
  note             text check (char_length(note) <= 500),
  changed_by       uuid references auth.users (id) on delete set null,
  changed_at       timestamptz not null default now(),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade
);

create index project_status_history_project_idx on public.project_status_history (project_id, changed_at desc);

-- -----------------------------------------------------------------------------
-- Campos de auditoría y bitácora
-- -----------------------------------------------------------------------------
create trigger farms_set_updated before update on public.farms
  for each row execute function public.set_updated_fields();
create trigger plots_set_updated before update on public.plots
  for each row execute function public.set_updated_fields();
create trigger crops_set_updated before update on public.crops
  for each row execute function public.set_updated_fields();
create trigger projects_set_updated before update on public.projects
  for each row execute function public.set_updated_fields();
create trigger project_plots_set_updated before update on public.project_plots
  for each row execute function public.set_updated_fields();

create trigger farms_audit after insert or update or delete on public.farms
  for each row execute function public.log_audit();
create trigger plots_audit after insert or update or delete on public.plots
  for each row execute function public.log_audit();
create trigger crops_audit after insert or update or delete on public.crops
  for each row execute function public.log_audit();
create trigger projects_audit after insert or update or delete on public.projects
  for each row execute function public.log_audit();
create trigger project_plots_audit after insert or update or delete on public.project_plots
  for each row execute function public.log_audit();

-- -----------------------------------------------------------------------------
-- Reglas de superficie
--   · La suma de parcelas activas no excede la superficie declarada del rancho.
--   · La superficie asignada a proyectos vigentes no excede la de la parcela.
-- Se bloquea la fila padre (FOR UPDATE) para que dos altas simultáneas no
-- rebasen el límite.
-- -----------------------------------------------------------------------------
create or replace function public.plot_assigned_area(p_plot uuid, p_exclude uuid default null)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(pp.assigned_area_ha), 0)
  from public.project_plots pp
  join public.projects p on p.id = pp.project_id
  where pp.plot_id = p_plot
    and p.status not in ('cerrado', 'cancelado')
    and (p_exclude is null or pp.id <> p_exclude);
$$;

create or replace function public.check_plot_area()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_farm public.farms%rowtype;
  v_used numeric;
  v_assigned numeric;
begin
  select * into v_farm from public.farms
  where id = new.farm_id and organization_id = new.organization_id
  for update;
  if not found then
    raise exception 'Rancho no encontrado' using errcode = 'P0002';
  end if;

  if tg_op = 'INSERT' or new.farm_id is distinct from old.farm_id then
    if not v_farm.is_active then
      raise exception 'El rancho "%" está inactivo; no se le pueden agregar parcelas', v_farm.name
        using errcode = '22023';
    end if;
  end if;

  if new.is_active and v_farm.total_area_ha is not null then
    select coalesce(sum(area_ha), 0) into v_used
    from public.plots
    where farm_id = new.farm_id and is_active and id <> new.id;

    if v_used + new.area_ha > v_farm.total_area_ha then
      raise exception 'La superficie de las parcelas (% ha) excede la del rancho (% ha). Disponible: % ha',
        v_used + new.area_ha, v_farm.total_area_ha, greatest(v_farm.total_area_ha - v_used, 0)
        using errcode = '22023';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    v_assigned := public.plot_assigned_area(new.id);
    if new.area_ha < v_assigned then
      raise exception 'La parcela tiene % ha asignadas a proyectos vigentes; la superficie no puede ser menor',
        v_assigned using errcode = '22023';
    end if;
    if not new.is_active and old.is_active and v_assigned > 0 then
      raise exception 'La parcela está asignada a proyectos vigentes; no puede desactivarse'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

create trigger plots_check_area before insert or update of farm_id, area_ha, is_active on public.plots
  for each row execute function public.check_plot_area();

create or replace function public.check_farm_area()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used numeric;
begin
  if new.total_area_ha is not null then
    select coalesce(sum(area_ha), 0) into v_used
    from public.plots where farm_id = new.id and is_active;
    if new.total_area_ha < v_used then
      raise exception 'Las parcelas activas suman % ha; la superficie del rancho no puede ser menor', v_used
        using errcode = '22023';
    end if;
  end if;

  if not new.is_active and old.is_active and exists (
    select 1 from public.project_plots pp
    join public.plots pl on pl.id = pp.plot_id
    join public.projects p on p.id = pp.project_id
    where pl.farm_id = new.id and p.status not in ('cerrado', 'cancelado')
  ) then
    raise exception 'El rancho tiene parcelas en proyectos vigentes; no puede desactivarse'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger farms_check_area before update of total_area_ha, is_active on public.farms
  for each row execute function public.check_farm_area();

create or replace function public.check_project_plot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plot public.plots%rowtype;
  v_status public.project_status;
  v_used numeric;
begin
  select * into v_plot from public.plots
  where id = new.plot_id and organization_id = new.organization_id
  for update;
  select status into v_status from public.projects
  where id = new.project_id and organization_id = new.organization_id;
  if v_plot.id is null or v_status is null then
    raise exception 'Proyecto o parcela no encontrados' using errcode = 'P0002';
  end if;

  if v_status in ('cerrado', 'cancelado') then
    raise exception 'El proyecto está % y no admite cambios de parcelas', v_status using errcode = '22023';
  end if;
  if tg_op = 'INSERT' and not v_plot.is_active then
    raise exception 'La parcela "%" está inactiva', v_plot.name using errcode = '22023';
  end if;

  v_used := public.plot_assigned_area(new.plot_id, new.id);
  if v_used + new.assigned_area_ha > v_plot.area_ha then
    raise exception 'La parcela "%" tiene % ha; ya hay % ha asignadas a otros proyectos vigentes. Disponible: % ha',
      v_plot.name, v_plot.area_ha, v_used, greatest(v_plot.area_ha - v_used, 0)
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger project_plots_check before insert or update of plot_id, assigned_area_ha on public.project_plots
  for each row execute function public.check_project_plot();

create or replace function public.prevent_closed_project_plot_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Al eliminar el proyecto completo (cascada) el padre ya no existe y se permite.
  if exists (
    select 1 from public.projects where id = old.project_id and status in ('cerrado', 'cancelado')
  ) then
    raise exception 'El proyecto está cerrado o cancelado y no admite cambios de parcelas'
      using errcode = '22023';
  end if;
  return old;
end;
$$;

create trigger project_plots_prevent_delete before delete on public.project_plots
  for each row execute function public.prevent_closed_project_plot_delete();

-- -----------------------------------------------------------------------------
-- Proyectos: folio, responsable válido e historial de estados
-- -----------------------------------------------------------------------------
create or replace function public.before_project_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.code := public.next_folio(new.organization_id, 'project', 'PRY');
    new.status := 'planeacion';
  end if;

  if new.responsible_id is not null
     and (tg_op = 'INSERT' or new.responsible_id is distinct from old.responsible_id)
     and not exists (
       select 1 from public.memberships
       where organization_id = new.organization_id and user_id = new.responsible_id and status = 'activo'
     ) then
    raise exception 'El responsable debe ser un usuario activo de la organización' using errcode = '22023';
  end if;

  if tg_op = 'INSERT' or new.crop_id is distinct from old.crop_id then
    if not exists (
      select 1 from public.crops
      where id = new.crop_id and organization_id = new.organization_id and is_active
    ) then
      raise exception 'El cultivo seleccionado está inactivo' using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

create trigger projects_before_write before insert or update on public.projects
  for each row execute function public.before_project_write();

create or replace function public.log_project_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.project_status_history (organization_id, project_id, from_status, to_status, note, changed_by)
    values (
      new.organization_id, new.id,
      case when tg_op = 'UPDATE' then old.status end,
      new.status,
      nullif(current_setting('app.status_note', true), ''),
      auth.uid()
    );
  end if;
  return null;
end;
$$;

create trigger projects_log_status after insert or update of status on public.projects
  for each row execute function public.log_project_status();

-- Transiciones permitidas. Avanzar o retroceder una etapa, cancelar, y cerrar
-- desde cosecha o comercialización. Reabrir un proyecto cerrado o cancelado
-- queda reservado a propietario/administrador (se valida en la RPC).
create or replace function public.project_transition_allowed(
  p_from public.project_status,
  p_to public.project_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from::text, p_to::text) in (
    ('planeacion', 'preparacion'), ('planeacion', 'siembra'), ('planeacion', 'cancelado'),
    ('preparacion', 'planeacion'), ('preparacion', 'siembra'), ('preparacion', 'cancelado'),
    ('siembra', 'preparacion'), ('siembra', 'desarrollo'), ('siembra', 'cancelado'),
    ('desarrollo', 'siembra'), ('desarrollo', 'cosecha'), ('desarrollo', 'cancelado'),
    ('cosecha', 'desarrollo'), ('cosecha', 'comercializacion'), ('cosecha', 'cerrado'), ('cosecha', 'cancelado'),
    ('comercializacion', 'cosecha'), ('comercializacion', 'cerrado'),
    ('cerrado', 'comercializacion'),
    ('cancelado', 'planeacion')
  );
$$;

create or replace function public.change_project_status(
  p_project uuid,
  p_status public.project_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.projects%rowtype;
  v_overbooked text;
begin
  select * into v_p from public.projects where id = p_project for update;
  if not found or not public.is_member(v_p.organization_id) then
    raise exception 'Proyecto no encontrado' using errcode = 'P0002';
  end if;
  if not public.has_role(v_p.organization_id, array['propietario', 'administrador', 'agronomo']::public.app_role[]) then
    raise exception 'No tienes permiso para cambiar el estado del proyecto' using errcode = '42501';
  end if;
  if v_p.status = p_status then
    raise exception 'El proyecto ya se encuentra en ese estado' using errcode = '22023';
  end if;
  if not public.project_transition_allowed(v_p.status, p_status) then
    raise exception 'No se permite pasar de "%" a "%"', v_p.status, p_status using errcode = '22023';
  end if;
  if v_p.status in ('cerrado', 'cancelado')
     and not public.has_role(v_p.organization_id, array['propietario', 'administrador']::public.app_role[]) then
    raise exception 'Solo un propietario o administrador puede reabrir un proyecto' using errcode = '42501';
  end if;
  if p_status = 'cancelado' and char_length(trim(coalesce(p_note, ''))) < 5 then
    raise exception 'Indica el motivo de la cancelación' using errcode = '22023';
  end if;

  -- Al reabrir, sus parcelas vuelven a contar: verificar que sigan disponibles.
  if v_p.status in ('cerrado', 'cancelado') then
    select string_agg(pl.name, ', ') into v_overbooked
    from public.project_plots pp
    join public.plots pl on pl.id = pp.plot_id
    where pp.project_id = p_project
      and public.plot_assigned_area(pp.plot_id) + pp.assigned_area_ha > pl.area_ha;
    if v_overbooked is not null then
      raise exception 'No hay superficie disponible en: %. Ajusta las asignaciones antes de reabrir', v_overbooked
        using errcode = '22023';
    end if;
  end if;

  perform set_config('app.status_note', coalesce(trim(p_note), ''), true);
  update public.projects
  set status = p_status,
      end_date = case
        when p_status in ('cerrado', 'cancelado') then coalesce(end_date, (now() at time zone 'America/Mexico_City')::date)
        when v_p.status in ('cerrado', 'cancelado') then null
        else end_date
      end
  where id = p_project;
  perform set_config('app.status_note', '', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- Indicadores del dashboard (SECURITY INVOKER: respeta la RLS del usuario)
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_summary(p_org uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with active_projects as (
    select * from public.projects
    where organization_id = p_org and status not in ('cerrado', 'cancelado')
  ),
  cultivated as (
    select ap.crop_id, sum(pp.assigned_area_ha) as area
    from active_projects ap
    join public.project_plots pp on pp.project_id = ap.id
    group by ap.crop_id
  )
  select jsonb_build_object(
    'farms', (select count(*) from public.farms where organization_id = p_org and is_active),
    'plots', (select count(*) from public.plots where organization_id = p_org and is_active),
    'crops', (select count(*) from public.crops where organization_id = p_org and is_active),
    'registered_area', (
      select coalesce(sum(area_ha), 0) from public.plots where organization_id = p_org and is_active
    ),
    'cultivated_area', (select coalesce(sum(area), 0) from cultivated),
    'projects_total', (select count(*) from public.projects where organization_id = p_org),
    'projects_active', (select count(*) from active_projects),
    'planned_budget', (select coalesce(sum(budget_amount), 0) from active_projects),
    'by_status', (
      select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
      from (
        select status, count(*) as n from public.projects where organization_id = p_org group by status
      ) s
    ),
    'area_by_crop', (
      select coalesce(jsonb_agg(jsonb_build_object('crop', c.name || coalesce(' · ' || c.variety, ''), 'area', cu.area) order by cu.area desc), '[]'::jsonb)
      from cultivated cu join public.crops c on c.id = cu.crop_id
    )
  );
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
--   Lectura: cualquier miembro activo.
--   Alta/edición: propietario, administrador, agrónomo.
--   Eliminación: propietario y administrador.
-- -----------------------------------------------------------------------------
alter table public.organization_counters  enable row level security;
alter table public.farms                  enable row level security;
alter table public.plots                  enable row level security;
alter table public.crops                  enable row level security;
alter table public.projects               enable row level security;
alter table public.project_plots          enable row level security;
alter table public.project_status_history enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['farms', 'plots', 'crops', 'projects', 'project_plots'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_member(organization_id))',
      t || '_select_members', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (public.has_role(organization_id, array[''propietario'', ''administrador'', ''agronomo'']::public.app_role[]))',
      t || '_insert_writers', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (public.has_role(organization_id, array[''propietario'', ''administrador'', ''agronomo'']::public.app_role[]))
         with check (public.has_role(organization_id, array[''propietario'', ''administrador'', ''agronomo'']::public.app_role[]))',
      t || '_update_writers', t);
  end loop;
end;
$$;

create policy "farms_delete_admins" on public.farms
  for delete to authenticated
  using (public.has_role(organization_id, array['propietario', 'administrador']::public.app_role[]));
create policy "plots_delete_admins" on public.plots
  for delete to authenticated
  using (public.has_role(organization_id, array['propietario', 'administrador']::public.app_role[]));
create policy "crops_delete_admins" on public.crops
  for delete to authenticated
  using (public.has_role(organization_id, array['propietario', 'administrador']::public.app_role[]));
-- Solo proyectos sin operación (planeación o cancelados); el resto se cancela.
create policy "projects_delete_admins" on public.projects
  for delete to authenticated
  using (
    status in ('planeacion', 'cancelado')
    and public.has_role(organization_id, array['propietario', 'administrador']::public.app_role[])
  );
-- Quitar parcelas de un proyecto es parte de su edición.
create policy "project_plots_delete_writers" on public.project_plots
  for delete to authenticated
  using (public.has_role(organization_id, array['propietario', 'administrador', 'agronomo']::public.app_role[]));

create policy "project_status_history_select_members" on public.project_status_history
  for select to authenticated using (public.is_member(organization_id));

-- -----------------------------------------------------------------------------
-- Privilegios. Se otorgan columnas específicas para que organization_id,
-- folio, estado y campos de auditoría no puedan alterarse desde el cliente.
-- -----------------------------------------------------------------------------
revoke all on public.organization_counters, public.farms, public.plots, public.crops,
  public.projects, public.project_plots, public.project_status_history from anon, authenticated;

grant select, delete on public.farms, public.plots, public.crops, public.projects,
  public.project_plots to authenticated;
grant select on public.project_status_history to authenticated;

grant insert (id, organization_id, name, code, municipality, state, address, total_area_ha, latitude, longitude, notes, is_active)
  on public.farms to authenticated;
grant update (name, code, municipality, state, address, total_area_ha, latitude, longitude, notes, is_active)
  on public.farms to authenticated;

grant insert (id, organization_id, farm_id, name, code, area_ha, soil_type, irrigation_type, notes, is_active)
  on public.plots to authenticated;
grant update (farm_id, name, code, area_ha, soil_type, irrigation_type, notes, is_active)
  on public.plots to authenticated;

grant insert (id, organization_id, name, variety, scientific_name, cycle_days, yield_unit, notes, is_active)
  on public.crops to authenticated;
grant update (name, variety, scientific_name, cycle_days, yield_unit, notes, is_active)
  on public.crops to authenticated;

grant insert (id, organization_id, name, crop_id, season, start_date, planting_date, expected_harvest_date,
  expected_yield, budget_amount, responsible_id, description)
  on public.projects to authenticated;
grant update (name, crop_id, season, start_date, planting_date, expected_harvest_date, end_date,
  expected_yield, budget_amount, responsible_id, description)
  on public.projects to authenticated;

grant insert (id, organization_id, project_id, plot_id, assigned_area_ha) on public.project_plots to authenticated;
grant update (assigned_area_ha) on public.project_plots to authenticated;

revoke execute on function
  public.next_folio(uuid, text, text),
  public.plot_assigned_area(uuid, uuid),
  public.check_plot_area(),
  public.check_farm_area(),
  public.check_project_plot(),
  public.prevent_closed_project_plot_delete(),
  public.before_project_write(),
  public.log_project_status(),
  public.change_project_status(uuid, public.project_status, text),
  public.dashboard_summary(uuid),
  public.project_transition_allowed(public.project_status, public.project_status)
from public, anon;

revoke execute on function
  public.next_folio(uuid, text, text),
  public.plot_assigned_area(uuid, uuid),
  public.check_plot_area(),
  public.check_farm_area(),
  public.check_project_plot(),
  public.prevent_closed_project_plot_delete(),
  public.before_project_write(),
  public.log_project_status()
from authenticated;

grant execute on function
  public.change_project_status(uuid, public.project_status, text),
  public.dashboard_summary(uuid),
  public.project_transition_allowed(public.project_status, public.project_status)
to authenticated;
