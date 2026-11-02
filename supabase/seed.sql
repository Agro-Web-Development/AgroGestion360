-- =============================================================================
-- AgroGestión 360 · Datos de DEMOSTRACIÓN (solo entorno local)
-- Organización ficticia "Agropecuaria Los Campos" marcada con is_demo = true.
-- Usuarios de prueba (contraseña para todos: Demo12345!):
--   propietario@demo.agrogestion360.mx   · Propietario
--   agronomo@demo.agrogestion360.mx      · Agrónomo
--   campo@demo.agrogestion360.mx         · Supervisor de campo
--   consulta@demo.agrogestion360.mx      · Consulta
-- Después se cargan ranchos, parcelas, cultivos y proyectos (Fase 2) y, al final,
-- inventario, maquinaria, personal, gastos, cosechas, ventas y pagos (finanzas).
-- =============================================================================

do $$
declare
  v_org constant uuid := '00000000-0000-4000-a000-000000000001';
  v_users constant jsonb := '[
    {"id": "00000000-0000-4000-b000-000000000001", "email": "propietario@demo.agrogestion360.mx", "name": "Laura Méndez Ruiz",     "role": "propietario"},
    {"id": "00000000-0000-4000-b000-000000000002", "email": "agronomo@demo.agrogestion360.mx",    "name": "Ing. Carlos Herrera",   "role": "agronomo"},
    {"id": "00000000-0000-4000-b000-000000000003", "email": "campo@demo.agrogestion360.mx",       "name": "José Luis Ramírez",     "role": "supervisor"},
    {"id": "00000000-0000-4000-b000-000000000004", "email": "consulta@demo.agrogestion360.mx",    "name": "Ana Sofía Torres",      "role": "consulta"}
  ]';
  u jsonb;
begin
  for u in select * from jsonb_array_elements(v_users) loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      (u ->> 'id')::uuid, 'authenticated', 'authenticated', u ->> 'email',
      extensions.crypt('Demo12345!', extensions.gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}',
      jsonb_build_object('full_name', u ->> 'name'),
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), (u ->> 'id')::uuid, u ->> 'id', 'email',
      jsonb_build_object('sub', u ->> 'id', 'email', u ->> 'email', 'email_verified', true),
      now(), now(), now()
    );
  end loop;

  insert into public.organizations (id, name, legal_name, rfc, email, phone, address, is_demo, created_by)
  values (
    v_org, 'Agropecuaria Los Campos', 'Agropecuaria Los Campos S.P.R. de R.L.', 'ALC150301AB1',
    'contacto@demo.agrogestion360.mx', '462 555 0101',
    'Carretera Irapuato–Abasolo km 12, Irapuato, Guanajuato', true,
    '00000000-0000-4000-b000-000000000001'
  );

  insert into public.memberships (organization_id, user_id, role, created_by)
  select v_org, (x.u ->> 'id')::uuid, (x.u ->> 'role')::public.app_role, '00000000-0000-4000-b000-000000000001'
  from jsonb_array_elements(v_users) as x(u);
end;
$$;

