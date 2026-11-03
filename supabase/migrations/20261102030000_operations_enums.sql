-- =============================================================================
-- AgroGestión 360 · Migración 0004a · Valores nuevos de enumeraciones
--
-- Va en un archivo propio: PostgreSQL no permite usar un valor agregado con
-- ALTER TYPE … ADD VALUE dentro de la misma transacción que lo crea.
-- =============================================================================

-- Transferencia entre almacenes: mueve existencia sin cambiar el valor del
-- producto ni imputar costo a proyectos.
alter type public.inventory_movement_type add value if not exists 'transferencia';
