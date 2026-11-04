-- Pruebas de la auditoría integral (migración 20261106070000_auditoria):
-- una organización con historial completo (inventario, maquinaria con
-- combustible, jornadas, cortes, venta con pago, gasto pagado, presupuesto y un
-- proyecto cerrado) se elimina en cascada sin dejar huérfanos, y las reglas que
-- se omiten en la cascada siguen aplicando a cualquier otra eliminación.
-- Ejecutar con: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- -----------------------------------------------------------------------------
-- Preparación: Org X (A propietario) con historial completo · Org Y (B).
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('18000000-0000-4000-a000-00000000000a', 'a8@test.mx', 'authenticated', 'authenticated'),
  ('18000000-0000-4000-a000-00000000000b', 'b8@test.mx', 'authenticated', 'authenticated');

insert into public.organizations (id, name) values
  ('28000000-0000-4000-a000-00000000000a', 'Audit X'),
  ('28000000-0000-4000-a000-00000000000b', 'Audit Y');
insert into public.memberships (organization_id, user_id, role) values
  ('28000000-0000-4000-a000-00000000000a', '18000000-0000-4000-a000-00000000000a', 'propietario'),
  ('28000000-0000-4000-a000-00000000000b', '18000000-0000-4000-a000-00000000000b', 'propietario');

insert into public.farms (id, organization_id, name) values
  ('38000000-0000-4000-a000-0000000000a1', '28000000-0000-4000-a000-00000000000a', 'Rancho X'),
  ('38000000-0000-4000-a000-0000000000b1', '28000000-0000-4000-a000-00000000000b', 'Rancho Y');
insert into public.plots (id, organization_id, farm_id, name, area_ha) values
  ('58000000-0000-4000-a000-0000000000a1', '28000000-0000-4000-a000-00000000000a', '38000000-0000-4000-a000-0000000000a1', 'X1', 10),
  ('58000000-0000-4000-a000-0000000000a2', '28000000-0000-4000-a000-00000000000a', '38000000-0000-4000-a000-0000000000a1', 'X2', 5),
  ('58000000-0000-4000-a000-0000000000b1', '28000000-0000-4000-a000-00000000000b', '38000000-0000-4000-a000-0000000000b1', 'Y1', 10);
insert into public.crops (id, organization_id, name) values
  ('48000000-0000-4000-a000-0000000000a1', '28000000-0000-4000-a000-00000000000a', 'Jitomate'),
  ('48000000-0000-4000-a000-0000000000b1', '28000000-0000-4000-a000-00000000000b', 'Maíz');
insert into public.projects (id, organization_id, name, crop_id, start_date) values
  ('68000000-0000-4000-a000-0000000000a1', '28000000-0000-4000-a000-00000000000a', 'Jitomate X',
   '48000000-0000-4000-a000-0000000000a1', public.mx_today() - 30),
  ('68000000-0000-4000-a000-0000000000a2', '28000000-0000-4000-a000-00000000000a', 'Cerrado X',
   '48000000-0000-4000-a000-0000000000a1', public.mx_today() - 30),
  ('68000000-0000-4000-a000-0000000000b1', '28000000-0000-4000-a000-00000000000b', 'Maíz Y',
   '48000000-0000-4000-a000-0000000000b1', public.mx_today() - 30);
insert into public.project_plots (organization_id, project_id, plot_id, assigned_area_ha) values
  ('28000000-0000-4000-a000-00000000000a', '68000000-0000-4000-a000-0000000000a1', '58000000-0000-4000-a000-0000000000a1', 10),
  ('28000000-0000-4000-a000-00000000000a', '68000000-0000-4000-a000-0000000000a2', '58000000-0000-4000-a000-0000000000a2', 5),
  ('28000000-0000-4000-a000-00000000000b', '68000000-0000-4000-a000-0000000000b1', '58000000-0000-4000-a000-0000000000b1', 10);
