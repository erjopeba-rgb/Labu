-- ETAPA 3: SISTEMA DE PRECIOS Y CATALOGO

-- 1. EXPANDIR TABLA TAREAS
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS unidad_medida VARCHAR(30) DEFAULT 'por_proyecto'
  CHECK (unidad_medida IN ('m2','metro_lineal','hora','unidad','por_proyecto','dia','mes'));
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS precio_referencia_min NUMERIC(12,2) DEFAULT NULL;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS precio_referencia_max NUMERIC(12,2) DEFAULT NULL;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS icono VARCHAR(100) DEFAULT NULL;

-- 2. CATALOGO DEL TRABAJADOR (precios propios por tarea)
CREATE TABLE IF NOT EXISTS catalogo_trabajador (
  id SERIAL PRIMARY KEY,
  trabajador_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tarea_id INTEGER NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
  precio NUMERIC(12,2) NOT NULL CHECK (precio >= 0),
  unidad_medida VARCHAR(30) NOT NULL DEFAULT 'por_proyecto'
    CHECK (unidad_medida IN ('m2','metro_lineal','hora','unidad','por_proyecto','dia','mes')),
  descripcion_extra TEXT,
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW(),
  UNIQUE (trabajador_id, tarea_id)
);

-- 3. EXPANDIR TRABAJOS con estructura Trabajo+Objetivo+Medida
ALTER TABLE trabajos ADD COLUMN IF NOT EXISTS objetivo VARCHAR(255) DEFAULT NULL;
ALTER TABLE trabajos ADD COLUMN IF NOT EXISTS medida NUMERIC(10,2) DEFAULT NULL;
ALTER TABLE trabajos ADD COLUMN IF NOT EXISTS unidad_medida VARCHAR(30) DEFAULT NULL
  CHECK (unidad_medida IN ('m2','metro_lineal','hora','unidad','por_proyecto','dia','mes'));

