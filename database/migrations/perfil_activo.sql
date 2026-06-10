-- Migración: columna perfil_activo en usuarios
-- Permite que un usuario cambie entre modo dueño y trabajador con la misma cuenta
-- Ejecutar en PostgreSQL

ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS perfil_activo VARCHAR(20);

-- Eliminar constraint anterior si existe (por si se corrió una versión incompleta)
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_perfil_activo_check;

-- Agregar constraint con todos los tipos válidos
ALTER TABLE usuarios
    ADD CONSTRAINT usuarios_perfil_activo_check
    CHECK (perfil_activo IN ('dueno', 'trabajador', 'ambos', 'tienda', 'moderador'));

-- Inicializar con el tipo_perfil actual para usuarios existentes
UPDATE usuarios
SET perfil_activo = tipo_perfil
WHERE perfil_activo IS NULL;
