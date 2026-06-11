# Labu — Guía para Claude Code

## ¿Qué es Labu?
Labu es una plataforma que conecta personas con complejidades técnicas en su hogar con personas que conocen la solución a sus problemas. Funciona similar a Uber pero para servicios del hogar y profesionales.

---

## Stack tecnológico
- **Frontend:** HTML + CSS + JS vanilla (sin frameworks)
- **Backend:** Node.js + Express
- **Base de datos:** PostgreSQL
- **Tiempo real:** Socket.io
- **Auth:** JWT + bcrypt
- **Pagos:** MercadoPago (integrado en sandbox, falta credenciales de producción)

---

## Configuración local
- **Servidor:** http://localhost:3000
- **Base de datos:** rtype1
- **Usuario DB:** postgres
- **Puerto DB:** 5432
- **PostgreSQL:** C:\Program Files\PostgreSQL\18\bin\psql.exe

---

## Estructura del proyecto
```
labu.com gpt5.2/
├── frontend/
│   ├── views/pages/        # Páginas HTML
│   ├── views/components/   # Componentes reutilizables
│   └── public/
│       ├── css/            # Archivos CSS por página
│       ├── js/modules/     # JS por página
│       └── uploads/        # Archivos subidos
├── backend/
│   ├── routes/             # Rutas Express
│   ├── controllers/        # Controladores
│   ├── services/           # Lógica de negocio
│   ├── middlewares/        # Auth, upload, etc.
│   └── config/db.js        # Conexión PostgreSQL
├── database/
│   ├── data/blueprints/    # SQLs de creación de tablas
│   └── migrations/         # Migraciones posteriores
└── skills/                 # Skills de Claude Code
```

---

## Perfiles de usuario
Labu tiene dos perfiles intercambiables con la misma cuenta:

### Perfil Dueño
- Publica trabajos con foto del "antes", título corto, descripción detallada y días disponibles
- Geolocalización obligatoria al publicar
- Recibe ofertas de trabajadores en "Mis ofertas laborales"
- Puede aceptar, rechazar o contraofertar
- Al aceptar paga (dinero retenido en plataforma)
- Confirma llegada del trabajador y trabajo terminado
- Califica al trabajador al finalizar

### Perfil Trabajador
- Ve trabajos publicados por dueños en el feed
- Puede ofertar (presupuesto, días propuestos, mensaje) o preguntar por chat
- Ve trabajos aceptados en "Mis trabajos"
- Confirma inicio, sube foto al terminar
- Califica al dueño al finalizar
- Sus publicaciones son automáticas (trabajos completados, logros)

---

## Flujo completo de un trabajo
1. **Dueño publica** trabajo con foto y geolocalización
2. **Trabajador oferta** proponiendo presupuesto, tiempo estimado y mensaje (el modal avisa si los horarios del trabajador no coinciden con los días disponibles del dueño)
3. **Dueño acepta** oferta → el sistema asigna automáticamente el próximo slot disponible usando `scheduling.service.js` (OSRM + disponibilidad semanal) → se genera el cobro al dueño → ambos reciben notificación con el horario asignado
4. **Publicación desaparece del feed** y pasa a "en proceso" para ambos (aparece widget en sidebar del feed)
5. **Trabajador llega** → sistema detecta geolocalización → dueño recibe notificación
6. **Trabajador termina** → sube foto/video del resultado → toca botón "Terminado"
7. **Dueño confirma** que el trabajo está correcto
8. **Se libera el pago** al trabajador
9. **Se genera publicación** antes/después en ambos perfiles
10. **Ambos se califican** mutuamente

> **Nota:** El chat de coordinación manual con minicalendario fue eliminado. El agendamiento es 100% automático al aceptar la oferta.

---

## Sistema de relaciones entre usuarios
- **Dueño ↔ Dueño:** Amigos (se aceptan mutuamente)
- **Dueño → Trabajador:** Seguidor (sin aceptación)
- **Trabajador ↔ Trabajador:** Amigos (se aceptan mutuamente)

---

## Reglas importantes para Claude Code

