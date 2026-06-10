-- ETAPA 11: FEATURES DIFERENCIADORAS

-- 1. PLANNER 2D
CREATE TABLE IF NOT EXISTS planners (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  trabajo_id INTEGER REFERENCES trabajos(id) ON DELETE SET NULL,
  nombre VARCHAR(255) NOT NULL,
  ancho_total NUMERIC(10,2),
  alto_total NUMERIC(10,2),
  unidad VARCHAR(10) DEFAULT 'metros',
  datos_json JSONB NOT NULL DEFAULT '{}',
  thumbnail_url TEXT,
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

-- 2. PROYECTOS COMPLETOS
CREATE TABLE IF NOT EXISTS proyectos (
  id SERIAL PRIMARY KEY,
  dueno_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  estado VARCHAR(20) DEFAULT 'planificacion'
    CHECK (estado IN ('planificacion','en_curso','pausado','finalizado','cancelado')),
  presupuesto_total NUMERIC(12,2),
  fecha_inicio DATE,
  fecha_estimada_fin DATE,
  planner_id INTEGER REFERENCES planners(id),
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trabajos_proyecto (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  trabajo_id INTEGER NOT NULL REFERENCES trabajos(id) ON DELETE CASCADE,
  orden INTEGER DEFAULT 0,
  depende_de INTEGER REFERENCES trabajos_proyecto(id),
  UNIQUE (proyecto_id, trabajo_id)
);

-- 3. INVENTARIO DE HERRAMIENTAS
CREATE TABLE IF NOT EXISTS herramientas (
  id SERIAL PRIMARY KEY,
  trabajador_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  categoria VARCHAR(100),
  marca VARCHAR(100),
  foto_url TEXT,
  disponible BOOLEAN DEFAULT TRUE,
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- VIDEOS EDUCATIVOS - nivel y URL
ALTER TABLE videos_educativos ADD COLUMN IF NOT EXISTS nivel VARCHAR(20) DEFAULT 'principiante'
  CHECK (nivel IN ('principiante','intermedio','avanzado'));
ALTER TABLE videos_educativos ADD COLUMN IF NOT EXISTS url_externo TEXT;

-- INDICES
CREATE INDEX IF NOT EXISTS idx_planners_usuario ON planners(usuario_id);
CREATE INDEX IF NOT EXISTS idx_planners_trabajo ON planners(trabajo_id);
CREATE INDEX IF NOT EXISTS idx_proyectos_dueno ON proyectos(dueno_id);
CREATE INDEX IF NOT EXISTS idx_trabajos_proyecto ON trabajos_proyecto(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_herramientas_trabajador ON herramientas(trabajador_id);
