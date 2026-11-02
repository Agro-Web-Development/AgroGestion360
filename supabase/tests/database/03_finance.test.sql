-- Pruebas de costos, inventario, ventas y cobranza: idempotencia, ausencia de
-- duplicidad, transaccionalidad, congelamiento al cierre y permisos.
-- Ejecutar con: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(68);

-- -----------------------------------------------------------------------------
-- Preparación: Org A (A propietario, G agrónomo, W almacén, F finanzas,
-- C consulta) · Org B (B propietario). Proyecto en cosecha con dos parcelas
-- (25 + 10 = 35 ha) y una tercera parcela no asignada.
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('12000000-0000-4000-a000-00000000000a', 'a3@test.mx', 'authenticated', 'authenticated'),
  ('12000000-0000-4000-a000-00000000000b', 'b3@test.mx', 'authenticated', 'authenticated'),
  ('12000000-0000-4000-a000-00000000000c', 'c3@test.mx', 'authenticated', 'authenticated'),
  ('12000000-0000-4000-a000-00000000000d', 'g3@test.mx', 'authenticated', 'authenticated'),
  ('12000000-0000-4000-a000-00000000000e', 'w3@test.mx', 'authenticated', 'authenticated'),
  ('12000000-0000-4000-a000-00000000000f', 'f3@test.mx', 'authenticated', 'authenticated');

insert into public.organizations (id, name) values
  ('22000000-0000-4000-a000-00000000000a', 'Fin A'),
  ('22000000-0000-4000-a000-00000000000b', 'Fin B');

insert into public.memberships (organization_id, user_id, role) values
  ('22000000-0000-4000-a000-00000000000a', '12000000-0000-4000-a000-00000000000a', 'propietario'),
  ('22000000-0000-4000-a000-00000000000b', '12000000-0000-4000-a000-00000000000b', 'propietario'),
  ('22000000-0000-4000-a000-00000000000a', '12000000-0000-4000-a000-00000000000c', 'consulta'),
  ('22000000-0000-4000-a000-00000000000a', '12000000-0000-4000-a000-00000000000d', 'agronomo'),
  ('22000000-0000-4000-a000-00000000000a', '12000000-0000-4000-a000-00000000000e', 'almacen'),
  ('22000000-0000-4000-a000-00000000000a', '12000000-0000-4000-a000-00000000000f', 'finanzas');

insert into public.farms (id, organization_id, name) values
  ('32000000-0000-4000-a000-0000000000a1', '22000000-0000-4000-a000-00000000000a', 'Rancho A');
insert into public.plots (id, organization_id, farm_id, name, area_ha) values
  ('52000000-0000-4000-a000-0000000000a1', '22000000-0000-4000-a000-00000000000a', '32000000-0000-4000-a000-0000000000a1', 'P1', 30),
  ('52000000-0000-4000-a000-0000000000a2', '22000000-0000-4000-a000-00000000000a', '32000000-0000-4000-a000-0000000000a1', 'P2', 20),
  ('52000000-0000-4000-a000-0000000000a3', '22000000-0000-4000-a000-00000000000a', '32000000-0000-4000-a000-0000000000a1', 'P3', 10);
insert into public.crops (id, organization_id, name) values
  ('42000000-0000-4000-a000-0000000000a1', '22000000-0000-4000-a000-00000000000a', 'Brócoli');
insert into public.projects (id, organization_id, name, crop_id, start_date, budget_amount) values
  ('62000000-0000-4000-a000-0000000000a1', '22000000-0000-4000-a000-00000000000a', 'Brócoli OI',
   '42000000-0000-4000-a000-0000000000a1', public.mx_today() - 60, 20000);
insert into public.project_plots (organization_id, project_id, plot_id, assigned_area_ha) values
  ('22000000-0000-4000-a000-00000000000a', '62000000-0000-4000-a000-0000000000a1', '52000000-0000-4000-a000-0000000000a1', 25),
  ('22000000-0000-4000-a000-00000000000a', '62000000-0000-4000-a000-0000000000a1', '52000000-0000-4000-a000-0000000000a2', 10);
update public.projects set status = 'cosecha' where id = '62000000-0000-4000-a000-0000000000a1';

set local role authenticated;

-- -----------------------------------------------------------------------------
-- Almacén: inventario con costo promedio, idempotencia y anulaciones
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"12000000-0000-4000-a000-00000000000e","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.inventory_products (id, organization_id, name, category, unit)
    values ('72000000-0000-4000-a000-0000000000a1', '22000000-0000-4000-a000-00000000000a', 'Urea 46%', 'fertilizante', 'kg')$$,
  'Almacén registra productos');
