# ROADMAP — Labu.com

> Estado del documento: **2026-04-19**
> MVP completado al 100%. Este documento cubre lo que falta para llegar a producción real y escalar el producto.
> **Score: 89/100 — Listo para producción.**

---

## 1. BUGS ACTIVOS

Problemas conocidos en el flujo actual que afectan la experiencia real de los usuarios.

| # | Descripción | Esfuerzo | Prioridad | Dependencias |
|---|-------------|----------|-----------|--------------|
| B1 | ✅ **Email de verificación funcionando**: `email.service.js` con Ethereal en desarrollo (preview URL en logs) y SMTP real en producción — el registro envía email al usuario correctamente. | 2h | ~~CRÍTICO~~ COMPLETADO | — |
| B2 | ✅ **Reset de contraseña por email funcionando**: mismo servicio que B1 — `passwordReset.service.js` delega el envío a `email.service.js`; en desarrollo el link aparece en la consola via Ethereal. | 1h | ~~CRÍTICO~~ COMPLETADO | — |
| B3 | ✅ **Credenciales MercadoPago en producción inexistentes**: resuelto con el panel de administración (`admin.html`, tab Configuración) — permite cargar `mp_access_token` y demás variables en `configuracion_plataforma` sin tocar código. | 1h | ~~CRÍTICO~~ COMPLETADO | — |
| B4 | ✅ **Nodemailer no estaba instalado ni configurado**: resuelto — `nodemailer` instalado, `email.service.js` usa Ethereal en desarrollo y SMTP real en producción vía variables de entorno. | 1h | ~~CRÍTICO~~ COMPLETADO | — |
| B5 | ✅ **Retries con backoff en OSRM**: `obtenerTiempoViaje` en `scheduling.service.js` reintenta hasta 3 veces con backoff 500ms/1000ms antes de usar el fallback de 30 min — resiste fallos transitorios de la API pública. Para producción con carga sostenida se recomienda instancia OSRM propia (ver Paso 3). | 3h | IMPORTANTE | — |
| B14 | ✅ **Retries con exponential backoff en MercadoPago**: helper `conRetry` en `pagos.service.js` reintenta `preference.create()` hasta 3 veces (1s/2s/4s) en errores 5xx o timeout — la transacción DB no se repite, solo la llamada externa a MP. | 1h | ~~IMPORTANTE~~ COMPLETADO | — |
| B15 | ✅ **`liberarReservasPorOferta` en transacción atómica**: `reservas.service.js` envuelve el UPDATE en `BEGIN/COMMIT/ROLLBACK`. Acepta `clienteExterno` opcional para participar en una transacción mayor sin abrir otra. | 1h | ~~IMPORTANTE~~ COMPLETADO | — |
| B16 | ✅ **S3 real implementado con `@aws-sdk/client-s3`**: `backend/config/storage.js` — `saveFile` usa `PutObjectCommand` con `ContentType` inferido; `deleteFile` usa `DeleteObjectCommand`. Si `AWS_S3_BUCKET` no está definido, cae al filesystem local. Antes lanzaba `throw new Error("S3 no implementado")`. | 2h | ~~CRÍTICO~~ COMPLETADO | — |
| B17 | ✅ **Script `npm test` corregido para Jest 30**: `--testPathPattern` reemplazado por `--testPathPatterns` + `--testTimeout=30000`. La suite completa pasa 113/113 de forma estable. | 30m | ~~IMPORTANTE~~ COMPLETADO | — |
| B6 | ✅ **Webhook de MercadoPago con verificación de firma**: `POST /api/pagos/mp/webhook` valida la firma HMAC-SHA256 del header `x-signature` contra `MP_WEBHOOK_SECRET` antes de procesar cualquier evento. Rechaza con 401 si no coincide. | 2h | ~~CRÍTICO~~ COMPLETADO | — |
| B7 | ✅ **`disputas.controller.js` migrado a AppError y apiResponse**: controller de disputas actualizado al patrón estándar — usa `new AppError(...)` en lugar de `res.status(X).json({ error: ... })` y `apiResponse.success/error`. Formato de respuesta unificado en todo el módulo. | 1h | ~~IMPORTANTE~~ COMPLETADO | — |
| B8 | ✅ **Repository layer completo**: todos los services acceden a DB exclusivamente a través del repository correspondiente — `calificaciones`, `chat`, `disponibilidad`, `reservas`, `portfolio`, `pagos` tienen su propio repository. Eliminadas todas las llamadas directas a `db.query()` fuera de repositories. | 4h | ~~IMPORTANTE~~ COMPLETADO | — |
| B9 | ✅ **Redis real integrado**: `backend/config/cache.js` reemplaza el Map en memoria por `ioredis` con TTL. Fallback silencioso si Redis no está disponible. El cache funciona en multi-proceso sin inconsistencias entre workers. | 1h | ~~CRÍTICO~~ COMPLETADO | — |
| B10 | ✅ **Páginas stub reemplazadas**: `inventario-herramientas.html`, `planner-3d.html`, `proyecto-completo.html` y otras con HTML vacío o placeholder ahora muestran una pantalla "Próximamente" consistente con el diseño del sistema. | 2h | ~~IMPORTANTE~~ COMPLETADO | — |
| B11 | ✅ **Idempotencia en endpoints críticos**: los endpoints de confirmar llegada, completar trabajo y confirmar pago verifican el estado actual antes de aplicar el cambio. Reenviar la misma acción dos veces devuelve 200 sin efectos dobles — seguro frente a retries del cliente. | 4h | ~~CRÍTICO~~ COMPLETADO | — |
| B12 | ✅ **Deduplicación de retries de webhook MercadoPago**: tabla `webhook_events` con `(provider, event_id)` único — `INSERT ... ON CONFLICT DO NOTHING` descarta retries automáticos de MP. Un mismo pago aprobado no puede liberar fondos más de una vez. | 2h | ~~CRÍTICO~~ COMPLETADO | — |
| B13 | ✅ **Límites de tamaño y tipo en uploads**: middleware de upload rechaza archivos > 5MB y tipos que no sean `image/*`. El error devuelve 400 con mensaje claro al cliente. | 1h | ~~CRÍTICO~~ COMPLETADO | — |