### SIEMPRE hacer antes de cambiar algo grande:
1. Preguntar si el cambio puede afectar otras partes del flujo
2. Verificar que el archivo SQL de migración usa `IF NOT EXISTS`
3. Confirmar que el JS nuevo está cargado en el HTML correspondiente
4. Revisar que las funciones llamadas desde HTML estén exportadas a `window`

### NUNCA hacer sin preguntar primero:
- Eliminar tablas de la base de datos
- Cambiar la estructura de autenticación JWT
- Modificar server.js sin avisar
- Renombrar archivos que ya tienen referencias en otros archivos
- Tocar el sistema de pagos de MercadoPago sin revisar primero

### Convenciones de código:
- Variables y comentarios en **español**
- CSS en archivos externos (no inline en HTML)
- Cada página tiene su propio archivo JS en `/public/js/modules/`
- Funciones llamadas desde HTML deben exportarse a `window.nombreFuncion`
- Siempre usar `IF NOT EXISTS` en migraciones SQL
- Siempre usar `ON CONFLICT DO NOTHING` en seeds SQL

### Errores comunes a evitar:
- Olvidar cargar el archivo JS en el HTML de la página
- Usar `CREATE INDEX` sin `IF NOT EXISTS`
- Llamar `cerrarModal()` antes de leer los datos del modal
- No agregar clase `visible` a `.form-error` al mostrar errores
- Usar `require("./services/...")` en socket.js (debe ser `"../services/..."`)

---

## Skills disponibles
Las skills están en la carpeta `/skills/` en la raíz del proyecto. Revisarlas antes de trabajar en features específicas.

---

