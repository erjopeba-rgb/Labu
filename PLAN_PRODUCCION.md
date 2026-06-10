# PLAN_PRODUCCION.md — Labu
**Fecha de auditoría:** 2026-04-19  
**Estado general:** 84/100 — Condicionalmente listo para producción  
**Tiempo estimado para resolver bloqueantes:** 22–26 horas

---

## RESUMEN EJECUTIVO

| Área | Score | Estado | Riesgo |
|------|-------|--------|--------|
| 1. Consistencia de datos | 85 | MAYORMENTE COMPLETO | Medio |
| 2. Manejo de errores | 95 | COMPLETO | Bajo |
| 3. Validación de inputs | 90 | COMPLETO | Bajo |
| 4. Performance | 85 | MAYORMENTE COMPLETO | Medio |
| 5. Estados centralizados | 95 | COMPLETO | Bajo |
| 6. Resiliencia | 75 | PARCIAL | **Alto** |
| 7. Infraestructura | 65 | PARCIAL | **Crítico** |
| 8. Escalabilidad | 90 | COMPLETO | Bajo |
| 9. Testing | 85 | BUENO | Bajo |
| 10. UX / Flujo | 80 | BUENO | Medio |

---

## ANÁLISIS DETALLADO POR ÁREA

---

### 1. CONSISTENCIA DE DATOS
**Estado: MAYORMENTE COMPLETO (85/100)**

**Implementado:**
- `offers.service.js` — `aceptarOferta()` usa `BEGIN/COMMIT/ROLLBACK` + `SELECT FOR UPDATE` en tabla offers
- `jobs.service.js` — `iniciarTrabajo()` y `confirmarCompletado()` usan `SELECT FOR UPDATE`
- `pagos.service.js` — creación de preferencia de pago envuelta en transacción
- `reservas.service.js` — inserción de reservas con `UNNEST` batch (sin loop de inserts)
- Idempotencia en aceptar oferta: verifica `estado IN ('pendiente', 'contraoferta')` antes de operar
- Idempotencia en `confirmarCompletado()`: retorna 200 sin efectos dobles si ya completado
- Webhook deduplicación: tabla `webhook_events` con unique `(provider, event_id)` + `INSERT ... ON CONFLICT DO NOTHING`

**Faltante / Parcial:**
- `liberarReservasPorOferta()` ocurre **fuera de la transacción** de aceptación de oferta → puede dejar reservas tentativas huérfanas si hay un fallo entre ambas operaciones
- No hay test de race condition para aceptación simultánea de oferta por dos dueños distintos
- `confirmarCompletado()` probablemente ejecuta `findOfertaAceptadaConMonto()` + pago + portfolio de forma secuencial; CLAUDE.md afirma `Promise.all()` pero necesita verificación manual

**Acciones concretas:**
1. Mover `liberarReservasPorOferta()` dentro del `BEGIN/COMMIT` de `aceptarOferta()` en `offers.service.js`
2. Verificar que `confirmarCompletado()` usa `Promise.all()` para las 3 operaciones post-commit

---

### 2. MANEJO DE ERRORES
**Estado: COMPLETO (95/100)**

**Implementado:**
- `backend/utils/AppError.js` — clase con `statusCode`, `isOperational`, `code`
- `backend/utils/apiResponse.js` — formato unificado `{ success: true, data }` / `{ success: false, error }`
- `backend/middlewares/errorHandler.middleware.js` — distingue errores operacionales de bugs, loguea con pino, almacena 5xx en tabla `error_logs`, devuelve mensajes opacos en producción
- Todos los controllers usan `next(err)`, todos los services lanzan `AppError`
- Tabla `error_logs` visible en tab "Errores" del panel admin con filtros por ruta/fecha

**Faltante / Parcial:**
- Algunos `console.error` legacy pueden persistir en archivos no migrados (verificar con grep)
- No hay manejo de `UnhandledPromiseRejection` global en `server.js`

**Acciones concretas:**
1. Agregar en `server.js`: `process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandledRejection'))`
2. `grep -r "console.error" backend/` para encontrar y migrar los que queden