-- 4. COMPROBANTES DE TRANSACCION
CREATE TABLE IF NOT EXISTS comprobantes (
  id SERIAL PRIMARY KEY,
  trabajo_id INTEGER NOT NULL UNIQUE REFERENCES trabajos(id) ON DELETE CASCADE,
  oferta_id INTEGER NOT NULL REFERENCES ofertas(id) ON DELETE CASCADE,
  dueno_id INTEGER NOT NULL REFERENCES usuarios(id),
  trabajador_id INTEGER NOT NULL REFERENCES usuarios(id),
  monto_final NUMERIC(12,2) NOT NULL,
  descripcion_trabajo TEXT NOT NULL,
  fecha_inicio TIMESTAMP,
  fecha_fin TIMESTAMP DEFAULT NOW(),
  numero_comprobante VARCHAR(20) NOT NULL UNIQUE,
  estado VARCHAR(20) DEFAULT 'emitido' CHECK (estado IN ('emitido','anulado')),
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Secuencia para numero de comprobante
CREATE SEQUENCE IF NOT EXISTS comprobantes_numero_seq START 1000;

-- INDICES
CREATE INDEX IF NOT EXISTS idx_catalogo_trabajador ON catalogo_trabajador(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_catalogo_tarea ON catalogo_trabajador(tarea_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_trabajo ON comprobantes(trabajo_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_dueno ON comprobantes(dueno_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_trabajador ON comprobantes(trabajador_id);

-- 5. POBLAR TAREAS POR RUBRO
-- Electricidad (id=1)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(1, 'Instalacion de tomacorriente', 'unidad', 3500, 8000),
(1, 'Cambio de llaves de luz', 'unidad', 2000, 5000),
(1, 'Instalacion de lampara o aplique', 'unidad', 3000, 7000),
(1, 'Tablero electrico', 'por_proyecto', 15000, 50000),
(1, 'Cableado general', 'metro_lineal', 800, 2000),
(1, 'Instalacion de aire acondicionado', 'unidad', 8000, 20000),
(1, 'Reparacion de cortocircuito', 'por_proyecto', 5000, 15000)
ON CONFLICT DO NOTHING;

-- Plomeria (id=2)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(2, 'Destapacion de canos', 'por_proyecto', 5000, 15000),
(2, 'Cambio de canilla', 'unidad', 4000, 10000),
(2, 'Reparacion de perdida de agua', 'por_proyecto', 6000, 20000),
(2, 'Instalacion de termotanque', 'unidad', 15000, 40000),
(2, 'Cambio de inodoro', 'unidad', 8000, 25000),
(2, 'Instalacion de lavarropas', 'unidad', 5000, 12000),
(2, 'Canos nuevos', 'metro_lineal', 2000, 6000)
ON CONFLICT DO NOTHING;

-- Albanileria (id=3)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(3, 'Reparacion de pared', 'por_proyecto', 8000, 30000),
(3, 'Colocacion de ceramicas', 'm2', 5000, 15000),
(3, 'Construccion de pared', 'm2', 8000, 25000),
(3, 'Reparacion de techo', 'm2', 6000, 20000),
(3, 'Contrapiso', 'm2', 4000, 12000),
(3, 'Nivelacion de piso', 'm2', 3000, 9000),
(3, 'Colocacion de porcelanato', 'm2', 6000, 18000)
ON CONFLICT DO NOTHING;

-- Pintura (id=4)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(4, 'Pintura interior', 'm2', 1500, 4000),
(4, 'Pintura exterior', 'm2', 2000, 6000),
(4, 'Pintura de frente', 'm2', 2500, 7000),
(4, 'Pintura de rejas', 'por_proyecto', 5000, 20000),
(4, 'Pintura de muebles', 'unidad', 3000, 10000),
(4, 'Enduido y pintura', 'm2', 2500, 6000)
ON CONFLICT DO NOTHING;

-- Carpinteria (id=5)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(5, 'Reparacion de puerta', 'unidad', 5000, 15000),
(5, 'Colocacion de puerta', 'unidad', 8000, 25000),
(5, 'Mueble a medida', 'por_proyecto', 30000, 150000),
(5, 'Reparacion de mueble', 'por_proyecto', 5000, 20000),
(5, 'Colocacion de piso de madera', 'm2', 4000, 12000),
(5, 'Deck de madera', 'm2', 8000, 25000)
ON CONFLICT DO NOTHING;

-- Herreria (id=6)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(6, 'Reja para ventana', 'unidad', 20000, 60000),
(6, 'Porton corredizo', 'unidad', 50000, 200000),
(6, 'Escalera metalica', 'por_proyecto', 40000, 150000),
(6, 'Soldadura de estructura', 'hora', 3000, 8000),
(6, 'Baranda de escalera', 'metro_lineal', 8000, 25000)
ON CONFLICT DO NOTHING;

-- Jardineria (id=7)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(7, 'Corte de cesped', 'm2', 200, 600),
(7, 'Poda de arbol', 'unidad', 8000, 30000),
(7, 'Dise??o de jardin', 'por_proyecto', 20000, 100000),
(7, 'Colocacion de cesped sintetico', 'm2', 5000, 15000),
(7, 'Limpieza de jardin', 'por_proyecto', 5000, 20000),
(7, 'Sistema de riego', 'por_proyecto', 15000, 60000)
ON CONFLICT DO NOTHING;

-- Limpieza (id=8)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(8, 'Limpieza de hogar', 'hora', 1500, 3500),
(8, 'Limpieza de oficina', 'm2', 300, 800),
(8, 'Limpieza de obra', 'm2', 500, 1500),
(8, 'Limpieza de vidrios', 'por_proyecto', 5000, 20000),
(8, 'Limpieza de alfombras', 'm2', 1000, 3000),
(8, 'Limpieza post evento', 'por_proyecto', 8000, 30000)
ON CONFLICT DO NOTHING;

-- Mudanzas (id=9)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(9, 'Mudanza local', 'por_proyecto', 20000, 80000),
(9, 'Mudanza larga distancia', 'por_proyecto', 50000, 200000),
(9, 'Carga y descarga', 'hora', 3000, 8000),
(9, 'Embalaje de objetos', 'por_proyecto', 10000, 40000)
ON CONFLICT DO NOTHING;

-- Aire Acondicionado (id=10)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(10, 'Instalacion de split', 'unidad', 15000, 40000),
(10, 'Service de aire acondicionado', 'unidad', 8000, 20000),
(10, 'Reparacion de aire acondicionado', 'por_proyecto', 10000, 35000),
(10, 'Instalacion de ventilador de techo', 'unidad', 5000, 15000)
ON CONFLICT DO NOTHING;

-- Seguridad (id=11)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(11, 'Instalacion de camara', 'unidad', 8000, 25000),
(11, 'Sistema de alarma', 'por_proyecto', 30000, 100000),
(11, 'Instalacion de cerradura electronica', 'unidad', 10000, 35000),
(11, 'Camara de seguridad exterior', 'unidad', 10000, 30000)
ON CONFLICT DO NOTHING;

-- Informatica (id=12)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(12, 'Reparacion de PC', 'por_proyecto', 5000, 20000),
(12, 'Instalacion de red wifi', 'por_proyecto', 8000, 25000),
(12, 'Formateo e instalacion de Windows', 'unidad', 5000, 15000),
(12, 'Soporte tecnico remoto', 'hora', 2000, 6000),
(12, 'Recuperacion de datos', 'por_proyecto', 10000, 40000)
ON CONFLICT DO NOTHING;

-- Diseno Grafico (id=13)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(13, 'Diseno de logo', 'por_proyecto', 10000, 50000),
(13, 'Branding completo', 'por_proyecto', 30000, 150000),
(13, 'Diseno de flyer', 'unidad', 3000, 10000),
(13, 'Diseno de banner web', 'unidad', 3000, 12000),
(13, 'Ilustracion digital', 'por_proyecto', 8000, 40000)
ON CONFLICT DO NOTHING;

-- Desarrollo Web (id=14)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(14, 'Landing page', 'por_proyecto', 30000, 100000),
(14, 'Sitio web institucional', 'por_proyecto', 50000, 200000),
(14, 'Tienda online', 'por_proyecto', 80000, 300000),
(14, 'Mantenimiento web', 'mes', 10000, 40000),
(14, 'Migracion de sitio', 'por_proyecto', 15000, 60000)
ON CONFLICT DO NOTHING;

-- Programacion (id=15)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(15, 'Desarrollo de script', 'por_proyecto', 10000, 50000),
(15, 'Automatizacion de tareas', 'por_proyecto', 15000, 80000),
(15, 'API REST', 'por_proyecto', 30000, 150000),
(15, 'App mobile', 'por_proyecto', 100000, 500000),
(15, 'Consultoria tecnica', 'hora', 5000, 15000)
ON CONFLICT DO NOTHING;

-- Edicion de Video (id=16)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(16, 'Edicion de video corto', 'por_proyecto', 8000, 30000),
(16, 'Edicion de video largo', 'por_proyecto', 20000, 80000),
(16, 'Reels para redes sociales', 'unidad', 5000, 20000),
(16, 'Color grading', 'hora', 3000, 10000),
(16, 'Motion graphics', 'por_proyecto', 15000, 60000)
ON CONFLICT DO NOTHING;

-- Produccion de Audio (id=17)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(17, 'Grabacion de voz', 'hora', 3000, 10000),
(17, 'Mezcla de cancion', 'unidad', 10000, 40000),
(17, 'Masterizacion', 'unidad', 8000, 30000),
(17, 'Jingle publicitario', 'por_proyecto', 20000, 80000)
ON CONFLICT DO NOTHING;

-- Fotografia (id=18)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(18, 'Sesion de fotos', 'hora', 8000, 25000),
(18, 'Fotografia de eventos', 'por_proyecto', 30000, 100000),
(18, 'Fotografia de producto', 'unidad', 3000, 10000),
(18, 'Edicion de fotos', 'unidad', 1000, 4000),
(18, 'Fotografia inmobiliaria', 'por_proyecto', 15000, 50000)
ON CONFLICT DO NOTHING;

-- Marketing Digital (id=19)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(19, 'Community manager', 'mes', 20000, 80000),
(19, 'Campana de publicidad', 'por_proyecto', 15000, 60000),
(19, 'SEO basico', 'mes', 15000, 50000),
(19, 'Email marketing', 'por_proyecto', 8000, 30000),
(19, 'Estrategia de redes sociales', 'por_proyecto', 10000, 40000)
ON CONFLICT DO NOTHING;

-- Redaccion (id=20)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(20, 'Articulo de blog', 'unidad', 3000, 10000),
(20, 'Copywriting', 'por_proyecto', 5000, 20000),
(20, 'Traduccion', 'por_proyecto', 5000, 25000),
(20, 'Correccion de textos', 'por_proyecto', 3000, 12000),
(20, 'Guion', 'por_proyecto', 10000, 50000)
ON CONFLICT DO NOTHING;

-- Contabilidad (id=21)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(21, 'Liquidacion de sueldos', 'mes', 10000, 40000),
(21, 'Declaracion de impuestos', 'por_proyecto', 8000, 30000),
(21, 'Alta de monotributo', 'por_proyecto', 5000, 15000),
(21, 'Asesoria contable', 'hora', 5000, 15000),
(21, 'Facturacion mensual', 'mes', 8000, 25000)
ON CONFLICT DO NOTHING;

-- Clases Particulares (id=22)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(22, 'Matematica', 'hora', 2000, 6000),
(22, 'Lengua y literatura', 'hora', 2000, 6000),
(22, 'Fisica', 'hora', 2500, 7000),
(22, 'Quimica', 'hora', 2500, 7000),
(22, 'Historia', 'hora', 2000, 5000),
(22, 'Preparacion para ingreso universitario', 'hora', 3000, 8000)
ON CONFLICT DO NOTHING;

-- Idiomas (id=23)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(23, 'Clase de ingles', 'hora', 2500, 7000),
(23, 'Clase de portugues', 'hora', 2000, 6000),
(23, 'Preparacion para examen de idioma', 'hora', 3000, 8000),
(23, 'Traduccion ingles-espanol', 'por_proyecto', 5000, 20000)
ON CONFLICT DO NOTHING;

-- Gaming (id=24)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(24, 'Coaching de videojuegos', 'hora', 2000, 8000),
(24, 'Boosting de cuenta', 'por_proyecto', 5000, 30000),
(24, 'Farming de recursos', 'hora', 1500, 5000),
(24, 'Clases de estrategia', 'hora', 2000, 7000)
ON CONFLICT DO NOTHING;

-- Diseno de Interiores (id=25)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(25, 'Diseno de ambiente', 'por_proyecto', 20000, 100000),
(25, 'Plano de interiores', 'por_proyecto', 15000, 60000),
(25, 'Asesoria de decoracion', 'hora', 5000, 15000),
(25, 'Render 3D', 'por_proyecto', 15000, 50000)
ON CONFLICT DO NOTHING;

-- Cerrajeria (id=26)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(26, 'Apertura de puerta', 'por_proyecto', 5000, 15000),
(26, 'Cambio de cerradura', 'unidad', 6000, 20000),
(26, 'Copia de llave', 'unidad', 1000, 3000),
(26, 'Instalacion de cerrojo', 'unidad', 5000, 15000)
ON CONFLICT DO NOTHING;

-- Gasfiteria (id=27)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(27, 'Instalacion de garrafa', 'unidad', 5000, 15000),
(27, 'Conexion de cocina a gas', 'por_proyecto', 8000, 25000),
(27, 'Reparacion de perdida de gas', 'por_proyecto', 8000, 20000),
(27, 'Instalacion de calefon', 'unidad', 10000, 30000)
ON CONFLICT DO NOTHING;

-- Fletes (id=28)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(28, 'Flete local', 'por_proyecto', 8000, 30000),
(28, 'Flete larga distancia', 'por_proyecto', 30000, 120000),
(28, 'Envio de paquete', 'unidad', 3000, 10000)
ON CONFLICT DO NOTHING;

-- Cuidado de Personas (id=29)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(29, 'Cuidado de adulto mayor', 'hora', 2000, 6000),
(29, 'Niana', 'hora', 1500, 5000),
(29, 'Acompanante terapeutico', 'hora', 3000, 8000),
(29, 'Cuidado nocturno', 'por_proyecto', 15000, 40000)
ON CONFLICT DO NOTHING;

-- Veterinaria (id=30)
INSERT INTO tareas (rubro_id, nombre, unidad_medida, precio_referencia_min, precio_referencia_max) VALUES
(30, 'Grooming de mascota', 'unidad', 5000, 20000),
(30, 'Paseo de perros', 'hora', 1500, 4000),
(30, 'Consulta veterinaria a domicilio', 'por_proyecto', 8000, 25000),
(30, 'Adiestramiento', 'hora', 3000, 10000)
ON CONFLICT DO NOTHING;
