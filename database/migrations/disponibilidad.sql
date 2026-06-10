-- Disponibilidad semanal del trabajador
-- Ejecutar en PostgreSQL para crear las tablas necesarias

CREATE TABLE IF NOT EXISTS disponibilidad_trabajador (
    id              SERIAL PRIMARY KEY,
    trabajador_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    dia_semana      SMALLINT NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
    -- 0=lunes, 1=martes, 2=miercoles, 3=jueves, 4=viernes, 5=sabado, 6=domingo
    hora_inicio     TIME NOT NULL,
    hora_fin        TIME NOT NULL,
    activo          BOOLEAN DEFAULT TRUE,
    creado_en       TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disp_trabajador ON disponibilidad_trabajador(trabajador_id);

-- Reservas tentativas: franjas horarias propuestas en una oferta
-- Estado: tentativa -> confirmada (una elegida) o liberada (rechazadas/no elegidas)

CREATE TABLE IF NOT EXISTS reservas_tentativas (
    id              SERIAL PRIMARY KEY,
    oferta_id       INTEGER NOT NULL REFERENCES ofertas(id) ON DELETE CASCADE,
    trabajador_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    trabajo_id      INTEGER NOT NULL REFERENCES trabajos(id) ON DELETE CASCADE,
    dia_semana      SMALLINT NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
    hora_inicio     TIME NOT NULL,
    hora_fin        TIME NOT NULL,
    estado          VARCHAR(20) DEFAULT 'tentativa'
                    CHECK (estado IN ('tentativa', 'confirmada', 'liberada')),
    creado_en       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservas_oferta     ON reservas_tentativas(oferta_id);
CREATE INDEX IF NOT EXISTS idx_reservas_trabajador ON reservas_tentativas(trabajador_id, estado);