select throws_ok(
  $$update public.inventory_products set stock = 999 where id = '72000000-0000-4000-a000-0000000000a1'$$,
  '42501', null, 'La existencia no se edita directamente');
select throws_ok(
  $$insert into public.inventory_movements (id, organization_id, product_id, movement_type, movement_date, quantity, total_cost, stock_after)
    values (gen_random_uuid(), '22000000-0000-4000-a000-00000000000a', '72000000-0000-4000-a000-0000000000a1', 'entrada', public.mx_today(), 1, 1, 1)$$,
  '42501', null, 'Los movimientos solo se registran por RPC');

select lives_ok(
  $$select public.register_inventory_movement('82000000-0000-4000-a000-000000000001', '72000000-0000-4000-a000-0000000000a1',
      'entrada', public.mx_today(), 100, 10, p_supplier => 'Fertilizantes del Bajío', p_reference => 'FAC-1')$$,
  'Entrada de 100 kg a $10');
select lives_ok(
  $$select public.register_inventory_movement('82000000-0000-4000-a000-000000000001', '72000000-0000-4000-a000-0000000000a1',
      'entrada', public.mx_today(), 100, 10)$$,
  'Reintentar con el mismo identificador no falla');
select is(
  (select stock::numeric from public.inventory_products where id = '72000000-0000-4000-a000-0000000000a1'),
  100.000, 'El reintento no duplica la entrada');
select throws_ok(
  $$select public.register_inventory_movement('82000000-0000-4000-a000-000000000001', '72000000-0000-4000-a000-0000000000a1',
      'entrada', public.mx_today(), 5, 10)$$,
  '23505', null, 'Un identificador ya usado con otros datos se rechaza');

select public.register_inventory_movement('82000000-0000-4000-a000-000000000002', '72000000-0000-4000-a000-0000000000a1',
  'entrada', public.mx_today(), 50, 13);
select results_eq(
  $$select stock, stock_value, avg_cost from public.inventory_products where id = '72000000-0000-4000-a000-0000000000a1'$$,
  $$values (150.000::numeric(14,3), 1650.00::numeric(14,2), 11.0000::numeric(14,4))$$,
  'Costo promedio ponderado: (1000 + 650) / 150 = $11');

select throws_ok(
  $$update public.inventory_products set unit = 'l' where id = '72000000-0000-4000-a000-0000000000a1'$$,
  '22023', null, 'Un producto con movimientos no cambia de unidad');
select throws_ok(
  $$select public.register_inventory_movement(gen_random_uuid(), '72000000-0000-4000-a000-0000000000a1', 'consumo', public.mx_today(), 10)$$,
  '22023', null, 'Un consumo exige proyecto y parcela');
select throws_ok(
  $$select public.register_inventory_movement(gen_random_uuid(), '72000000-0000-4000-a000-0000000000a1', 'consumo', public.mx_today(), 10,
      p_project => '62000000-0000-4000-a000-0000000000a1', p_plot => '52000000-0000-4000-a000-0000000000a3')$$,
  '22023', null, 'La parcela del consumo debe estar asignada al proyecto');
select throws_ok(
  $$select public.register_inventory_movement(gen_random_uuid(), '72000000-0000-4000-a000-0000000000a1', 'entrada', public.mx_today(), 10, 5,
      p_project => '62000000-0000-4000-a000-0000000000a1', p_plot => '52000000-0000-4000-a000-0000000000a1')$$,
  '22023', null, 'Una entrada (compra) no se imputa a un proyecto');

select public.register_inventory_movement('82000000-0000-4000-a000-000000000003', '72000000-0000-4000-a000-0000000000a1',
  'consumo', public.mx_today(), 30, 999,
  p_project => '62000000-0000-4000-a000-0000000000a1', p_plot => '52000000-0000-4000-a000-0000000000a1');
select is(
  (select total_cost::numeric from public.inventory_movements where id = '82000000-0000-4000-a000-000000000003'),
  330.00, 'El consumo se valora al costo promedio e ignora un costo manual');
select throws_ok(
  $$select public.register_inventory_movement(gen_random_uuid(), '72000000-0000-4000-a000-0000000000a1', 'consumo', public.mx_today(), 500,
      p_project => '62000000-0000-4000-a000-0000000000a1', p_plot => '52000000-0000-4000-a000-0000000000a1')$$,
  '22023', null, 'No se consume más de la existencia');