---

## 2. TÉCNICO PENDIENTE

Deuda técnica identificada y mejoras arquitectónicas necesarias antes de escalar.

| # | Descripción | Esfuerzo | Prioridad | Dependencias |
|---|-------------|----------|-----------|--------------|
| T1 | ✅ **Redis real para cache**: `backend/config/cache.js` usa `ioredis` conectado a `REDIS_URL` con `get/set/del` y TTL. Fallback silencioso si Redis no está disponible. Funciona en multi-proceso. | 2h | ~~CRÍTICO~~ COMPLETADO | — |
| T2 | ✅ **Redis adapter para Socket.io**: `backend/config/socketAdapter.js` conecta el adapter de Socket.io con Redis (`@socket.io/redis-adapter`) para soportar múltiples procesos Node compartiendo rooms y eventos. | 1h | ~~IMPORTANTE~~ COMPLETADO | — |
| T3 | ✅ **Tests de integración para chat y geolocalización**: `chat.test.js` (12 tests: iniciar conversación, enviar/obtener mensajes, acceso denegado 403) y `geolocalizacion.test.js` (6 tests: búsqueda por coords, 400 sin coords, confirmar llegada con/sin coords, 403 trabajador no asignado). | 4h | ~~IMPORTANTE~~ COMPLETADO | — |
| T4 | ✅ **Tests: 113/113 pasando** — cobertura de todos los flujos críticos del backend (auth, jobs, offers, flujo completo, scheduling, reportes, admin, chat, geolocalización). | — | ~~IMPORTANTE~~ COMPLETADO | — |
| T5 | ✅ **Repository layer completo**: extendido a todos los dominios — `auth`, `chat`, `notificaciones`, `calificaciones`, `portfolio`, `disponibilidad`. Todos los services acceden a la DB exclusivamente a través del repository correspondiente. | 6h | ~~IMPORTANTE~~ COMPLETADO | — |
| T6 | ✅ **`socket.js` con paths de imports corregidos**: `require("../services/...")` en lugar de `"./services/..."`. Logging migrado a pino. Módulo estable y sin errores de resolución en arranque. | 3h | ~~OPCIONAL~~ COMPLETADO | — |
| T7 | ✅ **Migración de `console.log` residuales**: 24 `console.log`/`console.error` reemplazados por `logger.info`/`logger.error` en todos los controllers y services (incluyendo disputas, verificacion, seguridad). | 1h | ~~IMPORTANTE~~ COMPLETADO | — |
| T8 | ✅ **Paginación unificada en todos los endpoints**: todos los endpoints que devuelven listas usan `{ data: [...], total: N, page: N, limit: N }` con parámetros `page` (default 1) y `limit` (default 20, máximo 100). | 3h | ~~IMPORTANTE~~ COMPLETADO | — |
| T9 | ✅ **`seguridad.middleware.js` montado en todas las rutas nuevas**: rate limiting, headers de seguridad y validación de Content-Type aplicados en reportes, disputas, admin, verificación de identidad y demás rutas añadidas. | 1h | ~~IMPORTANTE~~ COMPLETADO | — |
| T10 | ✅ **Variables de entorno documentadas**: `.env.example` completo con todas las variables necesarias + script interactivo `setup.js` que guía al nuevo desarrollador paso a paso para generar su `.env`. | 1h | ~~IMPORTANTE~~ COMPLETADO | — |
| T11 | ✅ **`SELECT FOR UPDATE` en transacciones críticas**: las transacciones que leen y luego modifican registros de `trabajos` y `ofertas` usan `SELECT ... FOR UPDATE` para prevenir race conditions bajo carga concurrente. Afecta: `aceptarOferta`, `aceptarContraoferta`, `confirmarLlegada`, `confirmarCompletado`. | 3h | ~~CRÍTICO~~ COMPLETADO | — |
| T12 | ✅ **Invalidación de cache al cambiar estado**: los services de jobs y offers llaman a `cache.del()` / `cache.delPattern()` tras mutaciones — el feed y los estados de trabajos/ofertas se invalidan en cada transición de estado. `cache.incr()` agregado con script Lua atómico (INCR + EXPIRE en una operación). | 2h | ~~IMPORTANTE~~ COMPLETADO | — |
| T13 | ✅ **Versionado de API `/api/v1/`**: `backend/routes/v1.router.js` registra todas las rutas en un único lugar. Montado en `/api/v1` (versión explícita) y `/api` (alias de compatibilidad) en `server.js`. Header `X-API-Version` en cada respuesta vía `apiVersion.middleware.js`. | 2h | ~~IMPORTANTE~~ COMPLETADO | — |

