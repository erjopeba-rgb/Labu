-- ETAPA 10: SECCION EQUIPATE

-- 1. PRODUCTOS RECOMENDADOS PARA TRABAJADORES
CREATE TABLE IF NOT EXISTS productos_recomendados (
  id SERIAL PRIMARY KEY,
  tienda_id INTEGER REFERENCES perfiles_tienda(id) ON DELETE SET NULL,
  producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  precio NUMERIC(12,2),
  foto_url TEXT,
  url_externo TEXT,
  categoria VARCHAR(100),
  rubro_id INTEGER REFERENCES rubros(id),
  destacado BOOLEAN DEFAULT FALSE,
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- 2. ACUERDOS DE COMISION CON TIENDAS
CREATE TABLE IF NOT EXISTS acuerdos_tienda (
  id SERIAL PRIMARY KEY,
  tienda_id INTEGER NOT NULL REFERENCES perfiles_tienda(id) ON DELETE CASCADE,
  comision_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 5,
  descripcion TEXT,
  activo BOOLEAN DEFAULT TRUE,
  fecha_inicio DATE DEFAULT NOW(),
  fecha_fin DATE,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- 3. CLICKS Y CONVERSIONES (para estadisticas)
CREATE TABLE IF NOT EXISTS clicks_equipate (
  id SERIAL PRIMARY KEY,
  producto_recomendado_id INTEGER NOT NULL REFERENCES productos_recomendados(id) ON DELETE CASCADE,
  usuario_id INTEGER REFERENCES usuarios(id),
  ip_address INET,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- 4. BADGE CAMARA (extiende sistema de badges)
INSERT INTO badges (codigo, nombre, descripcion, icono, condicion_tipo, condicion_valor) VALUES
('camara_verificada', 'Trabajador con Camara', 'Trabajador que usa camara de seguridad durante sus trabajos', 'camara', 'registros_camara', 3)
ON CONFLICT (codigo) DO NOTHING;

-- INDICES
CREATE INDEX IF NOT EXISTS idx_recomendados_rubro ON productos_recomendados(rubro_id);
CREATE INDEX IF NOT EXISTS idx_recomendados_tienda ON productos_recomendados(tienda_id);
CREATE INDEX IF NOT EXISTS idx_clicks_producto ON clicks_equipate(producto_recomendado_id);
