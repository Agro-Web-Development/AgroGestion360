-- Pruebas de administración financiera: presupuestos con versiones, gastos
-- directos y compartidos (reparto exacto), duplicidad, pagos y flujo de
-- efectivo, consolidación de costos por clase y categoría, alertas
-- configurables, congelamiento al cierre, permisos y separación de
-- organizaciones. Ejecutar con: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(76);

-- -----------------------------------------------------------------------------
-- Preparación: Org A (A propietario, G agrónomo, W almacén, F finanzas,
-- C consulta) · Org B (B propietario). P1 (30 ha en dos parcelas) y P2 (15 ha).
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('14000000-0000-4000-a000-00000000000a', 'a6@test.mx', 'authenticated', 'authenticated'),
  ('14000000-0000-4000-a000-00000000000b', 'b6@test.mx', 'authenticated', 'authenticated'),
  ('14000000-0000-4000-a000-00000000000c', 'c6@test.mx', 'authenticated', 'authenticated'),
  ('14000000-0000-4000-a000-00000000000d', 'g6@test.mx', 'authenticated', 'authenticated'),
  ('14000000-0000-4000-a000-00000000000e', 'w6@test.mx', 'authenticated', 'authenticated'),
  ('14000000-0000-4000-a000-00000000000f', 'f6@test.mx', 'authenticated', 'authenticated');

insert into public.organizations (id, name) values
  ('24000000-0000-4000-a000-00000000000a', 'Fin A'),
  ('24000000-0000-4000-a000-00000000000b', 'Fin B');

insert into public.memberships (organization_id, user_id, role) values
  ('24000000-0000-4000-a000-00000000000a', '14000000-0000-4000-a000-00000000000a', 'propietario'),
  ('24000000-0000-4000-a000-00000000000b', '14000000-0000-4000-a000-00000000000b', 'propietario'),
  ('24000000-0000-4000-a000-00000000000a', '14000000-0000-4000-a000-00000000000c', 'consulta'),
  ('24000000-0000-4000-a000-00000000000a', '14000000-0000-4000-a000-00000000000d', 'agronomo'),
  ('24000000-0000-4000-a000-00000000000a', '14000000-0000-4000-a000-00000000000e', 'almacen'),
  ('24000000-0000-4000-a000-00000000000a', '14000000-0000-4000-a000-00000000000f', 'finanzas');

insert into public.farms (id, organization_id, name) values
  ('34000000-0000-4000-a000-0000000000a1', '24000000-0000-4000-a000-00000000000a', 'Rancho A');
insert into public.plots (id, organization_id, farm_id, name, area_ha) values
  ('54000000-0000-4000-a000-0000000000a1', '24000000-0000-4000-a000-00000000000a', '34000000-0000-4000-a000-0000000000a1', 'P1-N', 20),
  ('54000000-0000-4000-a000-0000000000a2', '24000000-0000-4000-a000-00000000000a', '34000000-0000-4000-a000-0000000000a1', 'P1-S', 10),
  ('54000000-0000-4000-a000-0000000000a3', '24000000-0000-4000-a000-00000000000a', '34000000-0000-4000-a000-0000000000a1', 'P2', 15);
insert into public.crops (id, organization_id, name) values
  ('44000000-0000-4000-a000-0000000000a1', '24000000-0000-4000-a000-00000000000a', 'Maíz');
insert into public.projects (id, organization_id, name, crop_id, start_date) values
  ('64000000-0000-4000-a000-0000000000a1', '24000000-0000-4000-a000-00000000000a', 'Maíz P1',
   '44000000-0000-4000-a000-0000000000a1', public.mx_today() - 60),
  ('64000000-0000-4000-a000-0000000000a2', '24000000-0000-4000-a000-00000000000a', 'Maíz P2',
   '44000000-0000-4000-a000-0000000000a1', public.mx_today() - 60);
insert into public.project_plots (organization_id, project_id, plot_id, assigned_area_ha) values
  ('24000000-0000-4000-a000-00000000000a', '64000000-0000-4000-a000-0000000000a1', '54000000-0000-4000-a000-0000000000a1', 20),
  ('24000000-0000-4000-a000-00000000000a', '64000000-0000-4000-a000-0000000000a1', '54000000-0000-4000-a000-0000000000a2', 10),
  ('24000000-0000-4000-a000-00000000000a', '64000000-0000-4000-a000-0000000000a2', '54000000-0000-4000-a000-0000000000a3', 15);
update public.projects set status = 'desarrollo' where organization_id = '24000000-0000-4000-a000-00000000000a';

