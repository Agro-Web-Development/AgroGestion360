-- =============================================================================
-- AgroGestión 360 · Migración 0001 · Núcleo multiempresa
-- Organizaciones, perfiles, membresías con roles, invitaciones y auditoría.
-- Toda escritura sensible (crear organización, invitar, cambiar roles) se hace
-- mediante funciones RPC transaccionales; las tablas solo exponen lectura vía RLS.
-- =============================================================================

create extension if not exists citext with schema extensions;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.app_role as enum (
  'propietario',
  'administrador',
  'agronomo',
  'supervisor',
  'almacen',
  'finanzas',
  'consulta'
);

create type public.membership_status as enum ('activo', 'inactivo');

create type public.invitation_status as enum ('pendiente', 'aceptada', 'cancelada');

-- -----------------------------------------------------------------------------
-- Funciones utilitarias de triggers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 2 and 120),
  legal_name  text check (char_length(legal_name) <= 200),
  rfc         text check (rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'),
  email       extensions.citext,
  phone       text check (char_length(phone) <= 30),
  address     text check (char_length(address) <= 300),
  timezone    text not null default 'America/Mexico_City',
  currency    char(3) not null default 'MXN',
  plan        text not null default 'gratuito',
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);

comment on column public.organizations.is_demo is
  'Organización con datos ficticios de demostración; nunca mezclar con datos reales.';

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       extensions.citext not null,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  phone       text check (char_length(phone) <= 30),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);

create unique index profiles_email_key on public.profiles (email);

create table public.memberships (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  role             public.app_role not null default 'consulta',
  status           public.membership_status not null default 'activo',
  created_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  unique (organization_id, user_id)
);

create index memberships_user_idx on public.memberships (user_id) where status = 'activo';

create table public.invitations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  email            extensions.citext not null,
  role             public.app_role not null,
  status           public.invitation_status not null default 'pendiente',
  expires_at       timestamptz not null default now() + interval '14 days',
  accepted_at      timestamptz,
  created_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  check (role <> 'propietario')
);

create unique index invitations_pending_key
  on public.invitations (organization_id, email)
  where status = 'pendiente';
create index invitations_email_idx on public.invitations (email) where status = 'pendiente';

create table public.audit_logs (
  id               bigint generated always as identity primary key,
  organization_id  uuid references public.organizations (id) on delete cascade,
  table_name       text not null,
  record_id        uuid,
  action           text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data         jsonb,
  new_data         jsonb,
  actor_id         uuid,
  created_at       timestamptz not null default now()
);

create index audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);
create index audit_logs_record_idx on public.audit_logs (table_name, record_id);

-- -----------------------------------------------------------------------------
-- Triggers de campos de auditoría (updated_at / updated_by)
-- -----------------------------------------------------------------------------
create trigger organizations_set_updated before update on public.organizations
  for each row execute function public.set_updated_fields();
create trigger profiles_set_updated before update on public.profiles
  for each row execute function public.set_updated_fields();
create trigger memberships_set_updated before update on public.memberships
  for each row execute function public.set_updated_fields();
create trigger invitations_set_updated before update on public.invitations
  for each row execute function public.set_updated_fields();

-- -----------------------------------------------------------------------------
-- Bitácora de auditoría genérica. Se reutiliza en todas las tablas de negocio.
-- -----------------------------------------------------------------------------
create or replace function public.log_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_org uuid;
begin
  v_org := case
    when tg_table_name = 'organizations' then (v_row ->> 'id')::uuid
    else (v_row ->> 'organization_id')::uuid
  end;

  insert into public.audit_logs (organization_id, table_name, record_id, action, old_data, new_data, actor_id)
  values (
    v_org,
    tg_table_name,
    (v_row ->> 'id')::uuid,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return null;
end;
$$;

create trigger organizations_audit after insert or update or delete on public.organizations
  for each row execute function public.log_audit();
create trigger memberships_audit after insert or update or delete on public.memberships
  for each row execute function public.log_audit();
create trigger invitations_audit after insert or update or delete on public.invitations
  for each row execute function public.log_audit();

-- -----------------------------------------------------------------------------
-- Funciones de autorización (SECURITY DEFINER para evitar recursión en RLS)
-- -----------------------------------------------------------------------------
create or replace function public.is_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = p_org
      and m.user_id = auth.uid()
      and m.status = 'activo'
  );
