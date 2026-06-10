-- ============================================================
-- MIGRACIÓN: Sistema de verificación de identidad
-- ============================================================

-- 1. ENUM de estado de verificación
DO $$ BEGIN
  CREATE TYPE estado_verificacion AS ENUM (
    'no_verificado',
    'pendiente',
    'aprobado',
    'rechazado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tabla de verificaciones de identidad
CREATE TABLE IF NOT EXISTS verificaciones_identidad (
  id               SERIAL PRIMARY KEY,
  usuario_id       INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  dni_frente_url   VARCHAR(500) NOT NULL,
  dni_dorso_url    VARCHAR(500) NOT NULL,
  selfie_url       VARCHAR(500) NOT NULL,
  estado           estado_verificacion NOT NULL DEFAULT 'pendiente',
  motivo_rechazo   TEXT,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solo una verificación activa (pendiente o aprobada) por usuario
CREATE UNIQUE INDEX IF NOT EXISTS idx_verificaciones_usuario_activa
  ON verificaciones_identidad(usuario_id)
  WHERE estado IN ('pendiente', 'aprobado');

CREATE INDEX IF NOT EXISTS idx_verificaciones_estado
  ON verificaciones_identidad(estado);

-- 3. Campo verificado en perfiles
ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS verificado BOOLEAN NOT NULL DEFAULT FALSE;
