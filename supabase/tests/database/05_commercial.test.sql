-- Pruebas de producción y comercialización: cortes y lotes, existencias de
-- producto, ventas con varios lotes, borradores, entregas, pagos parciales,
-- anticipos, cancelaciones y reversos, trazabilidad, permisos y separación de
-- organizaciones. Ejecutar con: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(108);

-- -----------------------------------------------------------------------------
-- Preparación: Org A (A propietario, G agrónomo, W almacén, F finanzas,
-- C consulta) · Org B (B propietario). Dos proyectos en cosecha: brócoli
-- (parcela P1) y lechuga (parcela P2).
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('13000000-0000-4000-a000-00000000000a', 'a5@test.mx', 'authenticated', 'authenticated'),
  ('13000000-0000-4000-a000-00000000000b', 'b5@test.mx', 'authenticated', 'authenticated'),
  ('13000000-0000-4000-a000-00000000000c', 'c5@test.mx', 'authenticated', 'authenticated'),
  ('13000000-0000-4000-a000-00000000000d', 'g5@test.mx', 'authenticated', 'authenticated'),
  ('13000000-0000-4000-a000-00000000000e', 'w5@test.mx', 'authenticated', 'authenticated'),
  ('13000000-0000-4000-a000-00000000000f', 'f5@test.mx', 'authenticated', 'authenticated');

insert into public.organizations (id, name) values
  ('23000000-0000-4000-a000-00000000000a', 'Com A'),
  ('23000000-0000-4000-a000-00000000000b', 'Com B');

insert into public.memberships (organization_id, user_id, role) values
  ('23000000-0000-4000-a000-00000000000a', '13000000-0000-4000-a000-00000000000a', 'propietario'),
  ('23000000-0000-4000-a000-00000000000b', '13000000-0000-4000-a000-00000000000b', 'propietario'),
  ('23000000-0000-4000-a000-00000000000a', '13000000-0000-4000-a000-00000000000c', 'consulta'),
  ('23000000-0000-4000-a000-00000000000a', '13000000-0000-4000-a000-00000000000d', 'agronomo'),
  ('23000000-0000-4000-a000-00000000000a', '13000000-0000-4000-a000-00000000000e', 'almacen'),
  ('23000000-0000-4000-a000-00000000000a', '13000000-0000-4000-a000-00000000000f', 'finanzas');

insert into public.farms (id, organization_id, name) values
  ('33000000-0000-4000-a000-0000000000a1', '23000000-0000-4000-a000-00000000000a', 'Rancho A');
insert into public.plots (id, organization_id, farm_id, name, area_ha) values
  ('53000000-0000-4000-a000-0000000000a1', '23000000-0000-4000-a000-00000000000a', '33000000-0000-4000-a000-0000000000a1', 'P1', 20),
  ('53000000-0000-4000-a000-0000000000a2', '23000000-0000-4000-a000-00000000000a', '33000000-0000-4000-a000-0000000000a1', 'P2', 10);
insert into public.crops (id, organization_id, name) values
  ('43000000-0000-4000-a000-0000000000a1', '23000000-0000-4000-a000-00000000000a', 'Brócoli'),
  ('43000000-0000-4000-a000-0000000000a2', '23000000-0000-4000-a000-00000000000a', 'Lechuga');
insert into public.projects (id, organization_id, name, crop_id, start_date) values
  ('63000000-0000-4000-a000-0000000000a1', '23000000-0000-4000-a000-00000000000a', 'Brócoli OI',
   '43000000-0000-4000-a000-0000000000a1', public.mx_today() - 60),
  ('63000000-0000-4000-a000-0000000000a2', '23000000-0000-4000-a000-00000000000a', 'Lechuga OI',
   '43000000-0000-4000-a000-0000000000a2', public.mx_today() - 60);
insert into public.project_plots (organization_id, project_id, plot_id, assigned_area_ha) values
  ('23000000-0000-4000-a000-00000000000a', '63000000-0000-4000-a000-0000000000a1', '53000000-0000-4000-a000-0000000000a1', 20),
  ('23000000-0000-4000-a000-00000000000a', '63000000-0000-4000-a000-0000000000a2', '53000000-0000-4000-a000-0000000000a2', 10);
update public.projects set status = 'cosecha' where organization_id = '23000000-0000-4000-a000-00000000000a';
insert into public.employees (id, organization_id, full_name, daily_wage) values
  ('73000000-0000-4000-a000-0000000000a1', '23000000-0000-4000-a000-00000000000a', 'Rosa Jefa de Corte', 350);

