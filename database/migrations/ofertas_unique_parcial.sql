-- Reemplaza el UNIQUE global por un índice parcial:
-- solo bloquea si el trabajador ya tiene oferta activa (pendiente o contraoferta).
-- Permite volver a ofertar si la oferta anterior fue rechazada, cancelada o aceptada.

ALTER TABLE ofertas DROP CONSTRAINT IF EXISTS ofertas_trabajo_id_trabajador_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ofertas_unica_activa
    ON ofertas (trabajo_id, trabajador_id)
    WHERE estado IN ('pendiente', 'contraoferta');
