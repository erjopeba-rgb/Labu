-- Migración: agregar columna fotos_urls a la tabla trabajos
-- Ejecutar una sola vez contra la base de datos en uso.

ALTER TABLE trabajos
    ADD COLUMN IF NOT EXISTS fotos_urls JSONB DEFAULT NULL;
