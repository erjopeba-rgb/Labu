-- ETAPA 9: COMUNICACION EN TIEMPO REAL

-- 1. CONVERSACIONES
CREATE TABLE IF NOT EXISTS conversaciones (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('trabajo','disputa','tienda','general')),
  referencia_id INTEGER,
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS participantes_conversacion (
  id SERIAL PRIMARY KEY,
  conversacion_id INTEGER NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  ultimo_leido_en TIMESTAMP,
  creado_en TIMESTAMP DEFAULT NOW(),
  UNIQUE (conversacion_id, usuario_id)
);

-- 2. MENSAJES
CREATE TABLE IF NOT EXISTS mensajes_chat (
  id SERIAL PRIMARY KEY,
  conversacion_id INTEGER NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  remitente_id INTEGER NOT NULL REFERENCES usuarios(id),
  contenido TEXT NOT NULL,
  tipo VARCHAR(20) DEFAULT 'texto' CHECK (tipo IN ('texto','imagen','archivo','sistema')),
  leido BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- 3. NOTIFICACIONES
CREATE TABLE IF NOT EXISTS notificaciones (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  mensaje TEXT,
  referencia_tipo VARCHAR(30),
  referencia_id INTEGER,
  leida BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- INDICES
CREATE INDEX IF NOT EXISTS idx_conversaciones_tipo ON conversaciones(tipo, referencia_id);
CREATE INDEX IF NOT EXISTS idx_participantes_usuario ON participantes_conversacion(usuario_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion ON mensajes_chat(conversacion_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_remitente ON mensajes_chat(remitente_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_leida ON notificaciones(usuario_id, leida);
