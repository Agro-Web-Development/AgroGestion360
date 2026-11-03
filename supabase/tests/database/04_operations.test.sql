-- Pruebas del control operativo: almacenes, lotes, transferencias, inmutabilidad
-- de movimientos, bitácoras, maquinaria (combustible y mantenimiento), personal
-- (asistencia y cuadrillas), evidencias y RLS.
-- Ejecutar con: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(86);

-- -----------------------------------------------------------------------------
-- Preparación: Org A (A propietario, G agrónomo, S supervisor, W almacén,
-- C consulta) · Org B (B propietario). Proyecto en desarrollo (12 ha en P1) y
-- un segundo proyecto que se cerrará.
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('13000000-0000-4000-a000-00000000000a', 'a4@test.mx', 'authenticated', 'authenticated'),
  ('13000000-0000-4000-a000-00000000000b', 'b4@test.mx', 'authenticated', 'authenticated'),
  ('13000000-0000-4000-a000-00000000000c', 'c4@test.mx', 'authenticated', 'authenticated'),
  ('13000000-0000-4000-a000-00000000000d', 'g4@test.mx', 'authenticated', 'authenticated'),
  ('13000000-0000-4000-a000-00000000000e', 'w4@test.mx', 'authenticated', 'authenticated'),
  ('13000000-0000-4000-a000-000000000005', 's4@test.mx', 'authenticated', 'authenticated');

insert into public.organizations (id, name) values
  ('23000000-0000-4000-a000-00000000000a', 'Ops A'),
  ('23000000-0000-4000-a000-00000000000b', 'Ops B');

insert into public.memberships (organization_id, user_id, role) values
  ('23000000-0000-4000-a000-00000000000a', '13000000-0000-4000-a000-00000000000a', 'propietario'),
  ('23000000-0000-4000-a000-00000000000b', '13000000-0000-4000-a000-00000000000b', 'propietario'),
  ('23000000-0000-4000-a000-00000000000a', '13000000-0000-4000-a000-00000000000c', 'consulta'),
  ('23000000-0000-4000-a000-00000000000a', '13000000-0000-4000-a000-00000000000d', 'agronomo'),
  ('23000000-0000-4000-a000-00000000000a', '13000000-0000-4000-a000-00000000000e', 'almacen'),
  ('23000000-0000-4000-a000-00000000000a', '13000000-0000-4000-a000-000000000005', 'supervisor');

-- Objeto de Storage en una ruta de otra organización (para probar la ruta de evidencias).
insert into storage.objects (bucket_id, name)
values ('evidencias', '23000000-0000-4000-a000-00000000000b/irrigation_log/c3000000-0000-4000-a000-000000000001/foto.jpg');

-- Id fijo del almacén general creado por el alta de la organización.
update public.warehouses set id = '83000000-0000-4000-a000-0000000000a1'
where organization_id = '23000000-0000-4000-a000-00000000000a';

insert into public.farms (id, organization_id, name) values
  ('33000000-0000-4000-a000-0000000000a1', '23000000-0000-4000-a000-00000000000a', 'Rancho A');
insert into public.plots (id, organization_id, farm_id, name, area_ha, irrigation_type) values
  ('53000000-0000-4000-a000-0000000000a1', '23000000-0000-4000-a000-00000000000a', '33000000-0000-4000-a000-0000000000a1', 'P1', 30, 'goteo'),
  ('53000000-0000-4000-a000-0000000000a2', '23000000-0000-4000-a000-00000000000a', '33000000-0000-4000-a000-0000000000a1', 'P2', 20, 'gravedad');
insert into public.crops (id, organization_id, name) values
  ('43000000-0000-4000-a000-0000000000a1', '23000000-0000-4000-a000-00000000000a', 'Jitomate');
insert into public.projects (id, organization_id, name, crop_id, start_date) values
  ('63000000-0000-4000-a000-0000000000a1', '23000000-0000-4000-a000-00000000000a', 'Jitomate OI',
   '43000000-0000-4000-a000-0000000000a1', public.mx_today() - 60),
  ('63000000-0000-4000-a000-0000000000a2', '23000000-0000-4000-a000-00000000000a', 'Proyecto cerrado',
   '43000000-0000-4000-a000-0000000000a1', public.mx_today() - 60);
insert into public.project_plots (organization_id, project_id, plot_id, assigned_area_ha) values
  ('23000000-0000-4000-a000-00000000000a', '63000000-0000-4000-a000-0000000000a1', '53000000-0000-4000-a000-0000000000a1', 12),
  ('23000000-0000-4000-a000-00000000000a', '63000000-0000-4000-a000-0000000000a2', '53000000-0000-4000-a000-0000000000a2', 5);