-- Archivos ya cargados en Storage (para probar las políticas de evidencias).
insert into storage.objects (bucket_id, name) values
  ('evidencias', '23000000-0000-4000-a000-00000000000a/payment/98000000-0000-4000-a000-000000000002/recibo.pdf'),
  ('evidencias', '23000000-0000-4000-a000-00000000000a/harvest/93000000-0000-4000-a000-000000000001/corte.jpg'),
  ('evidencias', '23000000-0000-4000-a000-00000000000a/harvest/93000000-0000-4000-a000-000000000001/corte.pdf');

set local role authenticated;

-- -----------------------------------------------------------------------------
-- Agrónomo: cortes, lotes y mermas
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"13000000-0000-4000-a000-00000000000d","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.harvests (id, organization_id, project_id, plot_id, harvest_date, quality, unit, quantity, unit_weight_kg,
                                 classification, responsible_id)
    values ('93000000-0000-4000-a000-000000000001', '23000000-0000-4000-a000-00000000000a', '63000000-0000-4000-a000-0000000000a1',
            '53000000-0000-4000-a000-0000000000a1', public.mx_today() - 5, 'primera', 'caja', 500, 20, 'Exportación',
            '73000000-0000-4000-a000-0000000000a1')$$,
  'Corte de 500 cajas de 20 kg');
select results_eq(
  $$select quantity_kg, available_kg, cut_number from public.harvests where id = '93000000-0000-4000-a000-000000000001'$$,
  $$values (10000.000::numeric, 10000.000::numeric, 1)$$,
  'El lote nace con 10,000 kg disponibles y número de corte 1');
select matches(
  (select lot_code from public.harvests where id = '93000000-0000-4000-a000-000000000001'),
  '^LOT-\d{4}-0001$', 'El lote recibe folio consecutivo');
select lives_ok(
  $$insert into public.harvests (id, organization_id, project_id, plot_id, harvest_date, quality, unit, quantity)
    values ('93000000-0000-4000-a000-000000000002', '23000000-0000-4000-a000-00000000000a', '63000000-0000-4000-a000-0000000000a1',
            '53000000-0000-4000-a000-0000000000a1', public.mx_today() - 5, 'segunda', 'kg', 3000)$$,
  'Segunda calidad del mismo corte');
select is(
  (select cut_number from public.harvests where id = '93000000-0000-4000-a000-000000000002'),
  1, 'Otra calidad del mismo día comparte el número de corte');
select lives_ok(
  $$insert into public.harvests (id, organization_id, project_id, plot_id, harvest_date, quality, unit, quantity)
    values ('93000000-0000-4000-a000-000000000003', '23000000-0000-4000-a000-00000000000a', '63000000-0000-4000-a000-0000000000a2',
            '53000000-0000-4000-a000-0000000000a2', public.mx_today() - 3, 'unica', 't', 4)$$,
  'Corte de lechuga en toneladas');
select results_eq(
  $$select quantity_kg, cut_number from public.harvests where id = '93000000-0000-4000-a000-000000000003'$$,
  $$values (4000.000::numeric, 1)$$,
  'Toneladas a kilogramos; el número de corte es por proyecto');
select throws_ok(
  $$insert into public.harvests (organization_id, project_id, plot_id, harvest_date, quality, unit, quantity)
    values ('23000000-0000-4000-a000-00000000000a', '63000000-0000-4000-a000-0000000000a1',
            '53000000-0000-4000-a000-0000000000a1', public.mx_today(), 'primera', 'caja', 10)$$,
  '22023', null, 'Una unidad de empaque exige su peso neto');
select throws_ok(
  $$update public.harvests set sold_kg = 0 where id = '93000000-0000-4000-a000-000000000001'$$,
  '42501', null, 'Las existencias del lote no se editan directamente');
select throws_ok(
  $$insert into public.production_movements (id, organization_id, harvest_id, movement_type, movement_date, quantity_kg, available_after, reason)
    values (gen_random_uuid(), '23000000-0000-4000-a000-00000000000a', '93000000-0000-4000-a000-000000000001', 'merma',
            public.mx_today(), -1, 1, 'Directo')$$,
  '42501', null, 'Los movimientos de producto solo se registran por RPC');

select lives_ok(
  $$select public.register_production_adjustment('94000000-0000-4000-a000-000000000001', '93000000-0000-4000-a000-000000000002',
      'merma', 200, public.mx_today() - 1, 'Rezaga de selección')$$,
  'Merma justificada');
select lives_ok(
  $$select public.register_production_adjustment('94000000-0000-4000-a000-000000000001', '93000000-0000-4000-a000-000000000002',
      'merma', 200, public.mx_today() - 1, 'Rezaga de selección')$$,
  'Reintentar la merma no falla');
select results_eq(
  $$select available_kg, adjusted_kg from public.harvests where id = '93000000-0000-4000-a000-000000000002'$$,
  $$values (2800.000::numeric, 200.000::numeric)$$,
  'La merma descuenta la existencia una sola vez');