insert into public.employees (id, organization_id, full_name, daily_wage) values
  ('74000000-0000-4000-a000-0000000000a1', '24000000-0000-4000-a000-00000000000a', 'Juan Jornalero', 400);
insert into public.machinery (id, organization_id, name, hourly_cost) values
  ('84000000-0000-4000-a000-0000000000a1', '24000000-0000-4000-a000-00000000000a', 'Tractor', 600);
insert into public.inventory_products (id, organization_id, name, category_id, unit) values
  ('94000000-0000-4000-a000-0000000000a1', '24000000-0000-4000-a000-00000000000a', 'Urea',
   (select id from public.inventory_categories where organization_id = '24000000-0000-4000-a000-00000000000a' and kind = 'fertilizante'), 'kg'),
  ('94000000-0000-4000-a000-0000000000a2', '24000000-0000-4000-a000-00000000000a', 'Diésel',
   (select id from public.inventory_categories where organization_id = '24000000-0000-4000-a000-00000000000a' and kind = 'combustible'), 'l');
insert into public.suppliers (id, organization_id, name) values
  ('9b000000-0000-4000-a000-0000000000b1', '24000000-0000-4000-a000-00000000000a', 'Fletes del Bajío'),
  ('9b000000-0000-4000-a000-0000000000b2', '24000000-0000-4000-a000-00000000000a', 'Otro proveedor');

insert into storage.objects (bucket_id, name) values
  ('evidencias', '24000000-0000-4000-a000-00000000000a/expense/9c000000-0000-4000-a000-0000000000b1/factura.pdf');

set local role authenticated;

-- -----------------------------------------------------------------------------
-- Costos de los módulos existentes (insumos, combustible, mano de obra, maquinaria)
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"14000000-0000-4000-a000-00000000000e","role":"authenticated"}', true);
select public.register_inventory_movement(gen_random_uuid(), '94000000-0000-4000-a000-0000000000a1', 'entrada', public.mx_today() - 50, 1000, 10);
select public.register_inventory_movement(gen_random_uuid(), '94000000-0000-4000-a000-0000000000a2', 'entrada', public.mx_today() - 50, 500, 25);
select public.register_inventory_movement(gen_random_uuid(), '94000000-0000-4000-a000-0000000000a1', 'consumo', public.mx_today() - 40, 300,
  p_project => '64000000-0000-4000-a000-0000000000a1', p_plot => '54000000-0000-4000-a000-0000000000a1');
select public.register_inventory_movement(gen_random_uuid(), '94000000-0000-4000-a000-0000000000a2', 'consumo', public.mx_today() - 40, 100,
  p_project => '64000000-0000-4000-a000-0000000000a1', p_plot => '54000000-0000-4000-a000-0000000000a1');

select set_config('request.jwt.claims', '{"sub":"14000000-0000-4000-a000-00000000000d","role":"authenticated"}', true);
insert into public.labor_records (organization_id, project_id, employee_id, work_date, activity, quantity)
values ('24000000-0000-4000-a000-00000000000a', '64000000-0000-4000-a000-0000000000a1', '74000000-0000-4000-a000-0000000000a1',
        public.mx_today() - 30, 'Deshierbe', 1);
insert into public.machinery_usage (organization_id, machine_id, project_id, usage_date, hours)
values ('24000000-0000-4000-a000-00000000000a', '84000000-0000-4000-a000-0000000000a1', '64000000-0000-4000-a000-0000000000a1',
        public.mx_today() - 30, 5);

select is((select count(*)::int from public.project_budgets), 0, 'El agrónomo no ve presupuestos');
select throws_ok(
  $$select public.save_budget(gen_random_uuid(), '64000000-0000-4000-a000-0000000000a1', '[{"category":"otros","concept":"X","quantity":1,"unit_cost":1}]',
      public.mx_today() - 60, public.mx_today() + 60)$$,
  '42501', null, 'El agrónomo no elabora presupuestos');

reset role;
select results_eq(
  $$select cost_class, budget_category::text, sum(amount) from public.v_project_cost_entries
    where project_id = '64000000-0000-4000-a000-0000000000a1' group by 1, 2 order by 1$$,
  $$values ('combustibles', 'combustible', 2500.00::numeric), ('insumos', 'fertilizantes', 3000.00::numeric),
           ('mano_obra', 'mano_obra', 400.00::numeric), ('maquinaria', 'maquinaria', 3000.00::numeric)$$,
  'Cada costo de los módulos existentes conserva su clase y categoría presupuestal');
