-- Agrega columna dueno_id a portfolio_items para registrar actividad del dueño
-- cuando confirma un trabajo completado (antes/después visible en su perfil)

ALTER TABLE portfolio_items
  ADD COLUMN IF NOT EXISTS dueno_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_portfolio_dueno ON portfolio_items(dueno_id);