update public.projects set status = 'desarrollo' where id = '63000000-0000-4000-a000-0000000000a1';
update public.projects set status = 'cerrado' where id = '63000000-0000-4000-a000-0000000000a2';

insert into public.employees (id, organization_id, full_name, daily_wage) values
  ('73000000-0000-4000-a000-0000000000e1', '23000000-0000-4000-a000-00000000000a', 'Ana Pérez', 400),
  ('73000000-0000-4000-a000-0000000000e2', '23000000-0000-4000-a000-00000000000a', 'Luis Gómez', 350),
  ('73000000-0000-4000-a000-0000000000e3', '23000000-0000-4000-a000-00000000000a', 'Eva Ruiz', 350);

insert into public.inventory_products (id, organization_id, name, category_id, unit, track_lots)
select x.id, '23000000-0000-4000-a000-00000000000a', x.name, c.id, x.unit, x.track_lots
from (values
  ('93000000-0000-4000-a000-0000000000f1'::uuid, 'Fungicida X', 'agroquimico'::public.input_kind, 'l', true),
  ('93000000-0000-4000-a000-0000000000d1'::uuid, 'Diésel', 'combustible', 'l', false),
  ('93000000-0000-4000-a000-0000000000c1'::uuid, 'Semilla Y', 'semilla', 'kg', false)
) as x(id, name, kind, unit, track_lots)
join public.inventory_categories c on c.organization_id = '23000000-0000-4000-a000-00000000000a' and c.kind = x.kind;

-- -----------------------------------------------------------------------------
-- Catálogos iniciales
-- -----------------------------------------------------------------------------
select is(
  (select count(*)::int from public.inventory_categories where organization_id = '23000000-0000-4000-a000-00000000000a'),
  8, 'Una organización nueva recibe las 8 categorías iniciales');
select is(
  (select count(*)::int from public.activity_types where organization_id = '23000000-0000-4000-a000-00000000000a'),
  10, 'y las 10 actividades agrícolas iniciales');
select is(
  (select name from public.warehouses where organization_id = '23000000-0000-4000-a000-00000000000a'),
  'Almacén general', 'y su almacén general');

-- Los movimientos son inmutables incluso para el dueño de la base de datos.
select public.register_inventory_movement('a3000000-0000-4000-a000-000000000099', '93000000-0000-4000-a000-0000000000c1',
  'entrada', public.mx_today(), 1, 1)
from (select set_config('request.jwt.claims', '{"sub":"13000000-0000-4000-a000-00000000000a","role":"authenticated"}', true)) s;
select throws_ok(
  $$delete from public.inventory_movements where id = 'a3000000-0000-4000-a000-000000000099'$$,
  '42501', null, 'Un movimiento de inventario no se elimina físicamente');
select throws_ok(
  $$update public.inventory_movements set notes = 'x' where id = 'a3000000-0000-4000-a000-000000000099'$$,
  '42501', null, 'Ni se modifica');

set local role authenticated;

-- -----------------------------------------------------------------------------
-- Almacén: almacenes, lotes y transferencias
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"13000000-0000-4000-a000-00000000000e","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.warehouses (id, organization_id, name)
    values ('83000000-0000-4000-a000-0000000000b2', '23000000-0000-4000-a000-00000000000a', 'Bodega Norte')$$,
  'Almacén registra almacenes');
select throws_ok(
  $$select public.register_inventory_movement(gen_random_uuid(), '93000000-0000-4000-a000-0000000000f1', 'entrada',
      public.mx_today(), 100, 50, p_warehouse => '83000000-0000-4000-a000-0000000000a1')$$,
  '22023', null, 'Un producto con control por lotes exige lote en la entrada');
select lives_ok(
  $$select public.register_inventory_movement('a3000000-0000-4000-a000-000000000001', '93000000-0000-4000-a000-0000000000f1',
      'entrada', public.mx_today(), 100, 50, p_warehouse => '83000000-0000-4000-a000-0000000000a1',
      p_lot_number => 'L1', p_lot_expiry => public.mx_today() + 30)$$,
  'Entrada con lote nuevo y caducidad');
select is(
  (select expiry_date from public.inventory_lots where product_id = '93000000-0000-4000-a000-0000000000f1' and lot_number = 'L1'),
  public.mx_today() + 30, 'El lote se crea con su caducidad');
select throws_ok(
  $$select public.register_inventory_movement(gen_random_uuid(), '93000000-0000-4000-a000-0000000000f1', 'entrada',
      public.mx_today(), 5, 50, p_warehouse => '83000000-0000-4000-a000-0000000000a1',
      p_lot_number => 'l1', p_lot_expiry => public.mx_today() + 90)$$,
  '22023', null, 'El mismo lote no admite otra caducidad');