---

### 3. VALIDACIÓN DE INPUTS
**Estado: COMPLETO (90/100)**

**Implementado:**
- `jobs.routes.js` — valida título (100 chars), descripción (1000 chars), lat/lon (±90/±180)
- `offers.routes.js` — valida `monto_propuesto` (float > 0.01), `trabajo_id` (int > 1), `monto_contraoferta`
- `chat.routes.js` — valida `mensaje` (max 2000 chars, no vacío)
- Validación a nivel de service: no auto-oferta, perfil de transporte requerido, trabajo debe existir
- Geolocalización: lat/lon validados como floats antes del cálculo de distancia

**Faltante / Parcial:**
- Campo `mensaje` en el modal de oferta (`POST /api/offers`) no tiene longitud máxima explícita en la ruta
- `disponibilidad_dueno` (JSON de días del dueño) no se valida el formato en backend antes de guardar
- No hay límite por-recurso en creación de ofertas (un trabajador puede spam-ofertar en el mismo trabajo)

**Acciones concretas:**
1. Agregar `body('mensaje').optional().isLength({ max: 1000 })` en `offers.routes.js`
2. Agregar validación de `disponibilidad_dueno` como array de días válidos (0–6) en `jobs.routes.js`

---

### 4. PERFORMANCE
**Estado: MAYORMENTE COMPLETO (85/100)**

**Implementado:**
- Repository pattern en todos los módulos: queries SQL centralizadas, sin queries ad-hoc dispersas
- Feed con single JOIN query + paginación (N+1 resuelto)
- Haversine calculado una sola vez por request (no en loop)
- `reservas.service.js` usa `INSERT ... SELECT UNNEST(...)` para batch de slots
- Rechazar otras ofertas al aceptar una: batch update con single query
- Feed cacheado en Redis 60 segundos; cache invalidado en mutaciones con `cache.del()`
- 6 índices de escalabilidad en DB (declarados en blueprints)

**Faltante / Parcial:**
- Endpoint de job individual (`GET /api/jobs/:id`) no está cacheado → hits repetidos de DB en vistas de detalle
- Notificaciones dentro de `confirmarCompletado()` enviadas en secuencia (no `Promise.all()`)
- Paginación de chat: verificar que `creado_en` tiene índice en la tabla `mensajes`

**Acciones concretas:**
1. Cachear `GET /api/jobs/:id` con TTL 5 min, invalidar al cambiar estado
2. Verificar índice en `mensajes.creado_en` con `\d mensajes` en psql
3. Notificaciones post-completion en `Promise.all()`

---

### 5. ESTADOS CENTRALIZADOS
**Estado: COMPLETO (95/100)**

**Implementado:**
- Jobs: `publicado → en_negociacion → trabajador_llego → pendiente_confirmacion → completado | cancelado`
- Offers: `pendiente → aceptada | rechazada | contraoferta`
- Reservas: `tentativa → confirmada | liberada`
- Transiciones validadas en service layer (no se puede saltar estados)
- Sin hard deletes: cancelación via campo `estado`
- Nombres amigables de estados en frontend

**Faltante / Parcial:**
- No hay estado `en_disputa` en tabla `trabajos` → cuando hay disputa activa, el trabajo queda en `completado` sin reflejo en el estado, lo que puede confundir al usuario
- No hay `deleted_at` para audit trail de cancelaciones (solo queda el estado, no el timestamp)
- No hay estado `expirado` para ofertas que no reciben respuesta en N días

**Acciones concretas:**
1. Migración: agregar estado `en_disputa` al enum de `trabajos.estado`
2. Migración: agregar columna `cancelado_en TIMESTAMPTZ` en `trabajos` y `ofertas`
3. Job/cron para expirar ofertas sin respuesta (opcional, mejora de producto)

---

### 6. RESILIENCIA
**Estado: PARCIAL (75/100)**