update public.projects set status = 'cosecha' where id = '68000000-0000-4000-a000-0000000000a1';
update public.projects set status = 'cerrado' where id = '68000000-0000-4000-a000-0000000000a2';
update public.projects set status = 'cosecha' where id = '68000000-0000-4000-a000-0000000000b1';

-- Historial de X registrado por su propietario con las RPC de la aplicación.
select set_config('request.jwt.claims', '{"sub":"18000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);

insert into public.inventory_products (id, organization_id, name, unit, category_id)
select '78000000-0000-4000-a000-0000000000a1', '28000000-0000-4000-a000-00000000000a', 'Semilla X', 'pieza', id
from public.inventory_categories where organization_id = '28000000-0000-4000-a000-00000000000a' and kind = 'semilla';
insert into public.inventory_products (id, organization_id, name, unit, category_id)
select '78000000-0000-4000-a000-0000000000a2', '28000000-0000-4000-a000-00000000000a', 'Diésel X', 'l', id
from public.inventory_categories where organization_id = '28000000-0000-4000-a000-00000000000a' and kind = 'combustible';

select public.register_inventory_movement('88000000-0000-4000-a000-000000000001', '78000000-0000-4000-a000-0000000000a1',
  'entrada', public.mx_today() - 20, 10, 100);
select public.register_inventory_movement('88000000-0000-4000-a000-000000000002', '78000000-0000-4000-a000-0000000000a2',
  'entrada', public.mx_today() - 20, 100, 25);
select public.register_inventory_movement('88000000-0000-4000-a000-000000000003', '78000000-0000-4000-a000-0000000000a1',
  'consumo', public.mx_today() - 10, 4, p_project => '68000000-0000-4000-a000-0000000000a1',
  p_plot => '58000000-0000-4000-a000-0000000000a1');

insert into public.machinery (id, organization_id, name, hourly_cost) values
  ('98000000-0000-4000-a000-0000000000a1', '28000000-0000-4000-a000-00000000000a', 'Tractor X', 500);
select public.register_machinery_usage('98000000-0000-4000-a000-000000000011', '98000000-0000-4000-a000-0000000000a1',
  '68000000-0000-4000-a000-0000000000a1', public.mx_today() - 9, 3, '58000000-0000-4000-a000-0000000000a1',
  p_fuel_quantity => 20, p_fuel_product => '78000000-0000-4000-a000-0000000000a2');

insert into public.labor_records (id, organization_id, project_id, plot_id, crew, work_date, activity, pay_type, quantity, unit_rate)
values ('a8000000-0000-4000-a000-000000000001', '28000000-0000-4000-a000-00000000000a', '68000000-0000-4000-a000-0000000000a1',
        '58000000-0000-4000-a000-0000000000a1', 'Cuadrilla', public.mx_today() - 8, 'Deshierbe', 'jornal', 5, 300);

insert into public.harvests (id, organization_id, project_id, plot_id, harvest_date, quality, quantity_kg) values
  ('b8000000-0000-4000-a000-000000000001', '28000000-0000-4000-a000-00000000000a', '68000000-0000-4000-a000-0000000000a1',
   '58000000-0000-4000-a000-0000000000a1', public.mx_today() - 5, 'primera', 1000);

insert into public.customers (id, organization_id, name) values
  ('c8000000-0000-4000-a000-000000000001', '28000000-0000-4000-a000-00000000000a', 'Cliente X');
select public.save_sale('d8000000-0000-4000-a000-000000000001', 'c8000000-0000-4000-a000-000000000001', public.mx_today() - 4,
  '[{"harvest_id": "b8000000-0000-4000-a000-000000000001", "unit": "kg", "quantity": 400, "unit_price": 15}]', p_confirm => true);
select public.register_payment('e8000000-0000-4000-a000-000000000001', 'd8000000-0000-4000-a000-000000000001',
  public.mx_today() - 2, 2000, 'transferencia');

select public.register_expense('f8000000-0000-4000-a000-000000000001', '28000000-0000-4000-a000-00000000000a',
  public.mx_today() - 6, 'energia', 'riego', 'Energía de bombeo', 900, 'directo',
  '[{"project_id": "68000000-0000-4000-a000-0000000000a1"}]',
  p_payment => '{"id": "f8000000-0000-4000-a000-000000000002", "method": "efectivo"}');
select public.save_budget('f8000000-0000-4000-a000-000000000003', '68000000-0000-4000-a000-0000000000a1',
  '[{"category": "semillas", "concept": "Semilla", "unit": "pieza", "quantity": 10, "unit_cost": 100}]',
  public.mx_today() - 30, public.mx_today() + 60);

select is((select count(*)::int from public.audit_logs where organization_id = '28000000-0000-4000-a000-00000000000a') > 10, true,
  'El historial completo de X quedó auditado');

-- -----------------------------------------------------------------------------
-- Las reglas siguen aplicando mientras la organización exista
-- -----------------------------------------------------------------------------
select throws_ok(
  $$delete from public.harvests where id = 'b8000000-0000-4000-a000-000000000001'$$,
  '22023', null, 'Un lote con ventas no se elimina');
select throws_ok(
  $$delete from public.project_plots where project_id = '68000000-0000-4000-a000-0000000000a2'$$,
  '22023', null, 'Las parcelas de un proyecto cerrado no se retiran');
select throws_ok(
  $$delete from public.crops where id = '48000000-0000-4000-a000-0000000000a1'$$,
  '23503', null, 'Un cultivo en uso no se elimina (llave NO ACTION, verificada al terminar la sentencia)');
select throws_ok(
  $$delete from public.sales where id = 'd8000000-0000-4000-a000-000000000001'$$,
  '23503', null, 'Una venta con pagos no se elimina');
select throws_ok(
  $$delete from public.projects where id = '68000000-0000-4000-a000-0000000000a1'$$,
  null, null, 'Un proyecto con registros no se elimina');
select is(
  (select count(*)::int from pg_constraint where contype = 'f' and confdeltype = 'r' and connamespace = 'public'::regnamespace), 0,
  'No quedan llaves ON DELETE RESTRICT');
select is(
  (select confdeltype from pg_constraint where conname = 'payments_organization_id_fkey'), 'c',
  'Los pagos se eliminan con su organización');

-- -----------------------------------------------------------------------------
-- Eliminación de la organización completa
-- -----------------------------------------------------------------------------
select lives_ok(
  $$delete from public.organizations where id = '28000000-0000-4000-a000-00000000000a'$$,
  'Se elimina una organización con historial completo');
select lives_ok($$set constraints all immediate$$, 'Las llaves diferidas se cumplen al terminar');

select is((
  select count(*)::int from (
    select organization_id from public.projects union all
    select organization_id from public.harvests union all
    select organization_id from public.sales union all
    select organization_id from public.payments union all
    select organization_id from public.expenses union all
    select organization_id from public.cash_movements union all
    select organization_id from public.inventory_movements union all
    select organization_id from public.machinery_usage union all
    select organization_id from public.labor_records union all
    select organization_id from public.project_budgets union all
    select organization_id from public.production_movements
  ) x where organization_id = '28000000-0000-4000-a000-00000000000a'), 0,
  'No quedan registros huérfanos de X');
select is((select count(*)::int from public.audit_logs where organization_id = '28000000-0000-4000-a000-00000000000a'), 0,
  'La auditoría de X se elimina con ella');
select is((select count(*)::int from public.projects where organization_id = '28000000-0000-4000-a000-00000000000b'), 1,
  'La otra organización no se ve afectada');
select is((select count(*)::int from public.audit_logs where table_name = 'organizations' and action = 'DELETE'
           and record_id = '28000000-0000-4000-a000-00000000000a'), 0,
  'La eliminación no deja renglones de auditoría que apunten a una organización inexistente');

select * from finish();
rollback;
