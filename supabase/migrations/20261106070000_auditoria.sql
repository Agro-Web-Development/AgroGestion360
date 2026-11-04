-- =============================================================================
-- AgroGestión 360 · Migración 0008 · Correcciones de la auditoría integral
--
--   · Eliminar una organización con datos operativos fallaba: la cascada
--     disparaba las reglas de cada registro (proyecto vigente, lotes con ventas,
--     devolución de combustible, parcelas de proyectos cerrados) y la auditoría
--     intentaba guardar renglones de una organización que ya no existe. Ahora,
--     cuando la organización ya no existe en la misma operación, esas reglas se
--     omiten: la cascada borra todo y no deja huérfanos. Las reglas siguen
--     aplicando a cualquier otra eliminación.
-- =============================================================================

-- La organización se está eliminando (o ya no existe) en esta transacción.
create or replace function public.org_deleted(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.organizations where id = p_org);
$$;

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
  if tg_op = 'DELETE' and public.org_deleted(old.organization_id) then
    return old; -- cascada al eliminar la organización
  end if;
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

create or replace function public.before_harvest_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.org_deleted(old.organization_id) then
    return old; -- cascada al eliminar la organización (las evidencias también se eliminan)
  end if;
  if exists (select 1 from public.production_movements where harvest_id = old.id)
     or exists (select 1 from public.sale_items where harvest_id = old.id) then
    raise exception 'El lote % tiene ventas o ajustes registrados y no se elimina', old.lot_code using errcode = '22023';
  end if;
  delete from public.attachments where entity_type = 'harvest' and entity_id = old.id;
  return old;
end;
$$;

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
  ) and not public.org_deleted(old.organization_id) then
    raise exception 'El proyecto está cerrado o cancelado y no admite cambios de parcelas'
      using errcode = '22023';
  end if;
  return old;
end;
$$;

-- Eliminar un uso con combustible del almacén regresa el combustible (y su costo),
-- salvo que se esté eliminando toda la organización.
create or replace function public.after_machinery_usage_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.fuel_movement_id is not null and not public.org_deleted(old.organization_id) then
    perform public.process_inventory_reversal(gen_random_uuid(), old.fuel_movement_id, 'Se eliminó el uso de maquinaria');
  end if;
  return null;
end;
$$;

-- La auditoría de una organización se elimina con ella: no se registran los
-- renglones que borra la cascada (su organización ya no existe).
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
  if tg_op = 'DELETE' and v_org is not null and public.org_deleted(v_org) then
    return null;
  end if;

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

revoke execute on function public.org_deleted(uuid) from public, anon, authenticated;

-- Llaves foráneas. RESTRICT (y NO ACTION) se verifican al terminar cada paso de
-- la cascada, antes de que llegue a los registros que referencian el renglón
-- borrado (p. ej. un proyecto con partidas de venta), así que la organización
-- nunca se podía eliminar. Pasan a NO ACTION DEFERRABLE INITIALLY IMMEDIATE:
-- en la operación normal se verifican igual que antes (eliminar un catálogo o
-- un proyecto en uso se sigue rechazando con 23503) y solo la eliminación de
-- una organización las difiere al final de la transacción.
do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname, pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    where c.contype = 'f' and c.confdeltype = 'r' and c.connamespace = 'public'::regnamespace
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I %s', r.tbl, r.conname, replace(r.def, ' ON DELETE RESTRICT', ''));
  end loop;

  for r in
    select c.conrelid::regclass as tbl, c.conname
    from pg_constraint c
    where c.contype = 'f' and c.confdeltype = 'a' and not c.condeferrable and c.connamespace = 'public'::regnamespace
  loop
    execute format('alter table %s alter constraint %I deferrable initially immediate', r.tbl, r.conname);
  end loop;
end;
$$;

-- Los pagos solo referenciaban su venta: sin llave a la organización, la
-- cascada no los alcanzaba.
alter table public.payments
  add constraint payments_organization_id_fkey
  foreign key (organization_id) references public.organizations (id) on delete cascade;

create or replace function public.before_organization_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  set constraints all deferred;
  return old;
end;
$$;

create trigger organizations_before_delete before delete on public.organizations
  for each row execute function public.before_organization_delete();

revoke execute on function public.before_organization_delete() from public, anon, authenticated;