select throws_ok(
  $$select public.register_production_adjustment(gen_random_uuid(), '93000000-0000-4000-a000-000000000002',
      'perdida', 10, public.mx_today(), 'x')$$,
  '22023', null, 'Una pérdida sin justificación se rechaza');
select throws_ok(
  $$select public.register_production_adjustment(gen_random_uuid(), '93000000-0000-4000-a000-000000000002',
      'perdida', 5000, public.mx_today(), 'Descomposición en bodega')$$,
  '22023', null, 'No se da de baja más de lo disponible');
select throws_ok(
  $$select public.register_production_adjustment(gen_random_uuid(), '93000000-0000-4000-a000-000000000002',
      'merma', 10, public.mx_today() - 10, 'Fecha anterior al corte')$$,
  '22023', null, 'Un ajuste no puede ser anterior a la cosecha del lote');
select throws_ok(
  $$select public.save_sale(gen_random_uuid(), (select id from public.customers limit 1), public.mx_today(), '[]')$$,
  'P0002', null, 'El agrónomo no ve clientes ni registra ventas');

-- -----------------------------------------------------------------------------
-- Almacén: ajustes de producto, pero no cortes
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"13000000-0000-4000-a000-00000000000e","role":"authenticated"}', true);

select lives_ok(
  $$select public.register_production_adjustment('94000000-0000-4000-a000-000000000002', '93000000-0000-4000-a000-000000000002',
      'ajuste_entrada', 50, public.mx_today(), 'Conteo físico mayor al teórico')$$,
  'Almacén registra un ajuste por conteo');
select is(
  (select available_kg from public.harvests where id = '93000000-0000-4000-a000-000000000002'),
  2850.000::numeric, 'El ajuste de entrada aumenta la existencia');
select throws_ok(
  $$insert into public.harvests (organization_id, project_id, plot_id, harvest_date, quality, quantity_kg)
    values ('23000000-0000-4000-a000-00000000000a', '63000000-0000-4000-a000-0000000000a1',
            '53000000-0000-4000-a000-0000000000a1', public.mx_today(), 'primera', 100)$$,
  '42501', null, 'Almacén no registra cortes');

-- -----------------------------------------------------------------------------
-- Finanzas: borradores, confirmación y existencias
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"13000000-0000-4000-a000-00000000000f","role":"authenticated"}', true);

insert into public.customers (id, organization_id, name, customer_type, credit_days, is_active) values
  ('96000000-0000-4000-a000-000000000001', '23000000-0000-4000-a000-00000000000a', 'Exportadora Norte', 'exportadora', 10, true),
  ('96000000-0000-4000-a000-000000000002', '23000000-0000-4000-a000-00000000000a', 'Cliente Inactivo', 'mayorista', 0, false);

select lives_ok(
  $$select public.save_sale('97000000-0000-4000-a000-000000000001', '96000000-0000-4000-a000-000000000001', public.mx_today(),
      '[{"harvest_id":"93000000-0000-4000-a000-000000000001","unit":"caja","unit_weight_kg":20,"quantity":400,"unit_price":180,"discount":1000},
        {"harvest_id":"93000000-0000-4000-a000-000000000003","description":"Lechuga romana","unit":"t","quantity":2,"unit_price":9000}]')$$,
  'Borrador con dos productos de dos proyectos');
select results_eq(
  $$select status::text, subtotal, discount, total from public.sales where id = '97000000-0000-4000-a000-000000000001'$$,
  $$values ('borrador', 90000.00::numeric, 1000.00::numeric, 89000.00::numeric)$$,
  'Subtotal, descuento y total calculados en la BD');
select results_eq(
  $$select quantity_kg, description, quality::text from public.sale_items
    where sale_id = '97000000-0000-4000-a000-000000000001' order by quantity_kg desc$$,
  $$values (8000.000::numeric, 'Brócoli', 'primera'), (2000.000::numeric, 'Lechuga romana', 'unica')$$,
  'Kilogramos, producto y calidad se toman del lote');
select is(
  (select available_kg from public.harvests where id = '93000000-0000-4000-a000-000000000001'),
  10000.000::numeric, 'Un borrador no descuenta existencias');
select lives_ok(
  $$select public.save_sale('97000000-0000-4000-a000-000000000002', '96000000-0000-4000-a000-000000000001', public.mx_today(),
      '[{"harvest_id":"93000000-0000-4000-a000-000000000001","unit":"kg","quantity":6000,"unit_price":9}]')$$,
  'Segundo borrador sobre el mismo lote');
select throws_ok(
  $$select public.save_sale(gen_random_uuid(), '96000000-0000-4000-a000-000000000001', public.mx_today(),
      '[{"harvest_id":"93000000-0000-4000-a000-000000000001","unit":"kg","quantity":10000.5,"unit_price":9}]')$$,
  '22023', null, 'Ni un borrador puede exceder lo disponible del lote');