select is(
  (select count(*)::int from public.v_project_cost_entries e
   where e.project_id = '64000000-0000-4000-a000-0000000000a1'
     and not exists (select 1 from public.inventory_movements m where m.id = e.origin_id)
     and not exists (select 1 from public.labor_records l where l.id = e.origin_id)
     and not exists (select 1 from public.machinery_usage u where u.id = e.origin_id)),
  0, 'Cada renglón de costo apunta a su movimiento de origen');
set local role authenticated;

-- -----------------------------------------------------------------------------
-- Finanzas: presupuesto original y revisiones
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"14000000-0000-4000-a000-00000000000f","role":"authenticated"}', true);

select lives_ok(
  $$select public.save_budget('a4000000-0000-4000-a000-000000000001', '64000000-0000-4000-a000-0000000000a1', '[
      {"category":"fertilizantes","concept":"Urea","unit":"kg","quantity":400,"unit_cost":10},
      {"category":"combustible","concept":"Diésel","unit":"l","quantity":100,"unit_cost":25},
      {"category":"mano_obra","concept":"Jornales","unit":"jornal","quantity":2.5,"unit_cost":400},
      {"category":"maquinaria","concept":"Tractor","unit":"h","quantity":5.5,"unit_cost":600},
      {"category":"transporte","concept":"Fletes","quantity":1,"unit_cost":2000},
      {"category":"otros","concept":"Renta","quantity":1,"unit_cost":1000}]',
      public.mx_today() - 60, public.mx_today() + 60)$$,
  'Presupuesto original del proyecto');
select results_eq(
  $$select version, is_current, total, area_ha from public.project_budgets where id = 'a4000000-0000-4000-a000-000000000001'$$,
  $$values (1, true, 13800.00::numeric, 30.00::numeric)$$,
  'Versión 1 vigente: total = Σ partidas y superficie del proyecto');
select is((select budget_amount from public.projects where id = '64000000-0000-4000-a000-0000000000a1'), 13800.00::numeric,
  'El importe del proyecto se sincroniza con la versión vigente');
select lives_ok(
  $$select public.save_budget('a4000000-0000-4000-a000-000000000001', '64000000-0000-4000-a000-0000000000a1',
      '[{"category":"otros","concept":"X","quantity":1,"unit_cost":1}]', public.mx_today() - 60, public.mx_today() + 60)$$,
  'Reintento con el mismo identificador');
select is((select count(*)::int from public.project_budgets where project_id = '64000000-0000-4000-a000-0000000000a1'), 1,
  'El reintento no crea otra versión');
select throws_ok(
  $$select public.save_budget(gen_random_uuid(), '64000000-0000-4000-a000-0000000000a1',
      '[{"category":"otros","concept":"X","quantity":1,"unit_cost":1}]', public.mx_today() - 60, public.mx_today() + 60)$$,
  '22023', null, 'Una revisión debe indicar la versión desde la que se editó');
select throws_ok(
  $$select public.save_budget(gen_random_uuid(), '64000000-0000-4000-a000-0000000000a1',
      '[{"category":"otros","concept":"X","quantity":1,"unit_cost":1}]', public.mx_today() - 60, public.mx_today() + 60, p_base_version => 1)$$,
  '22023', null, 'Una revisión exige motivo');
select throws_ok(
  $$select public.save_budget(gen_random_uuid(), '64000000-0000-4000-a000-0000000000a1',
      '[{"category":"otros","concept":"X","quantity":1,"unit_cost":1}]', public.mx_today() + 60, public.mx_today() - 60,
      p_base_version => 1, p_reason => 'Periodo invertido')$$,
  '22023', null, 'El periodo debe ser válido');
select throws_ok(
  $$select public.save_budget(gen_random_uuid(), '64000000-0000-4000-a000-0000000000a1',
      '[{"category":"otros","concept":"X","quantity":0,"unit_cost":1}]', public.mx_today() - 60, public.mx_today() + 60,
      p_base_version => 1, p_reason => 'Cantidad cero')$$,
  '22023', null, 'Las partidas requieren cantidad mayor que cero');
select lives_ok(
  $$select public.save_budget('a4000000-0000-4000-a000-000000000002', '64000000-0000-4000-a000-0000000000a1', '[
      {"category":"fertilizantes","concept":"Urea","unit":"kg","quantity":400,"unit_cost":10},
      {"category":"combustible","concept":"Diésel","unit":"l","quantity":100,"unit_cost":25},
      {"category":"mano_obra","concept":"Jornales","unit":"jornal","quantity":2.5,"unit_cost":400},
      {"category":"maquinaria","concept":"Tractor","unit":"h","quantity":5.5,"unit_cost":600},
      {"category":"transporte","concept":"Fletes","quantity":1,"unit_cost":2000},
      {"category":"otros","concept":"Renta","quantity":1,"unit_cost":1000},
      {"category":"mantenimiento","concept":"Bomba","quantity":1,"unit_cost":600}]',
      public.mx_today() - 60, public.mx_today() + 60, p_base_version => 1, p_reason => 'Se agrega mantenimiento de la bomba')$$,
  'Revisión del presupuesto (versión 2)');