## Estado actual del MVP (100% completo)
- ✅ Login/Registro con JWT
- ✅ Publicar trabajos con foto
- ✅ Feed separado por rol (dueño/trabajador)
- ✅ Sistema de ofertas
- ✅ Disponibilidad semanal del trabajador
- ✅ Sistema de notificaciones
- ✅ Chat en tiempo real (Socket.io)
- ✅ Agenda con días disponibles
- ✅ Flujo completo de trabajo (confirmación llegada, resultado, calificación mutua)
- ✅ Geolocalización para confirmar llegada del trabajador (frontend + backend)
- ✅ Agendamiento automático al aceptar oferta (`scheduling.service.js` con OSRM)
- ✅ Perfiles intercambiables dueño/trabajador
- ✅ Sistema de amigos/seguidores
- ✅ Publicación automática antes/después (auto-portfolio al completar)
- ✅ Connection pool configurado (PostgreSQL)
- ✅ 6 índices de escalabilidad en DB
- ✅ Paginación en jobs, offers y chat
- ✅ N+1 queries resuelto en chat
- ✅ Rate limiting en login/registro y Socket.io
- ✅ CORS restringido por variable de entorno
- ✅ Validación de inputs con express-validator
- ✅ Logging estructurado con pino (reemplaza console.log/error — 24 usos migrados, 6 eventos de negocio)
- ✅ Recuperación de contraseña (reset por email)
- ✅ Verificación de email al registrarse
- ✅ Health check endpoint (`GET /api/health`)
- ✅ Transacciones atómicas en operaciones críticas
- ✅ Queries optimizadas (CTE, UNNEST batch, helpers reutilizables)
- ✅ Manejo de errores estandarizado en todos los controllers
- ✅ Comentarios en publicaciones (tabla `comentarios`, endpoint + UI en feed)
- ✅ Sistema de reportes de comentarios y publicaciones (tabla `reportes`, `POST /api/reportes`, modal UI)
- ✅ AppError class + middleware global de errores
- ✅ Formato de respuesta API unificado (`apiResponse.js`)
- ✅ Repository layer completo para todos los módulos (`jobs`, `offers`, `auth`, `chat`, `notificaciones`, `calificaciones`, `portfolio`, `disponibilidad`, `pagos`, `profile`) — 10/10
- ✅ Logging avanzado con pino + requestId por request (AsyncLocalStorage)
- ✅ Redis real integrado — cache con `ioredis` (`cache.js`) y Socket.io adapter (`socketAdapter.js`) listos para multi-proceso
- ✅ Fix timezone en `fecha_inicio` (TIMESTAMP → TIMESTAMPTZ)
- ✅ MercadoPago conectado al flujo de pago real + verificación de firma HMAC-SHA256 en webhook
- ✅ Widget de trabajo en proceso en sidebar del feed
- ✅ Aviso de horarios no coincidentes en modal de oferta
- ✅ Campo tiempo de preparación en página de agenda (`disponibilidad_trabajador.tiempo_preparacion_minutos`)
- ✅ `scheduling.service.js`: cálculo inteligente de tiempo de viaje con OSRM (desde casa o desde trabajo anterior)
- ✅ Nodemailer con Ethereal en desarrollo — en producción usa SMTP real vía variables de entorno
- ✅ CI/CD con GitHub Actions — `ci.yml` (PostgreSQL service, migraciones, `npm test`) + `deploy.yml` (scaffold con TODOs PM2)
- ✅ Panel de administración (`admin.html`) con 4 tabs: usuarios, reportes, configuración de plataforma y verificaciones de identidad
- ✅ Verificación de identidad completa: UI en `mi-perfil.html` para subir DNI + selfie, badge de verificado en perfil público
- ✅ Tests de integración para chat (`chat.test.js`) y geolocalización (`geolocalizacion.test.js`)
- ✅ Tests: 150/150 pasando (Jest 30)
- ✅ Fix double-booking en agendamiento automático (C1 del AUDIT.md): reserva confirmada persistida + advisory lock por trabajador + comparaciones de calendario en timezone Argentina (`date-fns-tz`)
- ✅ Flujo de dinero real (C4 del AUDIT.md): gate de pago aprobado para confirmar llegada (402 si el dueño no pagó), retención real (distribuciones nacen `pendiente`), liberación al confirmar completado (→ `procesado` en la misma transacción), payout por saldo + retiro manual (tabla `retiros`, `GET /api/pagos/saldo`, `POST /api/pagos/retiros` con advisory lock, página `mis-pagos.html`, tab Retiros en admin)
- ✅ Cancelación con salvaguardas (C3 del AUDIT.md): reglas por estado y rol — libre sin pago; con pago aprobado no iniciado reembolso automático (pago → `reembolsado`, distribuciones anuladas); bloqueada para el dueño si el trabajo está iniciado (403, solo trabajador/admin, dinero retenido para disputa); bloqueada para todos salvo admin en `pendiente_confirmacion`/`completado`; liberación de reservas + notificación `trabajo_cancelado` en la misma transacción
- ✅ Disputa activa congela el pago (I7 del AUDIT.md): `confirmarCompletado` → 403 con disputa `abierta`/`en_revision`; el admin resuelve con `resultado` obligatorio — `trabajador` libera las distribuciones, `dueno` reembolso contable (incluye reversión de `procesado` si la disputa es sobre un trabajo ya completado); columna `disputas.resultado` + select en el modal de admin; resolución parcial por porcentaje pendiente (documentada en AUDIT.md)
- ✅ Patrón outbox en pagos (I17 del AUDIT.md): ninguna transacción de DB abierta durante llamadas de red a MercadoPago — el pago nace `iniciando` commiteado antes de llamar a MP, una transacción corta final aplica el resultado (`pendiente`/`aprobado`/`fallido`); webhook idempotente con dedupe `webhook_events` + guard de estado `FOR UPDATE` (no duplica distribuciones)
- ✅ Versionado de API `/api/v1/` con alias de compatibilidad `/api/` (`v1.router.js` + `apiVersion.middleware.js`)
- ✅ Búsqueda avanzada con mapa Leaflet interactivo y filtros por rubro/distancia/precio/disponibilidad (`busqueda-avanzada.html`)
- ✅ Sistema de confianza: trabajadores favoritos del dueño + agenda de mantenimiento recurrente con alertas de vencimiento (badges de nivel en feed y perfil público)
- ✅ Catálogo de servicios: rubros con estadísticas, tareas con precios de referencia, catálogo propio del trabajador editable, comprobantes (`catalogo.html`)
- ✅ Sistema de ayudantes: solicitudes de ayudante por trabajo, postulación y aceptación, transacción atómica (`ayudantes.html`)
- ✅ Límites de tamaño en uploads (5MB, solo imágenes) — validación en middleware de upload
- ✅ SELECT FOR UPDATE en transacciones críticas (race conditions prevenidos)
- ✅ Idempotencia en acciones críticas (confirmar llegada, completar, pago)
- ✅ `seguridad.middleware.js` montado en todas las rutas nuevas
- ✅ Portfolio visible en perfil público (fotos antes/después sin login)
- ✅ Paginación unificada en todos los endpoints (`{ data, total, page, limit }`)
- ✅ Páginas stub reemplazadas por pantalla "Próximamente" consistente
- ✅ Sistema de disputas completo: backend (`disputas.service.js`, `disputas.controller.js` con AppError/apiResponse) + UI en `mis-trabajos.html` (abrir disputa, evidencia, mensajes, resolver)
- ✅ Uploads migrados a S3 (AWS SDK, variables `AWS_S3_BUCKET` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, URLs servidas desde bucket)
- ✅ Backups automáticos de PostgreSQL: cron diario con `pg_dump` + compresión + upload a S3, retención 30 días, alerta email si falla
- ✅ Estados de error con retry en todas las páginas
- ✅ Features reales en landing page (sin contenido placeholder)
- ✅ Perfiles públicos accesibles sin login
- ✅ Estados vacíos con CTAs contextuales en todas las listas
- ✅ Nombres amigables de estados de trabajo en el frontend
- ✅ Formulario de edición en área principal de mi-perfil (no modal)
- ✅ Confirmación visual de éxito en pagos — `frontend/views/pages/pago-exitoso.html` + `pago-exitoso.js` + `pago-exitoso.css`; el callback de MercadoPago redirige a esta página con `?status=success|failure|pending&payment_id=...`
- ✅ Notificaciones agrupadas por fecha
- ✅ Disponibilidad semanal visible sin scroll en agenda (grid 7 columnas)
- ✅ Skeleton loading en feed (reemplaza spinner genérico mientras cargan las tarjetas)
- ✅ Rating del trabajador visible en tarjetas de oferta (estrella + promedio junto al nombre)
- ✅ Timeline de progreso en tarjetas de trabajo (indicador visual de etapa: oferta → agendado → en curso → completado)
- ✅ Validación inline en formularios (errores por campo en tiempo real, sin esperar submit)
- ✅ Avatares con iniciales de color determinístico (hash del nombre → color HSL consistente entre sesiones)
- ✅ Notificación al dueño cuando ningún trabajador tiene disponibilidad compatible con sus días
- ✅ Emails de verificación y reset de contraseña enviados realmente — Ethereal en desarrollo (preview URL en logs), SMTP real en producción (`email.service.js` conectado a ambos flujos)
- ✅ Deduplicación de retries de webhook MercadoPago — tabla `webhook_events` con `(provider, event_id)` único + `INSERT ... ON CONFLICT DO NOTHING`
- ✅ `.env.example` completo con todas las variables del proyecto + script `setup.js` interactivo para generar `.env` al clonar
- ✅ Runner de migraciones `migrate.js` (raíz) con tabla `migration_history` — ejecuta SQLs en orden, omite los ya aplicados, idempotente en CI y deployments (`npm run migrate`)
- ✅ `NODE_ENV` consistente en todo el backend — `development` activa Ethereal + logs verbose; `production` usa SMTP real + logs JSON + errores opacos; `test` deshabilita emails
- ✅ Cola de trabajos Bull con 3 workers (`emailWorker`, `osrmWorker`, `portfolioWorker`) — tareas secundarias desacopladas del request principal; fallback síncrono si Redis no está disponible
- ✅ Auditoría de código completa — 9 hallazgos corregidos (2 críticos, 3 importantes, 4 menores): `avatar_url` fix en `offers.repository.js`, migración `estadisticas_trabajador.sql`, CDN socket.io en `mis-ofertas-laborales.html`, 6 controllers huérfanos (denuncias/seguridad/estadisticas/tienda/equipate/features) registrados en `v1.router.js`, `logger.warn` para MP token ausente en development, eliminación de `app.js` innecesario en 3 páginas stub, `next(err)` en `messages.routes.js` y `notifications.routes.js`, `estadisticas_trabajador` en `TABLAS_CORE` de `setup.js`