-- =============================================================================
-- Fase 2 · Ranchos, parcelas, cultivos y proyectos de DEMOSTRACIÓN
-- Las fechas son relativas al día de la carga para que el dashboard muestre
-- cosechas próximas. Los cambios de estado usan la RPC real (como propietario)
-- para que el historial sea consistente.
-- =============================================================================
do $$
declare
  v_org constant uuid := '00000000-0000-4000-a000-000000000001';
  v_owner constant uuid := '00000000-0000-4000-b000-000000000001';
  v_agro constant uuid := '00000000-0000-4000-b000-000000000002';
  d date := current_date;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  insert into public.farms (id, organization_id, name, code, municipality, state, address, total_area_ha, latitude, longitude) values
    ('00000000-0000-4000-a100-000000000001', v_org, 'El Mezquite', 'MZQ', 'Irapuato', 'Guanajuato',
     'Carretera Irapuato–Abasolo km 12', 85, 20.676700, -101.354200),
    ('00000000-0000-4000-a100-000000000002', v_org, 'La Esperanza', 'ESP', 'Abasolo', 'Guanajuato',
     'Camino a Rancho Nuevo s/n', 60, 20.449900, -101.528600);

  insert into public.plots (id, organization_id, farm_id, name, code, area_ha, soil_type, irrigation_type) values
    ('00000000-0000-4000-a200-000000000001', v_org, '00000000-0000-4000-a100-000000000001', 'Parcela Norte', 'MZQ-N', 25, 'Vertisol', 'goteo'),
    ('00000000-0000-4000-a200-000000000002', v_org, '00000000-0000-4000-a100-000000000001', 'Parcela Sur', 'MZQ-S', 30, 'Vertisol', 'gravedad'),
    ('00000000-0000-4000-a200-000000000003', v_org, '00000000-0000-4000-a100-000000000001', 'El Bajío', 'MZQ-B', 18.5, 'Franco arcilloso', 'aspersion'),
    ('00000000-0000-4000-a200-000000000004', v_org, '00000000-0000-4000-a100-000000000002', 'Lote 1', 'ESP-1', 20, 'Franco', 'pivote'),
    ('00000000-0000-4000-a200-000000000005', v_org, '00000000-0000-4000-a100-000000000002', 'Lote 2', 'ESP-2', 22, 'Franco', 'temporal');

  insert into public.crops (id, organization_id, name, variety, scientific_name, cycle_days, yield_unit) values
    ('00000000-0000-4000-a300-000000000001', v_org, 'Maíz', 'Blanco H-377', 'Zea mays', 150, 'ton'),
    ('00000000-0000-4000-a300-000000000002', v_org, 'Jitomate', 'Saladette', 'Solanum lycopersicum', 120, 'caja'),
    ('00000000-0000-4000-a300-000000000003', v_org, 'Brócoli', 'Avenger', 'Brassica oleracea var. italica', 90, 'ton'),
    ('00000000-0000-4000-a300-000000000004', v_org, 'Sorgo', 'Escobero', 'Sorghum bicolor', 130, 'ton');

  insert into public.projects (id, organization_id, name, crop_id, season, start_date, planting_date,
    expected_harvest_date, expected_yield, budget_amount, responsible_id, description) values
    ('00000000-0000-4000-a400-000000000001', v_org, 'Maíz blanco P-V · El Mezquite', '00000000-0000-4000-a300-000000000001',
     'Primavera-Verano', d - 120, d - 105, d + 30, 520, 1150000, v_agro, 'Siembra de temporal con riego de auxilio.'),
    ('00000000-0000-4000-a400-000000000002', v_org, 'Jitomate saladette · Parcela Norte', '00000000-0000-4000-a300-000000000002',
     'Otoño-Invierno', d - 60, d - 40, d + 80, 42000, 2400000, v_agro, 'Producción en acolchado con fertirriego.'),
    ('00000000-0000-4000-a400-000000000003', v_org, 'Brócoli exportación · La Esperanza', '00000000-0000-4000-a300-000000000003',
     'Otoño-Invierno', d - 95, d - 85, d + 5, 300, 980000, v_owner, null),
    ('00000000-0000-4000-a400-000000000004', v_org, 'Sorgo escobero · Lote 2', '00000000-0000-4000-a300-000000000004',
     'Primavera-Verano', d + 10, null, null, 90, 350000, v_agro, 'En planeación; pendiente confirmar financiamiento.');

  insert into public.project_plots (organization_id, project_id, plot_id, assigned_area_ha) values
    (v_org, '00000000-0000-4000-a400-000000000001', '00000000-0000-4000-a200-000000000002', 30),
    (v_org, '00000000-0000-4000-a400-000000000001', '00000000-0000-4000-a200-000000000003', 15),
    (v_org, '00000000-0000-4000-a400-000000000002', '00000000-0000-4000-a200-000000000001', 12),
    (v_org, '00000000-0000-4000-a400-000000000003', '00000000-0000-4000-a200-000000000004', 20),
    (v_org, '00000000-0000-4000-a400-000000000004', '00000000-0000-4000-a200-000000000005', 22);

  perform public.change_project_status('00000000-0000-4000-a400-000000000001', 'preparacion', 'Barbecho y rastreo');
  perform public.change_project_status('00000000-0000-4000-a400-000000000001', 'siembra', null);
  perform public.change_project_status('00000000-0000-4000-a400-000000000001', 'desarrollo', 'Emergencia uniforme');
  perform public.change_project_status('00000000-0000-4000-a400-000000000002', 'siembra', 'Trasplante de plántula');
  perform public.change_project_status('00000000-0000-4000-a400-000000000002', 'desarrollo', null);
  perform public.change_project_status('00000000-0000-4000-a400-000000000003', 'siembra', null);
  perform public.change_project_status('00000000-0000-4000-a400-000000000003', 'desarrollo', null);
  perform public.change_project_status('00000000-0000-4000-a400-000000000003', 'cosecha', 'Inicio de corte');

  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- =============================================================================
