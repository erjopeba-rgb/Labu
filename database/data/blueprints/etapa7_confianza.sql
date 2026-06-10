-- ETAPA 7: SISTEMA DE CONFIANZA AVANZADO

-- 1. TRABAJADORES DE CONFIANZA (FAVORITOS)
CREATE TABLE IF NOT EXISTS trabajadores_confianza (
  id SERIAL PRIMARY KEY,
  dueno_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  trabajador_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nota TEXT,
  creado_en TIMESTAMP DEFAULT NOW(),
  UNIQUE (dueno_id, trabajador_id)
);

-- 2. AGENDA DE MANTENIMIENTO RECURRENTE
CREATE TABLE IF NOT EXISTS mantenimientos_recurrentes (
  id SERIAL PRIMARY KEY,
  dueno_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  trabajador_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tarea_id INTEGER REFERENCES tareas(id),
  rubro_id INTEGER REFERENCES rubros(id),
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  frecuencia VARCHAR(20) NOT NULL CHECK (frecuencia IN ('semanal','quincenal','mensual','bimestral','trimestral','anual')),
  proximo_vencimiento DATE NOT NULL,
  ultimo_trabajo_id INTEGER REFERENCES trabajos(id),
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

-- INDICES
CREATE INDEX IF NOT EXISTS idx_confianza_dueno ON trabajadores_confianza(dueno_id);
CREATE INDEX IF NOT EXISTS idx_confianza_trabajador ON trabajadores_confianza(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_mantenimiento_dueno ON mantenimientos_recurrentes(dueno_id);
CREATE INDEX IF NOT EXISTS idx_mantenimiento_vencimiento ON mantenimientos_recurrentes(proximo_vencimiento);