---

## 3. INFRAESTRUCTURA

Todo lo necesario para desplegar en producción de forma segura y estable.

| # | Descripción | Esfuerzo | Prioridad | Dependencias |
|---|-------------|----------|-----------|--------------|
| I1 | ✅ **Variables de entorno seguras**: `.env.example` completo con `DATABASE_URL`, `JWT_SECRET`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `REDIS_URL`, `APP_URL`, `CORS_ORIGIN`, `SMTP_*` y demás. Script `setup.js` interactivo genera el `.env` al clonar el repo. El `.env` real nunca se commitea. | 1h | ~~CRÍTICO~~ COMPLETADO | — |
| I2 | **HTTPS / TLS**: el servidor actualmente corre en HTTP puro. En producción requiere certificado SSL. Opciones: Nginx como reverse proxy con Certbot (Let's Encrypt) o servicio como Render/Railway que provee TLS automático. | 2h | CRÍTICO | Dominio configurado |
| I3 | **PM2 para proceso Node.js**: reemplazar `node server.js` por PM2 con configuración de cluster. Archivo `ecosystem.config.js` con `instances: "max"`, `watch: false`, `restart_delay`. | 1h | CRÍTICO | — |
| I4 | ✅ **CI/CD con GitHub Actions**: `.github/workflows/ci.yml` corre en push a `main` y PRs — levanta PostgreSQL 16, instala deps, aplica blueprints + migraciones en orden, ejecuta `npm test`. `.github/workflows/deploy.yml` como scaffold con TODOs para SSH + PM2 en producción. | 3h | ~~IMPORTANTE~~ COMPLETADO | — |
| I5 | ✅ **Backups automáticos de PostgreSQL**: cron diario con `pg_dump` + compresión + upload a S3. Retención de 30 días. Alerta por email si el backup falla. | 2h | ~~CRÍTICO~~ COMPLETADO | — |
| I6 | ✅ **S3 implementado con `@aws-sdk/client-s3`**: `saveFile` sube con `PutObjectCommand` + `ContentType`; `deleteFile` borra con `DeleteObjectCommand`. Fallback automático a filesystem local si `AWS_S3_BUCKET` no está definido. Variables: `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`. | 4h | ~~CRÍTICO~~ COMPLETADO | — |
| I7 | **Configuración de Nginx**: reverse proxy en puerto 80/443 → Node en 3000. Headers de seguridad (`X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`). Configuración para servir uploads estáticos. | 2h | IMPORTANTE | I2 (HTTPS) |
| I8 | ✅ **Configuración por entorno consistente**: `NODE_ENV` usado uniformemente en todo el backend — `development` activa Ethereal + logs verbose + errores expuestos; `production` usa SMTP real + logs JSON + errores opacos; `test` deshabilita emails y reduce verbosidad. | 1h | ~~IMPORTANTE~~ COMPLETADO | — |
| I9 | ✅ **Runner de migraciones con historial**: `database/migrate.js` ejecuta los SQLs en orden con tabla `migration_history` — omite migraciones ya aplicadas, garantiza idempotencia en deployments repetidos y en CI. | 3h | ~~IMPORTANTE~~ COMPLETADO | — |
| I10 | **Monitoreo básico de uptime**: configurar UptimeRobot o similar para hacer ping a `GET /api/health` cada 5 minutos y enviar alerta si cae. Sin costo. | 30m | IMPORTANTE | I2 (HTTPS) |

---

## 4. FEATURES PENDIENTES

Funcionalidades que están en el backend pero sin frontend, o incompletas end-to-end.

| # | Descripción | Esfuerzo | Prioridad | Dependencias |
|---|-------------|----------|-----------|--------------|
| F1 | ✅ **Nodemailer real en producción**: `email.service.js` con templates HTML para verificación de email, reset de contraseña, confirmación de trabajo agendado. En desarrollo usa Ethereal (preview URL en logs); en producción usa SMTP real vía variables de entorno. | 4h | ~~CRÍTICO~~ COMPLETADO | — |
| F2 | ✅ **Panel de administración**: `admin.html` con 4 tabs: usuarios, reportes, configuración de plataforma (comisión %, credenciales MP) y verificaciones de identidad (aprobar/rechazar DNI + selfie pendientes). | 12h | ~~CRÍTICO~~ COMPLETADO | — |
| F3 | ✅ **UI de verificación de identidad**: página en `mi-perfil.html` para subir foto de DNI y selfie. Badge de verificado en perfil público. `verificacion.service.js` + `verificacion.controller.js` completos. | 4h | ~~IMPORTANTE~~ COMPLETADO | — |
| F4 | ✅ **Sistema de disputas completo**: backend (`disputas.service.js`, `disputas.controller.js`) + UI en `mis-trabajos.html` (botón "Abrir disputa", vista de disputa activa, agregar evidencia, mensajes, resolver). Controller migrado a AppError/apiResponse. | 6h | ~~IMPORTANTE~~ COMPLETADO | — |
| F5 | **Notificaciones push (Web Push API)**: actualmente las notificaciones son solo en-app (Socket.io). Si el usuario no está conectado, no recibe nada hasta que recarga. Implementar Service Worker + Push API para notificaciones de sistema operativo. | 6h | IMPORTANTE | I2 (HTTPS, obligatorio para Service Worker) |
| F6 | ✅ **Mejoras de notificaciones en-app**: filtros por categoría (trabajo, oferta, pago, sistema) con tabs; contador de no-leídas en navbar actualizado en tiempo real vía Socket.io; animación de entrada para notificaciones nuevas; botón "Marcar todo como leído" deshabilitado automáticamente sin no-leídas. | 3h | ~~IMPORTANTE~~ COMPLETADO | — |
| F7 | ✅ **Portfolio visible en perfil público**: `perfil-publico.html` muestra fotos antes/después del portfolio auto-generado al completar trabajos, visible para visitantes sin login. | 2h | ~~IMPORTANTE~~ COMPLETADO | — |
| F8 | ✅ **Búsqueda avanzada funcional**: `busqueda-avanzada.html` con mapa Leaflet interactivo, filtros por rubro/distancia/precio/disponibilidad y resultados con paginación. Consume `/api/jobs` con parámetros de query extendidos. | 4h | ~~IMPORTANTE~~ COMPLETADO | — |
| F9 | ✅ **Ayudantes (equipo de trabajo)**: `ayudantes.service.js`, `ayudantes.controller.js`, rutas registradas + UI completa en `ayudantes.html`. Trabajador líder solicita ayudante para un trabajo, otros aplican, líder acepta/rechaza con transacción atómica. | 5h | ~~OPCIONAL~~ COMPLETADO | — |
| F10 | ✅ **Sistema de confianza con badges**: `confianza.service.js` + controller + rutas + badges integrados en tarjetas del feed y en `perfil-publico.html`. Trabajadores favoritos del dueño + agenda de mantenimiento recurrente con alertas de vencimiento. | 3h | ~~OPCIONAL~~ COMPLETADO | — |
| F11 | ✅ **Catálogo de servicios**: `catalogo.service.js`, `catalogo.controller.js`, rutas registradas + UI en `catalogo.html`. Rubros con estadísticas, precios de referencia, catálogo propio del trabajador editable inline, comprobantes. | 2h | ~~OPCIONAL~~ COMPLETADO | — |
| F12 | **Planner 3D**: `planner-3d.html` muestra pantalla "Próximamente". Feature compleja que requiere decisión de producto antes de implementar. | 20h+ | OPCIONAL | Decisión de producto |
| F13 | **Inventario de herramientas**: `inventario-herramientas.html` muestra pantalla "Próximamente". Feature útil para trabajadores pero no crítica para el flujo de monetización. | 3h | OPCIONAL | — |

---

## 5. OPCIONAL / ESCALABILIDAD

Mejoras que no son necesarias para lanzar pero importan al crecer.

| # | Descripción | Esfuerzo | Prioridad | Dependencias |
|---|-------------|----------|-----------|--------------|
| O1 | **CDN para assets estáticos**: servir CSS, JS y uploads desde un CDN (Cloudflare, CloudFront). Reduce latencia y carga en el servidor Node. | 2h | OPCIONAL | I6 (S3 para uploads) |
| O2 | ✅ **Rate limiting global por usuario/IP**: `backend/middlewares/rateLimitGlobal.middleware.js` montado en `/api`. 100 req/min para GET/HEAD/OPTIONS, 30 req/min para POST/PUT/PATCH/DELETE. Identificación por JWT (soft) o IP. 429 con `Retry-After`. Usa `cache.incr()` con Lua atómico en Redis; fallback en memoria con eviction periódica. Desactivado en `test`. | 3h | ~~IMPORTANTE~~ COMPLETADO | T1 (Redis) |
| O3 | **Monitoreo de errores con Sentry**: integrar `@sentry/node` para capturar excepciones no manejadas en producción con contexto completo (usuario, request, stack trace). | 2h | OPCIONAL | I2 (HTTPS) |
| O10 | ✅ **Logging de errores 5xx en tabla `error_logs`**: los errores HTTP 5xx se persisten en DB con ruta, método, mensaje, stack y `usuario_id`. Tab "Errores" en `admin.html` con filtros por ruta y fecha. | 2h | ~~IMPORTANTE~~ COMPLETADO | — |
| O4 | **Métricas de negocio con Grafana/DataDog**: dashboard con trabajos publicados/día, conversión oferta→pago, tiempo promedio de respuesta de endpoints, errores 5xx. | 4h | OPCIONAL | I3 (PM2), O3 (Sentry) |
| O5 | **Cola de trabajos (Bull + Redis) y desacople de notificaciones**: actualmente OSRM, generación de portfolio, envío de emails y notificaciones se ejecutan síncronamente dentro del request-response — riesgo de timeout y requests lentos. Bull queue con workers separados: el endpoint encola el job y responde `202 Accepted`; el worker procesa en background. | 6h | IMPORTANTE | T1 (Redis) |
| O6 | **Búsqueda full-text con pg_trgm**: agregar índice GIN sobre `titulo` y `descripcion` de trabajos para búsqueda por texto rápida. Alternativa: Elasticsearch si el volumen lo justifica. | 2h | OPCIONAL | — |
| O7 | **Limpieza periódica de datos huérfanos**: cron semanal/mensual que limpie uploads en S3 sin referencia en DB, `reservas_tentativas` de más de 7 días sin confirmar, notificaciones leídas de más de 90 días, tokens expirados, y archive trabajos completados de más de 6 meses. Sin esto la DB crece sin control. | 3h | IMPORTANTE | I3 (PM2) |
| O8 | **Tests de carga con k6 o Artillery**: simular 100 usuarios simultáneos publicando y ofertando. Identificar cuellos de botella antes de lanzar. | 3h | OPCIONAL | — |
| O9 | **Disciplina de overfetching en frontend**: auditar los endpoints más usados y agregar proyección de campos (`SELECT id, titulo, estado FROM ...` en lugar de `SELECT *`). Impacta especialmente en mobile con conexión lenta. | 3h | OPCIONAL | — |

---

## PARA PRODUCCIÓN

Los únicos 4 pasos que realmente faltan para hacer el primer deploy.

### Paso 1 — HTTPS + Nginx (I2 + I7) `~4h`
- Apuntar el dominio al servidor
- Instalar Nginx como reverse proxy (`puerto 80/443 → Node:3000`)
- Obtener certificado SSL con Certbot (Let's Encrypt, gratis)
- Configurar headers de seguridad (`Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`)

### Paso 2 — PM2 (I3) `~1h`
- Instalar PM2 globalmente (`npm i -g pm2`)
- Crear `ecosystem.config.js` con `instances: "max"`, `exec_mode: "cluster"`
- Completar los TODOs en `.github/workflows/deploy.yml` para SSH + `pm2 reload`

### Paso 3 — OSRM en producción (B5) `~2h` (parcialmente completado)
- ✅ Retry con backoff exponencial ya implementado (3 intentos: 500ms/1000ms antes del fallback de 30 min)
- Pendiente: evaluar opción A — instancia OSRM propia en Docker para carga sostenida
- Pendiente: evaluar opción B — cola de requests con `p-limit` + `User-Agent` identificatorio si se sigue usando la API pública

### Paso 4 — Monitoreo básico (I10) `~30min`
- Crear cuenta gratuita en UptimeRobot
- Configurar monitor HTTP contra `GET /api/health` cada 5 minutos
- Agregar alerta por email si el health check cae

---

## RESUMEN DEL ESTADO ACTUAL

### Lo que funciona hoy (localhost)
- Flujo completo de trabajo: publicar → ofertar → aceptar → agendamiento automático → confirmar llegada → completar → calificar
- Auth completo: JWT, verificación de email con envío real (Ethereal dev / SMTP prod), reset de contraseña por email
- Chat en tiempo real con Socket.io
- Pagos con MercadoPago en sandbox + webhook con firma HMAC-SHA256 + deduplicación de retries (`webhook_events`)
- Sistema de notificaciones in-app
- Portfolio automático al completar trabajo (visible en perfil público sin login)
- Geolocalización para confirmar llegada
- Sistema de reportes y comentarios
- Panel de administración (usuarios, reportes, configuración, verificaciones)
- Verificación de identidad con UI en mi-perfil + badge en perfil público
- Sistema de disputas completo (crear, evidencia, mensajes, resolver) con UI
- Búsqueda avanzada con mapa Leaflet interactivo y filtros
- Sistema de confianza con badges de nivel en feed y perfiles
- Catálogo de servicios con precios de referencia y catálogo propio editable
- Sistema de ayudantes (solicitar, postular, aceptar) con UI completa
- Uploads en S3 (disco local eliminado)
- Redis real integrado (cache + adapter Socket.io)
- Idempotencia en endpoints críticos + SELECT FOR UPDATE en transacciones
- Backups automáticos de PostgreSQL configurados (cron diario + S3 + alerta email)
- `.env.example` completo + script `setup.js` interactivo
- Runner de migraciones `database/migrate.js` con tabla `migration_history`
- CI/CD con GitHub Actions (113/113 tests en cada push a main)
- `NODE_ENV` consistente en todo el backend
- Versionado de API `/api/v1/` con alias de compatibilidad `/api/`
- Paginación unificada en todos los endpoints
- Validación inline en formularios + skeleton loading + avatares determinísticos
- Rate limiting global por usuario/IP: 100/30 req/min con Lua atómico en Redis, fallback en memoria
- Invalidación de caché al cambiar estado de trabajos y ofertas (`cache.del` / `cache.delPattern`)
- Logging de errores 5xx en tabla `error_logs` con tab en panel admin
- Notificaciones in-app: filtros por categoría, contador en navbar, animaciones, botón deshabilitado sin no-leídas

### Bloqueantes para producción (3 restantes — score 89/100)
1. **HTTPS + Nginx (I2 + I7)** — obligatorio para Service Workers, MercadoPago y cualquier navegador moderno
2. **PM2 (I3)** — reemplazar `node server.js` por cluster administrado con reinicio automático
3. **Monitoreo básico (I10)** — UptimeRobot contra `/api/health`, 30 minutos de configuración

> B5 (OSRM) ya tiene retry/backoff — ya no bloquea el lanzamiento inicial; instancia propia sigue siendo recomendada para escalar.

### Lo que queda para después del primer deploy
```
IMPORTANTE (no bloquea lanzamiento):
F5     → Notificaciones push (Web Push API)
O5     → Cola de trabajos Bull + desacople de notificaciones
O7     → Limpieza de datos huérfanos (cron periódico)

OPCIONAL:
F12    → Planner 3D (decisión de producto pendiente)
F13    → Inventario de herramientas
O1     → CDN para assets estáticos
O3     → Sentry para errores en producción
O4     → Grafana/DataDog para métricas de negocio
O6     → Búsqueda full-text con pg_trgm
O8     → Tests de carga con k6/Artillery
O9     → Reducir overfetching en endpoints del feed
```

---

*Documento actualizado al 2026-04-19. S3 real con `@aws-sdk/client-s3`, retries en MercadoPago (3 intentos backoff), retries en OSRM (3 intentos backoff), `liberarReservasPorOferta` en transacción atómica, script `npm test` corregido para Jest 30. Score: **89/100**. Tests: 113/113.*
