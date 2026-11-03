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
  e_5 constant uuid := '00000000-0000-4000-a700-000000000005';
  e_6 constant uuid := '00000000-0000-4000-a700-000000000006';
  -- Clientes y ventas
  c_export constant uuid := '00000000-0000-4000-a800-000000000001';
  c_congel constant uuid := '00000000-0000-4000-a800-000000000002';
  c_abasto constant uuid := '00000000-0000-4000-a800-000000000003';
  s_1 constant uuid := '00000000-0000-4000-a900-000000000001';
  s_2 constant uuid := '00000000-0000-4000-a900-000000000002';
  s_3 constant uuid := '00000000-0000-4000-a900-000000000003';
  s_4 constant uuid := '00000000-0000-4000-a900-000000000004';
  a_1 constant uuid := '00000000-0000-4000-a900-000000000101';
  -- Lotes de producción (cada corte por calidad)
  h_1 constant uuid := '00000000-0000-4000-a910-000000000001';
  h_2 constant uuid := '00000000-0000-4000-a910-000000000002';
  h_3 constant uuid := '00000000-0000-4000-a910-000000000003';
  h_4 constant uuid := '00000000-0000-4000-a910-000000000004';
  h_5 constant uuid := '00000000-0000-4000-a910-000000000005';
  -- Catálogos (las categorías y el almacén general los crea el alta de la organización)
  sup_semillas constant uuid := '00000000-0000-4000-ab00-000000000001';
  sup_fert constant uuid := '00000000-0000-4000-ab00-000000000002';
  sup_agq constant uuid := '00000000-0000-4000-ab00-000000000003';
  sup_gas constant uuid := '00000000-0000-4000-ab00-000000000004';
  sup_inv constant uuid := '00000000-0000-4000-ab00-000000000005';
  i_bio constant uuid := '00000000-0000-4000-a500-000000000007';
  w_norte constant uuid := '00000000-0000-4000-ac00-000000000001';
  cat_sem uuid;
  cat_fer uuid;
  cat_agq uuid;
  cat_bio uuid;
  cat_com uuid;
  w_general uuid;
  d date := public.mx_today();
  k int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  select id into cat_sem from public.inventory_categories where organization_id = v_org and kind = 'semilla';
  select id into cat_fer from public.inventory_categories where organization_id = v_org and kind = 'fertilizante';
  select id into cat_agq from public.inventory_categories where organization_id = v_org and kind = 'agroquimico';
  select id into cat_bio from public.inventory_categories where organization_id = v_org and kind = 'biologico';
  select id into cat_com from public.inventory_categories where organization_id = v_org and kind = 'combustible';
  select id into w_general from public.warehouses where organization_id = v_org and name = 'Almacén general';

  insert into public.suppliers (id, organization_id, name, rfc, contact_name, phone) values
    (sup_semillas, v_org, 'Semillas del Bajío',          'SBA100312MN4', 'Óscar Medina',   '462 555 0401'),
    (sup_fert,     v_org, 'Fertilizantes de Guanajuato', 'FGU080125RT2', 'Laura Pineda',   '462 555 0402'),
    (sup_agq,      v_org, 'Agroquímicos Irapuato',       null,           'Héctor Ramos',   '462 555 0403'),
    (sup_gas,      v_org, 'Gasolinera El Copal',         null,           null,             '462 555 0404'),
    (sup_inv,      v_org, 'Invernaderos Valle Verde',    null,           'Sofía Aguilar',  '461 555 0405');

  -- Personal (antes que el inventario: los movimientos registran responsable)
  insert into public.employees (id, organization_id, full_name, position, phone, daily_wage, worker_type, hire_date) values
    (e_1, v_org, 'Pedro Sánchez Luna',   'Tractorista',          '462 555 0201', 450, 'planta',   '2019-02-11'),
    (e_2, v_org, 'Miguel Ortega Ruiz',   'Aplicador',            '462 555 0202', 400, 'planta',   '2021-07-01'),
    (e_3, v_org, 'Rosa María Vega',      'Jornalera',            null,           350, 'eventual', d - 120),
    (e_4, v_org, 'Raúl Díaz Hernández',  'Chofer',               '462 555 0204', 420, 'planta',   '2022-03-15'),
    (e_5, v_org, 'Juana López Mata',     'Jornalera',            null,           350, 'temporal', d - 90),
    (e_6, v_org, 'Ernesto Ríos Paz',     'Jornalero',            null,           350, 'temporal', d - 90);

  -- Inventario: compras (no son costo de proyecto) y consumos (sí lo son)
  insert into public.inventory_products (id, organization_id, name, sku, category_id, unit, min_stock, track_lots) values
    (i_semilla,  v_org, 'Semilla maíz blanco H-377',      'SEM-001', cat_sem, 'saco', 10,   true),
    (i_urea,     v_org, 'Urea 46 %',                      'FER-001', cat_fer, 'kg',   2000, false),
    (i_dap,      v_org, 'Fosfato diamónico DAP 18-46-00', 'FER-002', cat_fer, 'kg',   1000, false),
    (i_fungi,    v_org, 'Fungicida clorotalonil 720',     'AGQ-001', cat_agq, 'l',    40,   true),
    (i_diesel,   v_org, 'Diésel',                         'COM-001', cat_com, 'l',    500,  false),
    (i_plantula, v_org, 'Plántula de brócoli Avenger',    'SEM-002', cat_sem, 'pieza', null, false),
    (i_bio,      v_org, 'Trichoderma harzianum WP',       'BIO-001', cat_bio, 'kg',   5,    true);

  perform public.register_inventory_movement(gen_random_uuid(), i_semilla, 'entrada', d - 110, 60, 3850,
    p_supplier => sup_semillas, p_reference => 'F-10231', p_lot_number => 'H377-26A', p_lot_expiry => d + 250,
    p_responsible => e_4);
  perform public.register_inventory_movement(gen_random_uuid(), i_urea, 'entrada', d - 110, 12000, 9.80,
    p_supplier => sup_fert, p_reference => 'FG-5520');
  perform public.register_inventory_movement(gen_random_uuid(), i_urea, 'entrada', d - 50, 8000, 10.60,
    p_supplier => sup_fert, p_reference => 'FG-5871');
  perform public.register_inventory_movement(gen_random_uuid(), i_dap, 'entrada', d - 110, 6000, 14.20,
    p_supplier => sup_fert, p_reference => 'FG-5521');
  perform public.register_inventory_movement(gen_random_uuid(), i_fungi, 'entrada', d - 70, 120, 285,
    p_supplier => sup_agq, p_reference => 'AI-889', p_lot_number => 'CL720-2401', p_lot_expiry => d + 420);
  perform public.register_inventory_movement(gen_random_uuid(), i_diesel, 'entrada', d - 112, 6000, 23.90,
    p_supplier => sup_gas, p_reference => 'GC-3302');
  perform public.register_inventory_movement(gen_random_uuid(), i_diesel, 'entrada', d - 45, 4000, 24.60,
    p_supplier => sup_gas, p_reference => 'GC-3517');
  perform public.register_inventory_movement(gen_random_uuid(), i_plantula, 'entrada', d - 86, 900000, 0.42,
    p_supplier => sup_inv, p_reference => 'IVV-120');
  perform public.register_inventory_movement(gen_random_uuid(), i_bio, 'entrada', d - 60, 20, 310,
    p_supplier => sup_agq, p_reference => 'AI-902', p_lot_number => 'TH-0925', p_lot_expiry => d + 20);

  -- Maíz (45 ha): siembra y fertilización
  perform public.register_inventory_movement(gen_random_uuid(), i_semilla, 'consumo', d - 104, 30, p_project => p_maiz, p_plot => pl_sur,
    p_lot_number => 'H377-26A', p_responsible => e_1);
  perform public.register_inventory_movement(gen_random_uuid(), i_semilla, 'consumo', d - 104, 15, p_project => p_maiz, p_plot => pl_bajio,
    p_lot_number => 'H377-26A', p_responsible => e_1);
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
  perform public.register_inventory_movement(gen_random_uuid(), i_diesel, 'consumo', d - 40, 600, p_project => p_jito, p_plot => pl_norte);

  -- Brócoli (20 ha)
  perform public.register_inventory_movement(gen_random_uuid(), i_plantula, 'consumo', d - 85, 880000, p_project => p_broc, p_plot => pl_lote1);
  perform public.register_inventory_movement(gen_random_uuid(), i_urea, 'consumo', d - 55, 4000, p_project => p_broc, p_plot => pl_lote1);
  perform public.register_inventory_movement(gen_random_uuid(), i_dap, 'consumo', d - 84, 1200, p_project => p_broc, p_plot => pl_lote1);
  perform public.register_inventory_movement(gen_random_uuid(), i_diesel, 'consumo', d - 30, 1400, p_project => p_broc, p_plot => pl_lote1);

  -- Merma por derrame (no es costo de proyecto)
  perform public.register_inventory_movement(gen_random_uuid(), i_diesel, 'ajuste_salida', d - 10, 35,
    p_notes => 'Derrame en tanque de almacenamiento');

  -- Maquinaria (tarifas sin combustible: el diésel sale del inventario)
  insert into public.machinery (id, organization_id, name, code, kind, brand, model, serial_number, acquisition_date,
                                acquisition_cost, responsible_id, rate_basis, hourly_cost, daily_rate,
                                maintenance_interval_hours, maintenance_interval_days, notes) values
    (m_tractor,    v_org, 'Tractor John Deere 6110', 'TR-01', 'tractor', 'John Deere', '6110J', '1PY6110JLKB001234', '2020-03-10',
     1450000, e_1, 'hora', 650, null, 250, 180, 'Incluye operador y depreciación; sin combustible.'),
    (m_sembradora, v_org, 'Sembradora de precisión 6 surcos', 'SM-01', 'implemento', 'Gaspardo', 'MTE-R 6', 'GS-88120', '2021-01-20',
     380000, e_1, 'hora', 280, null, null, 365, null),
    (m_aspersora,  v_org, 'Aspersora de aguilón 600 l', 'AS-01', 'aspersora', 'Swissmex', 'Aguilón 600', null, '2022-05-02',
     95000, e_2, 'jornada', 180, 1200, 40, null, 'Se renta por jornada a proyectos.'),
    (m_camion,     v_org, 'Camión Ford F-450 redilas', 'CM-01', 'vehiculo', 'Ford', 'F-450 2019', '1FDUF4GT5KEC12345', '2019-08-30',
     780000, e_4, 'hora', 350, null, 300, 120, null);

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

  -- Gastos directos (sin insumos, maquinaria ni mano de obra). Pasan por la RPC
  -- real: encabezado con proveedor del catálogo y reparto al proyecto. Los que
  -- llevan p_payment quedan pagados; los demás quedan por pagar.
  insert into public.suppliers (id, organization_id, name, rfc, contact_name, phone) values
    ('00000000-0000-4000-ab00-000000000011', v_org, 'Ejido San Roque',            null,           'Comisariado ejidal', null),
    ('00000000-0000-4000-ab00-000000000012', v_org, 'Módulo de riego Irapuato',   null,           null,                 '462 555 0412'),
    ('00000000-0000-4000-ab00-000000000013', v_org, 'Agroasemex',                 'AGR901105SP1', null,                 null),
    ('00000000-0000-4000-ab00-000000000014', v_org, 'CFE',                        'CSS160330CP7', null,                 null),
    ('00000000-0000-4000-ab00-000000000015', v_org, 'Agroconsultores del Centro', null,           'Ing. Marta Salas',   '461 555 0415'),
    ('00000000-0000-4000-ab00-000000000016', v_org, 'Transportes Frío Express',   null,           'Daniel Cortés',      '461 555 0416'),
    ('00000000-0000-4000-ab00-000000000017', v_org, 'Empacadora del Bajío',       null,           'Patricia Núñez',     '461 555 0417');

  perform public.register_expense('00000000-0000-4000-b400-000000000001', v_org, d - 118, 'renta_tierra', 'otros',
    'Renta de 15 ha El Bajío ciclo P-V', 67500, 'directo', jsonb_build_array(jsonb_build_object('project_id', p_maiz)),
    '00000000-0000-4000-ab00-000000000011', 'ESR-2026-04', 'transferencia',
    p_payment => jsonb_build_object('id', '00000000-0000-4000-b500-000000000001', 'date', d - 118, 'reference', 'SPEI 1001'));
  perform public.register_expense('00000000-0000-4000-b400-000000000002', v_org, d - 90, 'agua_riego', 'riego',
    'Cuota de riego de auxilio', 18900, 'directo', jsonb_build_array(jsonb_build_object('project_id', p_maiz)),
    '00000000-0000-4000-ab00-000000000012', 'MRI-7781', 'deposito');
  perform public.register_expense('00000000-0000-4000-b400-000000000003', v_org, d - 80, 'seguros', 'otros',
    'Seguro agrícola catastrófico', 21600, 'directo', jsonb_build_array(jsonb_build_object('project_id', p_maiz)),
    '00000000-0000-4000-ab00-000000000013', 'AGX-55120', 'transferencia',
    p_payment => jsonb_build_object('id', '00000000-0000-4000-b500-000000000003', 'date', d - 78, 'reference', 'SPEI 1044'));
  perform public.register_expense('00000000-0000-4000-b400-000000000004', v_org, d - 45, 'energia', 'riego',
    'Bombeo para fertirriego', 14300, 'directo', jsonb_build_array(jsonb_build_object('project_id', p_jito, 'plot_id', pl_norte)),
    '00000000-0000-4000-ab00-000000000014', 'CFE-0926', 'transferencia',
    p_payment => jsonb_build_object('id', '00000000-0000-4000-b500-000000000004', 'date', d - 40, 'reference', 'Domiciliado'));
  perform public.register_expense('00000000-0000-4000-b400-000000000005', v_org, d - 35, 'servicios_profesionales', 'otros',
    'Asesoría técnica en nutrición', 12000, 'directo', jsonb_build_array(jsonb_build_object('project_id', p_jito)),
    '00000000-0000-4000-ab00-000000000015', 'ACC-311', 'transferencia');
  perform public.register_expense('00000000-0000-4000-b400-000000000006', v_org, d - 80, 'energia', 'riego',
    'Bombeo para riego por pivote', 22800, 'directo', jsonb_build_array(jsonb_build_object('project_id', p_broc, 'plot_id', pl_lote1)),
    '00000000-0000-4000-ab00-000000000014', 'CFE-0914', 'transferencia',
    p_payment => jsonb_build_object('id', '00000000-0000-4000-b500-000000000006', 'date', d - 75, 'reference', 'Domiciliado'));
  perform public.register_expense('00000000-0000-4000-b400-000000000007', v_org, d - 20, 'fletes', 'transporte',
    'Flete refrigerado a Celaya', 28500, 'directo', jsonb_build_array(jsonb_build_object('project_id', p_broc)),
    '00000000-0000-4000-ab00-000000000016', 'TFE-1290', 'transferencia',
    p_payment => jsonb_build_object('id', '00000000-0000-4000-b500-000000000007', 'date', d - 14, 'reference', 'SPEI 2210'));
  perform public.register_expense('00000000-0000-4000-b400-000000000008', v_org, d - 12, 'fletes', 'transporte',
    'Flete refrigerado a Celaya', 28500, 'directo', jsonb_build_array(jsonb_build_object('project_id', p_broc)),
    '00000000-0000-4000-ab00-000000000016', 'TFE-1342', 'transferencia');
  perform public.register_expense('00000000-0000-4000-b400-000000000009', v_org, d - 10, 'maquila', 'cosecha',
    'Hidroenfriado y empaque', 41200, 'directo', jsonb_build_array(jsonb_build_object('project_id', p_broc)),
    '00000000-0000-4000-ab00-000000000017', 'EDB-4410', 'transferencia');

  -- Cortes de brócoli (proyecto en cosecha): cada corte por calidad es un lote
  -- LOT-AAAA-0001. Se capturan en cajas, toneladas o kg; la existencia es en kg.
  insert into public.harvests (id, organization_id, project_id, plot_id, harvest_date, cut_number, quality, classification,
                               unit, quantity, unit_weight_kg, packages, responsible_id, notes) values
    (h_1, v_org, p_broc, pl_lote1, d - 25, 1, 'primera', 'Exportación', 'caja', 2100, 20, 2100, e_3, 'Primer corte, cabeza compacta'),
    (h_2, v_org, p_broc, pl_lote1, d - 18, 2, 'segunda', 'Congelado',   'kg',   12000, null, 600, e_3, null),
    (h_3, v_org, p_broc, pl_lote1, d - 15, 3, 'primera', 'Nacional',    't',    38.5, null, 1925, e_3, null),
    (h_4, v_org, p_broc, pl_lote1, d - 6,  4, 'primera', 'Exportación', 'caja', 900, 20, 900, e_6, null),
    (h_5, v_org, p_broc, pl_lote1, d - 6,  4, 'segunda', 'Congelado',   'kg',   4000, null, null, e_6, 'Mismo corte, segunda calidad');

  -- Clientes
  insert into public.customers (id, organization_id, name, customer_type, rfc, contact_name, phone, email, address, credit_days) values
    (c_export, v_org, 'Exportadora Hortícola del Bajío', 'exportadora', 'EHB120415KQ3', 'Mariana Lozano', '461 555 0301',
     'compras@demo-exportadora.mx', 'Carretera Celaya–Salvatierra km 4, Celaya, Gto.', 30),
    (c_congel, v_org, 'Congeladora Valle Verde',         'industria',   'CVV090722HT8', 'Jorge Arriaga',  '461 555 0302', null, null, 15),
    (c_abasto, v_org, 'Comercializadora Central de Abasto', 'mayorista', null,           'Luis Mendoza',   '462 555 0303', null, null, 7);

  -- Venta de exportación: anticipo sobre el borrador, confirmación (descuenta el
  -- lote), aplicación explícita del anticipo, entrega y un pago parcial.
  perform public.save_sale(s_1, c_export, d - 20,
    jsonb_build_array(jsonb_build_object('harvest_id', h_1, 'description', 'Brócoli de exportación', 'unit', 'caja',
                                         'unit_weight_kg', 20, 'quantity', 2000, 'unit_price', 196)),
    p_delivery_date => d - 19, p_notes => 'Entrega LAB empacadora Celaya');
  perform public.register_payment(a_1, s_1, d - 21, 150000, 'transferencia', 'Anticipo SPEI 0034511', p_kind => 'anticipo');
  perform public.confirm_sale(s_1);
  perform public.apply_advance(gen_random_uuid(), a_1, null, d - 18);
  perform public.register_delivery(gen_random_uuid(), s_1, d - 19, null, 'Mariana Lozano', 'Thermo King placas GT-45-210');
  perform public.register_payment(gen_random_uuid(), s_1, d - 5, 100000, 'transferencia', 'SPEI 0035120');

  -- Venta con dos lotes (primera y segunda), entregada en dos viajes y pagada.
  perform public.save_sale(s_2, c_congel, d - 12,
    jsonb_build_array(
      jsonb_build_object('harvest_id', h_3, 'description', 'Brócoli para congelado', 'unit', 't', 'quantity', 30, 'unit_price', 8500),
      jsonb_build_object('harvest_id', h_2, 'description', 'Brócoli para congelado', 'unit', 'kg', 'quantity', 10000, 'unit_price', 5.20)),
    p_notes => 'Entrega en planta Celaya', p_confirm => true);
  perform public.register_delivery(gen_random_uuid(), s_2, d - 12,
    jsonb_build_array(jsonb_build_object('sale_item_id', (select id from public.sale_items where sale_id = s_2 and harvest_id = h_3), 'quantity', 20)),
    'Recepción planta Celaya', 'Camión propio');
  perform public.register_delivery(gen_random_uuid(), s_2, d - 11, null, 'Recepción planta Celaya', 'Camión propio');
  perform public.register_payment(gen_random_uuid(), s_2, d - 8, 200000, 'transferencia', 'SPEI 7712');
  perform public.register_payment(gen_random_uuid(), s_2, d - 2, 107000, 'cheque', 'Cheque 004581');

  -- Venta de contado con descuento, sin entregar ni pagar (vencida).
  perform public.save_sale(s_3, c_abasto, d - 9,
    jsonb_build_array(jsonb_build_object('harvest_id', h_3, 'description', 'Brócoli mercado nacional', 'unit', 'kg',
                                         'quantity', 6000, 'unit_price', 7.50, 'discount', 500)),
    p_confirm => true);

  -- Borrador: aún no descuenta el lote.
  perform public.save_sale(s_4, c_export, d,
    jsonb_build_array(jsonb_build_object('harvest_id', h_4, 'description', 'Brócoli de exportación', 'unit', 'caja',
                                         'unit_weight_kg', 20, 'quantity', 300, 'unit_price', 200)),
    p_delivery_date => d + 2);

  -- Mermas y pérdidas justificadas
  perform public.register_production_adjustment(gen_random_uuid(), h_2, 'merma', 300, d - 10, 'Rezaga por manchado detectada en selección');
  perform public.register_production_adjustment(gen_random_uuid(), h_1, 'perdida', 150, d - 19, 'Cajas dañadas en maniobra de carga');

  -- ===========================================================================
  -- Control operativo: almacenes, bitácoras, maquinaria y personal
  -- ===========================================================================

  -- Segundo almacén y transferencia de diésel (no cambia el valor ni los costos)
  insert into public.warehouses (id, organization_id, name, code, farm_id, location, responsible_id) values
    (w_norte, v_org, 'Bodega La Esperanza', 'BG-ESP', '00000000-0000-4000-a100-000000000002', 'Junto al pivote del Lote 1', e_4);
  perform public.register_inventory_movement(gen_random_uuid(), i_diesel, 'transferencia', d - 9, 800,
    p_warehouse => w_general,
    p_to_warehouse => w_norte, p_responsible => e_4, p_notes => 'Abasto para cosecha de brócoli');

  -- Aplicaciones (el producto sale del almacén en la misma operación)
  perform public.register_chemical_application('00000000-0000-4000-ad00-000000000001', p_broc, pl_lote1, d - 40, i_fungi, 50, 20,
    p_warehouse => w_general, p_lot_number => 'CL720-2401', p_time => '07:30', p_active_ingredient => 'Clorotalonil 720 g/l', p_responsible => e_2,
    p_machine => m_aspersora, p_reentry_hours => 48, p_preharvest_days => 7, p_notes => 'Prevención de mildiu');
  perform public.register_chemical_application('00000000-0000-4000-ad00-000000000002', p_jito, pl_norte, d - 20, i_fungi, 36, 12,
    p_warehouse => w_general, p_lot_number => 'CL720-2401', p_time => '06:45', p_active_ingredient => 'Clorotalonil 720 g/l', p_responsible => e_2,
    p_machine => m_aspersora, p_reentry_hours => 48, p_preharvest_days => 7);
  perform public.register_chemical_application('00000000-0000-4000-ad00-000000000003', p_jito, pl_norte, d - 10, i_bio, 4, 6,
    p_warehouse => w_general, p_lot_number => 'TH-0925', p_time => '17:00', p_active_ingredient => 'Trichoderma harzianum', p_responsible => e_2, p_equipment => 'Drench por sistema de goteo');

  -- Riegos
  insert into public.irrigation_logs (id, organization_id, project_id, plot_id, log_date, start_time, end_time, irrigation_system, water_m3, responsible_id, notes) values
    ('00000000-0000-4000-ae00-000000000001', v_org, p_maiz, pl_sur,   d - 75, '06:00', '14:00', 'gravedad', 2400, e_1, 'Riego de auxilio'),
    ('00000000-0000-4000-ae00-000000000002', v_org, p_maiz, pl_bajio, d - 74, '20:00', '04:00', 'aspersion', 1100, e_1, 'Riego nocturno'),
    ('00000000-0000-4000-ae00-000000000003', v_org, p_jito, pl_norte, d - 30, '07:00', '09:30', 'goteo', 180, e_2, null),
    ('00000000-0000-4000-ae00-000000000004', v_org, p_jito, pl_norte, d - 25, '07:00', '09:30', 'goteo', 185, e_2, null),
    ('00000000-0000-4000-ae00-000000000005', v_org, p_jito, pl_norte, d - 20, '07:00', '10:00', 'goteo', null, e_2, 'Fertirriego'),
    ('00000000-0000-4000-ae00-000000000006', v_org, p_broc, pl_lote1, d - 45, '05:00', '11:00', 'pivote', 1600, e_4, null),
    ('00000000-0000-4000-ae00-000000000007', v_org, p_broc, pl_lote1, d - 30, '05:00', '10:30', 'pivote', 1450, e_4, null);

  -- Actividades de campo (costo solo si no está en otro módulo)
  insert into public.field_activities (id, organization_id, project_id, plot_id, activity_type_id, activity_date, description, responsible_id, cost, notes)
  select x.id, v_org, x.project_id, x.plot_id, t.id, x.activity_date, x.description, x.responsible_id, x.cost, x.notes
  from (values
    ('00000000-0000-4000-af00-000000000001'::uuid, p_maiz, pl_sur, 'Preparación de terreno', d - 116, 'Barbecho, rastra y surcado', e_1, 0::numeric, 'Tractor registrado en Maquinaria'),
    ('00000000-0000-4000-af00-000000000002'::uuid, p_maiz, null, 'Siembra', d - 104, 'Siembra a 80 cm entre surcos', e_1, 0, null),
    ('00000000-0000-4000-af00-000000000003'::uuid, p_maiz, pl_bajio, 'Deshierbe', d - 65, 'Deshierbe mecánico con servicio contratado', null, 6800, 'Servicio externo; no incluye jornales propios'),
    ('00000000-0000-4000-af00-000000000004'::uuid, p_jito, pl_norte, 'Trasplante', d - 40, 'Trasplante a doble hilera', e_3, 0, null),
    ('00000000-0000-4000-af00-000000000005'::uuid, p_jito, pl_norte, 'Poda', d - 12, 'Poda de brotes laterales', e_3, 0, null),
    ('00000000-0000-4000-af00-000000000006'::uuid, p_broc, pl_lote1, 'Control fitosanitario', d - 41, 'Monitoreo de plagas previo a aplicación', e_2, 0, 'Presencia baja de palomilla dorso de diamante')
  ) as x(id, project_id, plot_id, type_name, activity_date, description, responsible_id, cost, notes)
  join public.activity_types t on t.organization_id = v_org and t.name = x.type_name;

  -- Uso de maquinaria con combustible surtido del almacén y uso por jornada
  perform public.register_machinery_usage(gen_random_uuid(), m_tractor, p_maiz, d - 30, 6, pl_sur,
    p_operator_id => e_1, p_activity => 'Cultivo y aporque',
    p_activity_type => (select id from public.activity_types where organization_id = v_org and name = 'Deshierbe'),
    p_fuel_quantity => 60, p_fuel_product => i_diesel, p_fuel_warehouse => w_general);
  perform public.register_machinery_usage(gen_random_uuid(), m_aspersora, p_jito, d - 10, 4, pl_norte,
    p_rate_basis => 'jornada', p_jornadas => 0.5, p_operator_id => e_2, p_activity => 'Aplicación de biológico');

  -- Mantenimientos (costo del equipo, no de los proyectos)
  insert into public.machinery_maintenance (id, organization_id, machine_id, maintenance_date, kind, description, provider, cost, hour_meter, responsible_id) values
    ('00000000-0000-4000-b100-000000000001', v_org, m_tractor, d - 125, 'preventivo', 'Servicio de 250 h: aceite, filtros y engrase', 'Agromaquinaria del Bajío', 8600, 3120, e_1),
    ('00000000-0000-4000-b100-000000000002', v_org, m_aspersora, d - 28, 'correctivo', 'Cambio de boquillas y manguera de presión', null, 2350, null, e_2),
    ('00000000-0000-4000-b100-000000000003', v_org, m_camion, d - 140, 'preventivo', 'Afinación y cambio de llantas traseras', 'Servicio Ford Irapuato', 14900, null, e_4);

  -- Cuadrilla, asignaciones, jornada de cuadrilla y asistencia
  insert into public.crews (id, organization_id, name, leader_id, notes) values
    ('00000000-0000-4000-b200-000000000001', v_org, 'Cuadrilla La Esperanza', e_3, 'Corte y labores manuales de brócoli');
  insert into public.crew_members (organization_id, crew_id, employee_id) values
    (v_org, '00000000-0000-4000-b200-000000000001', e_3),
    (v_org, '00000000-0000-4000-b200-000000000001', e_5),
    (v_org, '00000000-0000-4000-b200-000000000001', e_6);
  insert into public.employee_assignments (organization_id, employee_id, project_id, plot_id, crew_id, start_date, role) values
    (v_org, e_2, p_jito, pl_norte, null, d - 50, 'Aplicador y tutoreo'),
    (v_org, e_3, p_broc, pl_lote1, '00000000-0000-4000-b200-000000000001', d - 30, 'Jefa de cuadrilla'),
    (v_org, e_5, p_broc, pl_lote1, '00000000-0000-4000-b200-000000000001', d - 30, null),
    (v_org, e_6, p_broc, pl_lote1, '00000000-0000-4000-b200-000000000001', d - 30, null);
  insert into public.attendance_records (organization_id, employee_id, work_date, status, notes) values
    (v_org, e_5, d - 3, 'falta', 'Sin aviso');
  perform public.register_crew_labor('00000000-0000-4000-b300-000000000001', '00000000-0000-4000-b200-000000000001', p_broc,
    d - 4, 'Deshierbe manual entre camas', 1, p_plot => pl_lote1,
    p_activity_type => (select id from public.activity_types where organization_id = v_org and name = 'Deshierbe'));
  perform public.register_crew_labor('00000000-0000-4000-b300-000000000002', '00000000-0000-4000-b200-000000000001', p_broc,
    d - 3, 'Deshierbe manual entre camas', 1, p_plot => pl_lote1, p_employees => array[e_3, e_6]);

  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- =============================================================================
