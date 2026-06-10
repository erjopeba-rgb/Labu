-- Migración: tabla estadisticas_trabajador (extraída de etapa4_perfiles.sql)
CREATE TABLE IF NOT EXISTS estadisticas_trabajador (
  id SERIAL PRIMARY KEY,
  trabajador_id INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  total_trabajos INTEGER DEFAULT 0,
  trabajos_como_ayudante INTEGER DEFAULT 0,
  total_calificaciones INTEGER DEFAULT 0,
  suma_calificaciones NUMERIC(10,2) DEFAULT 0,
  porcentaje_positivas NUMERIC(5,2) DEFAULT 0,
  racha_dias INTEGER DEFAULT 0,
  racha_semanas INTEGER DEFAULT 0,
  ultimo_trabajo_en TIMESTAMP,
  ultima_actividad_en TIMESTAMP,
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);