**Implementado:**
- Redis con fallback a Map en memoria si no disponible
- Email con fallback a Ethereal en desarrollo; no-op si falla Ethereal
- Webhook deduplicación con transacción + `ON CONFLICT DO NOTHING`
- Rate limiting con Redis (fallback a memoria)
- Socket.io adapter con graceful fallback si Redis está caído
- DB connection pool con `pg.Pool`

**Faltante / Parcial — CRÍTICO:**

**OSRM sin retries:**
- `scheduling.service.js` — `obtenerTiempoViaje()` hace un solo HTTPS call; si falla usa 30 min hardcodeado
- No hay backoff exponencial ni circuit breaker
- En producción: un OSRM caído produce slots mal calculados sin alertar a nadie

**MercadoPago sin retries:**
- `pagos.service.js` — `preference.create()` falla y lanza error inmediatamente
- Si MP tiene spike de latencia, la aceptación de oferta falla para el dueño
- No hay retry con backoff; no hay fallback de "pago pendiente"

**Notificaciones silenciosas:**
- Todas las llamadas a `notificaciones.service` tienen `.catch(() => {})` → fallos silenciados
- Usuarios críticos (dueño al aceptar, trabajador al ser asignado) pueden no recibir notificación
- No hay cola de notificaciones con retry

**Acciones concretas (ordenadas por impacto):**
1. `scheduling.service.js`: envolver `obtenerTiempoViaje()` en retry con 3 intentos + backoff (200ms, 800ms, 3200ms)
2. `pagos.service.js`: envolver `preference.create()` con mismo patrón de retry
3. `notificaciones.service.js`: loguear fallos con `logger.error()` en lugar de silenciarlos; considerar tabla `notificaciones_pendientes` para retry asíncrono
4. Helper reutilizable `utils/retry.js` con función `withRetry(fn, maxAttempts, baseDelayMs)`

---

### 7. INFRAESTRUCTURA
**Estado: PARCIAL (65/100) — BLOQUEANTE**

**Implementado:**
- Pino logging estructurado con requestId por request (AsyncLocalStorage)
- `error_logs` table en DB; tab de errores en panel admin
- `.env.example` con todas las variables
- `setup.js` interactivo para onboarding
- `database/migrate.js` runner con `migration_history`
- CI/CD: `ci.yml` con PostgreSQL, migraciones, tests; `deploy.yml` con TODOs para PM2
- `seguridad.middleware.js` con rate limiting, headers de seguridad, Content-Type validation
- CORS restringido por `CORS_ORIGIN`

**Faltante / Parcial — CRÍTICO:**

**S3 NO implementado:**
- `backend/config/storage.js` — lanza error si `AWS_S3_BUCKET` está configurado (línea ~27)
- CLAUDE.md afirma "Uploads migrados a S3" pero el código tiene TODO
- En producción: uploads van al filesystem local → disco lleno en semanas
- **Esta es la brecha más grave del proyecto**

**Backups NO encontrados:**
- CLAUDE.md afirma "Backups automáticos con pg_dump + S3" pero no se encontró ningún script
- No hay `database/backup.sh`, no hay cron job configurado
- Variables `BACKUP_S3_BUCKET` en `.env.example` pero sin código que las use

**HTTPS no forzado en Express:**
- No hay redirect HTTP → HTTPS en `server.js`
- Depende enteramente del reverse proxy (nginx); si mal configurado, JWT en plaintext

**Sin monitoreo/observabilidad:**
- Logs van a stdout (pino JSON) pero no hay integración con sistema externo (Datadog, CloudWatch, ELK)
- Sin métricas de latencia, tasa de error, queries lentas
- Sin uptime monitoring configurado
- La tabla `error_logs` en DB es un buen inicio pero no reemplaza observabilidad real-time

**deploy.yml incompleto:**
- `deploy.yml` tiene TODO comments vacíos para SSH, PM2, health check
- Sin proceso de deploy automatizado real

