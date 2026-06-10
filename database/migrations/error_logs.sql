-- Tabla para logging de errores 5xx inesperados del servidor
CREATE TABLE IF NOT EXISTS error_logs (
    id           SERIAL PRIMARY KEY,
    mensaje      TEXT        NOT NULL,
    stack        TEXT,
    url          VARCHAR(500),
    metodo       VARCHAR(10),
    usuario_id   INTEGER     REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_creado_en ON error_logs(creado_en DESC);
