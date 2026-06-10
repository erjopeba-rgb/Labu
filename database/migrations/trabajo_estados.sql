-- Agrega el valor 'pendiente_confirmacion' al enum estado_trabajo.
-- Se usa cuando el trabajador marca el trabajo como terminado y espera confirmación del dueño.

ALTER TYPE estado_trabajo ADD VALUE IF NOT EXISTS 'pendiente_confirmacion';
