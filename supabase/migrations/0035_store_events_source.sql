-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0035  De dónde llegan las visitas
--   Cada evento de la tienda guarda el origen de la visita en la que pasó:
--   'instagram' | 'whatsapp' | 'facebook' | 'tiktok' | 'buscadores' |
--   'directo' | 'otros' (ver src/lib/visit-source.ts). NULL en los eventos de
--   antes de esta migración: la analítica los deja fuera del reparto por origen.
--
--   Además se empieza a registrar 'visit' en event_type: una por cada vez que
--   alguien entra a la tienda desde afuera, aunque no abra ningún producto.
--   event_type es TEXT sin CHECK, así que no hace falta tocarlo.
--
--   El código funciona con y sin esta migración: mientras no esté, guarda los
--   eventos sin origen.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE store_events ADD COLUMN IF NOT EXISTS source TEXT;
