-- Agrega medio de transporte al perfil del trabajador
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS medio_transporte VARCHAR(20) DEFAULT NULL;

ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS perfiles_medio_transporte_check;
ALTER TABLE perfiles ADD CONSTRAINT perfiles_medio_transporte_check
    CHECK (medio_transporte IS NULL OR medio_transporte IN ('auto', 'moto', 'bici', 'caminando'));