select results_eq(
  $$select version, is_current, total from public.project_budgets where project_id = '64000000-0000-4000-a000-0000000000a1' order by version$$,
  $$values (1, false, 13800.00::numeric), (2, true, 14400.00::numeric)$$,
  'La versión original se conserva y la revisión queda vigente');
select is((select count(*)::int from public.project_budget_lines where budget_id = 'a4000000-0000-4000-a000-000000000001'), 6,
  'Las partidas originales no cambian');
select throws_ok(
  $$select public.save_budget(gen_random_uuid(), '64000000-0000-4000-a000-0000000000a1',
      '[{"category":"otros","concept":"X","quantity":1,"unit_cost":1}]', public.mx_today() - 60, public.mx_today() + 60,
      p_base_version => 1, p_reason => 'Edición desde una versión vieja')$$,
  '22023', null, 'Una edición desde una versión que ya no es la vigente se rechaza');
select throws_ok(
  $$update public.project_budget_lines set unit_cost = 1 where budget_id = 'a4000000-0000-4000-a000-000000000001'$$,
  '42501', null, 'Las partidas no se modifican desde la API');

reset role;
select throws_ok(
  $$update public.project_budget_lines set unit_cost = 1 where budget_id = 'a4000000-0000-4000-a000-000000000001'$$,
  '42501', null, 'Las partidas son inmutables también para el dueño de la BD');
select throws_ok(
  $$delete from public.project_budgets where id = 'a4000000-0000-4000-a000-000000000001'$$,
  '42501', null, 'Las versiones no se eliminan');
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"14000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);
select throws_ok(
  $$update public.projects set budget_amount = 1 where id = '64000000-0000-4000-a000-0000000000a1'$$,
  '22023', null, 'Con presupuesto detallado el importe del proyecto no se captura a mano');

-- -----------------------------------------------------------------------------
-- Gastos directos y compartidos
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"14000000-0000-4000-a000-00000000000f","role":"authenticated"}', true);

select lives_ok(
  $$select public.register_expense('9c000000-0000-4000-a000-0000000000b1', '24000000-0000-4000-a000-00000000000a',
      public.mx_today() - 10, 'fletes', 'transporte', 'Flete a bodega', 1500, 'directo',
      '[{"project_id":"64000000-0000-4000-a000-0000000000a1","plot_id":"54000000-0000-4000-a000-0000000000a1"}]',
      '9b000000-0000-4000-a000-0000000000b1', 'f-100', 'transferencia',
      p_payment => '{"id":"9d000000-0000-4000-a000-0000000000b1","date":null,"reference":"SPEI 1"}')$$,
  'Gasto directo pagado al registrarse');
select results_eq(
  $$select invoice_ref, paid_amount, responsible_id from public.expenses where id = '9c000000-0000-4000-a000-0000000000b1'$$,
  $$values ('F-100'::text, 1500.00::numeric, '14000000-0000-4000-a000-00000000000f'::uuid)$$,
  'Factura normalizada, pago total y responsable por omisión');
select is((select count(*)::int from public.cash_movements where expense_id = '9c000000-0000-4000-a000-0000000000b1' and kind = 'pago_gasto'),
  1, 'El pago queda como movimiento de efectivo');
select lives_ok(
  $$select public.register_expense('9c000000-0000-4000-a000-0000000000b1', '24000000-0000-4000-a000-00000000000a',
      public.mx_today() - 10, 'fletes', 'transporte', 'Flete a bodega', 1500, 'directo',
      '[{"project_id":"64000000-0000-4000-a000-0000000000a1"}]')$$,
  'Reintento del mismo gasto');
select is((select count(*)::int from public.project_expenses where expense_id = '9c000000-0000-4000-a000-0000000000b1'), 1,
  'El reintento no duplica el costo');
select throws_ok(
  $$select public.register_expense(gen_random_uuid(), '24000000-0000-4000-a000-00000000000a', public.mx_today(), 'fletes',
      'transporte', 'Flete repetido', 1500, 'directo', '[{"project_id":"64000000-0000-4000-a000-0000000000a2"}]',
      '9b000000-0000-4000-a000-0000000000b1', 'F-100')$$,
  '23505', null, 'La misma factura del proveedor no se registra dos veces (ni en otro proyecto)');