select throws_ok(
  $$select public.save_sale(gen_random_uuid(), '96000000-0000-4000-a000-000000000002', public.mx_today(),
      '[{"harvest_id":"93000000-0000-4000-a000-000000000001","unit":"kg","quantity":10,"unit_price":9}]')$$,
  '22023', null, 'No se vende a un cliente inactivo');
select throws_ok(
  $$select public.save_sale(gen_random_uuid(), '96000000-0000-4000-a000-000000000001', public.mx_today(),
      '[{"harvest_id":"93000000-0000-4000-a000-000000000001","unit":"kg","quantity":10,"unit_price":9,"discount":91}]')$$,
  '22023', null, 'El descuento no supera el importe de la partida');

-- Anticipo sobre el borrador: no cuenta como pagado hasta aplicarse.
select lives_ok(
  $$select public.register_payment('98000000-0000-4000-a000-000000000001', '97000000-0000-4000-a000-000000000001',
      public.mx_today(), 20000, 'transferencia', 'SPEI anticipo', p_kind => 'anticipo')$$,
  'Anticipo de $20,000 sobre el borrador');
select throws_ok(
  $$select public.register_payment(gen_random_uuid(), '97000000-0000-4000-a000-000000000001', public.mx_today(), 100, 'efectivo')$$,
  '22023', null, 'Un borrador no recibe pagos (solo anticipos)');
select results_eq(
  $$select amount_paid, advance_balance from public.sales where id = '97000000-0000-4000-a000-000000000001'$$,
  $$values (0.00::numeric, 20000.00::numeric)$$,
  'El anticipo queda pendiente de aplicar');
select throws_ok(
  $$select public.save_sale('97000000-0000-4000-a000-000000000001', '96000000-0000-4000-a000-000000000001', public.mx_today(),
      '[{"harvest_id":"93000000-0000-4000-a000-000000000001","unit":"kg","quantity":100,"unit_price":9}]')$$,
  '22023', null, 'El borrador no puede quedar por debajo de sus anticipos');

select lives_ok(
  $$select public.confirm_sale('97000000-0000-4000-a000-000000000001')$$,
  'Se confirma la venta');
select results_eq(
  $$select available_kg, sold_kg from public.harvests
    where id in ('93000000-0000-4000-a000-000000000001', '93000000-0000-4000-a000-000000000003') order by id$$,
  $$values (2000.000::numeric, 8000.000::numeric), (2000.000::numeric, 2000.000::numeric)$$,
  'Confirmar descuenta cada partida de su lote');
select is(
  (select status::text from public.sales where id = '97000000-0000-4000-a000-000000000001'),
  'confirmada', 'La venta queda confirmada');
select throws_ok(
  $$select public.confirm_sale('97000000-0000-4000-a000-000000000002')$$,
  '22023', null, 'Confirmar un borrador que excede la existencia actual se rechaza');
select results_eq(
  $$select (select status::text from public.sales where id = '97000000-0000-4000-a000-000000000002'),
           (select available_kg from public.harvests where id = '93000000-0000-4000-a000-000000000001')$$,
  $$values ('borrador', 2000.000::numeric)$$,
  'La confirmación rechazada no deja movimientos (transacción completa)');
select lives_ok(
  $$select public.confirm_sale('97000000-0000-4000-a000-000000000001')$$,
  'Reintentar la confirmación no falla');
select is(
  (select count(*)::int from public.production_movements where sale_id = '97000000-0000-4000-a000-000000000001'),
  2, 'El reintento no duplica las salidas de producto');
select throws_ok(
  $$select public.save_sale('97000000-0000-4000-a000-000000000001', '96000000-0000-4000-a000-000000000001', public.mx_today(),
      '[{"harvest_id":"93000000-0000-4000-a000-000000000001","unit":"kg","quantity":100,"unit_price":9}]')$$,
  '22023', null, 'Una venta confirmada ya no se edita');
select throws_ok(
  $$update public.sales set amount_paid = 1 where id = '97000000-0000-4000-a000-000000000001'$$,
  '42501', null, 'El saldo no se edita directamente');

-- -----------------------------------------------------------------------------
-- Pagos parciales, anticipos y saldos (total $89,000)
-- -----------------------------------------------------------------------------
select throws_ok(
  $$select public.register_payment(gen_random_uuid(), '97000000-0000-4000-a000-000000000001', public.mx_today(), 69000.01, 'efectivo')$$,
  '22023', null, 'Un pago no excede el saldo menos los anticipos sin aplicar');
select lives_ok(
  $$select public.apply_advance('99000000-0000-4000-a000-000000000001', '98000000-0000-4000-a000-000000000001', 15000)$$,
  'Aplicación parcial del anticipo');
