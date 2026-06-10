-- Índices de escalabilidad para Labu
-- Seguro ejecutar más de una vez gracias a IF NOT EXISTS

-- 1. Feed de trabajos: filtra por estado publicado ordenado por fecha
CREATE INDEX IF NOT EXISTS idx_trabajos_estado_creado
    ON trabajos (estado, creado_en DESC);

-- 2. Ofertas por trabajo y estado
CREATE INDEX IF NOT EXISTS idx_ofertas_trabajo_estado
    ON ofertas (trabajo_id, estado);

-- 3. Notificaciones por usuario ordenadas por fecha (query más frecuente del navbar)
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_creado
    ON notificaciones (usuario_id, creado_en DESC);

-- 4. Mensajes no leídos: conteo por conversación
CREATE INDEX IF NOT EXISTS idx_mensajes_conv_creado_remitente
    ON mensajes_chat (conversacion_id, creado_en DESC, remitente_id);

-- 5. Disponibilidad activa por trabajador
CREATE INDEX IF NOT EXISTS idx_disp_trabajador_activo
    ON disponibilidad_trabajador (trabajador_id, activo);

-- 6. Reservas activas por trabajador
CREATE INDEX IF NOT EXISTS idx_reservas_trabajador_estado
    ON reservas_tentativas (trabajador_id, estado);
