-- Agrega tiempo de preparación al inicio de jornada laboral del trabajador
-- Representa los minutos que el trabajador necesita prepararse en casa antes de salir
-- al primer trabajo del día (no aplica entre trabajos consecutivos)

ALTER TABLE disponibilidad_trabajador
ADD COLUMN IF NOT EXISTS tiempo_preparacion_minutos INTEGER DEFAULT 15;