select lives_ok(
  $$select public.apply_advance('99000000-0000-4000-a000-000000000001', '98000000-0000-4000-a000-000000000001', 15000)$$,
  'Reintentar la aplicación no falla');
select results_eq(
  $$select amount_paid, advance_balance, status::text from public.sales where id = '97000000-0000-4000-a000-000000000001'$$,
  $$values (15000.00::numeric, 5000.00::numeric, 'parcialmente_pagada')$$,
  'El anticipo aplicado cuenta como pagado una sola vez');
select throws_ok(
  $$select public.apply_advance(gen_random_uuid(), '98000000-0000-4000-a000-000000000001', 5000.01)$$,
  '22023', null, 'No se aplica más que el anticipo pendiente');
select throws_ok(
  $$select public.cancel_payment('98000000-0000-4000-a000-000000000001', 'Devolución del anticipo')$$,
  '22023', null, 'Un anticipo con aplicaciones no se cancela');
select lives_ok(
  $$select public.register_payment('98000000-0000-4000-a000-000000000002', '97000000-0000-4000-a000-000000000001',
      public.mx_today(), 30000, 'cheque', 'Cheque 1001')$$,
  'Pago parcial de $30,000');
select results_eq(
  $$select balance, payment_status, recovery_pct, last_payment_date from public.v_sale_balances
    where id = '97000000-0000-4000-a000-000000000001'$$,
  $$values (44000.00::numeric, 'parcial'::text, 50.6::numeric, public.mx_today())$$,
  'Saldo, estado de pago, % de recuperación y último pago');
select throws_ok(
  $$select public.cancel_sale('97000000-0000-4000-a000-000000000001', 'Cliente canceló')$$,
  '22023', null, 'No se cancela una venta con pagos o anticipos');

-- Entregas parciales
select lives_ok(
  $$select public.register_delivery('9a000000-0000-4000-a000-000000000001', '97000000-0000-4000-a000-000000000001', public.mx_today(),
      jsonb_build_array(jsonb_build_object('sale_item_id',
        (select id from public.sale_items where sale_id = '97000000-0000-4000-a000-000000000001'
           and harvest_id = '93000000-0000-4000-a000-000000000001'), 'quantity', 100)),
      'Recibe almacén', 'Placas ABC-123')$$,
  'Entrega parcial de 100 cajas');
select is(
  (select delivery_status from public.v_sale_balances where id = '97000000-0000-4000-a000-000000000001'),
  'parcial', 'La venta queda parcialmente entregada');
select throws_ok(
  $$select public.register_delivery(gen_random_uuid(), '97000000-0000-4000-a000-000000000001', public.mx_today(),
      jsonb_build_array(jsonb_build_object('sale_item_id',
        (select id from public.sale_items where sale_id = '97000000-0000-4000-a000-000000000001'
           and harvest_id = '93000000-0000-4000-a000-000000000001'), 'quantity', 301)))$$,
  '22023', null, 'No se entrega más de lo pendiente');
select lives_ok(
  $$select public.register_delivery('9a000000-0000-4000-a000-000000000002', '97000000-0000-4000-a000-000000000001', public.mx_today())$$,
  'Entrega del resto');
select is(
  (select delivery_status from public.v_sale_balances where id = '97000000-0000-4000-a000-000000000001'),
  'entregada', 'La venta queda entregada');
select lives_ok(
  $$select public.cancel_delivery('9a000000-0000-4000-a000-000000000002', 'Viaje registrado por error')$$,
  'Se cancela una entrega');
select results_eq(
  $$select delivery_status, status::text from public.v_sale_balances where id = '97000000-0000-4000-a000-000000000001'$$,
  $$values ('parcial'::text, 'parcialmente_pagada')$$,
  'Cancelar la entrega restituye lo pendiente sin alterar el cobro');

-- Reversión de una aplicación y liquidación
select lives_ok(
  $$select public.cancel_advance_application('99000000-0000-4000-a000-000000000001', 'Aplicada por error')$$,
  'Se revierte la aplicación del anticipo');
select results_eq(
  $$select amount_paid, advance_balance from public.sales where id = '97000000-0000-4000-a000-000000000001'$$,
  $$values (30000.00::numeric, 20000.00::numeric)$$,
  'La reversión devuelve el importe al anticipo pendiente');
select lives_ok(
  $$select public.apply_advance('99000000-0000-4000-a000-000000000002', '98000000-0000-4000-a000-000000000001')$$,
  'Aplicación total del anticipo pendiente');
select lives_ok(
  $$select public.register_payment('98000000-0000-4000-a000-000000000003', '97000000-0000-4000-a000-000000000001',
      public.mx_today(), 39000, 'transferencia', 'SPEI liquidación')$$,
  'Pago de liquidación');
select results_eq(
  $$select amount_paid, advance_balance, status::text from public.sales where id = '97000000-0000-4000-a000-000000000001'$$,
  $$values (89000.00::numeric, 0.00::numeric, 'pagada')$$,
  'La venta queda pagada');
