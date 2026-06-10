-- ETAPA 2: SEGURIDAD Y CONFIANZA

-- 1. CALIFICACIONES
CREATE TABLE IF NOT EXISTS calificaciones (
  id SERIAL PRIMARY KEY,
  trabajo_id INTEGER NOT NULL REFERENCES trabajos(id) ON DELETE CASCADE,
  calificador_id INTEGER NOT NULL REFERENCES usuarios(id),
  calificado_id INTEGER NOT NULL REFERENCES usuarios(id),
  puntaje NUMERIC(2,1) NOT NULL CHECK (puntaje >= 1 AND puntaje <= 5),
  comentario TEXT,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('dueno_a_trabajador','trabajador_a_dueno')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (trabajo_id, calificador_id)
);

ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS promedio_calificacion NUMERIC(3,2) DEFAULT NULL;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS total_calificaciones INTEGER DEFAULT 0;

-- 2. VERIFICACION DE IDENTIDAD
CREATE TABLE IF NOT EXISTS verificaciones_identidad (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  foto_dni_url TEXT NOT NULL,
  foto_selfie_url TEXT,
  estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobado','rechazado')),
  motivo_rechazo TEXT,
  revisado_por INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS identidad_verificada BOOLEAN DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;

-- 3. DENUNCIAS
CREATE TABLE IF NOT EXISTS denuncias (
  id SERIAL PRIMARY KEY,
  denunciante_id INTEGER NOT NULL REFERENCES usuarios(id),
  denunciado_id INTEGER REFERENCES usuarios(id),
  trabajo_id INTEGER REFERENCES trabajos(id),
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('usuario','trabajo','oferta','comportamiento')),
  categoria VARCHAR(50) NOT NULL CHECK (categoria IN ('fraude','contenido_inapropiado','acoso','identidad_falsa','servicio_prohibido','incumplimiento','otro')),
  descripcion TEXT NOT NULL,
  evidencia_urls TEXT[],
  estado VARCHAR(20) DEFAULT 'abierta' CHECK (estado IN ('abierta','en_revision','resuelta','desestimada')),
  resolucion TEXT,
  moderador_id INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. MODERACION DE SERVICIOS
CREATE TABLE IF NOT EXISTS moderacion_servicios (
  id SERIAL PRIMARY KEY,
  trabajo_id INTEGER NOT NULL UNIQUE REFERENCES trabajos(id) ON DELETE CASCADE,
  estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobado','rechazado','con_advertencia')),
  motivo TEXT,
  moderador_id INTEGER REFERENCES usuarios(id),
  advertencia_publica TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rubros_sensibles (
  id SERIAL PRIMARY KEY,
  rubro_id INTEGER NOT NULL UNIQUE REFERENCES rubros(id),
  requiere_revision BOOLEAN DEFAULT TRUE,
  advertencia_texto TEXT,
  condiciones_adicionales TEXT
);

-- 5. ADVERTENCIAS CONFIRMADAS
CREATE TABLE IF NOT EXISTS advertencias_confirmadas (
  id SERIAL PRIMARY KEY,
  contratacion_id INTEGER NOT NULL REFERENCES ofertas(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  ip_address INET,
  confirmado_en TIMESTAMP DEFAULT NOW(),
  UNIQUE (contratacion_id, usuario_id)
);

-- 6. CAMARA
CREATE TABLE IF NOT EXISTS registros_camara (
  id SERIAL PRIMARY KEY,
  trabajo_id INTEGER NOT NULL REFERENCES trabajos(id) ON DELETE CASCADE,
  trabajador_id INTEGER NOT NULL REFERENCES usuarios(id),
  archivo_url TEXT NOT NULL,
  duracion_segundos INTEGER,
  tamanio_bytes BIGINT,
  estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo','eliminado','en_disputa')),
  fecha_grabacion TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. DISPUTAS
CREATE TABLE IF NOT EXISTS disputas (
  id SERIAL PRIMARY KEY,
  trabajo_id INTEGER NOT NULL REFERENCES trabajos(id) ON DELETE CASCADE,
  abierta_por INTEGER NOT NULL REFERENCES usuarios(id),
  contra_usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('trabajo_mal_hecho','no_pago','acusacion_falsa','incumplimiento','otro')),
  descripcion TEXT NOT NULL,
  monto_en_disputa NUMERIC(10,2),
  estado VARCHAR(20) DEFAULT 'abierta' CHECK (estado IN ('abierta','en_mediacion','resuelta_demandante','resuelta_demandado','cerrada')),
  resolucion TEXT,
  moderador_id INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evidencias_disputa (
  id SERIAL PRIMARY KEY,
  disputa_id INTEGER NOT NULL REFERENCES disputas(id) ON DELETE CASCADE,
  subida_por INTEGER NOT NULL REFERENCES usuarios(id),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('foto','video','documento','camara_registro')),
  url TEXT NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mensajes_disputa (
  id SERIAL PRIMARY KEY,
  disputa_id INTEGER NOT NULL REFERENCES disputas(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  mensaje TEXT NOT NULL,
  es_moderador BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS penalizaciones (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  disputa_id INTEGER REFERENCES disputas(id),
  denuncia_id INTEGER REFERENCES denuncias(id),
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('advertencia','suspension_temporal','suspension_permanente','reduccion_calificacion')),
  descripcion TEXT NOT NULL,
  duracion_dias INTEGER,
  activa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  expira_en TIMESTAMP
);

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS suspendido BOOLEAN DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS suspension_hasta TIMESTAMP;

-- 8. TERMINOS Y CONDICIONES
CREATE TABLE IF NOT EXISTS versiones_tyc (
  id SERIAL PRIMARY KEY,
  version VARCHAR(10) NOT NULL UNIQUE,
  contenido TEXT NOT NULL,
  vigente BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS aceptaciones_tyc (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  version_tyc_id INTEGER NOT NULL REFERENCES versiones_tyc(id),
  ip_address INET,
  aceptado_en TIMESTAMP DEFAULT NOW(),
  UNIQUE (usuario_id, version_tyc_id)
);

-- INDICES
CREATE INDEX IF NOT EXISTS idx_calificaciones_calificado ON calificaciones(calificado_id);
CREATE INDEX IF NOT EXISTS idx_calificaciones_trabajo ON calificaciones(trabajo_id);
CREATE INDEX IF NOT EXISTS idx_denuncias_denunciado ON denuncias(denunciado_id);
CREATE INDEX IF NOT EXISTS idx_denuncias_estado ON denuncias(estado);
CREATE INDEX IF NOT EXISTS idx_disputas_trabajo ON disputas(trabajo_id);
CREATE INDEX IF NOT EXISTS idx_disputas_estado ON disputas(estado);
CREATE INDEX IF NOT EXISTS idx_registros_camara_trabajo ON registros_camara(trabajo_id);
