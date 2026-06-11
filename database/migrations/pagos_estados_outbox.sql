-- I17: patrón outbox en pagos — las llamadas de red a MercadoPago ocurren fuera
-- de toda transacción de DB. Estados nuevos de pagos.estado:
--   'iniciando'  → registro creado y commiteado ANTES de llamar a MP (ninguna conexión retenida)
--   'procesando' → reservado para marcar pagos en procesamiento de webhook (hoy ese rol
--                  lo cumple webhook_events, porque el pago recién se identifica con Payment.get)
--   'fallido'    → la llamada a MP agotó los reintentos; el intento queda auditado

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

    IF v_def IS NOT NULL AND v_def LIKE '%iniciando%' THEN
        RAISE NOTICE 'El CHECK de pagos.estado ya incluye iniciando. Nada que hacer.';
        RETURN;
    END IF;

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE pagos DROP CONSTRAINT ' || quote_ident(v_constraint_name);
        RAISE NOTICE 'CHECK constraint % eliminado.', v_constraint_name;
    END IF;

    ALTER TABLE pagos ADD CONSTRAINT pagos_estado_check
        CHECK (estado IN ('pendiente','aprobado','rechazado','devuelto','en_proceso','reembolsado','iniciando','procesando','fallido'));
    RAISE NOTICE 'CHECK pagos_estado_check recreado con estados outbox (iniciando/procesando/fallido).';
END $$;
