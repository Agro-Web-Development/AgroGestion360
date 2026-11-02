-- Pruebas de catálogos agrícolas y proyectos: aislamiento, permisos y reglas.
-- Ejecutar con: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(31);

-- -----------------------------------------------------------------------------
-- Preparación: Org A (A propietario, G agrónomo, C consulta) · Org B (B propietario)
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('11000000-0000-4000-a000-00000000000a', 'a2@test.mx', 'authenticated', 'authenticated'),
  ('11000000-0000-4000-a000-00000000000b', 'b2@test.mx', 'authenticated', 'authenticated'),
  ('11000000-0000-4000-a000-00000000000c', 'c2@test.mx', 'authenticated', 'authenticated'),
  ('11000000-0000-4000-a000-00000000000d', 'g2@test.mx', 'authenticated', 'authenticated');

insert into public.organizations (id, name) values
  ('21000000-0000-4000-a000-00000000000a', 'Agro A'),
  ('21000000-0000-4000-a000-00000000000b', 'Agro B');

insert into public.memberships (organization_id, user_id, role) values
  ('21000000-0000-4000-a000-00000000000a', '11000000-0000-4000-a000-00000000000a', 'propietario'),
  ('21000000-0000-4000-a000-00000000000b', '11000000-0000-4000-a000-00000000000b', 'propietario'),
  ('21000000-0000-4000-a000-00000000000a', '11000000-0000-4000-a000-00000000000c', 'consulta'),
  ('21000000-0000-4000-a000-00000000000a', '11000000-0000-4000-a000-00000000000d', 'agronomo');

-- Rancho y cultivo de Org B (para probar referencias cruzadas)
insert into public.farms (id, organization_id, name) values
  ('31000000-0000-4000-a000-0000000000b1', '21000000-0000-4000-a000-00000000000b', 'Rancho B');
insert into public.crops (id, organization_id, name) values
  ('41000000-0000-4000-a000-0000000000b1', '21000000-0000-4000-a000-00000000000b', 'Maíz B');

set local role authenticated;

-- -----------------------------------------------------------------------------
-- Agrónomo de Org A: altas y reglas de superficie
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-a000-00000000000d","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.farms (id, organization_id, name, total_area_ha)
    values ('31000000-0000-4000-a000-0000000000a1', '21000000-0000-4000-a000-00000000000a', 'El Mezquite', 50)$$,
  'El agrónomo puede registrar ranchos');
select throws_ok(
  $$insert into public.farms (organization_id, name) values ('21000000-0000-4000-a000-00000000000a', 'el mezquite')$$,
  '23505', null, 'El nombre del rancho es único por organización (sin distinguir mayúsculas)');
select lives_ok(
  $$insert into public.plots (id, organization_id, farm_id, name, area_ha) values
    ('51000000-0000-4000-a000-0000000000a1', '21000000-0000-4000-a000-00000000000a', '31000000-0000-4000-a000-0000000000a1', 'P1', 30),
    ('51000000-0000-4000-a000-0000000000a2', '21000000-0000-4000-a000-00000000000a', '31000000-0000-4000-a000-0000000000a1', 'P2', 20)$$,
  'El agrónomo puede registrar parcelas');
select throws_ok(
  $$insert into public.plots (organization_id, farm_id, name, area_ha)
    values ('21000000-0000-4000-a000-00000000000a', '31000000-0000-4000-a000-0000000000a1', 'P3', 0.5)$$,
  '22023', null, 'Las parcelas no pueden exceder la superficie del rancho');
select throws_ok(
  $$update public.farms set total_area_ha = 40 where id = '31000000-0000-4000-a000-0000000000a1'$$,
  '22023', null, 'La superficie del rancho no puede quedar por debajo de sus parcelas');
select throws_ok(
  $$insert into public.plots (organization_id, farm_id, name, area_ha)
    values ('21000000-0000-4000-a000-00000000000a', '31000000-0000-4000-a000-0000000000b1', 'Intrusa', 1)$$,
  null, null, 'No se puede crear una parcela en un rancho de otra organización');
select throws_ok(
  $$update public.farms set organization_id = '21000000-0000-4000-a000-00000000000b'
    where id = '31000000-0000-4000-a000-0000000000a1'$$,
  '42501', null, 'organization_id no es editable');

select lives_ok(
  $$insert into public.crops (id, organization_id, name, variety, yield_unit)
    values ('41000000-0000-4000-a000-0000000000a1', '21000000-0000-4000-a000-00000000000a', 'Jitomate', 'Saladette', 'caja')$$,
  'El agrónomo puede registrar cultivos');

-- -----------------------------------------------------------------------------
-- Proyectos
-- -----------------------------------------------------------------------------
select lives_ok(
  $$insert into public.projects (id, organization_id, name, crop_id, start_date, responsible_id)
    values ('61000000-0000-4000-a000-0000000000a1', '21000000-0000-4000-a000-00000000000a', 'Jitomate PV',
            '41000000-0000-4000-a000-0000000000a1', '2026-03-01', '11000000-0000-4000-a000-00000000000d')$$,
  'El agrónomo puede crear proyectos');
select matches(
  (select code from public.projects where id = '61000000-0000-4000-a000-0000000000a1'),
  '^PRY-\d{4}-0001$', 'El proyecto recibe un folio consecutivo');
select is(
  (select to_status::text from public.project_status_history where project_id = '61000000-0000-4000-a000-0000000000a1'),
  'planeacion', 'El alta registra el estado inicial en el historial');
