-- Tabla de comentarios en publicaciones de trabajos
CREATE TABLE IF NOT EXISTS comentarios (
    id          SERIAL PRIMARY KEY,
    trabajo_id  INT NOT NULL REFERENCES trabajos(id) ON DELETE CASCADE,
    usuario_id  INT NOT NULL REFERENCES usuarios(id),
    contenido   TEXT NOT NULL,
    creado_en   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comentarios_trabajo_id ON comentarios(trabajo_id);