$$;

create or replace function public.has_role(p_org uuid, p_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = p_org
      and m.user_id = auth.uid()
      and m.status = 'activo'
      and m.role = any (p_roles)
  );
$$;

create or replace function public.user_role(p_org uuid)
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.memberships m
  where m.organization_id = p_org
    and m.user_id = auth.uid()
    and m.status = 'activo';
$$;

create or replace function public.shares_organization(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid()
      and mine.status = 'activo'
      and theirs.user_id = p_user
  );
$$;

-- -----------------------------------------------------------------------------
-- Alta de usuarios: crea el perfil y acepta invitaciones pendientes
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));

  insert into public.memberships (organization_id, user_id, role, created_by)
  select i.organization_id, new.id, i.role, i.created_by
  from public.invitations i
  where i.email = new.email::extensions.citext
    and i.status = 'pendiente'
    and i.expires_at > now()
  on conflict (organization_id, user_id) do nothing;

  update public.invitations
  set status = 'aceptada', accepted_at = now()
  where email = new.email::extensions.citext
    and status = 'pendiente'
    and expires_at > now();

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- RPC: crear organización (organización + membresía de propietario, atómico)
-- -----------------------------------------------------------------------------
create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  if p_name is null or char_length(trim(p_name)) < 2 then
    raise exception 'El nombre de la organización es obligatorio' using errcode = '22023';
  end if;

  insert into public.organizations (name, created_by, updated_by)
  values (trim(p_name), v_uid, v_uid)
  returning id into v_org;

  insert into public.memberships (organization_id, user_id, role, created_by, updated_by)
  values (v_org, v_uid, 'propietario', v_uid, v_uid);

  return v_org;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: invitar miembro. Si el correo ya tiene cuenta se agrega directamente;
-- si no, se registra una invitación que se acepta automáticamente al registrarse.
-- Devuelve 'agregado' | 'invitado'.
-- -----------------------------------------------------------------------------
create or replace function public.invite_member(p_org uuid, p_email text, p_role public.app_role)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email extensions.citext := lower(trim(p_email));
  v_target uuid;
begin
  if not public.has_role(p_org, array['propietario', 'administrador']::public.app_role[]) then
    raise exception 'No tienes permiso para invitar usuarios' using errcode = '42501';
  end if;
  if p_role = 'propietario' then
    raise exception 'El rol de propietario solo se asigna cambiando el rol de un miembro existente'
      using errcode = '22023';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Correo electrónico no válido' using errcode = '22023';
  end if;

  select id into v_target from public.profiles where email = v_email;

  if v_target is not null then
    if exists (
      select 1 from public.memberships
      where organization_id = p_org and user_id = v_target and status = 'activo'
    ) then
      raise exception 'El usuario ya es miembro de la organización' using errcode = '23505';
    end if;

    insert into public.memberships (organization_id, user_id, role, created_by, updated_by)
    values (p_org, v_target, p_role, v_uid, v_uid)
    on conflict (organization_id, user_id)
      do update set role = excluded.role, status = 'activo';
    return 'agregado';
  end if;

  insert into public.invitations (organization_id, email, role, created_by, updated_by)
  values (p_org, v_email, p_role, v_uid, v_uid)
  on conflict (organization_id, email) where status = 'pendiente'
    do update set role = excluded.role, expires_at = now() + interval '14 days';
  return 'invitado';
end;
$$;

