-- =============================================================================
-- AgroGestión 360 · Migración 0007 · Preparación comercial y puesta en producción
--
--   · Observaciones de campo (plagas, enfermedades, clima…): nuevo registro de
--     bitácora con evidencias, capturable sin conexión.
--   · offline_submissions: bitácora de sincronización de la captura sin conexión.
--     Su id es la clave de idempotencia (el id local del registro, que también
--     es el id del registro creado). Guarda la huella del contenido para detectar
--     un reenvío distinto de algo ya sincronizado, y los conflictos que requieren
--     la revisión de un usuario autorizado.
--   · Planes de suscripción: estructura de límites por organización (proyectos
--     vigentes, usuarios, almacenamiento y funcionalidades). Sin cobros: toda
--     organización nace en el plan «piloto», sin límites.
--   · Auditoría de seguridad: la política de eliminación de Storage exige
--     membresía vigente y respeta la protección de los comprobantes.
--   · Índices para llaves foráneas usadas al eliminar catálogos.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.observation_category as enum (
  'plaga', 'enfermedad', 'maleza', 'clima', 'riego', 'nutricion', 'fenologia', 'otro'
);
create type public.observation_severity as enum ('baja', 'media', 'alta');

create type public.offline_record_type as enum ('riego', 'actividad', 'aplicacion', 'observacion', 'cosecha');
create type public.offline_submission_status as enum (
  'sincronizado',       -- el servidor confirmó el registro
  'requiere_revision',  -- la regla de negocio lo rechazó; espera corrección o revisión
  'descartado'          -- un usuario autorizado lo descartó
);

-- -----------------------------------------------------------------------------
-- Observaciones de campo
-- -----------------------------------------------------------------------------
create table public.field_observations (
  id                uuid primary key, -- lo genera el cliente: llave de idempotencia
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  project_id        uuid not null,
  plot_id           uuid,
  observation_date  date not null,
  observation_time  time,
  category          public.observation_category not null,
  severity          public.observation_severity not null default 'baja',
  title             text not null check (char_length(title) between 3 and 120),
  description       text check (char_length(description) <= 2000),
  latitude          numeric(9, 6) check (latitude between -90 and 90),
  longitude         numeric(9, 6) check (longitude between -180 and 180),
  responsible_id    uuid,
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
  foreign key (organization_id, responsible_id) references public.employees (organization_id, id) on delete restrict,
  check ((status = 'cancelado') = (cancelled_at is not null)),
  check ((latitude is null) = (longitude is null))
);

create index field_observations_project_idx on public.field_observations (project_id, observation_date desc);
create index field_observations_org_date_idx on public.field_observations (organization_id, observation_date desc);
create index field_observations_responsible_idx on public.field_observations (responsible_id) where responsible_id is not null;

create trigger field_observations_check_project before insert or update or delete on public.field_observations
  for each row execute function public.check_project_record('observation_date');
create trigger field_observations_cancelled_lock before update on public.field_observations
  for each row execute function public.prevent_cancelled_edit();
create trigger field_observations_set_updated before update on public.field_observations
  for each row execute function public.set_updated_fields();
create trigger field_observations_audit after insert or update or delete on public.field_observations
  for each row execute function public.log_audit();

alter table public.field_observations enable row level security;
create policy field_observations_select on public.field_observations for select to authenticated
  using (public.is_member(organization_id));
create policy field_observations_insert on public.field_observations for insert to authenticated
  with check (public.has_role(organization_id, '{propietario,administrador,agronomo,supervisor}'::public.app_role[]));
create policy field_observations_update on public.field_observations for update to authenticated
  using (public.has_role(organization_id, '{propietario,administrador,agronomo,supervisor}'::public.app_role[]))
  with check (public.has_role(organization_id, '{propietario,administrador,agronomo,supervisor}'::public.app_role[]));

