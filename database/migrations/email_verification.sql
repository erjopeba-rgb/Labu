-- Migración: verificación de email
-- Ejecutar: psql -U postgres -d rtype1 -f database/migrations/email_verification.sql

-- Columna email_verificado en la tabla usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN DEFAULT FALSE;

-- Tabla para tokens de verificación de email
CREATE TABLE IF NOT EXISTS email_verifications (
    id          SERIAL PRIMARY KEY,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token       VARCHAR(128) NOT NULL UNIQUE,
    expires_at  TIMESTAMP NOT NULL,
    creado_en   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_token   ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_usuario ON email_verifications(usuario_id);
