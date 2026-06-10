-- Migración: tabla para tokens de recuperación de contraseña
-- Ejecutar: psql -U postgres -d rtype1 -f database/migrations/password_resets.sql

CREATE TABLE IF NOT EXISTS password_resets (
    id          SERIAL PRIMARY KEY,
    email       VARCHAR(255) NOT NULL,
    token       VARCHAR(128) NOT NULL UNIQUE,
    expires_at  TIMESTAMP NOT NULL,
    creado_en   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);
