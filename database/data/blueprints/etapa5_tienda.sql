-- ETAPA 5: PERFIL TIENDA / NEGOCIO

-- 1. PERFIL TIENDA (extiende perfiles)
CREATE TABLE IF NOT EXISTS perfiles_tienda (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre_tienda VARCHAR(255) NOT NULL,
  descripcion TEXT,
  logo_url TEXT,
  banner_url TEXT,
  telefono VARCHAR(50),
  whatsapp VARCHAR(50),
  email_contacto VARCHAR(255),
  direccion TEXT,
  ciudad VARCHAR(100),
  provincia VARCHAR(100),
  latitud NUMERIC(10,7),
  longitud NUMERIC(10,7),
  radio_entrega_km INTEGER DEFAULT 10,
  hace_envios BOOLEAN DEFAULT TRUE,
  costo_envio_base NUMERIC(12,2),
  envio_gratis_desde NUMERIC(12,2),
  horarios TEXT,
  calificacion_promedio NUMERIC(3,2) DEFAULT 0,
  total_calificaciones INTEGER DEFAULT 0,
  total_ventas INTEGER DEFAULT 0,
  verificada BOOLEAN DEFAULT FALSE,
  activa BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

-- 2. CATEGORIAS DE PRODUCTOS
CREATE TABLE IF NOT EXISTS categorias_producto (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  descripcion TEXT,
  icono VARCHAR(100),
  rubro_id INTEGER REFERENCES rubros(id),
  activa BOOLEAN DEFAULT TRUE
);

-- 3. PRODUCTOS
CREATE TABLE IF NOT EXISTS productos (
  id SERIAL PRIMARY KEY,
  tienda_id INTEGER NOT NULL REFERENCES perfiles_tienda(id) ON DELETE CASCADE,
  categoria_id INTEGER REFERENCES categorias_producto(id),
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  precio NUMERIC(12,2) NOT NULL CHECK (precio >= 0),
  precio_oferta NUMERIC(12,2),
  unidad VARCHAR(50) DEFAULT 'unidad',
  stock INTEGER DEFAULT 0,
  stock_ilimitado BOOLEAN DEFAULT FALSE,
  fotos_urls TEXT[],
  marca VARCHAR(100),
  codigo_sku VARCHAR(100),
  activo BOOLEAN DEFAULT TRUE,
  destacado BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

-- 4. PEDIDOS DE MATERIALES
CREATE TABLE IF NOT EXISTS pedidos_materiales (
  id SERIAL PRIMARY KEY,
  dueno_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  trabajo_id INTEGER REFERENCES trabajos(id) ON DELETE SET NULL,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  ciudad VARCHAR(100),
  provincia VARCHAR(100),
  estado VARCHAR(20) DEFAULT 'abierto'
    CHECK (estado IN ('abierto','en_negociacion','cerrado','cancelado')),
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS items_pedido (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER NOT NULL REFERENCES pedidos_materiales(id) ON DELETE CASCADE,
  nombre_material VARCHAR(255) NOT NULL,
  cantidad NUMERIC(10,2) NOT NULL,
  unidad VARCHAR(50) DEFAULT 'unidad',
  descripcion_extra TEXT,
  producto_id INTEGER REFERENCES productos(id)
);

-- 5. OFERTAS DE TIENDAS A PEDIDOS
CREATE TABLE IF NOT EXISTS ofertas_tienda (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER NOT NULL REFERENCES pedidos_materiales(id) ON DELETE CASCADE,
  tienda_id INTEGER NOT NULL REFERENCES perfiles_tienda(id) ON DELETE CASCADE,
  monto_total NUMERIC(12,2) NOT NULL,
  detalle TEXT,
  incluye_envio BOOLEAN DEFAULT FALSE,
  costo_envio NUMERIC(12,2) DEFAULT 0,
  tiempo_entrega_dias INTEGER,
  estado VARCHAR(20) DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','aceptada','rechazada','cancelada')),
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW(),
  UNIQUE (pedido_id, tienda_id)
);

CREATE TABLE IF NOT EXISTS items_oferta_tienda (
  id SERIAL PRIMARY KEY,
  oferta_id INTEGER NOT NULL REFERENCES ofertas_tienda(id) ON DELETE CASCADE,
  item_pedido_id INTEGER NOT NULL REFERENCES items_pedido(id),
  producto_id INTEGER REFERENCES productos(id),
  precio_unitario NUMERIC(12,2) NOT NULL,
  cantidad NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL
);

-- 6. SUGERENCIAS DE MATERIALES POR TAREA
CREATE TABLE IF NOT EXISTS sugerencias_materiales (
  id SERIAL PRIMARY KEY,
  tarea_id INTEGER NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
  nombre_material VARCHAR(255) NOT NULL,
  cantidad_referencia NUMERIC(10,2),
  unidad VARCHAR(50) DEFAULT 'unidad',
  descripcion TEXT,
  categoria_id INTEGER REFERENCES categorias_producto(id),
  orden INTEGER DEFAULT 0
);

-- 7. CALIFICACIONES DE TIENDA
CREATE TABLE IF NOT EXISTS calificaciones_tienda (
  id SERIAL PRIMARY KEY,
  tienda_id INTEGER NOT NULL REFERENCES perfiles_tienda(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  oferta_id INTEGER REFERENCES ofertas_tienda(id),
  puntaje NUMERIC(2,1) NOT NULL CHECK (puntaje >= 1 AND puntaje <= 5),
  comentario TEXT,
  creado_en TIMESTAMP DEFAULT NOW(),
  UNIQUE (tienda_id, usuario_id, oferta_id)
);

-- INDICES
CREATE INDEX IF NOT EXISTS idx_productos_tienda ON productos(tienda_id);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_dueno ON pedidos_materiales(dueno_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos_materiales(estado);
CREATE INDEX IF NOT EXISTS idx_ofertas_tienda_pedido ON ofertas_tienda(pedido_id);
CREATE INDEX IF NOT EXISTS idx_ofertas_tienda_tienda ON ofertas_tienda(tienda_id);
CREATE INDEX IF NOT EXISTS idx_sugerencias_tarea ON sugerencias_materiales(tarea_id);

-- CATEGORIAS INICIALES
INSERT INTO categorias_producto (nombre, descripcion, icono) VALUES
('Materiales de construccion', 'Cemento, arena, ladrillos, bloques', 'construccion'),
('Electricidad', 'Cables, llaves, tomacorrientes, tableros', 'electricidad'),
('Plomeria', 'Canios, canillas, valvulas, termotanques', 'plomeria'),
('Pintura', 'Pinturas, esmaltes, rodillos, pinceles', 'pintura'),
('Herramientas', 'Herramientas manuales y electricas', 'herramienta'),
('Carpinteria', 'Maderas, tornillos, bisagras, barnices', 'carpinteria'),
('Jardineria', 'Tierra, fertilizantes, semillas, mangueras', 'jardineria'),
('Limpieza', 'Productos de limpieza profesional', 'limpieza'),
('Seguridad', 'Camaras, cerraduras, alarmas', 'seguridad'),
('Informatica', 'Cables, conectores, componentes', 'informatica'),
('Ferreteria general', 'Tornillos, tuercas, adhesivos, selladores', 'ferreteria'),
('Climatizacion', 'Splits, ventiladores, extractores', 'climatizacion')
ON CONFLICT (nombre) DO NOTHING;