select lives_ok(
  $$select public.register_expense(gen_random_uuid(), '24000000-0000-4000-a000-00000000000a', public.mx_today(), 'fletes',
      'transporte', 'Flete de otro proveedor', 100, 'directo', '[{"project_id":"64000000-0000-4000-a000-0000000000a2"}]',
      '9b000000-0000-4000-a000-0000000000b2', 'F-100')$$,
  'El mismo folio de otro proveedor sí se acepta');
select throws_ok(
  $$select public.register_expense(gen_random_uuid(), '24000000-0000-4000-a000-00000000000a', public.mx_today(), 'otros',
      'semillas', 'Semilla comprada aparte', 100, 'directo', '[{"project_id":"64000000-0000-4000-a000-0000000000a1"}]')$$,
  '22023', null, 'Semillas, insumos, combustible, mano de obra y maquinaria no se capturan como gasto');
select throws_ok(
  $$select public.register_expense(gen_random_uuid(), '24000000-0000-4000-a000-00000000000a', public.mx_today() + 1, 'otros',
      'otros', 'Gasto futuro', 100, 'directo', '[{"project_id":"64000000-0000-4000-a000-0000000000a1"}]')$$,
  '22023', null, 'La fecha del gasto no puede ser futura');

select lives_ok(
  $$select public.register_expense('9c000000-0000-4000-a000-0000000000b2', '24000000-0000-4000-a000-00000000000a',
      public.mx_today() - 5, 'renta_tierra', 'otros', 'Renta de bodega compartida', 1000, 'superficie',
      '[{"project_id":"64000000-0000-4000-a000-0000000000a1"},{"project_id":"64000000-0000-4000-a000-0000000000a2"}]')$$,
  'Gasto compartido por superficie (30 y 15 ha)');
select results_eq(
  $$select project_id, amount, allocation_share, allocation_basis from public.project_expenses
    where expense_id = '9c000000-0000-4000-a000-0000000000b2' order by project_id$$,
  $$values ('64000000-0000-4000-a000-0000000000a1'::uuid, 666.67::numeric, 0.666667::numeric, 30.0000::numeric),
           ('64000000-0000-4000-a000-0000000000a2'::uuid, 333.33::numeric, 0.333333::numeric, 15.0000::numeric)$$,
  'Reparto por superficie con el criterio guardado');
select is((select sum(amount) from public.project_expenses where expense_id = '9c000000-0000-4000-a000-0000000000b2'), 1000.00::numeric,
  'El reparto suma exactamente el total del gasto');
select lives_ok(
  $$select public.register_expense('9c000000-0000-4000-a000-0000000000b3', '24000000-0000-4000-a000-00000000000a',
      public.mx_today() - 5, 'seguros', 'otros', 'Seguro compartido', 100, 'partes_iguales',
      '[{"project_id":"64000000-0000-4000-a000-0000000000a1"},{"project_id":"64000000-0000-4000-a000-0000000000a2"}]')$$,
  'Gasto compartido en partes iguales');
select lives_ok(
  $$select public.register_expense('9c000000-0000-4000-a000-0000000000b4', '24000000-0000-4000-a000-00000000000a',
      public.mx_today() - 5, 'energia', 'riego', 'Bombeo compartido', 1000.01, 'partes_iguales',
      '[{"project_id":"64000000-0000-4000-a000-0000000000a1"},{"project_id":"64000000-0000-4000-a000-0000000000a2"}]')$$,
  'Partes iguales con un centavo de residuo');
select results_eq(
  $$select amount from public.project_expenses where expense_id = '9c000000-0000-4000-a000-0000000000b4' order by project_id$$,
  $$values (500.00::numeric), (500.01::numeric)$$,
  'El residuo del redondeo se ajusta en un solo proyecto y el total cuadra');
select throws_ok(
  $$select public.register_expense(gen_random_uuid(), '24000000-0000-4000-a000-00000000000a', public.mx_today(), 'otros', 'otros',
      'Porcentajes incompletos', 100, 'porcentaje',
      '[{"project_id":"64000000-0000-4000-a000-0000000000a1","value":60},{"project_id":"64000000-0000-4000-a000-0000000000a2","value":30}]')$$,
  '22023', null, 'Los porcentajes deben sumar 100');
select throws_ok(
  $$select public.register_expense(gen_random_uuid(), '24000000-0000-4000-a000-00000000000a', public.mx_today(), 'otros', 'otros',
      'Importes que no cuadran', 100, 'importe',
      '[{"project_id":"64000000-0000-4000-a000-0000000000a1","value":60},{"project_id":"64000000-0000-4000-a000-0000000000a2","value":30}]')$$,
  '22023', null, 'Los importes deben sumar el total');
