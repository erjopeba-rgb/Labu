-- ETAPA 4: PERFILES, PORTFOLIO Y AYUDANTES

-- 1. PORTFOLIO
CREATE TABLE IF NOT EXISTS portfolio_items (
  id SERIAL PRIMARY KEY,
  trabajador_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  trabajo_id INTEGER REFERENCES trabajos(id) ON DELETE SET NULL,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  rubro_id INTEGER REFERENCES rubros(id),
  foto_antes_url TEXT,
  foto_despues_url TEXT,
  fotos_urls TEXT[],
  video_url TEXT,
  destacado BOOLEAN DEFAULT FALSE,
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- 2. HISTORIAL LABORAL
CREATE TABLE IF NOT EXISTS historial_laboral (
  id SERIAL PRIMARY KEY,
  trabajador_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  trabajo_id INTEGER NOT NULL REFERENCES trabajos(id) ON DELETE CASCADE,
  tarea_id INTEGER REFERENCES tareas(id),
  rubro_id INTEGER REFERENCES rubros(id),
  fecha_inicio TIMESTAMP,
  fecha_fin TIMESTAMP DEFAULT NOW(),
  monto_cobrado NUMERIC(12,2),
  calificacion_recibida NUMERIC(2,1),
  como_ayudante BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMP DEFAULT NOW(),
  UNIQUE (trabajador_id, trabajo_id)
);

-- 3. CALENDARIO LABORAL
CREATE TABLE IF NOT EXISTS eventos_calendario (
  id SERIAL PRIMARY KEY,
  trabajador_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  trabajo_id INTEGER REFERENCES trabajos(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  fecha_inicio TIMESTAMP NOT NULL,
  fecha_fin TIMESTAMP,
  rubro_id INTEGER REFERENCES rubros(id),
  tipo VARCHAR(30) DEFAULT 'trabajo' CHECK (tipo IN ('trabajo','disponible','bloqueado')),
  creado_en TIMESTAMP DEFAULT NOW()
);

-- 4. ESTADISTICAS Y GAMIFICACION
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

CREATE TABLE IF NOT EXISTS badges (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  icono VARCHAR(100),
  condicion_tipo VARCHAR(50) NOT NULL,
  condicion_valor INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS badges_usuario (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES badges(id),
  desbloqueado_en TIMESTAMP DEFAULT NOW(),
  UNIQUE (usuario_id, badge_id)
);

-- 5. SISTEMA DE AYUDANTES
CREATE TABLE IF NOT EXISTS solicitudes_ayudante (
  id SERIAL PRIMARY KEY,
  trabajo_id INTEGER NOT NULL REFERENCES trabajos(id) ON DELETE CASCADE,
  trabajador_lider_id INTEGER NOT NULL REFERENCES usuarios(id),
  cantidad_necesaria INTEGER NOT NULL DEFAULT 1,
  pago_por_ayudante NUMERIC(12,2) NOT NULL,
  descripcion TEXT,
  estado VARCHAR(20) DEFAULT 'abierta' CHECK (estado IN ('abierta','cubierta','cerrada','cancelada')),
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS aplicaciones_ayudante (
  id SERIAL PRIMARY KEY,
  solicitud_id INTEGER NOT NULL REFERENCES solicitudes_ayudante(id) ON DELETE CASCADE,
  ayudante_id INTEGER NOT NULL REFERENCES usuarios(id),
  estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aceptado','rechazado','cancelado')),
  creado_en TIMESTAMP DEFAULT NOW(),
  UNIQUE (solicitud_id, ayudante_id)
);

CREATE TABLE IF NOT EXISTS pagos_ayudante (
  id SERIAL PRIMARY KEY,
  aplicacion_id INTEGER NOT NULL REFERENCES aplicaciones_ayudante(id),
  trabajo_id INTEGER NOT NULL REFERENCES trabajos(id),
  ayudante_id INTEGER NOT NULL REFERENCES usuarios(id),
  trabajador_lider_id INTEGER NOT NULL REFERENCES usuarios(id),
  monto NUMERIC(12,2) NOT NULL,
  estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente','procesado','fallido')),
  procesado_en TIMESTAMP,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- 6. AMONESTACIONES
CREATE TABLE IF NOT EXISTS amonestaciones (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  trabajo_id INTEGER REFERENCES trabajos(id),
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('ayudante_no_registrado','otro')),
  descripcion TEXT NOT NULL,
  numero_amonestacion INTEGER NOT NULL DEFAULT 1,
  activa BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- COLUMNAS EXTRA EN TABLAS EXISTENTES
ALTER TABLE trabajos ADD COLUMN IF NOT EXISTS tiene_solicitud_ayudantes BOOLEAN DEFAULT FALSE;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS foto_url TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS racha_dias INTEGER DEFAULT 0;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS total_badges INTEGER DEFAULT 0;

-- INDICES
CREATE INDEX IF NOT EXISTS idx_portfolio_trabajador ON portfolio_items(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_historial_trabajador ON historial_laboral(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_calendario_trabajador ON eventos_calendario(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_trabajo ON solicitudes_ayudante(trabajo_id);
CREATE INDEX IF NOT EXISTS idx_aplicaciones_solicitud ON aplicaciones_ayudante(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_amonestaciones_usuario ON amonestaciones(usuario_id);

-- BADGES INICIALES
INSERT INTO badges (codigo, nombre, descripcion, icono, condicion_tipo, condicion_valor) VALUES
('primer_trabajo',    'Primer Trabajo',      'Completaste tu primer trabajo',              'estrella',   'total_trabajos', 1),
('trabajos_5',        '5 Trabajos',          'Completaste 5 trabajos',                     'medalla',    'total_trabajos', 5),
('trabajos_10',       '10 Trabajos',         'Completaste 10 trabajos',                    'trofeo',     'total_trabajos', 10),
('trabajos_50',       '50 Trabajos',         'Completaste 50 trabajos - Eres un experto',  'diamante',   'total_trabajos', 50),
('trabajos_100',      '100 Trabajos',        'Leyenda de la plataforma',                   'corona',     'total_trabajos', 100),
('racha_7',           'Racha de 7 dias',     '7 dias consecutivos con actividad',          'fuego',      'racha_dias',     7),
('racha_30',          'Racha de 30 dias',    '30 dias consecutivos con actividad',         'cohete',     'racha_dias',     30),
('cinco_estrellas',   'Cinco Estrellas',     'Promedio de calificacion mayor a 4.5',       'brillante',  'promedio_cal',   45),
('primer_ayudante',   'Primer Ayudante',     'Trabajaste como ayudante por primera vez',   'apretón',    'trabajos_ayud',  1),
('independiente',     'Independiente',       'Evolucionaste a trabajador independiente',   'aguila',     'total_trabajos', 20)
ON CONFLICT (codigo) DO NOTHING;
