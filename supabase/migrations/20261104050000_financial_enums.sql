-- =============================================================================
-- AgroGestión 360 · Migración 0006a · Valores de enum de la Fase 5
--
-- Archivo propio porque PostgreSQL no permite usar un valor de enum en la
-- misma transacción que lo agrega (la migración 20261104050100 lo usa en
-- vistas y funciones).
-- =============================================================================

-- Mantenimiento de infraestructura del proyecto (cintilla, sistema de riego,
-- cercos…). El mantenimiento de maquinaria sigue siendo costo del equipo.
alter type public.expense_category add value if not exists 'mantenimiento' before 'otros';
