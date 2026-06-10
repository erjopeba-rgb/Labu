-- ETAPA 8: PAGOS Y COMISIONES

-- 1. CONFIGURACION DE COMISIONES
CREATE TABLE IF NOT EXISTS configuracion_plataforma (
  id SERIAL PRIMARY KEY,
  clave VARCHAR(100) NOT NULL UNIQUE,
  valor TEXT NOT NULL,
  descripcion TEXT,
  actualizado_en TIMESTAMP DEFAULT NOW()
);

INSERT INTO configuracion_plataforma (clave, valor, descripcion) VALUES
('comision_porcentaje', '10', 'Porcentaje de comision de la plataforma sobre cada trabajo'),
('comision_minima', '500', 'Comision minima en pesos'),
('seguro_precio', '2000', 'Precio del seguro opcional por trabajo en pesos'),
('mp_public_key', '', 'MercadoPago public key'),
('mp_access_token', '', 'MercadoPago access token')
ON CONFLICT (clave) DO NOTHING;

-- 2. VIDEOS EDUCATIVOS
CREATE TABLE IF NOT EXISTS videos_educativos (
  id SERIAL PRIMARY KEY,
  autor_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  url_video TEXT,
  url_thumbnail TEXT,
  duracion_segundos INTEGER,
  categoria VARCHAR(100),
  rubro_id INTEGER REFERENCES rubros(id),
  precio NUMERIC(12,2) NOT NULL DEFAULT 0,
  es_gratis BOOLEAN DEFAULT FALSE,
  vistas INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accesos_video (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  video_id INTEGER NOT NULL REFERENCES videos_educativos(id) ON DELETE CASCADE,
  pago_id INTEGER,
  acceso_hasta TIMESTAMP,
  creado_en TIMESTAMP DEFAULT NOW(),
  UNIQUE (usuario_id, video_id)
);

CREATE TABLE IF NOT EXISTS calificaciones_video (
  id SERIAL PRIMARY KEY,
  video_id INTEGER NOT NULL REFERENCES videos_educativos(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  puntaje NUMERIC(2,1) NOT NULL CHECK (puntaje >= 1 AND puntaje <= 5),
  comentario TEXT,
  creado_en TIMESTAMP DEFAULT NOW(),
  UNIQUE (video_id, usuario_id)
);

-- 3. PAGOS
CREATE TABLE IF NOT EXISTS pagos (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('trabajo','video','seguro','suscripcion')),
  referencia_id INTEGER,
  monto_total NUMERIC(12,2) NOT NULL,
  monto_plataforma NUMERIC(12,2) NOT NULL DEFAULT 0,
  monto_trabajador NUMERIC(12,2),
  monto_ayudante NUMERIC(12,2),
  monto_seguro NUMERIC(12,2),
  estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobado','rechazado','devuelto','en_proceso')),
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  mp_status TEXT,
  mp_detail TEXT,
  metadata JSONB,
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

-- 4. DISTRIBUCIONES DE PAGO
CREATE TABLE IF NOT EXISTS distribuciones_pago (
  id SERIAL PRIMARY KEY,
  pago_id INTEGER NOT NULL REFERENCES pagos(id) ON DELETE CASCADE,
  destinatario_id INTEGER NOT NULL REFERENCES usuarios(id),
  tipo_destinatario VARCHAR(20) NOT NULL CHECK (tipo_destinatario IN ('trabajador','ayudante','plataforma')),
  monto NUMERIC(12,2) NOT NULL,
  estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente','procesado','fallido')),
  procesado_en TIMESTAMP,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- 5. SEGUROS
CREATE TABLE IF NOT EXISTS seguros_trabajo (
  id SERIAL PRIMARY KEY,
  trabajo_id INTEGER NOT NULL REFERENCES trabajos(id) ON DELETE CASCADE,
  pago_id INTEGER REFERENCES pagos(id),
  contratado_por INTEGER NOT NULL REFERENCES usuarios(id),
  cubre_trabajador BOOLEAN DEFAULT TRUE,
  cubre_ayudantes BOOLEAN DEFAULT TRUE,
  estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo','vencido','usado','cancelado')),
  creado_en TIMESTAMP DEFAULT NOW(),
  UNIQUE (trabajo_id)
);

-- INDICES
CREATE INDEX IF NOT EXISTS idx_pagos_usuario ON pagos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_tipo ON pagos(tipo);
CREATE INDEX IF NOT EXISTS idx_distribuciones_pago ON distribuciones_pago(pago_id);
CREATE INDEX IF NOT EXISTS idx_distribuciones_destinatario ON distribuciones_pago(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_videos_autor ON videos_educativos(autor_id);
CREATE INDEX IF NOT EXISTS idx_videos_rubro ON videos_educativos(rubro_id);
CREATE INDEX IF NOT EXISTS idx_accesos_usuario ON accesos_video(usuario_id);
