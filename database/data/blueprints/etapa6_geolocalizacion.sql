-- ETAPA 6: GEOLOCALIZACION AVANZADA

-- 1. ZONAS DE TRABAJO DEL TRABAJADOR
CREATE TABLE IF NOT EXISTS zonas_trabajo (
  id SERIAL PRIMARY KEY,
  trabajador_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  provincia VARCHAR(100) NOT NULL,
  localidad VARCHAR(100) NOT NULL,
  activa BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT NOW(),
  UNIQUE (trabajador_id, provincia, localidad)
);

-- 2. COORDENADAS EN PERFILES Y TRABAJOS
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS latitud NUMERIC(10,7) DEFAULT NULL;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS longitud NUMERIC(10,7) DEFAULT NULL;
ALTER TABLE trabajos ADD COLUMN IF NOT EXISTS latitud NUMERIC(10,7) DEFAULT NULL;
ALTER TABLE trabajos ADD COLUMN IF NOT EXISTS longitud NUMERIC(10,7) DEFAULT NULL;
ALTER TABLE trabajos ADD COLUMN IF NOT EXISTS localidad VARCHAR(100) DEFAULT NULL;

-- 3. INDICES
CREATE INDEX IF NOT EXISTS idx_zonas_trabajador ON zonas_trabajo(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_zonas_localidad ON zonas_trabajo(provincia, localidad);
CREATE INDEX IF NOT EXISTS idx_trabajos_localidad ON trabajos(ciudad, provincia);
CREATE INDEX IF NOT EXISTS idx_perfiles_ubicacion ON perfiles(ciudad, provincia);