-- Finanzas · Inventario, maquinaria, personal, gastos, cosechas, ventas y pagos
-- de DEMOSTRACIÓN. Todo pasa por las RPC y triggers reales (como propietario),
-- de modo que existencias, costos promedio, saldos y folios son consistentes.
-- Las fechas son relativas al día de la carga (zona horaria de México).
-- =============================================================================
do $$
declare
  v_org constant uuid := '00000000-0000-4000-a000-000000000001';
  v_owner constant uuid := '00000000-0000-4000-b000-000000000001';
  -- Proyectos y parcelas de la Fase 2
  p_maiz constant uuid := '00000000-0000-4000-a400-000000000001';
  p_jito constant uuid := '00000000-0000-4000-a400-000000000002';
  p_broc constant uuid := '00000000-0000-4000-a400-000000000003';
  pl_sur constant uuid := '00000000-0000-4000-a200-000000000002';
  pl_bajio constant uuid := '00000000-0000-4000-a200-000000000003';
  pl_norte constant uuid := '00000000-0000-4000-a200-000000000001';
  pl_lote1 constant uuid := '00000000-0000-4000-a200-000000000004';
  -- Productos
  i_semilla constant uuid := '00000000-0000-4000-a500-000000000001';
  i_urea constant uuid := '00000000-0000-4000-a500-000000000002';
  i_dap constant uuid := '00000000-0000-4000-a500-000000000003';
  i_fungi constant uuid := '00000000-0000-4000-a500-000000000004';
  i_diesel constant uuid := '00000000-0000-4000-a500-000000000005';
  i_plantula constant uuid := '00000000-0000-4000-a500-000000000006';
  -- Maquinaria y personal
  m_tractor constant uuid := '00000000-0000-4000-a600-000000000001';
  m_sembradora constant uuid := '00000000-0000-4000-a600-000000000002';
  m_aspersora constant uuid := '00000000-0000-4000-a600-000000000003';
  m_camion constant uuid := '00000000-0000-4000-a600-000000000004';
  e_1 constant uuid := '00000000-0000-4000-a700-000000000001';
  e_2 constant uuid := '00000000-0000-4000-a700-000000000002';
  e_3 constant uuid := '00000000-0000-4000-a700-000000000003';
  e_4 constant uuid := '00000000-0000-4000-a700-000000000004';
  -- Clientes y ventas
  c_export constant uuid := '00000000-0000-4000-a800-000000000001';
  c_congel constant uuid := '00000000-0000-4000-a800-000000000002';
  c_abasto constant uuid := '00000000-0000-4000-a800-000000000003';
  s_1 constant uuid := '00000000-0000-4000-a900-000000000001';
  s_2 constant uuid := '00000000-0000-4000-a900-000000000002';
  s_3 constant uuid := '00000000-0000-4000-a900-000000000003';
  d date := public.mx_today();
  k int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  -- Inventario: compras (no son costo de proyecto) y consumos (sí lo son)
  insert into public.inventory_products (id, organization_id, name, sku, category, unit, min_stock) values
    (i_semilla,  v_org, 'Semilla maíz blanco H-377',      'SEM-001', 'semilla',      'saco', 10),
    (i_urea,     v_org, 'Urea 46 %',                      'FER-001', 'fertilizante', 'kg',   2000),
    (i_dap,      v_org, 'Fosfato diamónico DAP 18-46-00', 'FER-002', 'fertilizante', 'kg',   1000),
    (i_fungi,    v_org, 'Fungicida clorotalonil 720',     'AGQ-001', 'agroquimico',  'l',    40),
    (i_diesel,   v_org, 'Diésel',                         'COM-001', 'combustible',  'l',    500),
    (i_plantula, v_org, 'Plántula de brócoli Avenger',    'SEM-002', 'semilla',      'pieza', null);

  perform public.register_inventory_movement(gen_random_uuid(), i_semilla, 'entrada', d - 110, 60, 3850,
    p_supplier => 'Semillas del Bajío', p_reference => 'F-10231');
  perform public.register_inventory_movement(gen_random_uuid(), i_urea, 'entrada', d - 110, 12000, 9.80,
    p_supplier => 'Fertilizantes de Guanajuato', p_reference => 'FG-5520');
  perform public.register_inventory_movement(gen_random_uuid(), i_urea, 'entrada', d - 50, 8000, 10.60,
    p_supplier => 'Fertilizantes de Guanajuato', p_reference => 'FG-5871');
  perform public.register_inventory_movement(gen_random_uuid(), i_dap, 'entrada', d - 110, 6000, 14.20,
    p_supplier => 'Fertilizantes de Guanajuato', p_reference => 'FG-5521');
  perform public.register_inventory_movement(gen_random_uuid(), i_fungi, 'entrada', d - 70, 120, 285,
    p_supplier => 'Agroquímicos Irapuato', p_reference => 'AI-889');
  perform public.register_inventory_movement(gen_random_uuid(), i_diesel, 'entrada', d - 112, 6000, 23.90,
    p_supplier => 'Gasolinera El Copal', p_reference => 'GC-3302');
  perform public.register_inventory_movement(gen_random_uuid(), i_diesel, 'entrada', d - 45, 4000, 24.60,
    p_supplier => 'Gasolinera El Copal', p_reference => 'GC-3517');
  perform public.register_inventory_movement(gen_random_uuid(), i_plantula, 'entrada', d - 86, 900000, 0.42,
    p_supplier => 'Invernaderos Valle Verde', p_reference => 'IVV-120');

  -- Maíz (45 ha): siembra y fertilización
  perform public.register_inventory_movement(gen_random_uuid(), i_semilla, 'consumo', d - 104, 30, p_project => p_maiz, p_plot => pl_sur);
  perform public.register_inventory_movement(gen_random_uuid(), i_semilla, 'consumo', d - 104, 15, p_project => p_maiz, p_plot => pl_bajio);
  perform public.register_inventory_movement(gen_random_uuid(), i_dap, 'consumo', d - 104, 3000, p_project => p_maiz, p_plot => pl_sur);
  perform public.register_inventory_movement(gen_random_uuid(), i_dap, 'consumo', d - 104, 1500, p_project => p_maiz, p_plot => pl_bajio);
  perform public.register_inventory_movement(gen_random_uuid(), i_urea, 'consumo', d - 60, 6000, p_project => p_maiz, p_plot => pl_sur);
  perform public.register_inventory_movement(gen_random_uuid(), i_urea, 'consumo', d - 60, 3000, p_project => p_maiz, p_plot => pl_bajio);
  perform public.register_inventory_movement(gen_random_uuid(), i_diesel, 'consumo', d - 104, 1800, p_project => p_maiz, p_plot => pl_sur);
  perform public.register_inventory_movement(gen_random_uuid(), i_diesel, 'consumo', d - 104, 900, p_project => p_maiz, p_plot => pl_bajio);
  -- Devolución de urea no aplicada en El Bajío
  perform public.register_inventory_movement(gen_random_uuid(), i_urea, 'devolucion', d - 58, 400, p_project => p_maiz, p_plot => pl_bajio,
    p_notes => 'Sobrante de la segunda fertilización');

  -- Jitomate (12 ha)
  perform public.register_inventory_movement(gen_random_uuid(), i_urea, 'consumo', d - 30, 2400, p_project => p_jito, p_plot => pl_norte);
  perform public.register_inventory_movement(gen_random_uuid(), i_fungi, 'consumo', d - 20, 36, p_project => p_jito, p_plot => pl_norte);
  perform public.register_inventory_movement(gen_random_uuid(), i_diesel, 'consumo', d - 40, 600, p_project => p_jito, p_plot => pl_norte);

  -- Brócoli (20 ha)
  perform public.register_inventory_movement(gen_random_uuid(), i_plantula, 'consumo', d - 85, 880000, p_project => p_broc, p_plot => pl_lote1);
  perform public.register_inventory_movement(gen_random_uuid(), i_urea, 'consumo', d - 55, 4000, p_project => p_broc, p_plot => pl_lote1);
  perform public.register_inventory_movement(gen_random_uuid(), i_dap, 'consumo', d - 84, 1200, p_project => p_broc, p_plot => pl_lote1);
  perform public.register_inventory_movement(gen_random_uuid(), i_fungi, 'consumo', d - 40, 50, p_project => p_broc, p_plot => pl_lote1);
  perform public.register_inventory_movement(gen_random_uuid(), i_diesel, 'consumo', d - 30, 1400, p_project => p_broc, p_plot => pl_lote1);

  -- Merma por derrame (no es costo de proyecto)
  perform public.register_inventory_movement(gen_random_uuid(), i_diesel, 'ajuste_salida', d - 10, 35,
    p_notes => 'Derrame en tanque de almacenamiento');

  -- Maquinaria (tarifas sin combustible: el diésel sale del inventario)
  insert into public.machinery (id, organization_id, name, code, kind, hourly_cost, notes) values
    (m_tractor,    v_org, 'Tractor John Deere 6110', 'TR-01', 'tractor',    650, 'Incluye operador y depreciación; sin combustible.'),
    (m_sembradora, v_org, 'Sembradora de precisión 6 surcos', 'SM-01', 'implemento', 280, null),
    (m_aspersora,  v_org, 'Aspersora de aguilón 600 l', 'AS-01', 'aspersora',  180, null),
    (m_camion,     v_org, 'Camión Ford F-450 redilas', 'CM-01', 'vehiculo',   350, null);

  insert into public.machinery_usage (organization_id, machine_id, project_id, plot_id, usage_date, hours, operator, activity) values
    (v_org, m_tractor,    p_maiz, pl_sur,   d - 115, 22, 'Pedro Sánchez', 'Barbecho y rastreo'),
    (v_org, m_tractor,    p_maiz, pl_bajio, d - 114, 11, 'Pedro Sánchez', 'Barbecho y rastreo'),
    (v_org, m_sembradora, p_maiz, pl_sur,   d - 104, 9,  'Pedro Sánchez', 'Siembra'),
    (v_org, m_sembradora, p_maiz, pl_bajio, d - 104, 4.5, 'Pedro Sánchez', 'Siembra'),
    (v_org, m_tractor,    p_maiz, pl_sur,   d - 60, 8,  'Pedro Sánchez', 'Fertilización y cultivo'),
    (v_org, m_aspersora,  p_maiz, null,     d - 45, 10, 'Miguel Ortega', 'Control de gusano cogollero'),
    (v_org, m_tractor,    p_jito, pl_norte, d - 55, 14, 'Pedro Sánchez', 'Preparación de camas'),
    (v_org, m_aspersora,  p_jito, pl_norte, d - 20, 6,  'Miguel Ortega', 'Aplicación de fungicida'),
    (v_org, m_tractor,    p_broc, pl_lote1, d - 92, 18, 'Pedro Sánchez', 'Preparación de suelo'),
    (v_org, m_aspersora,  p_broc, pl_lote1, d - 40, 8,  'Miguel Ortega', 'Aplicación de fungicida'),
    (v_org, m_camion,     p_broc, null,     d - 25, 6,  'Raúl Díaz',     'Acarreo de cosecha a empaque'),
    (v_org, m_camion,     p_broc, null,     d - 15, 6,  'Raúl Díaz',     'Acarreo de cosecha a empaque');

  -- Personal y mano de obra (máximo un jornal por empleado y día)
  insert into public.employees (id, organization_id, full_name, position, phone, daily_wage) values
    (e_1, v_org, 'Pedro Sánchez Luna',   'Tractorista',          '462 555 0201', 450),
    (e_2, v_org, 'Miguel Ortega Ruiz',   'Aplicador',            '462 555 0202', 400),
    (e_3, v_org, 'Rosa María Vega',      'Jornalera',            null,           350),
    (e_4, v_org, 'Raúl Díaz Hernández',  'Chofer',               '462 555 0204', 420);

  for k in 0..9 loop
    insert into public.labor_records (organization_id, project_id, plot_id, employee_id, work_date, activity, quantity) values
      (v_org, p_maiz, pl_sur, e_3, d - 100 + k * 3, 'Deshierbe y aporque', 1),
      (v_org, p_jito, pl_norte, e_2, d - 50 + k * 3, 'Tutoreo y amarre', 1);
  end loop;
  insert into public.labor_records (organization_id, project_id, plot_id, employee_id, crew, work_date, activity, pay_type, quantity, unit_label, unit_rate) values
    (v_org, p_maiz, null,     null, 'Cuadrilla de 10 jornaleros', d - 70, 'Deshierbe manual', 'jornal', 10, null, 350),
    (v_org, p_jito, pl_norte, null, 'Cuadrilla de trasplante',    d - 40, 'Trasplante', 'destajo', 120000, 'planta', 0.12),
    (v_org, p_broc, pl_lote1, null, 'Cuadrilla de trasplante',    d - 85, 'Trasplante', 'destajo', 880000, 'planta', 0.08),
    (v_org, p_broc, pl_lote1, null, 'Cuadrilla de corte (12)',    d - 25, 'Corte y empaque', 'destajo', 2100, 'caja', 9),
    (v_org, p_broc, pl_lote1, null, 'Cuadrilla de corte (12)',    d - 18, 'Corte y empaque', 'destajo', 600, 'caja', 9),
    (v_org, p_broc, pl_lote1, null, 'Cuadrilla de corte (12)',    d - 15, 'Corte y empaque', 'destajo', 1925, 'caja', 9),
    (v_org, p_broc, pl_lote1, null, 'Cuadrilla de corte (12)',    d - 6,  'Corte y empaque', 'destajo', 900, 'caja', 9);
  insert into public.labor_records (organization_id, project_id, plot_id, employee_id, work_date, activity, quantity) values
    (v_org, p_broc, null, e_4, d - 25, 'Acarreo de cosecha', 1),
    (v_org, p_broc, null, e_4, d - 15, 'Acarreo de cosecha', 1);

  -- Gastos directos (sin insumos, maquinaria ni mano de obra)
  insert into public.project_expenses (organization_id, project_id, plot_id, expense_date, category, description, supplier, invoice_ref, amount) values
    (v_org, p_maiz, null,     d - 118, 'renta_tierra',            'Renta de 15 ha El Bajío ciclo P-V', 'Ejido San Roque', 'ESR-2026-04', 67500),
    (v_org, p_maiz, null,     d - 90,  'agua_riego',              'Cuota de riego de auxilio',        'Módulo de riego Irapuato', 'MRI-7781', 18900),
    (v_org, p_maiz, null,     d - 80,  'seguros',                 'Seguro agrícola catastrófico',     'Agroasemex', 'AGX-55120', 21600),
    (v_org, p_jito, pl_norte, d - 45,  'energia',                 'Bombeo para fertirriego',          'CFE', 'CFE-0926', 14300),
    (v_org, p_jito, null,     d - 35,  'servicios_profesionales', 'Asesoría técnica en nutrición',    'Agroconsultores del Centro', 'ACC-311', 12000),
    (v_org, p_broc, pl_lote1, d - 80,  'energia',                 'Bombeo para riego por pivote',     'CFE', 'CFE-0914', 22800),
    (v_org, p_broc, null,     d - 20,  'fletes',                  'Flete refrigerado a Celaya',       'Transportes Frío Express', 'TFE-1290', 28500),
    (v_org, p_broc, null,     d - 12,  'fletes',                  'Flete refrigerado a Celaya',       'Transportes Frío Express', 'TFE-1342', 28500),
    (v_org, p_broc, null,     d - 10,  'maquila',                 'Hidroenfriado y empaque',          'Empacadora del Bajío', 'EDB-4410', 41200);

  -- Cosechas de brócoli (proyecto en cosecha)
  insert into public.harvests (organization_id, project_id, plot_id, harvest_date, quality, quantity_kg, packages) values
    (v_org, p_broc, pl_lote1, d - 25, 'primera', 42000, 2100),
    (v_org, p_broc, pl_lote1, d - 18, 'segunda', 12000, 600),
    (v_org, p_broc, pl_lote1, d - 15, 'primera', 38500, 1925),
    (v_org, p_broc, pl_lote1, d - 6,  'primera', 18000, 900);

  -- Clientes, ventas (folio VTA) y pagos parciales
  insert into public.customers (id, organization_id, name, rfc, contact_name, phone, email, credit_days) values
    (c_export, v_org, 'Exportadora Hortícola del Bajío', 'EHB120415KQ3', 'Mariana Lozano', '461 555 0301', 'compras@demo-exportadora.mx', 30),
    (c_congel, v_org, 'Congeladora Valle Verde',         'CVV090722HT8', 'Jorge Arriaga',  '461 555 0302', null, 15),
    (c_abasto, v_org, 'Comercializadora Central de Abasto', null,       'Luis Mendoza',   '462 555 0303', null, 7);

  perform public.create_sale(s_1, c_export, d - 20,
    jsonb_build_array(jsonb_build_object('project_id', p_broc, 'description', 'Brócoli de exportación', 'quality', 'primera',
                                         'quantity_kg', 40000, 'unit_price', 9.80)));
  perform public.create_sale(s_2, c_congel, d - 12,
    jsonb_build_array(
      jsonb_build_object('project_id', p_broc, 'description', 'Brócoli para congelado', 'quality', 'primera', 'quantity_kg', 30000, 'unit_price', 8.50),
      jsonb_build_object('project_id', p_broc, 'description', 'Brócoli para congelado', 'quality', 'segunda', 'quantity_kg', 10000, 'unit_price', 5.20)),
    p_notes => 'Entrega en planta Celaya');
  perform public.create_sale(s_3, c_abasto, d - 9,
    jsonb_build_array(jsonb_build_object('project_id', p_broc, 'description', 'Brócoli mercado nacional', 'quality', 'primera',
                                         'quantity_kg', 6000, 'unit_price', 7.50)));

  perform public.register_payment(gen_random_uuid(), s_1, d - 18, 150000, 'transferencia', 'Anticipo SPEI 0034511');
  perform public.register_payment(gen_random_uuid(), s_1, d - 5, 100000, 'transferencia', 'SPEI 0035120');
  perform public.register_payment(gen_random_uuid(), s_2, d - 8, 200000, 'transferencia', 'SPEI 7712');
  perform public.register_payment(gen_random_uuid(), s_2, d - 2, 107000, 'cheque', 'Cheque 004581');

  perform set_config('request.jwt.claims', '', true);
end;
$$;