---

## Historial de mejoras (resumen por sesión)

Todas las mejoras están reflejadas en el Estado del MVP. Para detalles de implementación, leer el código directamente.

- **2026-03-30:** Transacciones atómicas en ofertas/calificaciones, validaciones express-validator en 4 endpoints, queries optimizadas (CTE Haversine, UNNEST batch, helper `_aceptarOfertaYTrabajo`), manejo de errores estandarizado en controllers
- **2026-03-31:** Separación `disponibilidad.service.js` → `reservas.service.js`, extracción auto-portfolio a `portfolio.service.js`, naming inglés en `jobs.controller.js` (`startJob`, `confirmArrivalJob`, etc.), `Promise.all` en `confirmarCompletado`
- **2026-03-31 tarde:** Logging pino (24 console.log migrados, 6 eventos de negocio), comentarios en publicaciones (tabla + endpoints + UI lazy), sistema de reportes (tabla + unique index + modal UI, motivos: contenido_inapropiado/spam/informacion_falsa/otro)
- **2026-04-01:** `AppError` + `errorHandler` global, `apiResponse.js` helpers `success/error`, repository layer para jobs/offers, `requestLogger.middleware.js` con `AsyncLocalStorage`, `cache.js` stub + `socketAdapter.js` stub, timezone TIMESTAMPTZ en `fecha_inicio`, MercadoPago conectado al flujo real + webhook `POST /api/pagos/webhook`
- **2026-04-04:** `scheduling.service.js` con OSRM (primer trabajo desde home, trabajos siguientes desde último confirmado, fallback 30 min), widget trabajo activo en sidebar feed, aviso horarios incompatibles en modal de oferta, campo `tiempo_preparacion_minutos` en agenda
- **2026-04-07:** Nodemailer + Ethereal en dev (preview URL en logs), firma HMAC-SHA256 en webhook MP, Redis real con `ioredis` en `cache.js` + `@socket.io/redis-adapter`, repository layer 10/10 módulos, CI/CD con GitHub Actions (`ci.yml` + `deploy.yml`)
- **2026-04-09:** Error states con retry en todas las páginas, landing con features reales, perfiles públicos sin login, estados vacíos con CTAs, nombres amigables de estados DB, formulario edición en área principal de mi-perfil, `pago-exitoso.html` con query params status/payment_id, notificaciones agrupadas por fecha, disponibilidad grid 7 columnas sin scroll
- **2026-04-10:** Skeleton loading en feed, rating en tarjetas de oferta, timeline de progreso en tarjetas de trabajo, validación inline en formularios (blur), avatares con color HSL determinístico, notificación al dueño sin disponibilidad compatible
- **2026-04-10 tarde:** Límites upload 5MB solo imágenes, `SELECT FOR UPDATE` en transacciones críticas (aceptarOferta/confirmarLlegada/confirmarCompletado), idempotencia en acciones críticas, `seguridad.middleware` en rutas nuevas, portfolio en perfil público, paginación unificada `{ data, total, page, limit }`, páginas stub → "Próximamente"
- **2026-04-11:** API versioning `/api/v1` + alias `/api` (`v1.router.js` + `apiVersion.middleware.js`), búsqueda avanzada Leaflet con filtros rubro/distancia/precio/disponibilidad, sistema de confianza con badges (tablas `trabajadores_confianza` + `mantenimientos_recurrentes`), catálogo de servicios con estadísticas por rubro, sistema de ayudantes (solicitudes + aplicaciones, transacción atómica)
- **2026-04-12 mañana:** `email.service.js` conectado a verificación + reset (Ethereal/dev, SMTP/prod, desactivado/test), deduplicación webhook MP con tabla `webhook_events` + `ON CONFLICT DO NOTHING`, `.env.example` completo + `setup.js` interactivo, `migrate.js` con tabla `migration_history` idempotente (`npm run migrate`), `NODE_ENV` consistente en todo el backend
- **2026-04-12 tarde:** Rate limiting global Redis 100/30 req/min (`rateLimitGlobal.middleware.js`), `cache.incr()` atómico con Lua, invalidación caché en mutaciones de jobs/offers, logging errores 5xx en tabla `error_logs` + tab en admin, notificaciones in-app con filtros por categoría + contador navbar en tiempo real
- **2026-04-19:** S3 real con `PutObjectCommand`/`DeleteObjectCommand` + fallback filesystem, retry exponencial MP 3 intentos (1s→2s→4s), retry OSRM 3 intentos (500ms→1000ms), `liberarReservasPorOferta` acepta cliente externo para participar en transacción del llamador, cola Bull 3 workers (`emailWorker`, `osrmWorker`, `portfolioWorker`) con fallback síncrono, npm test corregido para Jest 30 (113/113)
- **2026-06-02:** B5 Disputas completo (`disputas.service.js`, `disputas.controller.js`, migración aplicada, UI en `mis-trabajos.html`, 113→113 tests); B7 S3 uploads completo (`upload.service.js` refactor, `uploadEvidencia`, fix portfolio, 113→119 tests); B8 Backups automáticos completo (`backup.service.js`, `backup.job.js` cron 3AM, tab en admin, 119→127 tests)
- **2026-06-08:** Auditoría completa — 9 hallazgos corregidos: `avatar_url` fix en `offers.repository.js` (crítico), migración `estadisticas_trabajador.sql` aplicada en ambas DBs (crítico), CDN socket.io 4.8.3 en `mis-ofertas-laborales.html` (importante), 6 routes huérfanos creados y registrados en `v1.router.js` (importante), `logger.warn` para MP token ausente en development (importante), `app.js` eliminado de 3 páginas stub (menor), `next(err)` en `messages.routes.js` y `notifications.routes.js` (menor), `estadisticas_trabajador` en `TABLAS_CORE` de `setup.js` (menor). Tests: 127/127. Proyecto listo para deploy.
- **2026-06-08 tarde:** Bug fixes — deduplicación persistente en DB para notificación `sin_disponibilidad` (evita duplicados entre sesiones); ventana de confirmación de asistencia restringida a ±3 minutos con validación en frontend y backend; notificaciones fake eliminadas del navbar (Carlos López, María García); fix mismatch `data.data` en panel de notificaciones navbar; script del navbar extraído a `/js/modules/navbar.js` y registrado en `feed.html`. Tests: 127/127.
- **2026-06-10:** Auditoría AUDIT.md (35 hallazgos, raíz del proyecto) + paquete scheduling resuelto — **C2** (deps consolidadas en `backend/package.json`, Express 5 único, raíz scripts-only); **C1, el bug de superposición de citas pendiente desde 2026-06-08**: `agendarTrabajo` con advisory lock por trabajador + `asignarSlotATrabajo` (fecha_inicio + reserva confirmada en una transacción) en `scheduling.service.js`, detector de conflictos deriva la franja desde `fecha_inicio` + `tiempo_estimado` cuando no hay reserva, `osrmWorker.js` unificado sobre ese camino; **I8 (timezone)**: comparaciones de calendario en `America/Argentina/Buenos_Aires` con `date-fns-tz` (nueva dependencia); I14 verificado como falso positivo (FKs de `reservas_tentativas` son ON DELETE CASCADE). Detalle en AUDIT.md. Tests: 129/129 (2 nuevos en `scheduling.test.js`).
- **2026-06-10 tarde:** **C4 resuelto** (paquete "dinero", decisión de producto: payout saldo + retiro manual) — gate de pago aprobado en `iniciarTrabajo` (402 sin pago, en todos los entornos), `insertDistribucion` nace `'pendiente'` (retención real), `confirmarCompletado` libera distribuciones a `'procesado'` en la misma transacción (eliminadas `updatePagoAprobado`/`insertPago` que falsificaban aprobaciones), tabla `retiros` + saldo (`GET /api/pagos/saldo`, `POST /api/pagos/retiros` con `pg_advisory_xact_lock(47002, usuarioId)`), admin `GET/PATCH /api/admin/retiros`, página `mis-pagos.html` + tab Retiros en admin. Fix BOM en `migrate.js` (desbloqueó el runner; 32 migraciones registradas en `migration_history` de ambas DBs). Tests: 135/135 (helper `aprobarPagoTrabajo` + 6 tests nuevos).
- **2026-06-10 noche:** **C3 resuelto** (cancelación con salvaguardas) — `cancelarTrabajo` reescrito con transacción + `FOR UPDATE`: reglas por estado/rol (libre sin pago; reembolso automático con pago aprobado no iniciado; bloqueada para dueño si iniciado — solo trabajador/admin, dinero retenido para disputa; bloqueada para todos salvo admin en `pendiente_confirmacion`/`completado`), `reembolsarPagoPorTrabajo` (distribuciones `pendiente` → NULL + pago `aprobado` → `reembolsado`), `liberarReservasPorTrabajo` (tentativas y confirmadas → liberadas), `notificarTrabajoCancelado` a la contraparte. Migración `pagos_reembolsado.sql` (CHECK de `pagos.estado` + `'reembolsado'`) aplicada en ambas DBs. Tests: 140/140 (5 nuevos en `jobs.test.js`, describe C3).
- **2026-06-11:** **I7 resuelto** (disputa activa congela el pago) — gate en `confirmarCompletado` (403 si hay disputa `abierta`/`en_revision`, chequeo con `FOR UPDATE` dentro de la transacción existente), `resolverDisputa` reescrito en transacción con `resultado` obligatorio (`'trabajador'` → `liberarDistribucionesPorTrabajo`; `'dueno'` → `reembolsarPagoPorDisputa`, que además revierte distribuciones `'procesado'` para disputas sobre trabajos ya completados), orden de locks trabajos → disputas en ambos caminos para evitar deadlocks, migración `disputas_resultado.sql` (columna `resultado`) aplicada en ambas DBs, select de resultado en el modal de admin. Resolución parcial por porcentaje documentada como pendiente en AUDIT.md. Tests: 144/144 (4 nuevos en `jobs.test.js`, describe I7).
- **2026-06-11 tarde:** **I17 resuelto** (patrón outbox — cierra el paquete "dinero") — `crearPreferenciaTrabajo`, `pagarDirectoTrabajo` y `procesarWebhook` ya no retienen transacciones de DB durante las llamadas de red a MP: el pago nace `'iniciando'` commiteado antes de llamar (estados `'iniciando'`/`'procesando'`/`'fallido'` agregados al CHECK vía `pagos_estados_outbox.sql`, aplicada en ambas DBs), la llamada HTTP con retry corre sin conexión retenida, y una transacción corta final aplica el resultado (`activarPagoConPreferencia` / `aplicarResultadoMP` con `FOR UPDATE` + guard idempotente que evita duplicar distribuciones cuando el webhook llega tras un pago directo ya aplicado; si MP falla → `marcarPagoFallido`). En el webhook el marcador pre-red es `webhook_events` (el pago se identifica recién con `Payment.get`); el dedupe definitivo va `ON CONFLICT` en la misma transacción que los efectos. Fix lateral: `webhook_events` en el TRUNCATE de `tests/helpers.js`. Tests: 150/150 (suite nueva `pagos.test.js`, 6 tests con SDK de MP mockeado — verifica que el pago está commiteado durante la llamada de red).

---

## Reglas de prompts

Antes de ejecutar cualquier cambio en el código:
1. **Reformular el prompt dos veces a detalle** — reescribir el pedido del usuario con precisión técnica, identificar archivos afectados, posibles efectos secundarios y casos borde.
2. **Confirmar el plan con el usuario** — presentar el plan reformulado y esperar aprobación explícita antes de tocar código.
3. **Usar la skill correspondiente** — `/debug` para errores, `/feature` para nuevas funcionalidades, `/refactor` para mejoras de código; revisar `/skills/` antes de empezar.
