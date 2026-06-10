-- Agrega disponibilidad del dueño al trabajo (JSON array de días disponibles/no disponibles)
-- Formato: [{ "dia_semana": 0, "disponible": true }, ...]  (0=Lun..6=Dom)
ALTER TABLE trabajos ADD COLUMN IF NOT EXISTS disponibilidad_dueno JSONB;
