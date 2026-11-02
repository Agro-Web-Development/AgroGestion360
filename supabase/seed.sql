-- =============================================================================
-- AgroGestión 360 · Datos de DEMOSTRACIÓN (solo entorno local)
-- Organización ficticia "Agropecuaria Los Campos" marcada con is_demo = true.
-- Usuarios de prueba (contraseña para todos: Demo12345!):
--   propietario@demo.agrogestion360.mx   · Propietario
--   agronomo@demo.agrogestion360.mx      · Agrónomo
--   campo@demo.agrogestion360.mx         · Supervisor de campo
--   consulta@demo.agrogestion360.mx      · Consulta
-- Los datos agrícolas de demostración se añaden en las fases siguientes.
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
