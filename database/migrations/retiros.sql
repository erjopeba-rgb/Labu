-- Retiros de saldo del trabajador (payout manual)
-- El saldo liberado de un trabajador = SUM(distribuciones_pago procesadas a su favor)
-- menos lo ya comprometido en retiros (solicitado o pagado).
-- El admin marca el retiro como 'pagado' tras hacer la transferencia manual.

CREATE TABLE IF NOT EXISTS retiros (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  estado VARCHAR(20) NOT NULL DEFAULT 'solicitado' CHECK (estado IN ('solicitado','pagado','rechazado')),
  datos_cobro TEXT NOT NULL,          -- CBU/CVU/alias indicado por el trabajador
  nota_admin TEXT,                    -- motivo de rechazo o referencia de transferencia
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retiros_usuario ON retiros(usuario_id);
CREATE INDEX IF NOT EXISTS idx_retiros_estado ON retiros(estado);
