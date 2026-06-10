-- Tabla de reportes de publicaciones y comentarios
CREATE TABLE IF NOT EXISTS reportes (
    id            SERIAL PRIMARY KEY,
    tipo          VARCHAR(20)  NOT NULL CHECK (tipo IN ('comentario', 'publicacion')),
    referencia_id INT          NOT NULL,
    reportado_por INT          NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    motivo        VARCHAR(50)  NOT NULL CHECK (motivo IN ('contenido_inapropiado', 'spam', 'informacion_falsa', 'otro')),
    estado        VARCHAR(20)  NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'revisado')),
    creado_en     TIMESTAMPTZ  DEFAULT NOW()
);

-- Evita que un usuario reporte el mismo contenido dos veces
CREATE UNIQUE INDEX IF NOT EXISTS idx_reportes_unique
    ON reportes(tipo, referencia_id, reportado_por);

CREATE INDEX IF NOT EXISTS idx_reportes_estado
    ON reportes(estado);