select throws_ok(
  $$select public.register_expense(gen_random_uuid(), '24000000-0000-4000-a000-00000000000a', public.mx_today(), 'otros', 'otros',
      'Muy poco', 0.01, 'partes_iguales',
      '[{"project_id":"64000000-0000-4000-a000-0000000000a1"},{"project_id":"64000000-0000-4000-a000-0000000000a2"}]')$$,
  '22023', null, 'Un importe que no alcanza para todos los proyectos se rechaza');
select throws_ok(
  $$select public.register_expense(gen_random_uuid(), '24000000-0000-4000-a000-00000000000a', public.mx_today(), 'otros', 'otros',
      'Proyecto repetido', 100, 'partes_iguales',
      '[{"project_id":"64000000-0000-4000-a000-0000000000a1"},{"project_id":"64000000-0000-4000-a000-0000000000a1"}]')$$,
  '22023', null, 'Un proyecto no aparece dos veces en el reparto');
select throws_ok(
  $$select public.register_expense(gen_random_uuid(), '24000000-0000-4000-a000-00000000000a', public.mx_today(), 'otros', 'otros',
      'Compartido con parcela', 100, 'partes_iguales',
      '[{"project_id":"64000000-0000-4000-a000-0000000000a1","plot_id":"54000000-0000-4000-a000-0000000000a1"},{"project_id":"64000000-0000-4000-a000-0000000000a2"}]')$$,
  '22023', null, 'Un gasto compartido se asigna a todo el proyecto');
select throws_ok(
  $$insert into public.project_expenses (organization_id, project_id, expense_date, amount, expense_id, allocation_share, allocation_basis)
    values ('24000000-0000-4000-a000-00000000000a', '64000000-0000-4000-a000-0000000000a1', public.mx_today(), 10,
            '9c000000-0000-4000-a000-0000000000b2', 0.1, 1)$$,
  '42501', null, 'Las asignaciones solo se escriben con la función de registro');

-- -----------------------------------------------------------------------------
-- Consolidación: costo por clase, presupuesto contra real y alertas
-- P1 = insumos 3,000 + combustible 2,500 + mano de obra 400 + maquinaria 3,000
--      + flete 1,500 + renta 666.67 + seguro 50 + bombeo 500.00 = 11,616.67
-- -----------------------------------------------------------------------------
select results_eq(
  $$select materials_cost, fuel_cost, labor_cost, machinery_cost, services_cost, other_cost, maintenance_cost, total_cost
    from public.v_project_costs where project_id = '64000000-0000-4000-a000-0000000000a1'$$,
  $$values (3000.00::numeric, 2500.00::numeric, 400.00::numeric, 3000.00::numeric, 2000.00::numeric, 716.67::numeric,
            0::numeric, 11616.67::numeric)$$,
  'Costo por clase (las siete clases suman el total)');
select is(
  (select total_cost from public.v_project_costs where project_id = '64000000-0000-4000-a000-0000000000a1'),
  (select sum(amount) from public.v_project_cost_entries where project_id = '64000000-0000-4000-a000-0000000000a1'),
  'El total coincide con la suma de los renglones de origen');
select results_eq(
  $$select budget_amount, budget_version, budget_variance, budget_remaining, budget_used_pct, budget_status, cost_per_ha
    from public.v_project_costs where project_id = '64000000-0000-4000-a000-0000000000a1'$$,
  $$values (14400.00::numeric, 2, 2783.33::numeric, 2783.33::numeric, 80.7::numeric, 'aviso'::text, 387.22::numeric)$$,
  'Presupuesto restante, diferencia, porcentaje, estado y costo por hectárea');
select results_eq(
  $$select category::text, budget_amount, actual_amount, difference, used_pct, status
    from public.v_budget_comparison where project_id = '64000000-0000-4000-a000-0000000000a1' order by category::text collate "C"$$,
  $$values
    ('combustible'::text, 2500.00::numeric, 2500.00::numeric, 0.00::numeric, 100.0::numeric, 'agotado'::text),
    ('fertilizantes', 4000.00, 3000.00, 1000.00, 75.0, 'aviso'),
    ('mano_obra', 1000.00, 400.00, 600.00, 40.0, 'normal'),
    ('mantenimiento', 600.00, 0, 600.00, 0.0, 'normal'),
    ('maquinaria', 3300.00, 3000.00, 300.00, 90.9, 'critico'),
    ('otros', 1000.00, 716.67, 283.33, 71.7, 'aviso'),
    ('riego', 0, 500.00, -500.00, null, 'sin_presupuesto'),
    ('transporte', 2000.00, 1500.00, 500.00, 75.0, 'aviso')$$,
  'Presupuesto contra gasto real por categoría con los umbrales 70/90/100');

