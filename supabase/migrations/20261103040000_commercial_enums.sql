-- =============================================================================
-- AgroGestión 360 · Migración 0005a · Estados de venta de la Fase 4
--
-- Va en un archivo propio: PostgreSQL no permite usar un valor agregado con
-- ALTER TYPE … ADD VALUE dentro de la misma transacción que lo crea.
--
-- Ciclo de una venta: borrador → confirmada (descuenta los lotes) → entregada;
-- con pagos pasa a parcialmente_pagada o pagada. «vigente» equivalía a una venta
-- confirmada, así que se renombra (las ventas existentes conservan su sentido).
-- =============================================================================

alter type public.sale_status rename value 'vigente' to 'confirmada';
alter type public.sale_status add value if not exists 'borrador' before 'confirmada';
alter type public.sale_status add value if not exists 'entregada' after 'confirmada';
alter type public.sale_status add value if not exists 'parcialmente_pagada' after 'entregada';
alter type public.sale_status add value if not exists 'pagada' after 'parcialmente_pagada';
