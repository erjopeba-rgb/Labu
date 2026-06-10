-- ============================================================
-- MIGRACIÓN: Crear ENUM estado_trabajo y migrar columna
--
-- Problema: etapa1.sql definió 'estado' en trabajos como TEXT
-- con CHECK constraint. Las migraciones posteriores asumen un
-- ENUM llamado estado_trabajo que nunca fue creado.
-- Esto causa que estados como 'trabajador_llego' y
-- 'pendiente_confirmacion' sean rechazados por el CHECK.
-- ============================================================

DO $$
BEGIN
    -- Solo crear el ENUM si no existe
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_trabajo') THEN
        CREATE TYPE estado_trabajo AS ENUM (
            'publicado',
            'en_negociacion',
            'en_curso',
            'trabajador_llego',
            'pendiente_confirmacion',
            'completado',
            'cancelado',
            'rechazado'
        );
        RAISE NOTICE 'ENUM estado_trabajo creado.';
    ELSE
        -- El ENUM ya existe: agregar valores faltantes si no están
        IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'estado_trabajo' AND e.enumlabel = 'trabajador_llego') THEN
            ALTER TYPE estado_trabajo ADD VALUE 'trabajador_llego';
            RAISE NOTICE 'Valor trabajador_llego agregado al ENUM.';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'estado_trabajo' AND e.enumlabel = 'pendiente_confirmacion') THEN
            ALTER TYPE estado_trabajo ADD VALUE 'pendiente_confirmacion';
            RAISE NOTICE 'Valor pendiente_confirmacion agregado al ENUM.';
        END IF;
    END IF;
END $$;

-- Eliminar el CHECK constraint antiguo (si existe) y convertir la columna al ENUM
DO $$
DECLARE
    v_constraint_name TEXT;
    v_col_type TEXT;
BEGIN
    -- Obtener el tipo actual de la columna estado en trabajos
    SELECT data_type INTO v_col_type
    FROM information_schema.columns
    WHERE table_name = 'trabajos' AND column_name = 'estado';

    IF v_col_type IN ('text', 'character varying', 'USER-DEFINED') THEN
        -- Buscar el nombre del CHECK constraint sobre estado
        SELECT conname INTO v_constraint_name
        FROM pg_constraint
        WHERE conrelid = 'trabajos'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%estado%'
        LIMIT 1;

        IF v_constraint_name IS NOT NULL THEN
            EXECUTE 'ALTER TABLE trabajos DROP CONSTRAINT ' || quote_ident(v_constraint_name);
            RAISE NOTICE 'CHECK constraint % eliminado.', v_constraint_name;
        END IF;

        -- Solo convertir si la columna todavía no es el ENUM
        IF v_col_type != 'USER-DEFINED' THEN
            ALTER TABLE trabajos
                ALTER COLUMN estado TYPE estado_trabajo
                USING estado::estado_trabajo;
            RAISE NOTICE 'Columna trabajos.estado convertida a ENUM estado_trabajo.';
        END IF;
    ELSE
        RAISE NOTICE 'Columna trabajos.estado ya es tipo %. No se requiere conversión.', v_col_type;
    END IF;
END $$;

-- Verificar resultado
SELECT enumlabel AS estado
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'estado_trabajo'
ORDER BY e.enumsortorder;
