-- Fix: evitar conversaciones duplicadas para el mismo tipo+referencia_id
-- Unique constraint parcial: solo aplica cuando referencia_id NO es NULL
CREATE UNIQUE INDEX IF NOT EXISTS conversaciones_tipo_referencia_uq
  ON conversaciones (tipo, referencia_id)
  WHERE referencia_id IS NOT NULL;