select lives_ok(
  $$insert into public.finance_settings (organization_id, warning_pct, critical_pct, exhausted_pct)
    values ('24000000-0000-4000-a000-00000000000a', 50, 75, 95)$$,
  'Finanzas configura los umbrales de alerta');
select results_eq(
  $$select category::text, status from public.v_budget_comparison
    where project_id = '64000000-0000-4000-a000-0000000000a1' and category in ('mano_obra', 'transporte', 'maquinaria') order by category$$,
  $$values ('mano_obra'::text, 'normal'::text), ('maquinaria', 'critico'), ('transporte', 'critico')$$,
  'Las alertas usan los umbrales configurados');
select throws_ok(
  $$update public.finance_settings set warning_pct = 80 where organization_id = '24000000-0000-4000-a000-00000000000a'$$,
  '23514', null, 'Los umbrales deben ir en orden ascendente');

-- -----------------------------------------------------------------------------
-- Pagos de gastos y flujo de efectivo
-- -----------------------------------------------------------------------------
select lives_ok(
  $$select public.register_cash_movement('9d000000-0000-4000-a000-0000000000b2', '24000000-0000-4000-a000-00000000000a',
      'pago_gasto', public.mx_today() - 2, 400, 'efectivo', p_expense => '9c000000-0000-4000-a000-0000000000b2')$$,
  'Pago parcial de un gasto compartido');
select throws_ok(
  $$select public.register_cash_movement(gen_random_uuid(), '24000000-0000-4000-a000-00000000000a',
      'pago_gasto', public.mx_today(), 600.01, 'efectivo', p_expense => '9c000000-0000-4000-a000-0000000000b2')$$,
  '22023', null, 'Un pago no excede el saldo del gasto');
select throws_ok(
  $$select public.cancel_expense('9c000000-0000-4000-a000-0000000000b2', 'Captura errónea')$$,
  '22023', null, 'Un gasto con pagos no se cancela');
select throws_ok(
  $$select public.register_cash_movement(gen_random_uuid(), '24000000-0000-4000-a000-00000000000a',
      'pago_proveedor', public.mx_today(), 100, 'transferencia', 'Pago de compra')$$,
  '22023', null, 'Un pago a proveedor requiere proveedor');
select lives_ok(
  $$select public.register_cash_movement('9d000000-0000-4000-a000-0000000000b3', '24000000-0000-4000-a000-00000000000a',
      'otro_ingreso', public.mx_today() - 1, 5000, 'transferencia', 'Apoyo a la productividad',
      p_project => '64000000-0000-4000-a000-0000000000a1')$$,
  'Otro ingreso ligado a un proyecto');
select results_eq(
  $$select direction, sum(amount) from public.cash_flow_entries('24000000-0000-4000-a000-00000000000a',
      public.mx_today() - 30, public.mx_today()) group by direction order by direction$$,
  $$values ('egreso'::text, 1900.00::numeric), ('ingreso', 5000.00)$$,
  'Flujo: solo el dinero pagado o recibido (los gastos sin pagar no son egreso)');
select results_eq(
  $$select direction, sum(amount) from public.cash_flow_entries('24000000-0000-4000-a000-00000000000a',
      public.mx_today() - 30, public.mx_today(), '64000000-0000-4000-a000-0000000000a2') group by direction$$,
  $$values ('egreso'::text, 133.33::numeric)$$,
  'Con filtro de proyecto el pago de un gasto compartido se prorratea por su reparto');
select lives_ok(
  $$select public.cancel_cash_movement('9d000000-0000-4000-a000-0000000000b2', 'Pago registrado por error')$$,
  'Se cancela el pago');
select is((select paid_amount from public.expenses where id = '9c000000-0000-4000-a000-0000000000b2'), 0.00::numeric,
  'Cancelar el pago restituye el saldo del gasto');
select lives_ok(
  $$select public.cancel_expense('9c000000-0000-4000-a000-0000000000b2', 'Captura errónea')$$,
  'Se cancela el gasto sin pagos');
select is((select total_cost from public.v_project_costs where project_id = '64000000-0000-4000-a000-0000000000a1'), 10950.00::numeric,
  'Un gasto cancelado deja de contar como costo');
select is((select count(*)::int from public.project_expenses where expense_id = '9c000000-0000-4000-a000-0000000000b2'), 2,
  'Su reparto queda en el historial');