**Acciones concretas (ordenadas por criticidad):**
1. **URGENTE** — Implementar S3 en `storage.js`: integrar `@aws-sdk/client-s3`, función `uploadToS3(buffer, key, contentType)`, reemplazar local write
2. **URGENTE** — Crear `database/backup.sh`: `pg_dump` + `gzip` + `aws s3 cp` + email alerta si falla; configurar como cron diario en producción
3. **ALTO** — Agregar en `server.js` redirect HTTP→HTTPS condicional (`NODE_ENV === 'production' && !req.secure`)
4. **MEDIO** — Completar `deploy.yml` con steps reales de SSH + PM2 restart + migration + health check
5. **BAJO** — Configurar exportación de logs a CloudWatch/Datadog (pino transport)

---

### 8. ESCALABILIDAD
**Estado: COMPLETO (90/100)**

**Implementado:**
- Redis con `ioredis` real (no Map en memoria en producción)
- `incr()` atómico con Lua script para rate limiting
- `@socket.io/redis-adapter` configurado para multi-proceso
- Repository layer completo en todos los módulos
- Pool de conexiones PostgreSQL
- Feed cacheado con invalidación en mutaciones
- Separación Controllers → Services → Repositories

**Faltante / Parcial:**
- Pool de conexiones sin tuning de `min`/`max` para carga concurrente alta
- Endpoint `GET /api/jobs/:id` individual sin caché
- Sin configuración de Node.js cluster o PM2 cluster mode documentada

**Acciones concretas:**
1. `backend/config/db.js`: configurar `pool: { min: 2, max: 10 }` como punto de partida
2. Cachear job por ID con 5 min TTL

---

### 9. TESTING
**Estado: BUENO (85/100)**

**Implementado:**
- 9 archivos de test, ~1853 líneas, 113 tests pasando en CI
- E2E workflow completo en `flujo-completo.test.js`
- Chat, geolocalización, scheduling, auth, jobs, offers, admin, reportes cubiertos
- MercadoPago simulado con endpoint de sandbox (`simularPagoAprobadoDev`)
- `NODE_ENV=test` deshabilita emails, rate limiting y llamadas externas
- PostgreSQL real en CI (no mocks de DB)

**Faltante / Parcial:**
- No hay test de **race condition** (dos dueños aceptan misma oferta simultáneamente)
- No hay test del módulo de **disputas** (`disputas.service.js`, `disputas.controller.js`)
- No hay test de **deduplicación de webhook** (reenviar mismo `payment_id` dos veces)
- No hay test de **caché invalidation** (publicar trabajo limpia cache del feed)
- Paginación de chat no testeada (offset/limit edge cases)
- `deploy.yml` sin health check test post-deploy

**Acciones concretas:**
1. `tests/race-conditions.test.js` — test con dos requests simultáneos a `POST /api/offers/:id/accept`
2. `tests/disputas.test.js` — flujo abrir → responder → resolver disputa
3. `tests/webhook-dedup.test.js` — enviar mismo `payment_id` dos veces, verificar un solo pago procesado
4. Agregar test en `flujo-completo.test.js` que verifique cache invalidation

---

### 10. UX / FLUJO
**Estado: BUENO (80/100)**

**Implementado:**
- Flujo de 4 pasos funcional y probado E2E
- Agendamiento automático al aceptar oferta (no requiere coordinación manual)
- Widget de trabajo en proceso en sidebar del feed
- Aviso de horarios no coincidentes en modal de oferta
- Timeline de progreso en tarjetas
- Skeleton loading en feed
- Rating visible en tarjetas de oferta
- Validación inline en formularios
- Avatares con color determinístico
- Estados vacíos con CTAs contextuales
- Notificaciones agrupadas por fecha con filtros por categoría
- Nombres amigables de estados

**Faltante / Parcial:**

**MercadoPago Checkout API vs Preferences:**
- El código usa `new Preference(mpClient)` que devuelve `init_point` (redirect a MP)
- CLAUDE.md menciona "Checkout API" pero el código usa Preferences API (legacy)
- Con Preferences: el dueño abandona la app para pagar → menor conversión, peor UX
- Con Checkout Pro (Bricks): pago embebido en iframe, usuario no sale de la app

**Pago falla → flujo bloqueado:**
- Si el pago falla/cancela, el trabajo queda en `en_negociacion` indefinidamente
- No hay UI de "reintentar pago" ni estado explícito de `pago_pendiente`
- El dueño no sabe que debe reintentar el pago