select public.register_inventory_movement('82000000-0000-4000-a000-000000000004', '72000000-0000-4000-a000-0000000000a1',
  'devolucion', public.mx_today(), 10,
  p_project => '62000000-0000-4000-a000-0000000000a1', p_plot => '52000000-0000-4000-a000-0000000000a1');
select is(
  (select total_cost::numeric from public.inventory_movements where id = '82000000-0000-4000-a000-000000000004'),
  110.00, 'La devolución regresa al costo con que se consumió');
select throws_ok(
  $$select public.register_inventory_movement(gen_random_uuid(), '72000000-0000-4000-a000-0000000000a1', 'devolucion', public.mx_today(), 25,
      p_project => '62000000-0000-4000-a000-0000000000a1', p_plot => '52000000-0000-4000-a000-0000000000a1')$$,
  '22023', null, 'No se devuelve más de lo consumido por el proyecto');
select throws_ok(
  $$select public.reverse_inventory_movement(gen_random_uuid(), '82000000-0000-4000-a000-000000000003', 'Captura errónea')$$,
  '22023', null, 'No se anula un consumo que ya tuvo devoluciones');
select lives_ok(
  $$select public.reverse_inventory_movement('82000000-0000-4000-a000-000000000005', '82000000-0000-4000-a000-000000000004', 'Devolución duplicada')$$,
  'Se anula la devolución');
select throws_ok(
  $$select public.reverse_inventory_movement(gen_random_uuid(), '82000000-0000-4000-a000-000000000004', 'Otra vez')$$,
  '22023', null, 'Un movimiento solo se anula una vez');
select throws_ok(
  $$select public.reverse_inventory_movement(gen_random_uuid(), '82000000-0000-4000-a000-000000000005', 'Anular la anulación')$$,
  '22023', null, 'Una anulación no se anula');
select is(
  (select stock_value + (select sum(amount) from public.v_project_cost_entries where source = 'insumos'
                          and project_id = '62000000-0000-4000-a000-0000000000a1')
   from public.inventory_products where id = '72000000-0000-4000-a000-0000000000a1'),
  1650.00::numeric, 'Valor en almacén + costo imputado = compras (sin duplicar ni perder centavos)');

-- -----------------------------------------------------------------------------
-- Agrónomo: maquinaria, mano de obra y cosechas
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"12000000-0000-4000-a000-00000000000d","role":"authenticated"}', true);

select throws_ok(
  $$select public.register_inventory_movement(gen_random_uuid(), '72000000-0000-4000-a000-0000000000a1', 'entrada', public.mx_today(), 1, 1)$$,
  '42501', null, 'El agrónomo no mueve inventario');

insert into public.machinery (id, organization_id, name, hourly_cost)
values ('92000000-0000-4000-a000-0000000000a1', '22000000-0000-4000-a000-00000000000a', 'Tractor JD 6110', 500);
select lives_ok(
  $$insert into public.machinery_usage (id, organization_id, machine_id, project_id, plot_id, usage_date, hours)
    values ('93000000-0000-4000-a000-0000000000a1', '22000000-0000-4000-a000-00000000000a', '92000000-0000-4000-a000-0000000000a1',
            '62000000-0000-4000-a000-0000000000a1', '52000000-0000-4000-a000-0000000000a1', public.mx_today() - 5, 4)$$,
  'Registro de 4 h de tractor');
update public.machinery set hourly_cost = 800 where id = '92000000-0000-4000-a000-0000000000a1';
select is(
  (select amount::numeric from public.machinery_usage where id = '93000000-0000-4000-a000-0000000000a1'),
  2000.00, 'La tarifa queda congelada al registrar (cambiarla no altera el costo histórico)');
select throws_ok(
  $$insert into public.machinery_usage (organization_id, machine_id, project_id, usage_date, hours)
    values ('22000000-0000-4000-a000-00000000000a', '92000000-0000-4000-a000-0000000000a1',
            '62000000-0000-4000-a000-0000000000a1', public.mx_today() + 3, 2)$$,
  '22023', null, 'No se registran costos con fecha futura');
select throws_ok(
  $$insert into public.machinery_usage (organization_id, machine_id, project_id, plot_id, usage_date, hours)
    values ('22000000-0000-4000-a000-00000000000a', '92000000-0000-4000-a000-0000000000a1',
            '62000000-0000-4000-a000-0000000000a1', '52000000-0000-4000-a000-0000000000a3', public.mx_today(), 2)$$,
  '23503', null, 'La parcela del uso de maquinaria debe estar asignada al proyecto');