select throws_ok(
  $$select public.register_payment(gen_random_uuid(), '97000000-0000-4000-a000-000000000001', public.mx_today(), 0.01, 'efectivo')$$,
  '22023', null, 'Una venta liquidada no recibe más pagos');

-- -----------------------------------------------------------------------------
-- Cancelaciones y reversos
-- -----------------------------------------------------------------------------
select lives_ok(
  $$select public.save_sale('97000000-0000-4000-a000-000000000003', '96000000-0000-4000-a000-000000000001', public.mx_today(),
      '[{"harvest_id":"93000000-0000-4000-a000-000000000002","unit":"kg","quantity":1000,"unit_price":6}]', p_confirm => true)$$,
  'Venta registrada y confirmada en una operación');
select is(
  (select available_kg from public.harvests where id = '93000000-0000-4000-a000-000000000002'),
  1850.000::numeric, 'La venta descuenta 1,000 kg del lote');
select lives_ok(
  $$select public.register_payment('98000000-0000-4000-a000-000000000004', '97000000-0000-4000-a000-000000000003',
      public.mx_today(), 1000, 'cheque')$$,
  'Pago con cheque');
select lives_ok(
  $$select public.cancel_payment('98000000-0000-4000-a000-000000000004', 'Cheque devuelto')$$,
  'Se cancela el pago');
select results_eq(
  $$select p.status::text, s.amount_paid, s.status::text from public.payments p join public.sales s on s.id = p.sale_id
    where p.id = '98000000-0000-4000-a000-000000000004'$$,
  $$values ('cancelado', 0.00::numeric, 'confirmada')$$,
  'El pago cancelado se conserva y el saldo se restituye');
select throws_ok(
  $$delete from public.payments where id = '98000000-0000-4000-a000-000000000004'$$,
  '42501', null, 'Los pagos no se eliminan');
select lives_ok(
  $$select public.cancel_sale('97000000-0000-4000-a000-000000000003', 'Cliente desistió de la compra')$$,
  'Se cancela la venta confirmada');
select is(
  (select available_kg from public.harvests where id = '93000000-0000-4000-a000-000000000002'),
  2850.000::numeric, 'La cancelación restituye el lote');
select results_eq(
  $$select movement_type::text, quantity_kg, reverses_id is not null from public.production_movements
    where sale_id = '97000000-0000-4000-a000-000000000003' order by created_at, quantity_kg$$,
  $$values ('venta', -1000.000::numeric, false), ('cancelacion_venta', 1000.000::numeric, true)$$,
  'La restitución es un movimiento de reversión ligado a la salida');
select throws_ok(
  $$select public.cancel_sale('97000000-0000-4000-a000-000000000003', 'Otra vez')$$,
  '22023', null, 'Una venta se cancela una sola vez');
select lives_ok(
  $$select public.cancel_sale('97000000-0000-4000-a000-000000000002', 'Borrador sin uso')$$,
  'Se cancela un borrador');
select is(
  (select count(*)::int from public.production_movements where sale_id = '97000000-0000-4000-a000-000000000002'),
  0, 'Cancelar un borrador no genera movimientos');

-- -----------------------------------------------------------------------------
-- Trazabilidad e indicadores
-- -----------------------------------------------------------------------------
select results_eq(
  $$select lot_code, plot_name, project_id, quantity_kg from public.v_sale_lot_trace
    where sale_id = '97000000-0000-4000-a000-000000000001' order by lot_code$$,
  $$select lot_code, case when id = '93000000-0000-4000-a000-000000000001' then 'P1' else 'P2' end, project_id,
           case when id = '93000000-0000-4000-a000-000000000001' then 8000.000 else 2000.000 end::numeric
    from public.harvests where id in ('93000000-0000-4000-a000-000000000001', '93000000-0000-4000-a000-000000000003')
    order by lot_code$$,
  'Cada venta indica el lote, la parcela y el proyecto de origen');
select results_eq(
  $$select harvested_kg, sold_kg, available_kg, sales_amount, collected_amount, lots, cuts
    from public.v_project_costs where project_id = '63000000-0000-4000-a000-0000000000a1'$$,
  $$values (13000.000::numeric, 8000.000::numeric, 4850.000::numeric, 71000.00::numeric, 71000.00::numeric, 2::bigint, 1::bigint)$$,
  'Proyecto: cosechado, vendido, disponible (con mermas), ventas y cobrado');
select results_eq(
  $$select (s ->> 'sales_total')::numeric, (s ->> 'collected')::numeric, (s ->> 'receivable')::numeric,
           (s ->> 'production_kg')::numeric, (s ->> 'customers_active')::int
    from public.commercial_summary('23000000-0000-4000-a000-00000000000a', public.mx_today() - 30, public.mx_today()) s$$,
  $$values (89000.00::numeric, 89000.00::numeric, 0.00::numeric, 17000.000::numeric, 1)$$,
  'Dashboard comercial: ventas, cobrado, por cobrar, producción y clientes activos');