select throws_ok(
  $$select public.register_inventory_movement(gen_random_uuid(), '93000000-0000-4000-a000-0000000000d1', 'entrada',
      public.mx_today(), 1000, 20)$$,
  '22023', 'Selecciona el almacén', 'Con varios almacenes activos se exige el almacén');
select lives_ok(
  $$select public.register_inventory_movement('a3000000-0000-4000-a000-000000000002', '93000000-0000-4000-a000-0000000000d1',
      'entrada', public.mx_today(), 1000, 20, p_warehouse => '83000000-0000-4000-a000-0000000000a1')$$,
  'Entrada de 1,000 l de diésel a $20');
select lives_ok(
  $$select public.register_inventory_movement('a3000000-0000-4000-a000-000000000003', '93000000-0000-4000-a000-0000000000d1',
      'transferencia', public.mx_today(), 300, p_warehouse => '83000000-0000-4000-a000-0000000000a1',
      p_to_warehouse => '83000000-0000-4000-a000-0000000000b2')$$,
  'Transferencia de 300 l a la bodega norte');
select lives_ok(
  $$select public.register_inventory_movement('a3000000-0000-4000-a000-000000000003', '93000000-0000-4000-a000-0000000000d1',
      'transferencia', public.mx_today(), 300, p_warehouse => '83000000-0000-4000-a000-0000000000a1',
      p_to_warehouse => '83000000-0000-4000-a000-0000000000b2')$$,
  'Reintentar la transferencia no falla');
select results_eq(
  $$select w.name, b.quantity from public.inventory_balances b join public.warehouses w on w.id = b.warehouse_id
    where b.product_id = '93000000-0000-4000-a000-0000000000d1' order by w.name$$,
  $$values ('Almacén general'::text, 700.000::numeric(14,3)), ('Bodega Norte', 300.000)$$,
  'La transferencia mueve existencia entre almacenes (sin duplicarse)');
select results_eq(
  $$select stock, stock_value from public.inventory_products where id = '93000000-0000-4000-a000-0000000000d1'$$,
  $$values (1000.000::numeric(14,3), 20000.00::numeric(14,2))$$,
  'La transferencia no cambia la existencia total ni el valor del producto');
select throws_ok(
  $$select public.register_inventory_movement(gen_random_uuid(), '93000000-0000-4000-a000-0000000000d1', 'transferencia',
      public.mx_today(), 500, p_warehouse => '83000000-0000-4000-a000-0000000000b2',
      p_to_warehouse => '83000000-0000-4000-a000-0000000000a1')$$,
  '22023', null, 'No se transfiere más de lo que hay en el almacén de origen');
select throws_ok(
  $$select public.register_inventory_movement(gen_random_uuid(), '93000000-0000-4000-a000-0000000000d1', 'transferencia',
      public.mx_today(), 10, p_warehouse => '83000000-0000-4000-a000-0000000000a1',
      p_to_warehouse => '83000000-0000-4000-a000-0000000000a1')$$,
  '22023', null, 'El destino debe ser otro almacén');
select throws_ok(
  $$select public.register_inventory_movement(gen_random_uuid(), '93000000-0000-4000-a000-0000000000d1', 'consumo',
      public.mx_today(), 400, p_warehouse => '83000000-0000-4000-a000-0000000000b2',
      p_project => '63000000-0000-4000-a000-0000000000a1', p_plot => '53000000-0000-4000-a000-0000000000a1')$$,
  '22023', null, 'Sin existencias negativas por almacén aunque el total alcance');
select throws_ok(
  $$select public.register_inventory_movement(gen_random_uuid(), '93000000-0000-4000-a000-0000000000f1', 'consumo',
      public.mx_today(), 5, p_warehouse => '83000000-0000-4000-a000-0000000000a1',
      p_project => '63000000-0000-4000-a000-0000000000a1', p_plot => '53000000-0000-4000-a000-0000000000a1')$$,
  '22023', null, 'Una salida de un producto con lotes exige el lote');
select throws_ok(
  $$update public.warehouses set is_active = false where id = '83000000-0000-4000-a000-0000000000b2'$$,
  '22023', null, 'Un almacén con existencias no se desactiva');
select lives_ok(
  $$select public.reverse_inventory_movement(gen_random_uuid(), 'a3000000-0000-4000-a000-000000000003', 'Transferencia errónea')$$,
  'Una transferencia se anula con la transferencia inversa');
select is(
  (select quantity from public.inventory_balances
   where product_id = '93000000-0000-4000-a000-0000000000d1' and warehouse_id = '83000000-0000-4000-a000-0000000000a1'),
  1000.000::numeric(14,3), 'La anulación regresa la existencia al almacén de origen');

