-- ============================================================
-- MIGRACIÓN: Flujo completo de trabajo
-- Pasos 5-9: llegada, foto resultado, auto-portfolio, calificaciones
-- ============================================================

-- 1. Nuevos estados en trabajos (el campo es un ENUM, no varchar)
-- El CHECK CONSTRAINT anterior no funcionaba porque estado usa tipo enum estado_trabajo
ALTER TYPE estado_trabajo ADD VALUE IF NOT EXISTS 'trabajador_llego';
ALTER TYPE estado_trabajo ADD VALUE IF NOT EXISTS 'completado';

-- 2. Columnas para foto y texto del resultado (subidos por el trabajador)
ALTER TABLE trabajos ADD COLUMN IF NOT EXISTS foto_resultado_url  TEXT;
ALTER TABLE trabajos ADD COLUMN IF NOT EXISTS texto_resultado     TEXT;

-- 3. Índice para búsqueda por trabajador en ofertas (para /api/jobs/asignados)
CREATE INDEX IF NOT EXISTS idx_ofertas_estado_trabajador ON ofertas(trabajador_id, estado);