select is(
  (public.commercial_summary('23000000-0000-4000-a000-00000000000a', public.mx_today() - 30, public.mx_today(),
     p_project => '63000000-0000-4000-a000-0000000000a2') ->> 'sales_total')::numeric,
  18000.00::numeric, 'El filtro por proyecto toma solo sus partidas');

-- Evidencias: comprobantes de pago solo finanzas; fotografías del corte, campo.
select lives_ok(
  $$insert into public.attachments (organization_id, entity_type, entity_id, storage_path, file_name, mime_type, size_bytes)
    values ('23000000-0000-4000-a000-00000000000a', 'payment', '98000000-0000-4000-a000-000000000002',
            '23000000-0000-4000-a000-00000000000a/payment/98000000-0000-4000-a000-000000000002/recibo.pdf',
            'recibo.pdf', 'application/pdf', 1000)$$,
  'Finanzas adjunta el comprobante del pago (PDF)');

-- -----------------------------------------------------------------------------
-- Agrónomo: reglas del lote y lectura
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"13000000-0000-4000-a000-00000000000d","role":"authenticated"}', true);

select throws_ok(
  $$delete from public.harvests where id = '93000000-0000-4000-a000-000000000001'$$,
  '22023', null, 'Un lote con ventas no se elimina');
select throws_ok(
  $$update public.harvests set quantity = 300 where id = '93000000-0000-4000-a000-000000000001'$$,
  '22023', null, 'La cantidad del lote no baja de lo vendido');
select throws_ok(
  $$update public.harvests set quality = 'segunda' where id = '93000000-0000-4000-a000-000000000001'$$,
  '22023', null, 'El origen de un lote con ventas no se modifica');
select lives_ok(
  $$update public.harvests set classification = 'Exportación premium', quantity = 510 where id = '93000000-0000-4000-a000-000000000001'$$,
  'Se corrige la clasificación y la cantidad capturada');
select is(
  (select available_kg from public.harvests where id = '93000000-0000-4000-a000-000000000001'),
  2200.000::numeric, 'La corrección de cantidad actualiza la existencia');
select lives_ok(
  $$select public.reverse_production_adjustment('94000000-0000-4000-a000-000000000003', '94000000-0000-4000-a000-000000000001',
      'Merma capturada dos veces')$$,
  'Se revierte la merma');
select is(
  (select available_kg from public.harvests where id = '93000000-0000-4000-a000-000000000002'),
  3050.000::numeric, 'La reversión regresa la merma al lote');
select throws_ok(
  $$select public.reverse_production_adjustment(gen_random_uuid(), '94000000-0000-4000-a000-000000000001', 'Otra vez')$$,
  '22023', null, 'Un ajuste se revierte una sola vez');
select results_eq(
  $$select (select count(*)::int from public.production_movements where organization_id = '23000000-0000-4000-a000-00000000000a') > 0,
           (select count(*)::int from public.sales) + (select count(*)::int from public.v_sale_lot_trace)
             + (select count(*)::int from public.advance_applications) + (select count(*)::int from public.sale_deliveries)$$,
  $$values (true, 0)$$,
  'Campo ve los movimientos en kg, pero no ventas, trazas comerciales, anticipos ni entregas');
select is(
  (select count(*)::int from public.attachments where entity_type = 'payment'),
  0, 'Campo no ve comprobantes de pago');
select throws_ok(
  $$insert into public.attachments (organization_id, entity_type, entity_id, storage_path, file_name, mime_type, size_bytes)
    values ('23000000-0000-4000-a000-00000000000a', 'payment', '98000000-0000-4000-a000-000000000002',
            '23000000-0000-4000-a000-00000000000a/payment/98000000-0000-4000-a000-000000000002/recibo.pdf',
            'recibo.pdf', 'application/pdf', 1000)$$,
  '42501', null, 'Campo no adjunta comprobantes de pago');
select lives_ok(
  $$insert into public.attachments (organization_id, entity_type, entity_id, storage_path, file_name, mime_type, size_bytes)
    values ('23000000-0000-4000-a000-00000000000a', 'harvest', '93000000-0000-4000-a000-000000000001',
            '23000000-0000-4000-a000-00000000000a/harvest/93000000-0000-4000-a000-000000000001/corte.jpg',
            'corte.jpg', 'image/jpeg', 1000)$$,
  'Campo adjunta la fotografía del corte');