create or replace function public.cancel_invitation(p_invitation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.invitations
  where id = p_invitation and status = 'pendiente';

  if v_org is null then
    raise exception 'Invitación no encontrada o ya procesada' using errcode = 'P0002';
  end if;
  if not public.has_role(v_org, array['propietario', 'administrador']::public.app_role[]) then
    raise exception 'No tienes permiso para cancelar invitaciones' using errcode = '42501';
  end if;

  update public.invitations set status = 'cancelada' where id = p_invitation;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: cambiar rol o estado de un miembro.
-- Reglas: solo propietario/administrador; un administrador no puede modificar
-- propietarios ni otorgar el rol de propietario; siempre debe quedar al menos
-- un propietario activo; nadie puede desactivarse a sí mismo.
-- -----------------------------------------------------------------------------
create or replace function public.update_member(
  p_membership uuid,
  p_role public.app_role,
  p_status public.membership_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_m public.memberships%rowtype;
  v_caller public.app_role;
begin
  select * into v_m from public.memberships where id = p_membership for update;
  if not found then
    raise exception 'Miembro no encontrado' using errcode = 'P0002';
  end if;

  v_caller := public.user_role(v_m.organization_id);
  if v_caller is null or v_caller not in ('propietario', 'administrador') then
    raise exception 'No tienes permiso para administrar usuarios' using errcode = '42501';
  end if;
  if v_caller = 'administrador' and (v_m.role = 'propietario' or p_role = 'propietario') then
    raise exception 'Solo un propietario puede administrar propietarios' using errcode = '42501';
  end if;
  if v_m.user_id = v_uid and p_status = 'inactivo' then
    raise exception 'No puedes desactivar tu propia cuenta' using errcode = '22023';
  end if;

  if v_m.role = 'propietario' and v_m.status = 'activo'
     and (p_role <> 'propietario' or p_status <> 'activo') then
    perform 1 from public.memberships
    where organization_id = v_m.organization_id and role = 'propietario' and status = 'activo'
    for update;
    if (select count(*) from public.memberships
        where organization_id = v_m.organization_id
          and role = 'propietario' and status = 'activo') <= 1 then
      raise exception 'La organización debe conservar al menos un propietario activo'
        using errcode = '22023';
    end if;
  end if;

  update public.memberships
  set role = p_role, status = p_status
  where id = p_membership;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles      enable row level security;
alter table public.memberships   enable row level security;
alter table public.invitations   enable row level security;
alter table public.audit_logs    enable row level security;

-- organizations: lectura para miembros; edición para propietario/administrador.
create policy "organizations_select_members" on public.organizations
  for select to authenticated using (public.is_member(id));
create policy "organizations_update_admins" on public.organizations
  for update to authenticated
  using (public.has_role(id, array['propietario', 'administrador']::public.app_role[]))
  with check (public.has_role(id, array['propietario', 'administrador']::public.app_role[]));

-- profiles: el propio perfil y los de compañeros de organización.
create policy "profiles_select_self_or_peers" on public.profiles
  for select to authenticated using (id = auth.uid() or public.shares_organization(id));
create policy "profiles_update_self" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- memberships: lectura para miembros de la organización (escritura solo por RPC).
create policy "memberships_select_members" on public.memberships
  for select to authenticated using (public.is_member(organization_id));

-- invitations: solo administradores (escritura solo por RPC).
create policy "invitations_select_admins" on public.invitations
  for select to authenticated
  using (public.has_role(organization_id, array['propietario', 'administrador']::public.app_role[]));

-- audit_logs: solo propietario/administrador.
create policy "audit_logs_select_admins" on public.audit_logs
  for select to authenticated
  using (public.has_role(organization_id, array['propietario', 'administrador']::public.app_role[]));

-- -----------------------------------------------------------------------------
-- Privilegios
-- -----------------------------------------------------------------------------
revoke all on public.organizations, public.profiles, public.memberships,
  public.invitations, public.audit_logs from anon;

revoke insert, update, delete on public.organizations, public.profiles, public.memberships,
  public.invitations, public.audit_logs from authenticated;
grant select on public.organizations, public.profiles, public.memberships,
  public.invitations, public.audit_logs to authenticated;

-- Columnas editables directamente por el cliente (el resto solo por RPC/trigger).
grant update (name, legal_name, rfc, email, phone, address, timezone)
  on public.organizations to authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

revoke execute on function
  public.create_organization(text),
  public.invite_member(uuid, text, public.app_role),
  public.cancel_invitation(uuid),
  public.update_member(uuid, public.app_role, public.membership_status),
  public.is_member(uuid),
  public.has_role(uuid, public.app_role[]),
  public.user_role(uuid),
  public.shares_organization(uuid)
from public, anon;

grant execute on function
  public.create_organization(text),
  public.invite_member(uuid, text, public.app_role),
  public.cancel_invitation(uuid),
  public.update_member(uuid, public.app_role, public.membership_status),
  public.is_member(uuid),
  public.has_role(uuid, public.app_role[]),
  public.user_role(uuid),
  public.shares_organization(uuid)
to authenticated;

revoke execute on function public.handle_new_user(), public.handle_user_email_change(),
  public.log_audit() from public, anon, authenticated;
