-- Tabla de deduplicación de webhooks de MercadoPago.
-- UNIQUE (payment_id, tipo) garantiza que el mismo evento no se procese dos veces
-- aunque MP reintente el webhook.

CREATE TABLE IF NOT EXISTS webhook_events (
  id           SERIAL PRIMARY KEY,
  payment_id   TEXT        NOT NULL,
  tipo         TEXT        NOT NULL,
  procesado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_payment_tipo_idx
  ON webhook_events (payment_id, tipo);
