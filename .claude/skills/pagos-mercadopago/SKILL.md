---
name: pagos-mercadopago
description: Reglas y arquitectura del sistema de pagos de Labu (MercadoPago, patrón outbox, estados, webhook, retiros). Leer OBLIGATORIAMENTE antes de tocar cualquier código de pagos.
---

# Pagos / MercadoPago — Labu

## Regla de oro
**NUNCA modificar el sistema de pagos sin leer esta skill y revisar el código primero.** Casi todo en `pagos.service.js` tiene forma deliberada (auditorías C4, I7, I17 del AUDIT.md).

## Archivos
- `backend/services/pagos.service.js` — lógica central (outbox, webhook, saldo, retiros)
- `backend/controllers/pagos.controller.js` + `backend/routes/pagos.routes.js`
- `backend/repositories/pagos.repository.js`
- `database/migrations/pagos_reembolsado.sql`, `pagos_estados_outbox.sql`, `retiros.sql`
- `backend/tests/pagos.test.js` — SDK de MP siempre mockeado

## Estados de `pagos.estado` (CHECK constraint)
```
'iniciando'   → pago creado en DB, ANTES de llamar a MP (outbox)
'procesando'  → llamada a MP en curso
'pendiente'   → preferencia creada, esperando que el dueño pague
'aprobado'    → MP confirmó el pago (dinero retenido en plataforma)
'rechazado' / 'devuelto' / 'en_proceso'
'reembolsado' → cancelación o disputa resuelta a favor del dueño
'fallido'     → la llamada a MP falló (outbox)
```
Para agregar un estado: NO editar el CHECK a mano — crear migración que dropea y recrea `pagos_estado_check` (ver patrón DO-block en `pagos_estados_outbox.sql`).

## Patrón outbox (I17) — invariante central
**Ninguna transacción de DB queda abierta durante una llamada de red a MercadoPago.**
1. Transacción corta 1: el pago nace `'iniciando'` y se COMMITEA.
2. Llamada HTTP a MP **sin conexión de DB retenida** (con retry: 3 intentos, backoff 1s→2s→4s).
3. Transacción corta 2: aplicar resultado con `FOR UPDATE` (`activarPagoConPreferencia` / `aplicarResultadoMP`) → `'pendiente'`/`'aprobado'`/`'fallido'` (`marcarPagoFallido` si MP falló).

Aplica a `crearPreferenciaTrabajo`, `pagarDirectoTrabajo` y `procesarWebhook`. Cualquier cambio debe preservar este orden.

## Webhook (`POST /api/pagos/webhook`)
- **Firma:** verificación HMAC-SHA256 de `x-signature` antes de procesar.
- **Dedupe:** tabla `webhook_events` con UNIQUE `(provider, event_id)` + `INSERT ... ON CONFLICT DO NOTHING` — es el marcador idempotente pre-red (el pago se identifica recién con `Payment.get`). El dedupe definitivo va en la **misma transacción** que los efectos.
- **Guard de estado:** `FOR UPDATE` + verificación idempotente — si el webhook llega después de un pago directo ya aplicado, NO duplica distribuciones.

## Credenciales — precedencia DB > env
`getMPToken()` en `pagos.service.js`:
1. Valor en tabla `configuracion_plataforma` (editable desde panel admin) — **tiene precedencia**.
2. Fallback: `MP_ACCESS_TOKEN` / `MP_PUBLIC_KEY` del `.env` (solo despliegue inicial).
3. En `NODE_ENV=test` el fallback env está **desactivado** (evita llamadas de red reales en suites sin mock).

## Flujo del dinero (C4)
- **Gate 402:** `iniciarTrabajo` exige pago `'aprobado'` — sin pago el trabajador no puede confirmar llegada.
- **Retención:** las distribuciones nacen `'pendiente'` (el dinero queda retenido en plataforma).
- **Liberación:** `confirmarCompletado` pasa distribuciones a `'procesado'` en la misma transacción.
- **Payout:** por saldo — `GET /api/pagos/saldo`, `POST /api/pagos/retiros` con `pg_advisory_xact_lock(47002, usuarioId)` (previene doble retiro). Admin aprueba en `GET/PATCH /api/admin/retiros`. Tabla `retiros`: estados `'solicitado'/'pagado'/'rechazado'`.

## Interacciones con cancelación y disputas
- **Cancelación (C3):** con pago aprobado no iniciado → reembolso automático (pago → `'reembolsado'`, distribuciones anuladas). Trabajo iniciado → el dueño NO puede cancelar (403); dinero retenido para disputa.
- **Disputa (I7):** disputa `'abierta'`/`'en_revision'` congela el pago — `confirmarCompletado` devuelve 403. El admin resuelve con `resultado` obligatorio: `'trabajador'` libera distribuciones, `'dueno'` reembolsa (incluye reversión de `'procesado'` si el trabajo ya estaba completado).
- **Orden de locks:** siempre `trabajos` → `disputas` (previene deadlocks).

## Al testear
- Mockear el SDK de MP (ver `pagos.test.js`); helper `aprobarPagoTrabajo` en `tests/helpers.js`.
- `webhook_events` está en la lista TRUNCATE de `helpers.js` — toda tabla nueva de pagos debe agregarse ahí.
- Verificar el invariante outbox: el pago debe estar commiteado (visible desde otra conexión) durante la llamada de red.