insert into public.employees (id, organization_id, full_name, daily_wage)
values ('94000000-0000-4000-a000-0000000000a1', '22000000-0000-4000-a000-00000000000a', 'Juan Pérez', 350);
select lives_ok(
  $$insert into public.labor_records (organization_id, project_id, plot_id, employee_id, work_date, activity, quantity)
    values ('22000000-0000-4000-a000-00000000000a', '62000000-0000-4000-a000-0000000000a1', '52000000-0000-4000-a000-0000000000a1',
            '94000000-0000-4000-a000-0000000000a1', public.mx_today() - 2, 'Deshierbe', 1)$$,
  'Jornal con el salario del empleado');
select throws_ok(
  $$insert into public.labor_records (organization_id, project_id, plot_id, employee_id, work_date, activity, quantity)
    values ('22000000-0000-4000-a000-00000000000a', '62000000-0000-4000-a000-0000000000a1', '52000000-0000-4000-a000-0000000000a2',
            '94000000-0000-4000-a000-0000000000a1', public.mx_today() - 2, 'Riego', 0.5)$$,
  '22023', null, 'Un empleado no acumula más de un jornal por día');
select lives_ok(
  $$insert into public.labor_records (organization_id, project_id, crew, work_date, activity, pay_type, quantity, unit_label, unit_rate)
    values ('22000000-0000-4000-a000-00000000000a', '62000000-0000-4000-a000-0000000000a1', 'Cuadrilla de corte',
            public.mx_today() - 1, 'Corte', 'destajo', 200, 'caja', 3.5)$$,
  'Destajo de cuadrilla');
select is(
  (select sum(amount)::numeric from public.labor_records where project_id = '62000000-0000-4000-a000-0000000000a1'),
  1050.00, 'Mano de obra: 350 + 200 × 3.50');

select lives_ok(
  $$insert into public.harvests (id, organization_id, project_id, plot_id, harvest_date, quality, quantity_kg)
    values ('95000000-0000-4000-a000-0000000000a1', '22000000-0000-4000-a000-00000000000a', '62000000-0000-4000-a000-0000000000a1',
            '52000000-0000-4000-a000-0000000000a1', public.mx_today() - 1, 'primera', 10000)$$,
  'Registro de corte de 10 t');
select is(
  (select count(*)::int from public.sales where organization_id = '22000000-0000-4000-a000-00000000000a'),
  0, 'El agrónomo no ve ventas');
select throws_ok(
  $$insert into public.project_expenses (organization_id, project_id, expense_date, category, description, amount)
    values ('22000000-0000-4000-a000-00000000000a', '62000000-0000-4000-a000-0000000000a1', public.mx_today(), 'fletes', 'Flete', 100)$$,
  '42501', null, 'El agrónomo no captura gastos directos');

-- -----------------------------------------------------------------------------
-- Finanzas: gastos, ventas y pagos
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"12000000-0000-4000-a000-00000000000f","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.project_expenses (organization_id, project_id, expense_date, category, description, supplier, invoice_ref, amount)
    values ('22000000-0000-4000-a000-00000000000a', '62000000-0000-4000-a000-0000000000a1', public.mx_today() - 10,
            'renta_tierra', 'Renta de 35 ha', 'Ejido San José', 'R-001', 5000)$$,
  'Gasto directo con factura');
select throws_ok(
  $$insert into public.project_expenses (organization_id, project_id, expense_date, category, description, supplier, invoice_ref, amount)
    values ('22000000-0000-4000-a000-00000000000a', '62000000-0000-4000-a000-0000000000a1', public.mx_today(),
            'renta_tierra', 'Renta (otra vez)', 'ejido san josé', 'r-001', 5000)$$,
  '23505', null, 'La misma factura del mismo proveedor no se captura dos veces en el proyecto');

insert into public.customers (id, organization_id, name, credit_days)
values ('96000000-0000-4000-a000-0000000000a1', '22000000-0000-4000-a000-00000000000a', 'Exportadora del Norte', 15);

select throws_ok(
  $$select public.create_sale('97000000-0000-4000-a000-0000000000f1', '96000000-0000-4000-a000-0000000000a1', public.mx_today(),
      '[{"project_id":"62000000-0000-4000-a000-0000000000a1","description":"Brócoli","quantity_kg":12000,"unit_price":8}]')$$,
  '22023', null, 'No se vende más de lo cosechado');