-- Lote caducado: se recibe y se da de baja como merma, pero no se consume.
select lives_ok(
  $$select public.register_inventory_movement('a3000000-0000-4000-a000-000000000004', '93000000-0000-4000-a000-0000000000f1',
      'entrada', public.mx_today(), 10, 50, p_warehouse => '83000000-0000-4000-a000-0000000000a1',
      p_lot_number => 'L0', p_lot_expiry => public.mx_today() - 1)$$,
  'Entrada de un lote ya caducado');
select throws_ok(
  $$select public.register_inventory_movement(gen_random_uuid(), '93000000-0000-4000-a000-0000000000f1', 'consumo',
      public.mx_today(), 10, p_warehouse => '83000000-0000-4000-a000-0000000000a1', p_lot_number => 'L0',
      p_project => '63000000-0000-4000-a000-0000000000a1', p_plot => '53000000-0000-4000-a000-0000000000a1')$$,
  '22023', null, 'Un lote caducado no se consume en campo');
select lives_ok(
  $$select public.register_inventory_movement(gen_random_uuid(), '93000000-0000-4000-a000-0000000000f1', 'ajuste_salida',
      public.mx_today(), 10, p_warehouse => '83000000-0000-4000-a000-0000000000a1', p_lot_number => 'L0',
      p_notes => 'Merma por caducidad')$$,
  'El lote caducado se da de baja como ajuste');
select throws_ok(
  $$update public.inventory_products set track_lots = false where id = '93000000-0000-4000-a000-0000000000f1'$$,
  '22023', null, 'El control por lotes no cambia con existencia');

-- -----------------------------------------------------------------------------
-- Aplicación de agroquímicos (supervisor): salida de almacén ligada
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"13000000-0000-4000-a000-000000000005","role":"authenticated"}', true);

select throws_ok(
  $$select public.register_inventory_movement(gen_random_uuid(), '93000000-0000-4000-a000-0000000000f1', 'entrada',
      public.mx_today(), 1, 1, p_warehouse => '83000000-0000-4000-a000-0000000000a1', p_lot_number => 'L1')$$,
  '42501', null, 'El supervisor no mueve inventario directamente');
select lives_ok(
  $$select public.register_chemical_application('b3000000-0000-4000-a000-000000000001', '63000000-0000-4000-a000-0000000000a1',
      '53000000-0000-4000-a000-0000000000a1', public.mx_today(), '93000000-0000-4000-a000-0000000000f1', 20, 10,
      p_warehouse => '83000000-0000-4000-a000-0000000000a1', p_lot_number => 'L1', p_reentry_hours => 24,
      p_preharvest_days => 7)$$,
  'El supervisor registra una aplicación que sale del almacén');
select lives_ok(
  $$select public.register_chemical_application('b3000000-0000-4000-a000-000000000001', '63000000-0000-4000-a000-0000000000a1',
      '53000000-0000-4000-a000-0000000000a1', public.mx_today(), '93000000-0000-4000-a000-0000000000f1', 20, 10,
      p_warehouse => '83000000-0000-4000-a000-0000000000a1', p_lot_number => 'L1')$$,
  'Reintentar la aplicación no falla');
select results_eq(
  $$select a.lot_number, m.quantity, m.total_cost
    from public.chemical_applications a join public.inventory_movements m on m.id = a.inventory_movement_id
    where a.id = 'b3000000-0000-4000-a000-000000000001'$$,
  $$values ('L1'::text, 20.000::numeric(14,3), 1000.00::numeric(14,2))$$,
  'La aplicación queda ligada a su consumo (lote y costo promedio)');
select results_eq(
  $$select (select count(*)::int from public.inventory_movements
             where project_id = '63000000-0000-4000-a000-0000000000a1' and movement_type = 'consumo'),
           (select stock from public.inventory_products where id = '93000000-0000-4000-a000-0000000000f1'),
           (select inputs_cost from public.v_project_costs where project_id = '63000000-0000-4000-a000-0000000000a1')$$,
  $$values (1, 80.000::numeric(14,3), 1000.00::numeric)$$,
  'Una sola salida: descuenta existencia y carga el costo al proyecto');
select throws_ok(
  $$select public.register_chemical_application(gen_random_uuid(), '63000000-0000-4000-a000-0000000000a1',
      '53000000-0000-4000-a000-0000000000a1', public.mx_today(), '93000000-0000-4000-a000-0000000000c1', 1, 1, false)$$,
  '22023', null, 'Solo se registran aplicaciones de agroquímicos, biológicos o fertilizantes');
select throws_ok(
  $$select public.register_chemical_application(gen_random_uuid(), '63000000-0000-4000-a000-0000000000a1',
      '53000000-0000-4000-a000-0000000000a1', public.mx_today(), '93000000-0000-4000-a000-0000000000f1', 1, 15, false)$$,
  '22023', null, 'La superficie tratada no excede la asignada al proyecto');
