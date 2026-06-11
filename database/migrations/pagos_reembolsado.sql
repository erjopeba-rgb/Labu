-- C3: cancelación con reembolso — agrega 'reembolsado' a los estados válidos de pagos.
-- Un pago 'reembolsado' estaba 'aprobado' (dinero retenido en plataforma) y su trabajo
-- fue cancelado antes de iniciarse: el dinero vuelve al dueño.

DO $$
DECLARE
    v_constraint_name TEXT;
    v_def TEXT;
BEGIN
    -- Buscar el CHECK constraint sobre pagos.estado (no el de tipo)
    SELECT conname, pg_get_constraintdef(oid) INTO v_constraint_name, v_def
    FROM pg_constraint
    WHERE conrelid = 'pagos'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%estado%'
    LIMIT 1;

    IF v_def IS NOT NULL AND v_def LIKE '%reembolsado%' THEN
        RAISE NOTICE 'El CHECK de pagos.estado ya incluye reembolsado. Nada que hacer.';
        RETURN;
    END IF;

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE pagos DROP CONSTRAINT ' || quote_ident(v_constraint_name);
        RAISE NOTICE 'CHECK constraint % eliminado.', v_constraint_name;
    END IF;

    ALTER TABLE pagos ADD CONSTRAINT pagos_estado_check
        CHECK (estado IN ('pendiente','aprobado','rechazado','devuelto','en_proceso','reembolsado'));
    RAISE NOTICE 'CHECK pagos_estado_check recreado con reembolsado.';
END $$;