select throws_ok(
  $$select public.create_sale('97000000-0000-4000-a000-0000000000f2', '96000000-0000-4000-a000-0000000000a1', public.mx_today(),
      '[{"project_id":"62000000-0000-4000-a000-0000000000a1","description":"Brócoli","quantity_kg":100,"unit_price":8},
        {"project_id":"62000000-0000-4000-a000-0000000000a1","description":"Malo","quantity_kg":100,"unit_price":0}]')$$,
  '22023', null, 'Una partida inválida rechaza toda la venta');
select is(
  (select count(*)::int from public.sales) + (select count(*)::int from public.sale_items),
  0, 'Las ventas rechazadas no dejan encabezados ni partidas (transacción completa)');

select lives_ok(
  $$select public.create_sale('97000000-0000-4000-a000-0000000000a1', '96000000-0000-4000-a000-0000000000a1', public.mx_today(),
      '[{"project_id":"62000000-0000-4000-a000-0000000000a1","description":"Brócoli primera","quality":"primera","quantity_kg":6000,"unit_price":8.5},
        {"project_id":"62000000-0000-4000-a000-0000000000a1","description":"Brócoli segunda","quality":"segunda","quantity_kg":2000,"unit_price":6}]')$$,
  'Venta con dos partidas');
select lives_ok(
  $$select public.create_sale('97000000-0000-4000-a000-0000000000a1', '96000000-0000-4000-a000-0000000000a1', public.mx_today(),
      '[{"project_id":"62000000-0000-4000-a000-0000000000a1","description":"Brócoli primera","quantity_kg":6000,"unit_price":8.5}]')$$,
  'Reintentar la venta no falla');
select results_eq(
  $$select count(*)::int, sum(total)::numeric, min(due_date - sale_date) from public.sales$$,
  $$values (1, 63000.00::numeric, 15)$$,
  'Una sola venta por $63,000 con vencimiento según días de crédito');
select matches((select code from public.sales limit 1), '^VTA-\d{4}-0001$', 'La venta recibe folio consecutivo');
select is(
  (select total from public.sales) - (select sum(amount) from public.sale_items),
  0::numeric, 'El total de la venta es la suma de sus partidas');
select throws_ok(
  $$update public.sales set amount_paid = 63000$$,
  '42501', null, 'El saldo no se edita directamente');

select lives_ok(
  $$select public.register_payment('98000000-0000-4000-a000-0000000000a1', '97000000-0000-4000-a000-0000000000a1',
      public.mx_today(), 20000, 'transferencia', 'SPEI 123')$$,
  'Pago parcial de $20,000');
select lives_ok(
  $$select public.register_payment('98000000-0000-4000-a000-0000000000a1', '97000000-0000-4000-a000-0000000000a1',
      public.mx_today(), 20000, 'transferencia', 'SPEI 123')$$,
  'Reintentar el pago no falla');
select results_eq(
  $$select amount_paid, balance, payment_status from public.v_sale_balances$$,
  $$values (20000.00::numeric, 43000.00::numeric, 'parcial'::text)$$,
  'El reintento no duplica el cobro; saldo de $43,000');
select throws_ok(
  $$select public.register_payment(gen_random_uuid(), '97000000-0000-4000-a000-0000000000a1', public.mx_today(), 43000.01, 'efectivo')$$,
  '22023', null, 'Un pago no excede el saldo pendiente');
select throws_ok(
  $$select public.cancel_sale('97000000-0000-4000-a000-0000000000a1', 'Cliente canceló')$$,
  '22023', null, 'No se cancela una venta con pagos aplicados');
select lives_ok(
  $$select public.cancel_payment('98000000-0000-4000-a000-0000000000a1', 'Transferencia rechazada')$$,
  'Se cancela el pago');
select is((select amount_paid::numeric from public.sales), 0.00, 'Cancelar el pago restituye el saldo');
select throws_ok(
  $$select public.cancel_payment('98000000-0000-4000-a000-0000000000a1', 'Otra vez')$$,
  '22023', null, 'Un pago se cancela una sola vez');
select lives_ok(
  $$select public.register_payment('98000000-0000-4000-a000-0000000000a2', '97000000-0000-4000-a000-0000000000a1',
      public.mx_today(), 43000, 'transferencia')$$,
  'Nuevo pago parcial');
select lives_ok(
  $$select public.register_payment('98000000-0000-4000-a000-0000000000a3', '97000000-0000-4000-a000-0000000000a1',
      public.mx_today(), 20000, 'cheque')$$,
  'Pago de liquidación');
select is((select payment_status from public.v_sale_balances), 'pagada', 'La venta queda pagada');

