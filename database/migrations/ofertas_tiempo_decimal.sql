-- Cambiar tiempo_estimado de INTEGER a NUMERIC(5,2) para soportar horas decimales (ej: 1.5 horas)
ALTER TABLE ofertas ALTER COLUMN tiempo_estimado TYPE NUMERIC(5,2);
