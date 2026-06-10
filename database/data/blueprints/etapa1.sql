-- ============================================================
-- ETAPA 1: SCHEMA BASE
-- Tablas fundacionales requeridas por todas las etapas siguientes.
-- Orden de dependencias: usuarios -> perfiles -> rubros -> tareas -> trabajos -> ofertas
-- ============================================================

-- ============================================================
-- 1. USUARIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  tipo_perfil   VARCHAR(20)  NOT NULL CHECK (tipo_perfil IN ('dueno', 'trabajador', 'ambos')),
  activo        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);
-- Columnas agregadas por etapas posteriores:
-- etapa2: identidad_verificada, fecha_nacimiento, suspendido, suspension_hasta
-- auth:   tyc_aceptado

CREATE INDEX IF NOT EXISTS idx_usuarios_email  ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);

-- ============================================================
-- 2. PERFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS perfiles (
  id                  SERIAL PRIMARY KEY,
  usuario_id          INTEGER      NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre              VARCHAR(100) NOT NULL,
  apellido            VARCHAR(100),
  telefono            VARCHAR(20),
  ciudad              VARCHAR(100),
  provincia           VARCHAR(100),
  descripcion         TEXT,
  clasificacion       VARCHAR(50),          -- 'independiente' | 'empresa' | etc.
  nombre_negocio      VARCHAR(150),
  avatar_url          TEXT,
  calificacion_promedio NUMERIC(3,2) DEFAULT NULL,
  actualizado_en      TIMESTAMP    NOT NULL DEFAULT NOW()
);
-- Columnas agregadas por etapas posteriores:
-- etapa2: promedio_calificacion, total_calificaciones
-- etapa4: foto_url, racha_dias, total_badges
-- etapa6: latitud, longitud

CREATE INDEX IF NOT EXISTS idx_perfiles_usuario ON perfiles(usuario_id);

-- ============================================================
-- 3. RUBROS
-- ============================================================
CREATE TABLE IF NOT EXISTS rubros (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  icono  VARCHAR(100),
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_rubros_activo ON rubros(activo);

-- ============================================================
-- 4. TAREAS
-- ============================================================
CREATE TABLE IF NOT EXISTS tareas (
  id       SERIAL PRIMARY KEY,
  rubro_id INTEGER      NOT NULL REFERENCES rubros(id) ON DELETE CASCADE,
  nombre   VARCHAR(150) NOT NULL,
  activo   BOOLEAN      NOT NULL DEFAULT TRUE
);
-- Columnas agregadas por etapas posteriores:
-- etapa3: unidad_medida, precio_referencia_min, precio_referencia_max, icono

CREATE INDEX IF NOT EXISTS idx_tareas_rubro  ON tareas(rubro_id);
CREATE INDEX IF NOT EXISTS idx_tareas_activo ON tareas(activo);

-- ============================================================
-- 5. TRABAJOS
-- ============================================================
CREATE TABLE IF NOT EXISTS trabajos (
  id              SERIAL PRIMARY KEY,
  dueno_id        INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo          VARCHAR(255) NOT NULL,
  descripcion     TEXT,
  rubro_id        INTEGER      REFERENCES rubros(id) ON DELETE SET NULL,
  tarea_id        INTEGER      REFERENCES tareas(id) ON DELETE SET NULL,
  modalidad       VARCHAR(30)  NOT NULL DEFAULT 'presencial'
                    CHECK (modalidad IN ('presencial', 'remoto', 'hibrido')),
  ciudad          VARCHAR(100),
  provincia       VARCHAR(100),
  presupuesto_min NUMERIC(12,2) CHECK (presupuesto_min >= 0),
  presupuesto_max NUMERIC(12,2) CHECK (presupuesto_max >= 0),
  es_urgente      BOOLEAN      NOT NULL DEFAULT FALSE,
  estado          VARCHAR(30)  NOT NULL DEFAULT 'publicado'
                    CHECK (estado IN ('publicado', 'en_negociacion', 'en_curso', 'completado', 'cancelado', 'rechazado')),
  creado_en       TIMESTAMP    NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMP    NOT NULL DEFAULT NOW()
);
-- Columnas agregadas por etapas posteriores:
-- etapa3: objetivo, medida, unidad_medida
-- etapa4: tiene_solicitud_ayudantes
-- etapa6: latitud, longitud, localidad

CREATE INDEX IF NOT EXISTS idx_trabajos_dueno    ON trabajos(dueno_id);
CREATE INDEX IF NOT EXISTS idx_trabajos_rubro    ON trabajos(rubro_id);
CREATE INDEX IF NOT EXISTS idx_trabajos_estado   ON trabajos(estado);
CREATE INDEX IF NOT EXISTS idx_trabajos_urgente  ON trabajos(es_urgente);
CREATE INDEX IF NOT EXISTS idx_trabajos_creado   ON trabajos(creado_en DESC);

-- ============================================================
-- 6. OFERTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS ofertas (
  id                   SERIAL PRIMARY KEY,
  trabajo_id           INTEGER       NOT NULL REFERENCES trabajos(id) ON DELETE CASCADE,
  trabajador_id        INTEGER       NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  monto_propuesto      NUMERIC(12,2) NOT NULL CHECK (monto_propuesto >= 0),
  mensaje              TEXT,
  tiempo_estimado      INTEGER,
  unidad_tiempo        VARCHAR(20)   NOT NULL DEFAULT 'dias'
                         CHECK (unidad_tiempo IN ('horas', 'dias', 'semanas', 'meses')),
  estado               VARCHAR(30)   NOT NULL DEFAULT 'pendiente'
                         CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'contraoferta', 'cancelada')),
  monto_contraoferta   NUMERIC(12,2) CHECK (monto_contraoferta >= 0),
  mensaje_contraoferta TEXT,
  creado_en            TIMESTAMP     NOT NULL DEFAULT NOW(),
  actualizado_en       TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ofertas_trabajo    ON ofertas(trabajo_id);
