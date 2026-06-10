-- ============================================================
-- MIGRACIÓN: Campos extendidos de perfil trabajador
-- ============================================================

-- 1. Nuevas columnas en perfiles
ALTER TABLE perfiles
    ADD COLUMN IF NOT EXISTS anios_experiencia      INTEGER,
    ADD COLUMN IF NOT EXISTS descripcion_habilidades TEXT,
    ADD COLUMN IF NOT EXISTS herramientas            TEXT,
    ADD COLUMN IF NOT EXISTS disponibilidad_general  VARCHAR(20)
        CHECK (disponibilidad_general IN ('full_time', 'part_time', 'fines_semana'));

-- 2. Rubros del trabajador (multi-select)
CREATE TABLE IF NOT EXISTS perfil_rubros (
    id         SERIAL  PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    rubro_id   INTEGER NOT NULL REFERENCES rubros(id)   ON DELETE CASCADE,
    UNIQUE (usuario_id, rubro_id)
);

CREATE INDEX IF NOT EXISTS idx_perfil_rubros_usuario ON perfil_rubros(usuario_id);

-- 3. Zonas donde trabaja (multi-valor)
CREATE TABLE IF NOT EXISTS perfil_zonas (
    id         SERIAL       PRIMARY KEY,
    usuario_id INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    localidad  VARCHAR(200) NOT NULL,
    UNIQUE (usuario_id, localidad)
);

CREATE INDEX IF NOT EXISTS idx_perfil_zonas_usuario ON perfil_zonas(usuario_id);
