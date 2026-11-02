-- =============================================================================
-- AgroGestión 360 · Datos de DEMOSTRACIÓN (solo entorno local)
-- Organización ficticia "Agropecuaria Los Campos" marcada con is_demo = true.
-- Usuarios de prueba (contraseña para todos: Demo12345!):
--   propietario@demo.agrogestion360.mx   · Propietario
--   agronomo@demo.agrogestion360.mx      · Agrónomo
--   campo@demo.agrogestion360.mx         · Supervisor de campo
--   consulta@demo.agrogestion360.mx      · Consulta
-- Al final se cargan ranchos, parcelas, cultivos y proyectos de demostración (Fase 2).
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
