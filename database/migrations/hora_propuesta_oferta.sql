-- Agrega horario propuesto a ofertas: hora de inicio y fin que el trabajador propone
ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS hora_inicio_propuesta TIME;
ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS hora_fin_propuesta    TIME;
