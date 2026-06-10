-- Sistema de amigos y seguidores entre usuarios
-- Reglas:
--   Dueno <-> Dueno       = amigo (necesita aceptacion)
--   Dueno  -> Trabajador  = seguidor (auto-aceptado)
--   Trabajador <-> Trabajador = amigo (necesita aceptacion)
--
-- Ejecutar en psql: \i database/migrations/relaciones_usuarios.sql

CREATE TABLE IF NOT EXISTS relaciones_usuarios (
    id              SERIAL PRIMARY KEY,
    solicitante_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    receptor_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('amigo', 'seguidor')),
    estado          VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente', 'aceptado')),
    creado_en       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (solicitante_id, receptor_id)
);

CREATE INDEX IF NOT EXISTS idx_relaciones_receptor    ON relaciones_usuarios(receptor_id, estado);
CREATE INDEX IF NOT EXISTS idx_relaciones_solicitante ON relaciones_usuarios(solicitante_id);
