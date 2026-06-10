-- Migración: cambia fecha_inicio de TIMESTAMP (sin zona horaria) a TIMESTAMPTZ
-- Causa: node-postgres interpreta TIMESTAMP WITHOUT TIME ZONE como hora local
-- del proceso Node.js, introduciendo un desfasaje de 3 h en Argentina (UTC-3).
-- Con TIMESTAMPTZ PostgreSQL preserva el offset UTC y pg lo devuelve correctamente.
ALTER TABLE trabajos ALTER COLUMN fecha_inicio TYPE TIMESTAMPTZ;