select lives_ok(
  $$update public.chemical_applications set notes = 'Viento en calma' where id = 'b3000000-0000-4000-a000-000000000001'$$,
  'Las observaciones de la aplicación se editan');

select set_config('request.jwt.claims', '{"sub":"13000000-0000-4000-a000-00000000000e","role":"authenticated"}', true);
select throws_ok(
  $$select public.reverse_inventory_movement(gen_random_uuid(),
      (select inventory_movement_id from public.chemical_applications where id = 'b3000000-0000-4000-a000-000000000001'),
      'Anular desde almacén')$$,
  '22023', null, 'El consumo de una aplicación no se anula desde el almacén');

select set_config('request.jwt.claims', '{"sub":"13000000-0000-4000-a000-000000000005","role":"authenticated"}', true);
select lives_ok(
  $$select public.cancel_chemical_application('b3000000-0000-4000-a000-000000000001', 'Aplicación suspendida por lluvia')$$,
  'Cancelar la aplicación');
select results_eq(
  $$select (select stock from public.inventory_products where id = '93000000-0000-4000-a000-0000000000f1'),
           (select inputs_cost from public.v_project_costs where project_id = '63000000-0000-4000-a000-0000000000a1')$$,
  $$values (100.000::numeric(14,3), 0.00::numeric)$$,
  'La cancelación regresa el producto y retira el costo del proyecto');
select results_eq(
  $$select kind, cancelled from public.v_project_timeline
    where project_id = '63000000-0000-4000-a000-0000000000a1' and kind in ('aplicacion', 'insumo')$$,
  $$values ('aplicacion'::text, true)$$,
  'La bitácora muestra la aplicación cancelada sin duplicar sus movimientos');
select throws_ok(
  $$update public.chemical_applications set notes = 'cambio' where id = 'b3000000-0000-4000-a000-000000000001'$$,
  '22023', null, 'Un registro cancelado ya no se edita');

-- -----------------------------------------------------------------------------
-- Riego y actividades (supervisor)
-- -----------------------------------------------------------------------------
select lives_ok(
  $$insert into public.irrigation_logs (id, organization_id, project_id, plot_id, log_date, start_time, end_time, water_m3)
    values ('c3000000-0000-4000-a000-000000000001', '23000000-0000-4000-a000-00000000000a', '63000000-0000-4000-a000-0000000000a1',
            '53000000-0000-4000-a000-0000000000a1', public.mx_today() - 1, '22:00', '02:00', 150)$$,
  'Riego nocturno sin sistema indicado');
select results_eq(
  $$select duration_minutes, irrigation_system::text from public.irrigation_logs where id = 'c3000000-0000-4000-a000-000000000001'$$,
  $$values (240, 'goteo'::text)$$,
  'La duración cruza la medianoche y el sistema se toma de la parcela');
select throws_ok(
  $$insert into public.irrigation_logs (id, organization_id, project_id, plot_id, log_date, start_time, end_time)
    values (gen_random_uuid(), '23000000-0000-4000-a000-00000000000a', '63000000-0000-4000-a000-0000000000a1',
            '53000000-0000-4000-a000-0000000000a1', public.mx_today() + 1, '06:00', '07:00')$$,
  '22023', null, 'Un riego no se registra en fecha futura');
select throws_ok(
  $$insert into public.irrigation_logs (id, organization_id, project_id, plot_id, log_date, start_time, end_time)
    values (gen_random_uuid(), '23000000-0000-4000-a000-00000000000a', '63000000-0000-4000-a000-0000000000a2',
            '53000000-0000-4000-a000-0000000000a2', public.mx_today(), '06:00', '07:00')$$,
  '22023', null, 'Un proyecto cerrado no admite bitácoras');
select throws_ok(
  $$insert into public.irrigation_logs (id, organization_id, project_id, plot_id, log_date, start_time, end_time)
    values (gen_random_uuid(), '23000000-0000-4000-a000-00000000000a', '63000000-0000-4000-a000-0000000000a1',
            '53000000-0000-4000-a000-0000000000a2', public.mx_today(), '06:00', '07:00')$$,
  '23503', null, 'La parcela del riego debe estar asignada al proyecto');
select lives_ok(
  $$select public.cancel_field_record('riego', 'c3000000-0000-4000-a000-000000000001', 'Captura duplicada')$$,
  'Cancelar un riego con motivo');
select throws_ok(
  $$select public.cancel_field_record('riego', 'c3000000-0000-4000-a000-000000000001', 'Otra vez')$$,
  '22023', null, 'Un riego se cancela una sola vez');
select throws_ok(
  $$delete from public.irrigation_logs where id = 'c3000000-0000-4000-a000-000000000001'$$,
  '42501', null, 'Las bitácoras no se eliminan, se cancelan');

