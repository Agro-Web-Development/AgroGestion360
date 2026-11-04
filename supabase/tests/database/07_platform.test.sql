-- Pruebas de la Fase 6: observaciones de campo, bitácora de sincronización sin
-- conexión (idempotencia, conflictos, revisión), límites por plan, política de
-- eliminación de Storage y separación de organizaciones.
-- Ejecutar con: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(45);

-- -----------------------------------------------------------------------------
-- Preparación: Org A (A propietario, G agrónomo, S supervisor, C consulta,
-- F finanzas) · Org B (B propietario). P1 en desarrollo con la parcela PA.
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('15000000-0000-4000-a000-00000000000a', 'a7@test.mx', 'authenticated', 'authenticated'),
  ('15000000-0000-4000-a000-00000000000b', 'b7@test.mx', 'authenticated', 'authenticated'),
  ('15000000-0000-4000-a000-00000000000c', 'c7@test.mx', 'authenticated', 'authenticated'),
  ('15000000-0000-4000-a000-00000000000d', 'g7@test.mx', 'authenticated', 'authenticated'),
  ('15000000-0000-4000-a000-00000000000e', 's7@test.mx', 'authenticated', 'authenticated'),
  ('15000000-0000-4000-a000-00000000000f', 'f7@test.mx', 'authenticated', 'authenticated');

insert into public.organizations (id, name) values
  ('25000000-0000-4000-a000-00000000000a', 'Plat A'),
  ('25000000-0000-4000-a000-00000000000b', 'Plat B');

insert into public.memberships (organization_id, user_id, role) values
  ('25000000-0000-4000-a000-00000000000a', '15000000-0000-4000-a000-00000000000a', 'propietario'),
  ('25000000-0000-4000-a000-00000000000b', '15000000-0000-4000-a000-00000000000b', 'propietario'),
  ('25000000-0000-4000-a000-00000000000a', '15000000-0000-4000-a000-00000000000c', 'consulta'),
  ('25000000-0000-4000-a000-00000000000a', '15000000-0000-4000-a000-00000000000d', 'agronomo'),
  ('25000000-0000-4000-a000-00000000000a', '15000000-0000-4000-a000-00000000000e', 'supervisor'),
  ('25000000-0000-4000-a000-00000000000a', '15000000-0000-4000-a000-00000000000f', 'finanzas');

insert into public.farms (id, organization_id, name) values
  ('35000000-0000-4000-a000-0000000000a1', '25000000-0000-4000-a000-00000000000a', 'Rancho A'),
  ('35000000-0000-4000-a000-0000000000b1', '25000000-0000-4000-a000-00000000000b', 'Rancho B');
insert into public.plots (id, organization_id, farm_id, name, area_ha) values
  ('55000000-0000-4000-a000-0000000000a1', '25000000-0000-4000-a000-00000000000a', '35000000-0000-4000-a000-0000000000a1', 'PA', 10),
  ('55000000-0000-4000-a000-0000000000a2', '25000000-0000-4000-a000-00000000000a', '35000000-0000-4000-a000-0000000000a1', 'PA-libre', 5),
  ('55000000-0000-4000-a000-0000000000b1', '25000000-0000-4000-a000-00000000000b', '35000000-0000-4000-a000-0000000000b1', 'PB', 10);
insert into public.crops (id, organization_id, name) values
  ('45000000-0000-4000-a000-0000000000a1', '25000000-0000-4000-a000-00000000000a', 'Brócoli'),
  ('45000000-0000-4000-a000-0000000000b1', '25000000-0000-4000-a000-00000000000b', 'Maíz');
insert into public.projects (id, organization_id, name, crop_id, start_date) values
  ('65000000-0000-4000-a000-0000000000a1', '25000000-0000-4000-a000-00000000000a', 'Brócoli A',
   '45000000-0000-4000-a000-0000000000a1', public.mx_today() - 30),
  ('65000000-0000-4000-a000-0000000000b1', '25000000-0000-4000-a000-00000000000b', 'Maíz B',
   '45000000-0000-4000-a000-0000000000b1', public.mx_today() - 30);