-- Fase 5 · Presupuestos, gastos compartidos y flujo de efectivo de DEMOSTRACIÓN
-- Presupuestos por categoría (brócoli con una revisión que conserva la
-- versión original), dos gastos compartidos (por superficie y por porcentaje)
-- y movimientos de efectivo: pagos de gastos, pagos a proveedores y otros
-- ingresos/egresos (uno cancelado). Todo pasa por las RPC reales.
-- =============================================================================
do $$
declare
  v_org constant uuid := '00000000-0000-4000-a000-000000000001';
  v_owner constant uuid := '00000000-0000-4000-b000-000000000001';
  p_maiz constant uuid := '00000000-0000-4000-a400-000000000001';
  p_jito constant uuid := '00000000-0000-4000-a400-000000000002';
  p_broc constant uuid := '00000000-0000-4000-a400-000000000003';
  p_sorgo constant uuid := '00000000-0000-4000-a400-000000000004';
  b_broc_v1 constant uuid := '00000000-0000-4000-b600-000000000003';
  d date := public.mx_today();
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  -- Maíz (45 ha): semilla, fertilizante y combustible ya cerca o por encima de lo presupuestado.
  perform public.save_budget('00000000-0000-4000-b600-000000000001', p_maiz, '[
    {"category":"preparacion_terreno","concept":"Barbecho, rastra y surcado (servicio)","unit":"ha","quantity":45,"unit_cost":1800},
    {"category":"semillas","concept":"Semilla maíz blanco H-377","unit":"saco","quantity":45,"unit_cost":3700},
    {"category":"fertilizantes","concept":"DAP 18-46-00","unit":"kg","quantity":4500,"unit_cost":14.5},
    {"category":"fertilizantes","concept":"Urea 46 %","unit":"kg","quantity":9000,"unit_cost":10},
    {"category":"agroquimicos","concept":"Insecticida para gusano cogollero","unit":"l","quantity":45,"unit_cost":450},
    {"category":"riego","concept":"Cuotas de riego de auxilio","unit":"riego","quantity":2,"unit_cost":18900},
    {"category":"mano_obra","concept":"Jornales de deshierbe y aporque","unit":"jornal","quantity":80,"unit_cost":350},
    {"category":"maquinaria","concept":"Tractor (barbecho, cultivo y aporque)","unit":"h","quantity":70,"unit_cost":650},
    {"category":"maquinaria","concept":"Sembradora de precisión","unit":"h","quantity":14,"unit_cost":280},
    {"category":"maquinaria","concept":"Aspersora","unit":"jornada","quantity":3,"unit_cost":1200},
    {"category":"combustible","concept":"Diésel","unit":"l","quantity":3000,"unit_cost":24},
    {"category":"mantenimiento","concept":"Mantenimiento de canales y bomba","unit":"servicio","quantity":1,"unit_cost":12000},
    {"category":"cosecha","concept":"Cosecha mecánica","unit":"ha","quantity":45,"unit_cost":2500},
    {"category":"transporte","concept":"Fletes a bodega","unit":"t","quantity":520,"unit_cost":180},
    {"category":"otros","concept":"Renta de 15 ha El Bajío","unit":"ciclo","quantity":1,"unit_cost":67500},
    {"category":"otros","concept":"Seguro agrícola","unit":"ha","quantity":45,"unit_cost":480},
    {"category":"otros","concept":"Asesoría técnica (parte proporcional)","unit":"ciclo","quantity":1,"unit_cost":15000}
  ]'::jsonb, d - 125, d + 45, p_notes => 'Presupuesto del ciclo P-V autorizado por la dirección.');

  -- Jitomate (12 ha): ciclo largo, aún con poco avance.
  perform public.save_budget('00000000-0000-4000-b600-000000000002', p_jito, '[
    {"category":"preparacion_terreno","concept":"Camas, acolchado y cintilla","unit":"ha","quantity":12,"unit_cost":18000},
    {"category":"semillas","concept":"Plántula saladette injertada","unit":"pieza","quantity":300000,"unit_cost":1.6},
    {"category":"fertilizantes","concept":"Programa de fertirriego","unit":"ha","quantity":12,"unit_cost":21000},
    {"category":"agroquimicos","concept":"Programa fitosanitario","unit":"ha","quantity":12,"unit_cost":15000},
    {"category":"riego","concept":"Energía para bombeo","unit":"mes","quantity":5,"unit_cost":14000},
    {"category":"mano_obra","concept":"Tutoreo, poda y cosecha","unit":"jornal","quantity":1800,"unit_cost":360},
    {"category":"maquinaria","concept":"Tractor y aspersora","unit":"h","quantity":90,"unit_cost":650},
    {"category":"combustible","concept":"Diésel","unit":"l","quantity":1600,"unit_cost":24.5},
    {"category":"mantenimiento","concept":"Reposición de cintilla y válvulas","unit":"servicio","quantity":1,"unit_cost":45000},
    {"category":"cosecha","concept":"Empaque y selección","unit":"caja","quantity":30000,"unit_cost":9},
    {"category":"transporte","concept":"Fletes a central de abasto","unit":"viaje","quantity":40,"unit_cost":3500},
    {"category":"otros","concept":"Asesoría técnica y certificación","unit":"ciclo","quantity":1,"unit_cost":60000}
  ]'::jsonb, d - 60, d + 120);

  -- Brócoli (20 ha): versión original y una revisión por el programa de exportación.
  perform public.save_budget(b_broc_v1, p_broc, '[
    {"category":"preparacion_terreno","concept":"Preparación de suelo y camas","unit":"ha","quantity":20,"unit_cost":1500},
    {"category":"semillas","concept":"Plántula de brócoli Avenger","unit":"pieza","quantity":880000,"unit_cost":0.40},
    {"category":"fertilizantes","concept":"Urea y DAP","unit":"ha","quantity":20,"unit_cost":3000},
    {"category":"agroquimicos","concept":"Fungicidas e insecticidas","unit":"ha","quantity":20,"unit_cost":1250},
    {"category":"riego","concept":"Energía para riego por pivote","unit":"mes","quantity":4,"unit_cost":10000},
    {"category":"mano_obra","concept":"Trasplante, deshierbe y corte","unit":"ciclo","quantity":1,"unit_cost":110000},
    {"category":"maquinaria","concept":"Tractor, aspersora y camión","unit":"h","quantity":40,"unit_cost":600},
    {"category":"combustible","concept":"Diésel","unit":"l","quantity":1400,"unit_cost":24},
    {"category":"cosecha","concept":"Hidroenfriado y empaque","unit":"caja","quantity":4000,"unit_cost":7.5},
    {"category":"transporte","concept":"Fletes refrigerados","unit":"viaje","quantity":1,"unit_cost":30000},
    {"category":"otros","concept":"Asesoría técnica (parte proporcional)","unit":"ciclo","quantity":1,"unit_cost":8000}
  ]'::jsonb, d - 95, d + 15, p_notes => 'Presupuesto original del ciclo O-I.');
  perform public.save_budget('00000000-0000-4000-b600-000000000004', p_broc, '[
    {"category":"preparacion_terreno","concept":"Preparación de suelo y camas","unit":"ha","quantity":20,"unit_cost":1500},
    {"category":"semillas","concept":"Plántula de brócoli Avenger","unit":"pieza","quantity":880000,"unit_cost":0.42},
    {"category":"fertilizantes","concept":"Urea y DAP","unit":"ha","quantity":20,"unit_cost":3000},
    {"category":"agroquimicos","concept":"Fungicidas e insecticidas","unit":"ha","quantity":20,"unit_cost":1250},
    {"category":"riego","concept":"Energía para riego por pivote","unit":"mes","quantity":4,"unit_cost":10000},
    {"category":"mano_obra","concept":"Trasplante, deshierbe y corte","unit":"ciclo","quantity":1,"unit_cost":130000},
    {"category":"maquinaria","concept":"Tractor, aspersora y camión","unit":"h","quantity":40,"unit_cost":600},
    {"category":"combustible","concept":"Diésel","unit":"l","quantity":1450,"unit_cost":24},
    {"category":"mantenimiento","concept":"Mantenimiento del pivote","unit":"servicio","quantity":1,"unit_cost":8000},
    {"category":"cosecha","concept":"Hidroenfriado y empaque","unit":"caja","quantity":5000,"unit_cost":9},
    {"category":"transporte","concept":"Fletes refrigerados a Celaya","unit":"viaje","quantity":2,"unit_cost":30000},
    {"category":"otros","concept":"Asesoría técnica (parte proporcional)","unit":"ciclo","quantity":1,"unit_cost":12000}
  ]'::jsonb, d - 95, d + 15, p_base_version => 1,
    p_reason => 'Programa de exportación: más fletes refrigerados, empaque y corte; ajuste de precio de plántula');

  -- Sorgo (en planeación)
  perform public.save_budget('00000000-0000-4000-b600-000000000005', p_sorgo, '[
    {"category":"preparacion_terreno","concept":"Barbecho y rastra","unit":"ha","quantity":22,"unit_cost":1800},
    {"category":"semillas","concept":"Semilla sorgo escobero","unit":"kg","quantity":330,"unit_cost":95},
    {"category":"fertilizantes","concept":"Fertilización de fondo y cobertera","unit":"ha","quantity":22,"unit_cost":4200},
    {"category":"mano_obra","concept":"Jornales","unit":"jornal","quantity":120,"unit_cost":350},
    {"category":"maquinaria","concept":"Tractor y sembradora","unit":"h","quantity":60,"unit_cost":650},
    {"category":"combustible","concept":"Diésel","unit":"l","quantity":1500,"unit_cost":24},
    {"category":"cosecha","concept":"Corte y amarre de escoba","unit":"ha","quantity":22,"unit_cost":3500},
    {"category":"otros","concept":"Seguro agrícola","unit":"ha","quantity":22,"unit_cost":480}
  ]'::jsonb, d + 10, d + 150);

  -- Gastos compartidos: asesoría por superficie (45 / 12 / 20 ha) y
  -- mantenimiento del sistema de riego por porcentaje.
  perform public.register_expense('00000000-0000-4000-b400-000000000101', v_org, d - 30, 'servicios_profesionales', 'otros',
    'Asesoría técnica integral del ciclo', 36000, 'superficie',
    jsonb_build_array(jsonb_build_object('project_id', p_maiz), jsonb_build_object('project_id', p_jito),
                      jsonb_build_object('project_id', p_broc)),
    '00000000-0000-4000-ab00-000000000015', 'ACC-330', 'transferencia',
    p_notes => 'Contrato anual de asesoría; se reparte por hectáreas sembradas.');
  perform public.register_expense('00000000-0000-4000-b400-000000000102', v_org, d - 22, 'mantenimiento', 'mantenimiento',
    'Reparación de bomba y válvulas del sistema de riego', 18000, 'porcentaje',
    jsonb_build_array(jsonb_build_object('project_id', p_maiz, 'value', 50), jsonb_build_object('project_id', p_jito, 'value', 20),
                      jsonb_build_object('project_id', p_broc, 'value', 30)),
    null, null, 'efectivo', p_notes => 'Pozo compartido por los tres proyectos.');

  -- Pagos de gastos (parciales y totales)
  perform public.register_cash_movement('00000000-0000-4000-b500-000000000101', v_org, 'pago_gasto', d - 25, 20000,
    'transferencia', null, 'SPEI 3120', p_expense => '00000000-0000-4000-b400-000000000101');
  perform public.register_cash_movement('00000000-0000-4000-b500-000000000102', v_org, 'pago_gasto', d - 85, 10000,
    'deposito', 'Abono a cuota de riego', 'Ficha 55102', p_expense => '00000000-0000-4000-b400-000000000002');
  perform public.register_cash_movement('00000000-0000-4000-b500-000000000103', v_org, 'pago_gasto', d - 30, 12000,
    'transferencia', null, 'SPEI 3001', p_expense => '00000000-0000-4000-b400-000000000005');

  -- Pagos a proveedores de almacén (las compras no son costo de proyecto, pero sí salida de dinero)
  perform public.register_cash_movement('00000000-0000-4000-b500-000000000201', v_org, 'pago_proveedor', d - 48, 84800,
    'transferencia', 'Pago factura urea FG-5871', 'SPEI 2650', p_supplier => '00000000-0000-4000-ab00-000000000002');
  perform public.register_cash_movement('00000000-0000-4000-b500-000000000202', v_org, 'pago_proveedor', d - 44, 98400,
    'transferencia', 'Pago factura diésel GC-3517', 'SPEI 2671', p_supplier => '00000000-0000-4000-ab00-000000000004');
  perform public.register_cash_movement('00000000-0000-4000-b500-000000000203', v_org, 'pago_proveedor', d - 84, 378000,
    'transferencia', 'Pago plántula de brócoli IVV-120', 'SPEI 1980', p_supplier => '00000000-0000-4000-ab00-000000000005');

  -- Otros ingresos y egresos
  perform public.register_cash_movement('00000000-0000-4000-b500-000000000301', v_org, 'otro_ingreso', d - 40, 45000,
    'transferencia', 'Apoyo estatal a la productividad de maíz', 'SDAyR-2026-118', p_project => p_maiz);
  perform public.register_cash_movement('00000000-0000-4000-b500-000000000302', v_org, 'otro_egreso', d - 5, 1250,
    'transferencia', 'Comisiones bancarias del mes', 'Estado de cuenta');
  perform public.register_cash_movement('00000000-0000-4000-b500-000000000303', v_org, 'otro_egreso', d - 5, 1250,
    'transferencia', 'Comisiones bancarias del mes', 'Estado de cuenta');
  perform public.cancel_cash_movement('00000000-0000-4000-b500-000000000303', 'Captura duplicada de las comisiones');

  perform set_config('request.jwt.claims', '', true);
end;
$$;