select lives_ok(
  $$insert into public.field_activities (id, organization_id, project_id, plot_id, activity_type_id, activity_date, cost)
    values ('d3000000-0000-4000-a000-000000000001', '23000000-0000-4000-a000-00000000000a', '63000000-0000-4000-a000-0000000000a1',
            '53000000-0000-4000-a000-0000000000a1',
            (select id from public.activity_types where organization_id = '23000000-0000-4000-a000-00000000000a' and name = 'Poda'),
            public.mx_today(), 1500)$$,
  'Actividad con costo de servicio contratado');
select is(
  (select activities_cost from public.v_project_costs where project_id = '63000000-0000-4000-a000-0000000000a1'),
  1500.00::numeric, 'El costo de la actividad entra al costo del proyecto');
select lives_ok(
  $$select public.cancel_field_record('actividad', 'd3000000-0000-4000-a000-000000000001', 'Servicio no realizado')$$,
  'Cancelar la actividad');
select is(
  (select activities_cost from public.v_project_costs where project_id = '63000000-0000-4000-a000-0000000000a1'),
  0::numeric, 'Una actividad cancelada no suma costo');

-- -----------------------------------------------------------------------------
-- Maquinaria (agrónomo): combustible del almacén, jornadas y mantenimiento
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"13000000-0000-4000-a000-00000000000d","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.machinery (id, organization_id, name, hourly_cost, daily_rate, maintenance_interval_hours)
    values ('e3000000-0000-4000-a000-0000000000a1', '23000000-0000-4000-a000-00000000000a', 'Tractor T1', 500, 3000, 10)$$,
  'El agrónomo registra un equipo con tarifa por hora y por jornada');
select lives_ok(
  $$select public.register_machinery_usage('e4000000-0000-4000-a000-000000000001', 'e3000000-0000-4000-a000-0000000000a1',
      '63000000-0000-4000-a000-0000000000a1', public.mx_today(), 6, '53000000-0000-4000-a000-0000000000a1',
      p_fuel_quantity => 50, p_fuel_product => '93000000-0000-4000-a000-0000000000d1',
      p_fuel_warehouse => '83000000-0000-4000-a000-0000000000a1')$$,
  'Uso de 6 h con 50 l de diésel del almacén');
select results_eq(
  $$select machinery_cost, inputs_cost from public.v_project_costs where project_id = '63000000-0000-4000-a000-0000000000a1'$$,
  $$values (3000.00::numeric, 1000.00::numeric)$$,
  'La tarifa va a maquinaria y el diésel a insumos (sin contarlo dos veces)');
select throws_ok(
  $$select public.register_machinery_usage(gen_random_uuid(), 'e3000000-0000-4000-a000-0000000000a1',
      '63000000-0000-4000-a000-0000000000a1', public.mx_today(), 20)$$,
  '22023', null, 'Un equipo no excede 24 h por día');
select throws_ok(
  $$select public.register_machinery_usage(gen_random_uuid(), 'e3000000-0000-4000-a000-0000000000a1',
      '63000000-0000-4000-a000-0000000000a1', public.mx_today(), 1,
      p_fuel_quantity => 5, p_fuel_product => '93000000-0000-4000-a000-0000000000f1',
      p_fuel_warehouse => '83000000-0000-4000-a000-0000000000a1')$$,
  '22023', null, 'El combustible debe ser de la categoría combustibles');
select lives_ok(
  $$select public.register_machinery_usage('e4000000-0000-4000-a000-000000000002', 'e3000000-0000-4000-a000-0000000000a1',
      '63000000-0000-4000-a000-0000000000a1', public.mx_today() - 1, 9.5, p_rate_basis => 'jornada', p_jornadas => 1)$$,
  'Uso por jornada con la tarifa del equipo');
select is(
  (select amount from public.machinery_usage where id = 'e4000000-0000-4000-a000-000000000002'),
  3000.00::numeric(14,2), 'La jornada se cobra a la tarifa por jornada');
select lives_ok(
  $$delete from public.machinery_usage where id = 'e4000000-0000-4000-a000-000000000001'$$,
  'Eliminar el uso con combustible');
select results_eq(
  $$select (select stock from public.inventory_products where id = '93000000-0000-4000-a000-0000000000d1'),
           (select inputs_cost from public.v_project_costs where project_id = '63000000-0000-4000-a000-0000000000a1')$$,
  $$values (1000.000::numeric(14,3), 0.00::numeric)$$,
  'Al eliminar el uso, el combustible regresa al almacén y sale del costo');
select is(
  (select maintenance_alert from public.v_machinery_status where machine_id = 'e3000000-0000-4000-a000-0000000000a1'),
  'proximo', 'Con 9.5 de 10 h la alerta de mantenimiento es próxima');