insert into public.project_plots (organization_id, project_id, plot_id, assigned_area_ha) values
  ('25000000-0000-4000-a000-00000000000a', '65000000-0000-4000-a000-0000000000a1', '55000000-0000-4000-a000-0000000000a1', 10),
  ('25000000-0000-4000-a000-00000000000b', '65000000-0000-4000-a000-0000000000b1', '55000000-0000-4000-a000-0000000000b1', 10);
update public.projects set status = 'desarrollo'
where id in ('65000000-0000-4000-a000-0000000000a1', '65000000-0000-4000-a000-0000000000b1');

insert into storage.objects (bucket_id, name, owner_id) values
  ('evidencias', '25000000-0000-4000-a000-00000000000a/field_observation/a5000000-0000-4000-a000-000000000001/foto.jpg',
   '15000000-0000-4000-a000-00000000000e'),
  ('evidencias', '25000000-0000-4000-a000-00000000000a/field_observation/a5000000-0000-4000-a000-000000000001/foto2.jpg',
   '15000000-0000-4000-a000-00000000000e'),
  ('evidencias', '25000000-0000-4000-a000-00000000000a/payment/a5000000-0000-4000-a000-000000000099/recibo.pdf',
   '15000000-0000-4000-a000-00000000000f');

set local role authenticated;

-- -----------------------------------------------------------------------------
-- Observaciones de campo
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"15000000-0000-4000-a000-00000000000e","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.field_observations (id, organization_id, project_id, plot_id, observation_date, category, severity, title)
    values ('a5000000-0000-4000-a000-000000000001', '25000000-0000-4000-a000-00000000000a',
      '65000000-0000-4000-a000-0000000000a1', '55000000-0000-4000-a000-0000000000a1', public.mx_today(), 'plaga', 'alta',
      'Pulgón en el lote norte')$$,
  'El supervisor registra una observación');

select throws_ok(
  $$insert into public.field_observations (id, organization_id, project_id, observation_date, category, title)
    values (gen_random_uuid(), '25000000-0000-4000-a000-00000000000a', '65000000-0000-4000-a000-0000000000a1',
      public.mx_today() + 1, 'clima', 'Granizo')$$,
  '22023', null, 'Una observación no puede tener fecha futura');

select throws_ok(
  $$insert into public.field_observations (id, organization_id, project_id, plot_id, observation_date, category, title)
    values (gen_random_uuid(), '25000000-0000-4000-a000-00000000000a', '65000000-0000-4000-a000-0000000000a1',
      '55000000-0000-4000-a000-0000000000a2', public.mx_today(), 'maleza', 'Maleza')$$,
  '23503', null, 'La parcela debe estar asignada al proyecto');

select throws_ok(
  $$insert into public.field_observations (id, organization_id, project_id, observation_date, category, title, latitude)
    values (gen_random_uuid(), '25000000-0000-4000-a000-00000000000a', '65000000-0000-4000-a000-0000000000a1',
      public.mx_today(), 'otro', 'Sin longitud', 20.5)$$,
  '23514', null, 'Latitud y longitud van juntas');

select lives_ok(
  $$insert into public.attachments (organization_id, entity_type, entity_id, storage_path, file_name, mime_type, size_bytes)
    values ('25000000-0000-4000-a000-00000000000a', 'field_observation', 'a5000000-0000-4000-a000-000000000001',
      '25000000-0000-4000-a000-00000000000a/field_observation/a5000000-0000-4000-a000-000000000001/foto.jpg',
      'foto.jpg', 'image/jpeg', 2048)$$,
  'Las observaciones admiten evidencias fotográficas');