CREATE INDEX IF NOT EXISTS idx_ofertas_trabajador ON ofertas(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_ofertas_estado     ON ofertas(estado);

-- ============================================================
-- DATOS INICIALES: RUBROS (30 categorías)
-- IDs referenciados en etapa3_precios.sql
-- ============================================================
INSERT INTO rubros (id, nombre, icono) VALUES
  (1,  'Electricidad',          '⚡'),
  (2,  'Plomeria',              '🔧'),
  (3,  'Albanileria',           '🧱'),
  (4,  'Pintura',               '🎨'),
  (5,  'Carpinteria',           '🪚'),
  (6,  'Herreria',              '🔩'),
  (7,  'Jardineria',            '🌱'),
  (8,  'Limpieza',              '🧹'),
  (9,  'Mudanzas',              '📦'),
  (10, 'Aire Acondicionado',    '❄️'),
  (11, 'Seguridad',             '🔒'),
  (12, 'Informatica',           '💻'),
  (13, 'Diseno Grafico',        '🖌️'),
  (14, 'Desarrollo Web',        '🌐'),
  (15, 'Programacion',          '👨‍💻'),
  (16, 'Edicion de Video',      '🎬'),
  (17, 'Produccion de Audio',   '🎵'),
  (18, 'Fotografia',            '📷'),
  (19, 'Marketing Digital',     '📈'),
  (20, 'Redaccion',             '✍️'),
  (21, 'Contabilidad',          '📊'),
  (22, 'Clases Particulares',   '📚'),
  (23, 'Idiomas',               '🌍'),
  (24, 'Gaming',                '🎮'),
  (25, 'Diseno de Interiores',  '🛋️'),
  (26, 'Cerrajeria',            '🗝️'),
  (27, 'Gasfiteria',            '🚿'),
  (28, 'Fletes',                '🚚'),
  (29, 'Cuidado de Personas',   '🤲'),
  (30, 'Veterinaria',           '🐾')
ON CONFLICT (id) DO NOTHING;

-- Sincronizar secuencia tras inserción con IDs explícitos
SELECT setval('rubros_id_seq', 30);