select lives_ok(
  $$insert into public.machinery_maintenance (id, organization_id, machine_id, maintenance_date, kind, description, cost)
    values ('e5000000-0000-4000-a000-000000000001', '23000000-0000-4000-a000-00000000000a', 'e3000000-0000-4000-a000-0000000000a1',
            public.mx_today(), 'preventivo', 'Cambio de aceite y filtros', 5000)$$,
  'Registrar mantenimiento preventivo');
select results_eq(
  $$select (select maintenance_alert from public.v_machinery_status where machine_id = 'e3000000-0000-4000-a000-0000000000a1'),
           (select total_cost from public.v_project_costs where project_id = '63000000-0000-4000-a000-0000000000a1')$$,
  $$values ('al_dia'::text, 3000.00::numeric)$$,
  'El servicio reinicia la alerta y su costo no se carga al proyecto');
select lives_ok(
  $$update public.machinery set status = 'fuera_servicio' where id = 'e3000000-0000-4000-a000-0000000000a1'$$,
  'Marcar el equipo fuera de servicio');
select throws_ok(
  $$select public.register_machinery_usage(gen_random_uuid(), 'e3000000-0000-4000-a000-0000000000a1',
      '63000000-0000-4000-a000-0000000000a1', public.mx_today() - 2, 1)$$,
  '22023', null, 'Un equipo fuera de servicio no registra uso');

-- Cuadrilla
select lives_ok(
  $$insert into public.crews (id, organization_id, name) values
      ('f3000000-0000-4000-a000-0000000000c1', '23000000-0000-4000-a000-00000000000a', 'Cuadrilla 1');
    insert into public.crew_members (organization_id, crew_id, employee_id) values
      ('23000000-0000-4000-a000-00000000000a', 'f3000000-0000-4000-a000-0000000000c1', '73000000-0000-4000-a000-0000000000e1'),
      ('23000000-0000-4000-a000-00000000000a', 'f3000000-0000-4000-a000-0000000000c1', '73000000-0000-4000-a000-0000000000e3')$$,
  'El agrónomo integra una cuadrilla');

-- -----------------------------------------------------------------------------
-- Personal (supervisor): asistencia y jornadas coherentes
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"13000000-0000-4000-a000-000000000005","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.attendance_records (organization_id, employee_id, work_date, status)
    values ('23000000-0000-4000-a000-00000000000a', '73000000-0000-4000-a000-0000000000e2', public.mx_today(), 'falta')$$,
  'Registrar una falta');
select throws_ok(
  $$insert into public.labor_records (organization_id, project_id, employee_id, work_date, activity, quantity)
    values ('23000000-0000-4000-a000-00000000000a', '63000000-0000-4000-a000-0000000000a1',
            '73000000-0000-4000-a000-0000000000e2', public.mx_today(), 'Deshierbe', 1)$$,
  '22023', null, 'No se registra jornal a un empleado con falta ese día');
select lives_ok(
  $$insert into public.labor_records (organization_id, project_id, employee_id, work_date, activity, quantity)
    values ('23000000-0000-4000-a000-00000000000a', '63000000-0000-4000-a000-0000000000a1',
            '73000000-0000-4000-a000-0000000000e1', public.mx_today(), 'Deshierbe', 1)$$,
  'Jornal de un empleado');
select is(
  (select status::text from public.attendance_records
   where employee_id = '73000000-0000-4000-a000-0000000000e1' and work_date = public.mx_today()),
  'presente', 'El jornal marca la asistencia del día');
select throws_ok(
  $$update public.attendance_records set status = 'falta'
    where employee_id = '73000000-0000-4000-a000-0000000000e1' and work_date = public.mx_today()$$,
  '22023', null, 'No se marca falta a quien tiene trabajo registrado');
select is(
  public.register_crew_labor('f4000000-0000-4000-a000-000000000001', 'f3000000-0000-4000-a000-0000000000c1',
    '63000000-0000-4000-a000-0000000000a1', public.mx_today() - 2, 'Amarre', 1),
  2, 'La cuadrilla registra una jornada por integrante');
select is(
  public.register_crew_labor('f4000000-0000-4000-a000-000000000001', 'f3000000-0000-4000-a000-0000000000c1',
    '63000000-0000-4000-a000-0000000000a1', public.mx_today() - 2, 'Amarre', 1)
  + (select count(*)::int from public.labor_records where batch_id = 'f4000000-0000-4000-a000-000000000001'),
  4, 'Reintentar el registro de cuadrilla no duplica jornadas');
select throws_ok(
  $$select public.register_crew_labor(gen_random_uuid(), 'f3000000-0000-4000-a000-0000000000c1',
      '63000000-0000-4000-a000-0000000000a1', public.mx_today() - 2, 'Amarre', 1)$$,
  '22023', null, 'La cuadrilla no repite jornal el mismo día');

