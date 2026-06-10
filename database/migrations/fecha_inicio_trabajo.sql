-- Agrega fecha_inicio al trabajo (fecha y hora acordada con el trabajador)
ALTER TABLE trabajos ADD COLUMN IF NOT EXISTS fecha_inicio TIMESTAMP;