revoke all on public.field_observations from anon, authenticated;
grant select on public.field_observations to authenticated;
grant insert (id, organization_id, project_id, plot_id, observation_date, observation_time, category, severity, title,
  description, latitude, longitude, responsible_id)
  on public.field_observations to authenticated;
grant update (plot_id, observation_date, observation_time, category, severity, title, description, latitude, longitude,
  responsible_id)
  on public.field_observations to authenticated;

-- Cancelación con motivo (las bitácoras no se eliminan).
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
    when 'observacion' then 'field_observations'
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

-- Evidencias de observaciones (mismas reglas que las demás bitácoras).
alter table public.attachments
  drop constraint attachments_entity_type_check,
  add constraint attachments_entity_type_check check (entity_type in (
    'irrigation_log', 'chemical_application', 'field_activity', 'machinery_maintenance', 'field_observation', 'harvest',
    'payment', 'expense'));

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
    when 'field_observation' then 'field_observations'
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

-- -----------------------------------------------------------------------------
-- Seguridad de Storage (auditoría Fase 6)
--
-- Antes: el autor de un archivo podía eliminarlo aunque ya no perteneciera a la
-- organización, y un usuario de finanzas podía borrar del bucket el archivo de
-- un comprobante (que solo retira propietario o administrador). Ahora se exige
-- membresía vigente con rol de captura para ese tipo de evidencia, igual que la
-- RLS de attachments.
-- -----------------------------------------------------------------------------
drop policy evidencias_delete_owner_admin on storage.objects;
create policy evidencias_delete_owner_admin on storage.objects for delete to authenticated
  using (
    bucket_id = 'evidencias'
    and (
      (owner_id = auth.uid()::text
        and split_part(name, '/', 2) not in ('payment', 'expense')
        and public.has_role(public.storage_object_org(name), public.attachment_roles(split_part(name, '/', 2), true)))
      or public.has_role(public.storage_object_org(name), array['propietario', 'administrador']::public.app_role[])
    )
  );

