-- Agrega hora_inicio_real a trabajos: timestamp cuando el trabajador confirma su llegada
ALTER TABLE trabajos ADD COLUMN IF NOT EXISTS hora_inicio_real TIMESTAMP;
