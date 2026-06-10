-- Sistema de contactos (similar a amigos de Facebook)
-- Estado: pendiente (solicitud enviada) | aceptado (contactos mutuos)

CREATE TABLE IF NOT EXISTS contactos (
    id              SERIAL PRIMARY KEY,
    solicitante_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    receptor_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    estado          VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente', 'aceptado')),
    creado_en       TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (solicitante_id, receptor_id)
);

CREATE INDEX IF NOT EXISTS idx_contactos_solicitante ON contactos(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_contactos_receptor    ON contactos(receptor_id);
CREATE INDEX IF NOT EXISTS idx_contactos_estado      ON contactos(estado);
