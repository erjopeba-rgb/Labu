-- Reemplazar tabla de disputas con schema simplificado
DROP TABLE IF EXISTS disputas CASCADE;

CREATE TABLE IF NOT EXISTS disputas (
  id            SERIAL PRIMARY KEY,
  trabajo_id    INT          NOT NULL REFERENCES trabajos(id) ON DELETE CASCADE,
  iniciador_id  INT          NOT NULL REFERENCES usuarios(id),
  acusado_id    INT          NOT NULL REFERENCES usuarios(id),
  motivo        VARCHAR(100) NOT NULL,
  descripcion   TEXT,
  evidencia_urls JSONB       NOT NULL DEFAULT '[]',
  estado        VARCHAR(20)  NOT NULL DEFAULT 'abierta'
                  CHECK (estado IN ('abierta', 'en_revision', 'resuelta', 'cerrada')),
  resolucion    TEXT,
  creado_en     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disputas_trabajo    ON disputas(trabajo_id);
CREATE INDEX IF NOT EXISTS idx_disputas_iniciador  ON disputas(iniciador_id);
CREATE INDEX IF NOT EXISTS idx_disputas_acusado    ON disputas(acusado_id);
CREATE INDEX IF NOT EXISTS idx_disputas_estado     ON disputas(estado);
