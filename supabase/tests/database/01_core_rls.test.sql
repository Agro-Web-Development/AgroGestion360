-- Pruebas de aislamiento multiempresa y permisos del núcleo.
-- Ejecutar con: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

-- -----------------------------------------------------------------------------
-- Preparación (como superusuario): 3 usuarios, 2 organizaciones
--   A = propietario de Org A · B = propietario de Org B · C = consulta en Org A
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('10000000-0000-4000-a000-00000000000a', 'a@test.mx', 'authenticated', 'authenticated', '{"full_name":"Usuario A"}'),
  ('10000000-0000-4000-a000-00000000000b', 'b@test.mx', 'authenticated', 'authenticated', '{"full_name":"Usuario B"}'),
  ('10000000-0000-4000-a000-00000000000c', 'c@test.mx', 'authenticated', 'authenticated', '{"full_name":"Usuario C"}');

select is(
  (select count(*)::int from public.profiles where email in ('a@test.mx', 'b@test.mx', 'c@test.mx')),
  3, 'El trigger de alta crea un perfil por usuario');

insert into public.organizations (id, name) values
  ('20000000-0000-4000-a000-00000000000a', 'Org A'),
  ('20000000-0000-4000-a000-00000000000b', 'Org B');

insert into public.memberships (id, organization_id, user_id, role) values
  ('30000000-0000-4000-a000-00000000000a', '20000000-0000-4000-a000-00000000000a', '10000000-0000-4000-a000-00000000000a', 'propietario'),
  ('30000000-0000-4000-a000-00000000000b', '20000000-0000-4000-a000-00000000000b', '10000000-0000-4000-a000-00000000000b', 'propietario'),
  ('30000000-0000-4000-a000-00000000000c', '20000000-0000-4000-a000-00000000000a', '10000000-0000-4000-a000-00000000000c', 'consulta');

-- -----------------------------------------------------------------------------
-- Anónimo
-- -----------------------------------------------------------------------------
set local role anon;
select throws_ok(
  'select * from public.organizations', '42501', null,
  'Un usuario anónimo no puede leer organizaciones');
select throws_ok(
  $$select public.create_organization('X')$$, '42501', null,
  'Un usuario anónimo no puede crear organizaciones');

-- -----------------------------------------------------------------------------
-- Usuario A (propietario de Org A)
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);

select results_eq(
  'select name from public.organizations order by name',
  array['Org A'],
  'A solo ve su propia organización');
select is(
  (select count(*)::int from public.memberships where organization_id = '20000000-0000-4000-a000-00000000000b'),
  0, 'A no ve las membresías de Org B');
select is(
  (select count(*)::int from public.profiles where email = 'b@test.mx'),
  0, 'A no ve perfiles de usuarios de otras organizaciones');

update public.organizations set name = 'Org B hackeada' where id = '20000000-0000-4000-a000-00000000000b';
select throws_ok(
  $$insert into public.memberships (organization_id, user_id, role)
    values ('20000000-0000-4000-a000-00000000000b', '10000000-0000-4000-a000-00000000000a', 'propietario')$$,
  '42501', null, 'A no puede insertarse directamente en otra organización');
select throws_ok(
  $$select public.invite_member('20000000-0000-4000-a000-00000000000b', 'x@test.mx', 'administrador')$$,
  '42501', null, 'A no puede invitar usuarios a Org B');

select lives_ok(
  $$update public.organizations set name = 'Org A Renombrada' where id = '20000000-0000-4000-a000-00000000000a'$$,
  'El propietario puede editar su organización');
select throws_ok(
  $$select public.update_member('30000000-0000-4000-a000-00000000000a', 'administrador', 'activo')$$,
  '22023', null, 'No se puede quitar el último propietario');
select throws_ok(
  $$select public.invite_member('20000000-0000-4000-a000-00000000000a', 'c@test.mx', 'agronomo')$$,
  '23505', null, 'No se puede invitar a quien ya es miembro activo');
select is(
  public.invite_member('20000000-0000-4000-a000-00000000000a', 'nuevo@test.mx', 'agronomo'),
  'invitado', 'Un correo sin cuenta genera una invitación pendiente');
select isnt_empty(
  $$select 1 from public.audit_logs where organization_id = '20000000-0000-4000-a000-00000000000a'$$,
  'El propietario ve la bitácora de auditoría de su organización');

select ok(public.create_organization('Org A2') is not null, 'create_organization devuelve el id');
select is(
  (select role::text from public.memberships m join public.organizations o on o.id = m.organization_id
   where o.name = 'Org A2' and m.user_id = '10000000-0000-4000-a000-00000000000a'),
  'propietario', 'Quien crea una organización queda como propietario');

-- -----------------------------------------------------------------------------
-- Usuario C (consulta en Org A)
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-a000-00000000000c","role":"authenticated"}', true);

update public.organizations set name = 'Cambio indebido' where id = '20000000-0000-4000-a000-00000000000a';
select throws_ok(
  $$select public.invite_member('20000000-0000-4000-a000-00000000000a', 'z@test.mx', 'administrador')$$,
  '42501', null, 'Un usuario de consulta no puede invitar');
select throws_ok(
  $$select public.update_member('30000000-0000-4000-a000-00000000000c', 'administrador', 'activo')$$,
  '42501', null, 'Un usuario de consulta no puede elevar su propio rol');
select is_empty(
  'select 1 from public.audit_logs',
  'Un usuario de consulta no ve la auditoría');
select is_empty(
  'select 1 from public.invitations',
  'Un usuario de consulta no ve las invitaciones');

-- -----------------------------------------------------------------------------
-- Verificaciones finales (como superusuario)
-- -----------------------------------------------------------------------------
reset role;

select is(
  (select name from public.organizations where id = '20000000-0000-4000-a000-00000000000b'),
  'Org B', 'Org B no fue modificada por A');
select is(
  (select name from public.organizations where id = '20000000-0000-4000-a000-00000000000a'),
  'Org A Renombrada', 'El usuario de consulta no pudo modificar Org A');

insert into auth.users (id, email, aud, role)
values ('10000000-0000-4000-a000-00000000000d', 'nuevo@test.mx', 'authenticated', 'authenticated');
select is(
  (select role::text from public.memberships
   where user_id = '10000000-0000-4000-a000-00000000000d'
     and organization_id = '20000000-0000-4000-a000-00000000000a'),
  'agronomo', 'Al registrarse, la invitación pendiente se convierte en membresía');

select * from finish();
rollback;