-- -----------------------------------------------------------------------------
-- Cálculos del proyecto (sin duplicidad entre fuentes ni parcelas)
-- Costos: insumos 330 + maquinaria 2,000 + mano de obra 1,050 + gastos 5,000.
-- -----------------------------------------------------------------------------
select results_eq(
  $$select inputs_cost, machinery_cost, labor_cost, expenses_cost, total_cost
    from public.v_project_costs where project_id = '62000000-0000-4000-a000-0000000000a1'$$,
  $$values (330.00::numeric, 2000.00::numeric, 1050.00::numeric, 5000.00::numeric, 8380.00::numeric)$$,
  'Costo de producción por categoría');
select is(
  (select total_cost from public.v_project_costs where project_id = '62000000-0000-4000-a000-0000000000a1'),
  (select sum(amount) from public.v_project_cost_entries where project_id = '62000000-0000-4000-a000-0000000000a1'),
  'El total coincide con la suma del detalle de costos');
select results_eq(
  $$select area_ha, cost_per_ha, harvested_kg, cost_per_kg
    from public.v_project_costs where project_id = '62000000-0000-4000-a000-0000000000a1'$$,
  $$values (35.00::numeric, 239.43::numeric, 10000.000::numeric, 0.8380::numeric)$$,
  'Costo por hectárea (8,380 / 35) y por kilogramo (8,380 / 10,000)');
select results_eq(
  $$select sold_kg, available_kg, sales_amount, collected_amount, receivable_amount, gross_profit
    from public.v_project_costs where project_id = '62000000-0000-4000-a000-0000000000a1'$$,
  $$values (8000.000::numeric, 2000.000::numeric, 63000.00::numeric, 63000.00::numeric, 0.00::numeric, 54620.00::numeric)$$,
  'Ventas acumuladas, cobrado, saldo y utilidad bruta');
select is(
  (public.finance_summary('22000000-0000-4000-a000-00000000000a') ->> 'sales_total')::numeric,
  63000::numeric, 'Resumen financiero: ventas registradas');

-- -----------------------------------------------------------------------------
-- Propietario: producción vendida y cierre del proyecto
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"12000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);

select throws_ok(
  $$delete from public.harvests where id = '95000000-0000-4000-a000-0000000000a1'$$,
  '22023', null, 'No se elimina producción ya vendida');
select lives_ok(
  $$select public.change_project_status('62000000-0000-4000-a000-0000000000a1', 'cerrado', 'Ciclo terminado')$$,
  'Se cierra el proyecto');
select throws_ok(
  $$insert into public.labor_records (organization_id, project_id, crew, work_date, activity, quantity, unit_rate)
    values ('22000000-0000-4000-a000-00000000000a', '62000000-0000-4000-a000-0000000000a1', 'Cuadrilla', public.mx_today(), 'Limpieza', 2, 300)$$,
  '22023', null, 'Un proyecto cerrado no admite nuevos costos');
select throws_ok(
  $$delete from public.machinery_usage where id = '93000000-0000-4000-a000-0000000000a1'$$,
  '22023', null, 'Los costos de un proyecto cerrado no se eliminan');
select throws_ok(
  $$select public.register_inventory_movement(gen_random_uuid(), '72000000-0000-4000-a000-0000000000a1', 'consumo', public.mx_today(), 1,
      p_project => '62000000-0000-4000-a000-0000000000a1', p_plot => '52000000-0000-4000-a000-0000000000a1')$$,
  '22023', null, 'Un proyecto cerrado no recibe consumos');

-- -----------------------------------------------------------------------------
-- Consulta de Org A y propietario de Org B
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"12000000-0000-4000-a000-00000000000c","role":"authenticated"}', true);
select throws_ok(
  $$select public.register_payment(gen_random_uuid(), '97000000-0000-4000-a000-0000000000a1', public.mx_today(), 1, 'efectivo')$$,
  '42501', null, 'Consulta no registra pagos');

select set_config('request.jwt.claims', '{"sub":"12000000-0000-4000-a000-00000000000b","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.inventory_products) + (select count(*)::int from public.v_project_costs),
  0, 'Otra organización no ve inventario ni costos de Org A');
select throws_ok(
  $$select public.register_inventory_movement(gen_random_uuid(), '72000000-0000-4000-a000-0000000000a1', 'entrada', public.mx_today(), 1, 1)$$,
  'P0002', null, 'Otra organización no puede mover el inventario de Org A');

select * from finish();
rollback;