select throws_ok(
  $$insert into public.projects (organization_id, name, crop_id, start_date)
    values ('21000000-0000-4000-a000-00000000000a', 'Cruzado', '41000000-0000-4000-a000-0000000000b1', '2026-03-01')$$,
  null, null, 'No se puede usar un cultivo de otra organización');
select throws_ok(
  $$insert into public.projects (organization_id, name, crop_id, start_date, responsible_id)
    values ('21000000-0000-4000-a000-00000000000a', 'Ajeno', '41000000-0000-4000-a000-0000000000a1', '2026-03-01',
            '11000000-0000-4000-a000-00000000000b')$$,
  '22023', null, 'El responsable debe pertenecer a la organización');
select throws_ok(
  $$insert into public.projects (organization_id, name, crop_id, start_date, planting_date)
    values ('21000000-0000-4000-a000-00000000000a', 'Fechas', '41000000-0000-4000-a000-0000000000a1', '2026-03-01', '2026-02-01')$$,
  '23514', null, 'La siembra no puede ser anterior al inicio');
select throws_ok(
  $$update public.projects set status = 'cerrado' where id = '61000000-0000-4000-a000-0000000000a1'$$,
  '42501', null, 'El estado solo cambia mediante la RPC');

select lives_ok(
  $$insert into public.project_plots (organization_id, project_id, plot_id, assigned_area_ha)
    values ('21000000-0000-4000-a000-00000000000a', '61000000-0000-4000-a000-0000000000a1', '51000000-0000-4000-a000-0000000000a1', 25)$$,
  'Se asigna superficie de una parcela al proyecto');

insert into public.projects (id, organization_id, name, crop_id, start_date)
values ('61000000-0000-4000-a000-0000000000a2', '21000000-0000-4000-a000-00000000000a', 'Segundo',
        '41000000-0000-4000-a000-0000000000a1', '2026-03-01');
select throws_ok(
  $$insert into public.project_plots (organization_id, project_id, plot_id, assigned_area_ha)
    values ('21000000-0000-4000-a000-00000000000a', '61000000-0000-4000-a000-0000000000a2', '51000000-0000-4000-a000-0000000000a1', 10)$$,
  '22023', null, 'No se puede asignar más superficie de la disponible en la parcela');
select throws_ok(
  $$update public.plots set area_ha = 20 where id = '51000000-0000-4000-a000-0000000000a1'$$,
  '22023', null, 'La parcela no puede reducirse por debajo de lo asignado');

select throws_ok(
  $$select public.change_project_status('61000000-0000-4000-a000-0000000000a1', 'cosecha')$$,
  '22023', null, 'No se permiten saltos de estado no definidos');
select lives_ok(
  $$select public.change_project_status('61000000-0000-4000-a000-0000000000a1', 'preparacion', 'Barbecho')$$,
  'El agrónomo avanza el estado del proyecto');
select is(
  (select note from public.project_status_history
   where project_id = '61000000-0000-4000-a000-0000000000a1' and to_status = 'preparacion'),
  'Barbecho', 'El historial guarda la nota del cambio');
select throws_ok(
  $$select public.change_project_status('61000000-0000-4000-a000-0000000000a1', 'cancelado')$$,
  '22023', null, 'Cancelar exige un motivo');
select lives_ok(
  $$select public.change_project_status('61000000-0000-4000-a000-0000000000a1', 'cancelado', 'Falta de agua')$$,
  'Se cancela con motivo');
select throws_ok(
  $$select public.change_project_status('61000000-0000-4000-a000-0000000000a1', 'planeacion')$$,
  '42501', null, 'El agrónomo no puede reabrir un proyecto cancelado');
select lives_ok(
  $$insert into public.project_plots (organization_id, project_id, plot_id, assigned_area_ha)
    values ('21000000-0000-4000-a000-00000000000a', '61000000-0000-4000-a000-0000000000a2', '51000000-0000-4000-a000-0000000000a1', 10)$$,
  'La superficie de un proyecto cancelado queda liberada');

delete from public.farms where id = '31000000-0000-4000-a000-0000000000a1';
select isnt_empty(
  $$select 1 from public.farms where id = '31000000-0000-4000-a000-0000000000a1'$$,
  'El agrónomo no puede eliminar ranchos');

-- -----------------------------------------------------------------------------
-- Propietario de Org A: reapertura y eliminación
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);

select throws_ok(
  $$select public.change_project_status('61000000-0000-4000-a000-0000000000a1', 'planeacion')$$,
  '22023', null, 'No se reabre si la superficie ya fue asignada a otro proyecto');
select throws_ok(
  $$delete from public.plots where id = '51000000-0000-4000-a000-0000000000a1'$$,
  '23503', null, 'No se elimina una parcela con proyectos');
select lives_ok(
  $$delete from public.projects where id = '61000000-0000-4000-a000-0000000000a1'$$,
  'El propietario elimina un proyecto cancelado (con sus asignaciones)');

-- -----------------------------------------------------------------------------
-- Consulta de Org A y propietario de Org B
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-a000-00000000000c","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.crops (organization_id, name) values ('21000000-0000-4000-a000-00000000000a', 'Chile')$$,
  '42501', null, 'Un usuario de consulta no puede registrar cultivos');

select set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-a000-00000000000b","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.projects where organization_id = '21000000-0000-4000-a000-00000000000a'),
  0, 'Otra organización no ve los proyectos de Org A');

select * from finish();
rollback;