-- -----------------------------------------------------------------------------
-- Planes de suscripción y límites por organización
--
-- Los límites null significan «sin límite». No hay cobros ni pasarela de pago:
-- el plan solo lo cambia el equipo de AgroGestión (clave secreta / SQL), nunca
-- un usuario desde la aplicación.
-- -----------------------------------------------------------------------------
create table public.plans (
  code            text primary key check (code ~ '^[a-z][a-z0-9_]{1,29}$'),
  name            text not null check (char_length(name) between 2 and 60),
  description     text check (char_length(description) <= 300),
  max_projects    int check (max_projects > 0),     -- proyectos vigentes (no cerrados ni cancelados)
  max_users       int check (max_users > 0),        -- membresías activas + invitaciones pendientes
  max_storage_mb  int check (max_storage_mb > 0),   -- evidencias y comprobantes
  features        text[] not null default '{}',
  is_active       boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

comment on column public.plans.features is
  'Funcionalidades incluidas (offline, comercial, finanzas, reportes_excel…). Ver docs/saas-suscripciones.md.';

insert into public.plans (code, name, description, features, sort_order) values
  ('piloto', 'Piloto', 'Programa piloto con productores: sin límites ni cobro.',
   array['operacion', 'offline', 'comercial', 'finanzas', 'reportes_excel'], 0);

alter table public.organizations
  add column plan_code text not null default 'piloto' references public.plans (code) on update cascade,
  add column plan_started_at timestamptz not null default now();

create index organizations_plan_idx on public.organizations (plan_code);

alter table public.plans enable row level security;
create policy plans_select on public.plans for select to authenticated using (true);
revoke all on public.plans from anon, authenticated;
grant select on public.plans to authenticated;

-- Uso actual frente a los límites del plan (lo consulta la configuración de la organización).
create or replace function public.organization_usage(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plan public.plans%rowtype;
begin
  if not public.is_member(p_org) then
    raise exception 'Organización no encontrada' using errcode = 'P0002';
  end if;
  select p.* into v_plan from public.plans p join public.organizations o on o.plan_code = p.code where o.id = p_org;
  return jsonb_build_object(
    'plan_code', v_plan.code,
    'plan_name', v_plan.name,
    'features', to_jsonb(v_plan.features),
    'max_projects', v_plan.max_projects,
    'max_users', v_plan.max_users,
    'max_storage_mb', v_plan.max_storage_mb,
    'projects', (select count(*) from public.projects
                 where organization_id = p_org and status not in ('cerrado', 'cancelado')),
    'users', (select count(*) from public.memberships where organization_id = p_org and status = 'activo'),
    'pending_invitations', (select count(*) from public.invitations
                            where organization_id = p_org and status = 'pendiente' and expires_at > now()),
    'storage_bytes', (select coalesce(sum(size_bytes), 0) from public.attachments where organization_id = p_org)
  );
end;
$$;

-- Límite de proyectos vigentes al crear un proyecto.
create or replace function public.check_plan_projects()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max int;
begin
  select p.max_projects into v_max
  from public.organizations o join public.plans p on p.code = o.plan_code
  where o.id = new.organization_id
  for share of o;
  if v_max is not null and (
    select count(*) from public.projects
    where organization_id = new.organization_id and status not in ('cerrado', 'cancelado')
  ) >= v_max then
    raise exception 'Tu plan permite % proyectos vigentes. Cierra un proyecto o solicita un cambio de plan.', v_max
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger projects_plan_limit before insert on public.projects
  for each row execute function public.check_plan_projects();

-- Límite de usuarios: membresías activas + invitaciones pendientes (cada
-- invitación reserva su lugar, así la aceptación nunca falla por el límite).
create or replace function public.check_plan_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max int;
  v_email text;
begin
  if tg_table_name = 'memberships' then
    if new.status <> 'activo' or (tg_op = 'UPDATE' and old.status = 'activo') then
      return new;
    end if;
    select email into v_email from public.profiles where id = new.user_id;
    -- Aceptación de una invitación: su lugar ya estaba reservado.
    if exists (
      select 1 from public.invitations
      where organization_id = new.organization_id and email = v_email::extensions.citext and status = 'pendiente'
    ) then
      return new;
    end if;
  else
    if new.status <> 'pendiente' or (tg_op = 'UPDATE' and old.status = 'pendiente') then
      return new;
    end if;
    v_email := new.email;
  end if;

  select p.max_users into v_max
  from public.organizations o join public.plans p on p.code = o.plan_code
  where o.id = new.organization_id
  for update of o;
  if v_max is not null and (
    (select count(*) from public.memberships
     where organization_id = new.organization_id and status = 'activo')
    + (select count(*) from public.invitations
       where organization_id = new.organization_id and status = 'pendiente' and expires_at > now()
         and email <> coalesce(v_email, '')::extensions.citext)
  ) >= v_max then
    raise exception 'Tu plan permite % usuarios. Desactiva un usuario o solicita un cambio de plan.', v_max
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger memberships_plan_limit before insert or update of status on public.memberships
  for each row execute function public.check_plan_users();
create trigger invitations_plan_limit before insert or update of status on public.invitations
  for each row execute function public.check_plan_users();

-- Límite de almacenamiento de evidencias.
create or replace function public.check_plan_storage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max int;
begin
  select p.max_storage_mb into v_max
  from public.organizations o join public.plans p on p.code = o.plan_code
  where o.id = new.organization_id;
  if v_max is not null and (
    select coalesce(sum(size_bytes), 0) from public.attachments where organization_id = new.organization_id
  ) + new.size_bytes > v_max::bigint * 1024 * 1024 then
    raise exception 'Se alcanzó el almacenamiento de tu plan (% MB).', v_max using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger attachments_plan_limit before insert on public.attachments
  for each row execute function public.check_plan_storage();

-- -----------------------------------------------------------------------------
-- Sincronización de la captura sin conexión
-- -----------------------------------------------------------------------------
create table public.offline_submissions (
  id              uuid primary key,  -- clave de idempotencia: id local = id del registro creado
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  record_type     public.offline_record_type not null,
  captured_at     timestamptz not null,
  payload         jsonb not null,
  payload_hash    text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  status          public.offline_submission_status not null,
  attempts        int not null default 1 check (attempts > 0),
  last_error      text check (char_length(last_error) <= 500),
  entity_id       uuid,
  received_at     timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  synced_at       timestamptz,
  reviewed_by     uuid references auth.users (id) on delete set null,
  reviewed_at     timestamptz,
  review_note     text check (char_length(review_note) <= 500),
  check ((status = 'sincronizado') = (synced_at is not null and entity_id is not null)),
  check ((status = 'descartado') = (reviewed_at is not null))
);

create index offline_submissions_org_status_idx on public.offline_submissions (organization_id, status, received_at desc);
create index offline_submissions_user_idx on public.offline_submissions (user_id, received_at desc);

alter table public.offline_submissions enable row level security;
-- Cada quien ve sus envíos; los revisores ven los de toda la organización.
create policy offline_submissions_select on public.offline_submissions for select to authenticated
  using (
    (user_id = auth.uid() and public.is_member(organization_id))
    or public.has_role(organization_id, array['propietario', 'administrador', 'agronomo']::public.app_role[])
  );
revoke all on public.offline_submissions from anon, authenticated;
grant select on public.offline_submissions to authenticated;

-- Registra el resultado de un intento de sincronización. Estados terminales:
-- «sincronizado» no cambia (un reenvío con otro contenido se reporta como
-- conflicto sin modificar nada) y «descartado» solo lo decide un revisor.
-- Devuelve el estado resultante: sincronizado, requiere_revision, descartado o conflicto.
create or replace function public.save_offline_submission(
  p_id uuid,
  p_org uuid,
  p_type public.offline_record_type,
  p_captured_at timestamptz,
  p_payload jsonb,
  p_hash text,
  p_status public.offline_submission_status,
  p_entity uuid default null,
  p_error text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.offline_submissions%rowtype;
begin
  if v_uid is null or not public.is_member(p_org) then
    raise exception 'No perteneces a esta organización' using errcode = '42501';
  end if;
  if p_status = 'descartado' then
    raise exception 'Solo un revisor descarta registros' using errcode = '42501';
  end if;

  select * into v_row from public.offline_submissions where id = p_id for update;
  if found then
    if v_row.user_id <> v_uid or v_row.organization_id <> p_org then
      raise exception 'El registro pertenece a otro usuario u organización' using errcode = '42501';
    end if;
    if v_row.status = 'descartado' then
      return 'descartado';
    end if;
    if v_row.status = 'sincronizado' then
      return case when v_row.payload_hash = p_hash then 'sincronizado' else 'conflicto' end;
    end if;
    update public.offline_submissions
    set payload = p_payload,
        payload_hash = p_hash,
        record_type = p_type,
        status = p_status,
        attempts = attempts + 1,
        last_error = case when p_status = 'sincronizado' then null else left(p_error, 500) end,
        entity_id = p_entity,
        synced_at = case when p_status = 'sincronizado' then now() end,
        updated_at = now()
    where id = p_id;
    return p_status::text;
  end if;

  insert into public.offline_submissions (id, organization_id, user_id, record_type, captured_at, payload, payload_hash,
    status, last_error, entity_id, synced_at)
  values (p_id, p_org, v_uid, p_type, p_captured_at, p_payload, p_hash, p_status,
    case when p_status = 'sincronizado' then null else left(p_error, 500) end,
    p_entity, case when p_status = 'sincronizado' then now() end);
  return p_status::text;
end;
$$;

-- Un revisor (propietario, administrador o agrónomo) descarta un registro que
-- no puede sincronizarse; el dispositivo lo verá en su siguiente intento.
create or replace function public.discard_offline_submission(p_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.offline_submissions%rowtype;
begin
  select * into v_row from public.offline_submissions where id = p_id for update;
  if not found or not public.is_member(v_row.organization_id) then
    raise exception 'Registro no encontrado' using errcode = 'P0002';
  end if;
  if not public.has_role(v_row.organization_id, array['propietario', 'administrador', 'agronomo']::public.app_role[]) then
    raise exception 'No tienes permiso para revisar registros sin conexión' using errcode = '42501';
  end if;
  if v_row.status <> 'requiere_revision' then
    raise exception 'Solo se descartan registros que requieren revisión' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_note, ''))) < 5 then
    raise exception 'Indica el motivo' using errcode = '22023';
  end if;
  update public.offline_submissions
  set status = 'descartado', reviewed_by = auth.uid(), reviewed_at = now(), review_note = trim(p_note), updated_at = now()
  where id = p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Índices de llaves foráneas (eliminar un catálogo sin recorrer tablas completas)
-- -----------------------------------------------------------------------------
create index chemical_applications_product_idx on public.chemical_applications (product_id);
create index chemical_applications_machine_idx on public.chemical_applications (machine_id) where machine_id is not null;
create index chemical_applications_responsible_idx on public.chemical_applications (responsible_id) where responsible_id is not null;
create index irrigation_logs_responsible_idx on public.irrigation_logs (responsible_id) where responsible_id is not null;
create index field_activities_type_idx on public.field_activities (activity_type_id);
create index field_activities_responsible_idx on public.field_activities (responsible_id) where responsible_id is not null;
create index inventory_movements_supplier_idx on public.inventory_movements (supplier_id) where supplier_id is not null;
create index inventory_movements_responsible_idx on public.inventory_movements (responsible_id) where responsible_id is not null;
create index inventory_movements_to_warehouse_idx on public.inventory_movements (to_warehouse_id) where to_warehouse_id is not null;
create index labor_records_activity_type_idx on public.labor_records (activity_type_id) where activity_type_id is not null;
create index machinery_usage_activity_type_idx on public.machinery_usage (activity_type_id) where activity_type_id is not null;
create index machinery_usage_operator_idx on public.machinery_usage (operator_id) where operator_id is not null;
create index machinery_maintenance_responsible_idx on public.machinery_maintenance (responsible_id) where responsible_id is not null;
create index machinery_responsible_idx on public.machinery (responsible_id) where responsible_id is not null;
create index crews_leader_idx on public.crews (leader_id) where leader_id is not null;
create index employee_assignments_crew_idx on public.employee_assignments (crew_id) where crew_id is not null;
create index cash_movements_project_idx on public.cash_movements (project_id) where project_id is not null;
create index cash_movements_supplier_idx on public.cash_movements (supplier_id) where supplier_id is not null;
create index expenses_supplier_idx on public.expenses (supplier_id) where supplier_id is not null;
create index production_movements_sale_item_idx on public.production_movements (sale_item_id) where sale_item_id is not null;
create index project_budgets_crop_idx on public.project_budgets (crop_id) where crop_id is not null;
create index warehouses_farm_idx on public.warehouses (farm_id) where farm_id is not null;

-- -----------------------------------------------------------------------------
-- Privilegios de funciones
-- -----------------------------------------------------------------------------
revoke execute on function
  public.check_plan_projects(),
  public.check_plan_users(),
  public.check_plan_storage(),
  public.organization_usage(uuid),
  public.save_offline_submission(uuid, uuid, public.offline_record_type, timestamptz, jsonb, text,
    public.offline_submission_status, uuid, text),
  public.discard_offline_submission(uuid, text)
from public, anon;

revoke execute on function
  public.check_plan_projects(),
  public.check_plan_users(),
  public.check_plan_storage()
from authenticated;

grant execute on function
  public.organization_usage(uuid),
  public.save_offline_submission(uuid, uuid, public.offline_record_type, timestamptz, jsonb, text,
    public.offline_submission_status, uuid, text),
  public.discard_offline_submission(uuid, text)
to authenticated;