select is(
  (public.financial_series('24000000-0000-4000-a000-00000000000a', public.mx_today() - 30, public.mx_today(),
     p_project => '64000000-0000-4000-a000-0000000000a1') ->> 'period_cost')::numeric,
  (select sum(amount) from public.v_project_cost_entries
   where project_id = '64000000-0000-4000-a000-0000000000a1' and entry_date >= public.mx_today() - 30),
  'Las series del dashboard usan la misma fuente de costos');

select lives_ok(
  $$insert into public.attachments (organization_id, entity_type, entity_id, storage_path, file_name, mime_type, size_bytes)
    values ('24000000-0000-4000-a000-00000000000a', 'expense', '9c000000-0000-4000-a000-0000000000b1',
            '24000000-0000-4000-a000-00000000000a/expense/9c000000-0000-4000-a000-0000000000b1/factura.pdf', 'factura.pdf',
            'application/pdf', 1000)$$,
  'Comprobante del gasto en PDF');

-- -----------------------------------------------------------------------------
-- Consulta, agrónomo y otra organización
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"14000000-0000-4000-a000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.project_budgets where organization_id = '24000000-0000-4000-a000-00000000000a'), 2,
  'Consulta ve los presupuestos');
select throws_ok(
  $$select public.register_expense(gen_random_uuid(), '24000000-0000-4000-a000-00000000000a', public.mx_today(), 'otros', 'otros',
      'Intento', 100, 'directo', '[{"project_id":"64000000-0000-4000-a000-0000000000a1"}]')$$,
  '42501', null, 'Consulta no registra gastos');
select throws_ok(
  $$select public.register_cash_movement(gen_random_uuid(), '24000000-0000-4000-a000-00000000000a', 'otro_egreso',
      public.mx_today(), 100, 'efectivo', 'Intento')$$,
  '42501', null, 'Consulta no registra movimientos de efectivo');
select is_empty(
  $$update public.finance_settings set warning_pct = 60 where organization_id = '24000000-0000-4000-a000-00000000000a' returning 1$$,
  'Consulta no cambia los umbrales');

select set_config('request.jwt.claims', '{"sub":"14000000-0000-4000-a000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.expenses), 0, 'El agrónomo no ve gastos');
select is((select count(*)::int from public.cash_movements), 0, 'El agrónomo no ve movimientos de efectivo');
select is((select count(*)::int from public.attachments where entity_type = 'expense'), 0, 'El agrónomo no ve comprobantes de gastos');

select set_config('request.jwt.claims', '{"sub":"14000000-0000-4000-a000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.v_budget_comparison), 0, 'Otra organización no ve la comparación presupuestal');
select throws_ok(
  $$select public.register_expense(gen_random_uuid(), '24000000-0000-4000-a000-00000000000a', public.mx_today(), 'otros', 'otros',
      'Intrusión', 100, 'directo', '[{"project_id":"64000000-0000-4000-a000-0000000000a1"}]')$$,
  'P0002', null, 'Otra organización no registra gastos en Org A');

-- -----------------------------------------------------------------------------
-- Cierre del proyecto: presupuesto y costos congelados; el dinero sí se registra
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"14000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);
select lives_ok(
  $q$do $$ begin
      perform public.change_project_status('64000000-0000-4000-a000-0000000000a2', 'cosecha', null);
      perform public.change_project_status('64000000-0000-4000-a000-0000000000a2', 'cerrado', 'Ciclo terminado');
    end $$$q$,
  'Se cierra P2');
select throws_ok(
  $$select public.register_expense(gen_random_uuid(), '24000000-0000-4000-a000-00000000000a', public.mx_today(), 'otros', 'otros',
      'Tardío', 100, 'directo', '[{"project_id":"64000000-0000-4000-a000-0000000000a2"}]')$$,
  '22023', null, 'Un proyecto cerrado no recibe gastos');
select throws_ok(
  $$select public.save_budget(gen_random_uuid(), '64000000-0000-4000-a000-0000000000a2',
      '[{"category":"otros","concept":"X","quantity":1,"unit_cost":1}]', public.mx_today() - 60, public.mx_today())$$,
  '22023', null, 'Un proyecto cerrado no recibe presupuestos');
select lives_ok(
  $$select public.register_cash_movement(gen_random_uuid(), '24000000-0000-4000-a000-00000000000a', 'pago_gasto',
      public.mx_today(), 50, 'efectivo', p_expense => '9c000000-0000-4000-a000-0000000000b3')$$,
  'Tras el cierre sí se pagan gastos (es flujo, no costo)');

select * from finish();
rollback;