-- Evidencias: la fila exige el archivo en Storage y una ruta coherente.
select throws_ok(
  $$insert into public.attachments (organization_id, entity_type, entity_id, storage_path, file_name, mime_type, size_bytes)
    values ('23000000-0000-4000-a000-00000000000a', 'irrigation_log', 'c3000000-0000-4000-a000-000000000001',
            '23000000-0000-4000-a000-00000000000a/irrigation_log/c3000000-0000-4000-a000-000000000001/foto.jpg',
            'foto.jpg', 'image/jpeg', 1000)$$,
  '22023', null, 'No se registra una evidencia sin archivo cargado');
select throws_ok(
  $$insert into public.attachments (organization_id, entity_type, entity_id, storage_path, file_name, mime_type, size_bytes)
    values ('23000000-0000-4000-a000-00000000000a', 'irrigation_log', 'c3000000-0000-4000-a000-000000000001',
            '23000000-0000-4000-a000-00000000000b/irrigation_log/c3000000-0000-4000-a000-000000000001/foto.jpg',
            'foto.jpg', 'image/jpeg', 1000)$$,
  '23514', null, 'La ruta de la evidencia debe ser de la organización y del registro');
select throws_ok(
  $$insert into public.warehouses (organization_id, name) values ('23000000-0000-4000-a000-00000000000a', 'Bodega S')$$,
  '42501', null, 'El supervisor no administra almacenes');

-- -----------------------------------------------------------------------------
-- Permisos y aislamiento
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"13000000-0000-4000-a000-00000000000c","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.irrigation_logs (id, organization_id, project_id, plot_id, log_date, start_time, end_time)
    values (gen_random_uuid(), '23000000-0000-4000-a000-00000000000a', '63000000-0000-4000-a000-0000000000a1',
            '53000000-0000-4000-a000-0000000000a1', public.mx_today(), '06:00', '07:00')$$,
  '42501', null, 'Consulta no registra riegos');
select throws_ok(
  $$select public.register_chemical_application(gen_random_uuid(), '63000000-0000-4000-a000-0000000000a1',
      '53000000-0000-4000-a000-0000000000a1', public.mx_today(), '93000000-0000-4000-a000-0000000000f1', 1, 1, false)$$,
  '42501', null, 'Consulta no registra aplicaciones');
select isnt_empty(
  $$select 1 from public.v_project_timeline where project_id = '63000000-0000-4000-a000-0000000000a1'$$,
  'Consulta ve la bitácora del proyecto');

select set_config('request.jwt.claims', '{"sub":"13000000-0000-4000-a000-00000000000e","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.field_activities (id, organization_id, project_id, activity_type_id, activity_date)
    values (gen_random_uuid(), '23000000-0000-4000-a000-00000000000a', '63000000-0000-4000-a000-0000000000a1',
            (select id from public.activity_types where organization_id = '23000000-0000-4000-a000-00000000000a' limit 1),
            public.mx_today())$$,
  '42501', null, 'Almacén no registra actividades de campo');

select set_config('request.jwt.claims', '{"sub":"13000000-0000-4000-a000-00000000000b","role":"authenticated"}', true);
select is_empty(
  $$select 1 from public.warehouses where organization_id = '23000000-0000-4000-a000-00000000000a'
    union all select 1 from public.inventory_balances where organization_id = '23000000-0000-4000-a000-00000000000a'
    union all select 1 from public.chemical_applications where organization_id = '23000000-0000-4000-a000-00000000000a'
    union all select 1 from public.irrigation_logs where organization_id = '23000000-0000-4000-a000-00000000000a'
    union all select 1 from public.v_project_timeline where organization_id = '23000000-0000-4000-a000-00000000000a'$$,
  'Otra organización no ve almacenes, existencias ni bitácoras ajenas');
select throws_ok(
  $$select public.register_inventory_movement(gen_random_uuid(), '93000000-0000-4000-a000-0000000000d1', 'entrada',
      public.mx_today(), 1, 1)$$,
  'P0002', null, 'Otra organización no mueve productos ajenos');
select throws_ok(
  $$select public.cancel_field_record('actividad', 'd3000000-0000-4000-a000-000000000001', 'Intento ajeno')$$,
  'P0002', null, 'Otra organización no cancela registros ajenos');
select throws_ok(
  $$insert into public.irrigation_logs (id, organization_id, project_id, plot_id, log_date, start_time, end_time)
    values (gen_random_uuid(), '23000000-0000-4000-a000-00000000000b', '63000000-0000-4000-a000-0000000000a1',
            '53000000-0000-4000-a000-0000000000a1', public.mx_today(), '06:00', '07:00')$$,
  'P0002', null, 'No se registra una bitácora sobre un proyecto de otra organización');

select * from finish();
rollback;
