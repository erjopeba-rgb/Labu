-- I7: resultado económico de la resolución de una disputa
-- 'dueno'      → reembolso contable al dueño (pago 'reembolsado', distribuciones anuladas)
-- 'trabajador' → liberación del dinero retenido (distribuciones 'pendiente' → 'procesado')
-- NULL         → disputa aún no resuelta (o resuelta antes de esta migración, solo texto)
ALTER TABLE disputas ADD COLUMN IF NOT EXISTS resultado VARCHAR(20)
  CHECK (resultado IN ('dueno', 'trabajador'));