**Sin recuperación de sesión interrumpida:**
- Worker que cierra el browser después de aceptar oferta no tiene forma de retomar el flujo
- No hay pantalla "tenés un trabajo pendiente" al re-abrir la app

**Sin nudge post-calificación:**
- Si el usuario no califica en N días, no hay recordatorio

**Acciones concretas (por impacto):**
1. **ALTO** — Migrar pago a MercadoPago Checkout Pro Bricks (embebido, sin redirect)
   - Backend: cambiar `Preference` por `PreferenceItem` + Checkout Pro
   - Frontend: integrar MercadoPago JS SDK con Brick de card payment
   - Tiempo estimado: 8 horas
2. **ALTO** — Manejar pago fallido: agregar estado `pago_pendiente` en `trabajos`, UI de retry en `mis-ofertas-laborales.html`
3. **MEDIO** — Banner de recuperación: al cargar cualquier página verificar si hay trabajo activo y mostrar widget de retoma
4. **BAJO** — Cron de recordatorio de calificaciones pendientes (7 días post-completado)

---

## LISTA DE PENDIENTES ORDENADA POR PRIORIDAD

### 🚨 BLOQUEANTES (no deployar sin esto)

| # | Tarea | Archivos afectados | Tiempo estimado |
|---|-------|-------------------|-----------------|
| B1 | **Implementar S3 en `storage.js`** — AWS SDK, upload buffer, URL pública | `backend/config/storage.js`, `.env` | 4 horas |
| B2 | **Script de backup PostgreSQL** — pg_dump + gzip + S3 + alerta email | `database/backup.sh`, cron config | 4 horas |
| B3 | **Retry con backoff para MercadoPago** — `preference.create()` con 3 intentos | `backend/services/pagos.service.js` | 2 horas |
| B4 | **Retry con backoff para OSRM** — `obtenerTiempoViaje()` con 3 intentos | `backend/services/scheduling.service.js` | 2 horas |
| B5 | **Mover `liberarReservasPorOferta` dentro de transacción** en `aceptarOferta` | `backend/services/offers.service.js` | 1 hora |

**Subtotal bloqueantes: ~13 horas**

---

### ⚠️ ALTO IMPACTO (deployar dentro de los primeros 7 días)

| # | Tarea | Archivos afectados | Tiempo estimado |
|---|-------|-------------------|-----------------|
| A1 | **HTTPS forzado en Express** para `NODE_ENV=production` | `backend/server.js` | 30 min |
| A2 | **Estado `pago_pendiente`** en `trabajos` + UI de retry de pago | `migrations/`, `pagos.service.js`, `mis-ofertas-laborales.js` | 3 horas |
| A3 | **Migrar a MercadoPago Checkout Pro Bricks** (pago embebido) | `pagos.service.js`, `mis-ofertas-laborales.html/js` | 8 horas |
| A4 | **`unhandledRejection` en `server.js`** | `backend/server.js` | 30 min |
| A5 | **Completar `deploy.yml`** con SSH + PM2 + migration + health check | `.github/workflows/deploy.yml` | 3 horas |
| A6 | **Loguear fallos de notificaciones** (remover `.catch(() => {})` silencioso) | `backend/services/*.service.js` | 1 hora |
| A7 | **Test de race condition** — aceptación simultánea de oferta | `backend/tests/race-conditions.test.js` | 2 horas |
| A8 | **Test de deduplicación de webhook** | `backend/tests/webhook-dedup.test.js` | 1 hora |

**Subtotal alto impacto: ~19 horas**

---

### 📋 MEDIO IMPACTO (sprint post-lanzamiento)