select throws_ok(
  $$insert into public.attachments (organization_id, entity_type, entity_id, storage_path, file_name, mime_type, size_bytes)
    values ('23000000-0000-4000-a000-00000000000a', 'harvest', '93000000-0000-4000-a000-000000000001',
            '23000000-0000-4000-a000-00000000000a/harvest/93000000-0000-4000-a000-000000000001/corte.pdf',
            'corte.pdf', 'application/pdf', 1000)$$,
  '23514', null, 'Los PDF solo se aceptan como comprobantes de pago');

-- -----------------------------------------------------------------------------
-- Consulta: lee, pero no opera
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"13000000-0000-4000-a000-00000000000c","role":"authenticated"}', true);

select ok(
  (select count(*) from public.v_sale_lot_trace) > 0 and (select count(*) from public.advance_applications) > 0,
  'Consulta ve ventas, trazabilidad y anticipos');
select throws_ok(
  $$select public.register_payment(gen_random_uuid(), '97000000-0000-4000-a000-000000000001', public.mx_today(), 1, 'efectivo')$$,
  '42501', null, 'Consulta no registra pagos');
select throws_ok(
  $$select public.register_production_adjustment(gen_random_uuid(), '93000000-0000-4000-a000-000000000002',
      'merma', 1, public.mx_today(), 'Merma de prueba')$$,
  '42501', null, 'Consulta no registra mermas');
select throws_ok(
  $$select public.register_delivery(gen_random_uuid(), '97000000-0000-4000-a000-000000000001', public.mx_today())$$,
  '42501', null, 'Consulta no registra entregas');

-- -----------------------------------------------------------------------------
-- Otra organización
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"13000000-0000-4000-a000-00000000000b","role":"authenticated"}', true);

insert into public.customers (id, organization_id, name) values
  ('96000000-0000-4000-a000-0000000000b1', '23000000-0000-4000-a000-00000000000b', 'Cliente de B');

select is(
  (select count(*)::int from public.harvests) + (select count(*)::int from public.production_movements)
    + (select count(*)::int from public.sales) + (select count(*)::int from public.payments)
    + (select count(*)::int from public.attachments),
  0, 'Otra organización no ve lotes, movimientos, ventas, pagos ni evidencias de Org A');
select throws_ok(
  $$select public.save_sale(gen_random_uuid(), '96000000-0000-4000-a000-0000000000b1', public.mx_today(),
      '[{"harvest_id":"93000000-0000-4000-a000-000000000002","unit":"kg","quantity":10,"unit_price":9}]')$$,
  'P0002', null, 'Otra organización no vende lotes de Org A');
select throws_ok(
  $$select public.register_production_adjustment(gen_random_uuid(), '93000000-0000-4000-a000-000000000002',
      'merma', 1, public.mx_today(), 'Intento ajeno')$$,
  'P0002', null, 'Otra organización no ajusta lotes de Org A');
select throws_ok(
  $$select public.confirm_sale('97000000-0000-4000-a000-000000000001')$$,
  'P0002', null, 'Otra organización no opera ventas de Org A');
select throws_ok(
  $$select public.register_payment(gen_random_uuid(), '97000000-0000-4000-a000-000000000001', public.mx_today(), 1, 'efectivo')$$,
  'P0002', null, 'Otra organización no registra pagos a Org A');
select throws_ok(
  $$select public.apply_advance(gen_random_uuid(), '98000000-0000-4000-a000-000000000001')$$,
  'P0002', null, 'Otra organización no aplica anticipos de Org A');

-- -----------------------------------------------------------------------------
-- Propietario: cierre del proyecto congela sus lotes
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"13000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$select public.change_project_status('63000000-0000-4000-a000-0000000000a2', 'cerrado', 'Ciclo terminado')$$,
  'Se cierra el proyecto de lechuga');
select throws_ok(
  $$select public.save_sale(gen_random_uuid(), '96000000-0000-4000-a000-000000000001', public.mx_today(),
      '[{"harvest_id":"93000000-0000-4000-a000-000000000003","unit":"kg","quantity":10,"unit_price":9}]')$$,
  '22023', null, 'La producción de un proyecto cerrado no se vende');
select throws_ok(
  $$select public.register_production_adjustment(gen_random_uuid(), '93000000-0000-4000-a000-000000000003',
      'merma', 1, public.mx_today(), 'Merma tras el cierre')$$,
  '22023', null, 'Un proyecto cerrado no admite ajustes de producto');

-- El libro de producto es inmutable también para el dueño de la base de datos.
reset role;
select throws_ok(
  $$update public.production_movements set quantity_kg = -1 where sale_id = '97000000-0000-4000-a000-000000000001'$$,
  '42501', null, 'Los movimientos de producto no se modifican');
select throws_ok(
  $$delete from public.production_movements where sale_id = '97000000-0000-4000-a000-000000000001'$$,
  '42501', null, 'Los movimientos de producto no se eliminan');

select * from finish();
rollback;