select throws_ok(
  $$insert into public.field_observations (id, organization_id, project_id, observation_date, category, title)
    values (gen_random_uuid(), '25000000-0000-4000-a000-00000000000b', '65000000-0000-4000-a000-0000000000b1',
      public.mx_today(), 'plaga', 'Intruso')$$,
  '42501', null, 'No se registran observaciones en otra organización');

select set_config('request.jwt.claims', '{"sub":"15000000-0000-4000-a000-00000000000c","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.field_observations (id, organization_id, project_id, observation_date, category, title)
    values (gen_random_uuid(), '25000000-0000-4000-a000-00000000000a', '65000000-0000-4000-a000-0000000000a1',
      public.mx_today(), 'plaga', 'Consulta')$$,
  '42501', null, 'Consulta no registra observaciones');
select is((select count(*)::int from public.field_observations), 1, 'Consulta sí lee las observaciones de su organización');

select set_config('request.jwt.claims', '{"sub":"15000000-0000-4000-a000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.field_observations), 0, 'Otra organización no ve las observaciones');
select is((select count(*)::int from public.attachments where entity_type = 'field_observation'), 0,
  'Otra organización no ve las evidencias');

select set_config('request.jwt.claims', '{"sub":"15000000-0000-4000-a000-00000000000e","role":"authenticated"}', true);
select lives_ok(
  $$select public.cancel_field_record('observacion', 'a5000000-0000-4000-a000-000000000001', 'Captura duplicada')$$,
  'La observación se cancela con motivo');
select throws_ok(
  $$update public.field_observations set title = 'Cambio' where id = 'a5000000-0000-4000-a000-000000000001'$$,
  '22023', null, 'Una observación cancelada ya no se edita');

-- -----------------------------------------------------------------------------
-- Bitácora de sincronización sin conexión
-- -----------------------------------------------------------------------------
select is(
  public.save_offline_submission('b5000000-0000-4000-a000-000000000001', '25000000-0000-4000-a000-00000000000a', 'riego',
    now() - interval '2 hours', '{"x":1}', repeat('a', 64), 'requiere_revision', null, 'La parcela no está asignada'),
  'requiere_revision', 'Un rechazo de negocio queda en revisión');
select is(
  (select attempts from public.offline_submissions where id = 'b5000000-0000-4000-a000-000000000001'), 1,
  'Primer intento registrado');

select is(
  public.save_offline_submission('b5000000-0000-4000-a000-000000000001', '25000000-0000-4000-a000-00000000000a', 'riego',
    now() - interval '2 hours', '{"x":2}', repeat('b', 64), 'sincronizado', 'b5000000-0000-4000-a000-000000000001'),
  'sincronizado', 'El reintento corregido se sincroniza');
select ok(
  (select synced_at is not null and attempts = 2 and last_error is null from public.offline_submissions
   where id = 'b5000000-0000-4000-a000-000000000001'),
  'Se registra la fecha de sincronización y se limpia el error');

select is(
  public.save_offline_submission('b5000000-0000-4000-a000-000000000001', '25000000-0000-4000-a000-00000000000a', 'riego',
    now() - interval '2 hours', '{"x":2}', repeat('b', 64), 'sincronizado', 'b5000000-0000-4000-a000-000000000001'),
  'sincronizado', 'Reenviar lo mismo es idempotente');
select is(
  public.save_offline_submission('b5000000-0000-4000-a000-000000000001', '25000000-0000-4000-a000-00000000000a', 'riego',
    now() - interval '2 hours', '{"x":3}', repeat('c', 64), 'sincronizado', 'b5000000-0000-4000-a000-000000000001'),
  'conflicto', 'Reenviar otro contenido con el mismo id es un conflicto');
select is(
  (select payload ->> 'x' from public.offline_submissions where id = 'b5000000-0000-4000-a000-000000000001'), '2',
  'El conflicto no modifica lo sincronizado');

select throws_ok(
  $$select public.save_offline_submission(gen_random_uuid(), '25000000-0000-4000-a000-00000000000a', 'riego', now(), '{}',
      repeat('a', 64), 'descartado')$$,
  '42501', null, 'El dispositivo no puede descartar');
select throws_ok(
  $$select public.save_offline_submission(gen_random_uuid(), '25000000-0000-4000-a000-00000000000b', 'riego', now(), '{}',
      repeat('a', 64), 'requiere_revision')$$,
  '42501', null, 'No se registran envíos en una organización ajena');
select throws_ok(
  $$insert into public.offline_submissions (id, organization_id, user_id, record_type, captured_at, payload, payload_hash, status)
    values (gen_random_uuid(), '25000000-0000-4000-a000-00000000000a', '15000000-0000-4000-a000-00000000000e', 'riego', now(),
      '{}', repeat('a', 64), 'requiere_revision')$$,
  '42501', null, 'Sin escrituras directas a la bitácora de sincronización');

select public.save_offline_submission('b5000000-0000-4000-a000-000000000002', '25000000-0000-4000-a000-00000000000a', 'cosecha',
  now() - interval '1 day', '{"y":1}', repeat('d', 64), 'requiere_revision', null, 'Proyecto cerrado');
select throws_ok(
  $$select public.discard_offline_submission('b5000000-0000-4000-a000-000000000002', 'No procede')$$,
  '42501', null, 'El supervisor no revisa registros');

-- Otro miembro no puede usar el id de un envío ajeno.
select set_config('request.jwt.claims', '{"sub":"15000000-0000-4000-a000-00000000000d","role":"authenticated"}', true);
select throws_ok(
  $$select public.save_offline_submission('b5000000-0000-4000-a000-000000000002', '25000000-0000-4000-a000-00000000000a',
      'cosecha', now(), '{}', repeat('e', 64), 'sincronizado', gen_random_uuid())$$,
  '42501', null, 'Un envío pertenece a quien lo capturó');
select is((select count(*)::int from public.offline_submissions), 2, 'El agrónomo revisa los envíos de toda la organización');
select throws_ok(
  $$select public.discard_offline_submission('b5000000-0000-4000-a000-000000000001', 'Ya estaba sincronizado')$$,
  '22023', null, 'Solo se descarta lo que requiere revisión');
select throws_ok(
  $$select public.discard_offline_submission('b5000000-0000-4000-a000-000000000002', 'no')$$,
  '22023', null, 'Descartar exige motivo');
select lives_ok(
  $$select public.discard_offline_submission('b5000000-0000-4000-a000-000000000002', 'El proyecto ya se cerró; no procede')$$,
  'El agrónomo descarta un registro en conflicto');

select set_config('request.jwt.claims', '{"sub":"15000000-0000-4000-a000-00000000000e","role":"authenticated"}', true);
select is(
  public.save_offline_submission('b5000000-0000-4000-a000-000000000002', '25000000-0000-4000-a000-00000000000a', 'cosecha',
    now() - interval '1 day', '{"y":1}', repeat('d', 64), 'sincronizado', gen_random_uuid()),
  'descartado', 'El dispositivo ve que su registro fue descartado y no lo sobrescribe');

select set_config('request.jwt.claims', '{"sub":"15000000-0000-4000-a000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.offline_submissions), 0, 'Consulta no ve envíos de otros usuarios');
select set_config('request.jwt.claims', '{"sub":"15000000-0000-4000-a000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.offline_submissions), 0, 'Otra organización no ve los envíos');

-- -----------------------------------------------------------------------------
-- Planes y límites
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"15000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);
select is(public.organization_usage('25000000-0000-4000-a000-00000000000a') ->> 'plan_code', 'piloto',
  'Las organizaciones nacen en el plan piloto');
select is((public.organization_usage('25000000-0000-4000-a000-00000000000a') ->> 'users')::int, 5, 'Uso: usuarios activos');
select throws_ok(
  $$select public.organization_usage('25000000-0000-4000-a000-00000000000b')$$,
  'P0002', null, 'No se consulta el uso de otra organización');
select throws_ok(
  $$update public.organizations set plan_code = 'piloto' where id = '25000000-0000-4000-a000-00000000000a'$$,
  '42501', null, 'El propietario no cambia su plan desde la aplicación');
select throws_ok(
  $$insert into public.plans (code, name) values ('gratis', 'Gratis')$$,
  '42501', null, 'Los usuarios no crean planes');

reset role;
insert into public.plans (code, name, max_projects, max_users, max_storage_mb)
values ('prueba', 'Prueba', 2, 6, 1);
update public.organizations set plan_code = 'prueba' where id = '25000000-0000-4000-a000-00000000000a';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"15000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.projects (organization_id, name, crop_id, start_date)
    values ('25000000-0000-4000-a000-00000000000a', 'Segundo', '45000000-0000-4000-a000-0000000000a1', public.mx_today())$$,
  'Dentro del límite de proyectos');
select throws_ok(
  $$insert into public.projects (organization_id, name, crop_id, start_date)
    values ('25000000-0000-4000-a000-00000000000a', 'Tercero', '45000000-0000-4000-a000-0000000000a1', public.mx_today())$$,
  'P0001', null, 'El plan limita los proyectos vigentes');

select is(public.invite_member('25000000-0000-4000-a000-00000000000a', 'nuevo7@test.mx', 'supervisor'), 'invitado',
  'La invitación reserva el último lugar');
select throws_ok(
  $$select public.invite_member('25000000-0000-4000-a000-00000000000a', 'otro7@test.mx', 'consulta')$$,
  'P0001', null, 'El plan limita los usuarios (activos + invitaciones)');
reset role;
insert into auth.users (id, email, aud, role)
values ('15000000-0000-4000-a000-000000000010', 'nuevo7@test.mx', 'authenticated', 'authenticated');
select is(
  (select status::text from public.memberships where user_id = '15000000-0000-4000-a000-000000000010'), 'activo',
  'La invitación reservada se acepta aunque el plan esté lleno');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"15000000-0000-4000-a000-00000000000e","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.attachments (organization_id, entity_type, entity_id, storage_path, file_name, mime_type, size_bytes)
    values ('25000000-0000-4000-a000-00000000000a', 'field_observation', 'a5000000-0000-4000-a000-000000000001',
      '25000000-0000-4000-a000-00000000000a/field_observation/a5000000-0000-4000-a000-000000000001/foto2.jpg',
      'foto2.jpg', 'image/jpeg', 1048576)$$,
  'P0001', null, 'El plan limita el almacenamiento');

-- -----------------------------------------------------------------------------
-- Eliminación en Storage (auditoría)
-- -----------------------------------------------------------------------------
select set_config('storage.allow_delete_query', 'true', true);

select set_config('request.jwt.claims', '{"sub":"15000000-0000-4000-a000-00000000000f","role":"authenticated"}', true);
delete from storage.objects where name like '%/payment/%';
select is((select count(*)::int from storage.objects where name like '%/payment/%'), 1,
  'Finanzas no borra del bucket el archivo de un comprobante (solo propietario/administrador)');

reset role;
update public.memberships set status = 'inactivo'
where user_id = '15000000-0000-4000-a000-00000000000e' and organization_id = '25000000-0000-4000-a000-00000000000a';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"15000000-0000-4000-a000-00000000000e","role":"authenticated"}', true);
delete from storage.objects where name like '%foto2.jpg';
reset role;
select is((select count(*)::int from storage.objects where name like '%foto2.jpg'), 1,
  'Quien ya no es miembro no borra los archivos que subió');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"15000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);
delete from storage.objects where name like '%foto2.jpg';
reset role;
select is((select count(*)::int from storage.objects where name like '%foto2.jpg'), 0,
  'El propietario sí puede retirar archivos');

select * from finish();
rollback;