| # | Tarea | Archivos afectados | Tiempo estimado |
|---|-------|-------------------|-----------------|
| M1 | Cachear `GET /api/jobs/:id` con TTL 5 min | `backend/services/jobs.service.js` | 1 hora |
| M2 | Estado `en_disputa` en enum de `trabajos.estado` | `database/migrations/` | 1 hora |
| M3 | `cancelled_at TIMESTAMPTZ` en `trabajos` y `ofertas` | `database/migrations/` | 1 hora |
| M4 | Pool tuning: `{ min: 2, max: 10 }` en `db.js` | `backend/config/db.js` | 30 min |
| M5 | Test de módulo disputas (abrir → resolver) | `backend/tests/disputas.test.js` | 2 horas |
| M6 | Validación de `disponibilidad_dueno` como array de días válidos | `backend/routes/jobs.routes.js` | 30 min |
| M7 | Índice en `mensajes.creado_en` si no existe | `database/migrations/` | 30 min |
| M8 | Banner de recuperación de sesión interrumpida | `frontend/public/js/modules/` | 2 horas |
| M9 | Exportación de logs pino a CloudWatch/Datadog | `backend/config/logger.js` | 2 horas |
| M10 | `Promise.all()` para notificaciones post-confirmación | `backend/services/jobs.service.js` | 1 hora |

**Subtotal medio impacto: ~11.5 horas**

---

### 🔧 BAJO IMPACTO / MEJORAS (backlog)

| # | Tarea | Tiempo estimado |
|---|-------|-----------------|
| L1 | Cron de recordatorio de calificaciones pendientes (7 días) | 2 horas |
| L2 | Validación de longitud máxima de `mensaje` en offers | 30 min |
| L3 | Límite por-recurso en creación de ofertas (anti-spam) | 1 hora |
| L4 | Helper `utils/retry.js` reutilizable | 1 hora |
| L5 | Test de paginación de chat (offset/limit edge cases) | 1 hora |
| L6 | Test de cache invalidation en feed | 1 hora |
| L7 | Estado `expirado` para ofertas sin respuesta en N días | 3 horas |
| L8 | Uptime monitoring configurado (UptimeRobot / AWS Route53) | 1 hora |

---

## CHECKLIST DE DEPLOY A PRODUCCIÓN

### Pre-deploy (obligatorio)
- [ ] B1: S3 implementado y testeado con bucket real
- [ ] B2: Script de backup ejecutado manualmente y verificado en S3
- [ ] B3: Retry en MercadoPago verificado con logs de errores simulados
- [ ] B4: Retry en OSRM verificado con endpoint temporalmente caído
- [ ] B5: Transacción de `aceptarOferta` incluye liberación de reservas
- [ ] A1: HTTPS redirect funcionando con certificado válido
- [ ] A4: `unhandledRejection` handler en server.js
- [ ] Variables de entorno configuradas en servidor de producción:
  - `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`
  - `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`
  - `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
  - `REDIS_URL`, `CORS_ORIGIN`, `SMTP_*`
  - `APP_URL`
- [ ] `npm run migrate` ejecutado contra DB de producción
- [ ] `npm test` pasando (113/113) en rama de release
- [ ] CORS whitelist apunta al dominio de producción
- [ ] Webhook URL de MercadoPago actualizada en panel de MP a URL de producción
- [ ] Redis instance de producción disponible y accesible

### Post-deploy (primeros 30 minutos)
- [ ] `GET /api/health` responde 200
- [ ] Registro de nuevo usuario funciona (email de verificación llega)
- [ ] Publicar trabajo con foto → imagen visible en URL de S3
- [ ] Flujo completo E2E con cuenta sandbox de MercadoPago
- [ ] Socket.io conecta correctamente (chat en tiempo real)
- [ ] Panel admin accesible con usuario admin
- [ ] Logs visibles en sistema de monitoreo configurado

---

## ESTIMACIÓN TOTAL

| Prioridad | Horas |
|-----------|-------|
| Bloqueantes (B1–B5) | ~13 h |
| Alto impacto (A1–A8) | ~19 h |
| Medio impacto (M1–M10) | ~11.5 h |
| Bajo impacto (L1–L8) | ~10.5 h |
| **Total para lanzamiento mínimo (B + A)** | **~32 horas** |
| **Total para plataforma robusta (B + A + M)** | **~43.5 horas** |

---

*Generado por auditoría de código — 2026-04-19*
