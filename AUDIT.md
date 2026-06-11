# AUDIT.md — Auditoría completa del proyecto Labu

**Fecha:** 2026-06-10
**Alcance:** Backend (Express/PostgreSQL), Frontend (HTML/CSS/JS vanilla), Tests, Configuración/Deploy.
**Método:** Lectura de código fuente, greps sistemáticos, verificación cruzada con `.env.example`, blueprints SQL y CLAUDE.md. **No se corrigió nada** — solo documentación de problemas.

---

## 🔴 CRÍTICO

### C1. Superposición de citas (double-booking) en el agendamiento automático
- **Archivos:** `backend/workers/osrmWorker.js:19,36` + `backend/services/scheduling.service.js:150-161,203-207`
- **Descripción:** Al aceptar una oferta, `osrmWorker` asigna `fecha_inicio` con `jobsRepo.updateFechaInicio()` pero **nunca crea una fila confirmada en `reservas_tentativas`**. El detector de conflictos de `calcularProximoSlot` solo "ve" trabajos que tienen `rt.hora_inicio/rt.hora_fin` desde `reservas_tentativas` confirmadas (`if (!tc.rt_inicio || !tc.rt_fin) return false;` — línea 204). Resultado: todo trabajo agendado automáticamente es **invisible** para los agendamientos siguientes → dos trabajos pueden quedar asignados al mismo trabajador en el mismo horario. Es el bug de "superposición de citas" anotado como pendiente en CLAUDE.md (sesión 2026-06-08).
- **Agravante:** el worker corre sin transacción ni lock — dos ofertas aceptadas en paralelo para el mismo trabajador pueden elegir el mismo slot aunque se corrigiera lo anterior.
- **Acción sugerida:** al asignar el slot, insertar/confirmar una reserva en `reservas_tentativas` (o cambiar la query de conflictos para derivar la franja desde `fecha_inicio` + duración de la oferta), y serializar el agendamiento por trabajador (advisory lock o `SELECT ... FOR UPDATE`).

### C2. Dependencias divididas en dos `package.json` con versiones incompatibles de Express y Jest
- **Archivos:** `package.json` (raíz) vs `backend/package.json`
- **Descripción:** La raíz declara `express ^4.22.1` y `jest ^30`; el backend declara `express ^5.2.1` y `jest ^29`. El servidor resuelve **Express 5** desde `backend/node_modules` (verificado: 5.2.1 instalado ahí, 4.22.1 en raíz). Pero `express-validator`, `bull`, `node-cron`, `express-rate-limit` y `express-session` están **solo en la raíz** — el backend los resuelve "por accidente" subiendo el árbol de node_modules. Un `npm install` limpio solo dentro de `backend/` (p.ej. en el deploy descrito en `deploy.yml`) **rompería todos esos requires**. Además conviven `bcrypt` (no usado) y `bcryptjs` (el que realmente usa `auth.service.js:1`).
- **Acción sugerida:** consolidar todas las dependencias en un solo `package.json` (el del backend), fijar una sola major de Express (decidir 4 ó 5 deliberadamente — hoy corre 5 sin que el proyecto lo haya decidido), eliminar `bcrypt` o `bcryptjs` y `express-session` (sin un solo require en el código).

### C3. Cancelación de trabajo sin salvaguardas (pérdida de dinero / trabajador plantado)
- **Archivo:** `backend/repositories/jobs.repository.js:121-127` (`cancelJob`), `backend/services/jobs.service.js:59-64`
- **Descripción:** El dueño puede cancelar un trabajo en **cualquier estado** salvo `cancelado`/`completado` — incluso `en_negociacion` (con pago ya aprobado y retenido), `trabajador_llego` o `pendiente_confirmacion` (trabajo ya hecho). No hay: reembolso/anulación del pago en MercadoPago, notificación al trabajador asignado, ni liberación de `reservas_tentativas` confirmadas (el slot del trabajador queda bloqueado).
- **Acción sugerida:** restringir estados cancelables (solo `publicado` libremente), exigir flujo de disputa/reembolso si hay pago aprobado, notificar al trabajador y liberar reservas en la misma transacción.

### C4. El "dinero retenido en plataforma" no existe como tal: liberación de pago ficticia y trabajo sin pago verificado
- **Archivos:** `backend/services/jobs.service.js:186-199` (`confirmarCompletado`), `backend/services/offers.service.js:88-104` (`aceptarOferta`), `backend/services/jobs.service.js:68-133` (`iniciarTrabajo`)
- **Descripción:** El flujo documentado dice "al aceptar paga (dinero retenido) → al confirmar se libera el pago al trabajador". En el código:
  1. `aceptarOferta` acepta la oferta y pasa el trabajo a `en_negociacion` **aunque la creación de la preferencia de pago falle** (solo loguea y notifica "pago pendiente").
  2. `iniciarTrabajo` y `marcarCompletado` **no verifican** que exista un pago aprobado — el trabajo puede ejecutarse completo sin que el dueño haya pagado.
  3. La "liberación" en `confirmarCompletado` es `updatePagoAprobado` o, si no hay pago, **`insertPago` que crea un registro aprobado que nunca pasó por MercadoPago** (jobs.repository). No hay payout real (transferencia / marketplace split / money release de MP) hacia el trabajador.
- **Acción sugerida:** gate de estado: no permitir `iniciarTrabajo` sin pago `aprobado`; eliminar el `insertPago` fantasma; definir e implementar el mecanismo real de payout (MP split payments o registro de saldo + retiro manual documentado).

---

## 🟠 IMPORTANTE

### I1. `.env.example` documenta variables de Redis que el código nunca lee → Redis se desactiva silenciosamente
- **Archivos:** `.env.example:24-26` y `.env.production.example:30-33` (definen `REDIS_HOST/PORT/PASSWORD`) vs `backend/config/cache.js:52`, `backend/config/queue.js:12`, `backend/config/socketAdapter.js:12` (todos leen **solo `REDIS_URL`**)
- **Descripción:** Quien configure el entorno siguiendo los examples obtiene: caché en memoria, rate limiting global por proceso (incorrecto con PM2 cluster), sin adapter de Socket.io y colas Bull en fallback síncrono — todo sin un solo error visible.
- **Acción:** unificar a `REDIS_URL` en los examples (o soportar ambas formas en el código).

### I2. Formato de respuesta API NO unificado (contradice CLAUDE.md)
- **Archivos:** 22 de 25 controllers no importan `successResponse` (`backend/utils/apiResponse.js`); ~400 `res.json`/`res.status` directos con formas mezcladas: `{ error }`, `{ success, ... }`, arrays crudos, objetos crudos (ej.: `pagos.controller.js` devuelve `res.json(data)` sin `success`; `disputas.controller.js` mezcla `{ success: true, disputa }` con `{ error }`).
- **Impacto real en frontend:** `mis-trabajos.js:435` tiene que adivinar la forma: `data.init_point || (data.data && data.data.init_point)`.
- **Acción:** migrar controllers a `successResponse`/`AppError` módulo por módulo, empezando por los que consume el frontend de pagos/ofertas.

### I3. 71 `throw new Error(...)` de negocio en 11 services → 500 opacos en producción
- **Archivos:** `pagos`, `ayudantes`, `catalogo`, `confianza`, `contactos`, `denuncias`, `features`, `geolocalizacion`, `portfolio`, `seguridad`, `tienda` (`.service.js`). Solo `auth`, `jobs` y `offers` usan `AppError`.
- **Descripción:** Cuando estos errores llegan al `errorHandler` global se responden como `500 "Error interno del servidor"` (mensaje de negocio oculto en producción) y se guardan en `error_logs` contaminando la tabla. Varios controllers los rescatan con `catch (err) res.status(400).json({error: err.message})` y otros no — comportamiento distinto por módulo para el mismo tipo de error.
- **Acción:** convertir a `AppError` con statusCode correcto.

### I4. express-validator solo en 5 de ~30 routes
- **Archivos con validación:** `auth.routes.js`, `chat.routes.js`, `jobs.routes.js`, `offers.routes.js`, `reportes.routes.js`. **Sin validación declarativa:** pagos, disputas, disponibilidad, ayudantes, calificaciones, catálogo, confianza, admin, verificación, etc.
- **Descripción:** la validación es manual y desigual (`if (!trabajo_id || !motivo)`) o inexistente; `parseInt(req.params.id)` sin chequear `NaN` en múltiples controllers.
- **Acción:** agregar cadenas de validación al menos en endpoints de escritura de pagos, disputas, disponibilidad y admin.

### I5. OSRM hardcodeado al servidor demo público
- **Archivo:** `backend/services/scheduling.service.js:54` — `https://router.project-osrm.org/...`
- **Descripción:** El demo público de OSRM tiene rate limiting agresivo y sin SLA (prohibido para uso productivo). `OSRM_URL` está documentada en `.env.example` pero **no se usa en ningún archivo**. Cada cálculo de slot puede hacer varias llamadas; con tráfico real se degradará al fallback de 30 min fijos sin aviso.
- **Acción:** leer `process.env.OSRM_URL` con el demo como default solo en development.

### I6. `MP_ACCESS_TOKEN` / `MP_PUBLIC_KEY` documentados en `.env.example` pero el código los lee de la DB
- **Archivos:** `.env.example` vs `backend/services/pagos.service.js:38` (`getConfig('mp_access_token')` → tabla de configuración de plataforma). Único uso de la env var: `backend/scripts/setup.js:29` (la pide pero el runtime no la lee).
- **Descripción:** doble fuente de verdad confusa: configurar el `.env` no habilita MercadoPago; hay que cargar el token vía panel admin/tabla. Nada lo documenta.
- **Acción:** elegir una fuente (sugerido: DB con seed inicial desde env en `setup.js`) y documentarlo en `.env.example` y CLAUDE.md.

### I7. Disputas sin efecto económico ni bloqueo del flujo
- **Archivo:** `backend/services/disputas.service.js:104-131`
- **Descripción:** `resolverDisputa` solo guarda un texto y notifica. Una disputa abierta **no congela** el pago: el dueño puede `confirmarCompletado` y "liberar" el pago con la disputa en curso; no hay rama de reembolso/retención según resolución. Además el service usa `throw { status, error }` (objetos planos) en vez de `AppError` — CLAUDE.md afirma lo contrario.
- **Acción:** bloquear `confirmarCompletado`/liberación si hay disputa activa; agregar acción económica (reembolso parcial/total) a la resolución.

### I8. Bug de timezone en el detector de conflictos del scheduling
- **Archivo:** `backend/services/scheduling.service.js:199,205,315`
- **Descripción:** se comparan días usando `toISOString().substring(0,10)` (UTC). Un trabajo confirmado a las 21:00+ hora argentina (UTC-3) cae en el día UTC siguiente → el conflicto se evalúa contra el día equivocado y `cuando` puede mostrar la fecha corrida.
- **Acción:** normalizar a la zona horaria del negocio (`America/Argentina/Buenos_Aires`) para construir y comparar fechas.

### I9. `navbar.js` solo se carga en `feed.html`
- **Archivos:** `frontend/public/js/modules/navbar.js` referenciado únicamente en `frontend/views/pages/feed.html`; el resto de las páginas (mensajes, mis-ofertas, notificaciones, agenda, etc.) tienen el markup del navbar pero sin su lógica → panel de notificaciones del navbar muerto fuera del feed (los badges los actualiza `main.js`, pero el dropdown/panel no funciona).
- **Acción:** incluir `<script src="/js/modules/navbar.js">` en todas las páginas con navbar (CLAUDE.md ya lo anotaba como extracción reciente solo registrada en feed).

### I10. Doble carga de Socket.io en `mis-ofertas-laborales.html`
- **Archivo:** `frontend/views/pages/mis-ofertas-laborales.html` — carga `/socket.io/socket.io.js` **y** `https://cdn.socket.io/4.8.3/socket.io.min.js`.
- **Descripción:** la segunda sobrescribe el global `io`; versiones potencialmente distintas entre server local y CDN. La auditoría 2026-06-08 agregó el CDN pero no quitó el script local.
- **Acción:** dejar una sola fuente (sugerido: `/socket.io/socket.io.js` que siempre matchea la versión del server).

### I11. Botones de navegación muertos en el sidebar derecho
- **Archivos:** `frontend/views/components/sidebar-right.html:31,34` (`data-page="planner-3d"`, `data-page="videos"`) vs `frontend/public/js/main.js:74-89` (`pageMap` no contiene ninguna de las dos claves).
- **Descripción:** `navigateTo()` no encuentra la URL y retorna sin hacer nada — el usuario clickea y no pasa nada (sin feedback).
- **Acción:** mapear a las páginas reales (`/pages/planner-3d.html` existe) o quitar/deshabilitar los botones con tooltip "Próximamente".

### I12. Tests con aserciones débiles (falsos positivos) y dependencia de red externa
- **Archivos:**
  - `backend/tests/auth.test.js:245`, `offers.test.js:78,248`: `expect(res.status).toBeGreaterThanOrEqual(400)` — un 500 por bug pasa como si fuera la validación esperada.
  - `backend/tests/reportes.test.js:91`: `expect([201, 409]).toContain(res.status)` — no distingue creación de duplicado.
  - `backend/tests/scheduling.test.js`: ejercita `calcularProximoSlot` real → llama al **OSRM público por red** en cada corrida (lento/flaky en CI); si OSRM falla, el fallback de 30 min hace pasar el test sin verificar el cálculo de viaje.
- **Acción:** afirmar status exactos; mockear `obtenerTiempoViaje` en tests.

### I13. Módulos enteros sin cobertura de tests
- **Sin ningún test:** pagos (incl. webhook MP + firma HMAC + dedup `webhook_events`), disputas (solo evidencia vía `uploads.test.js`), calificaciones, disponibilidad/reservas, notificaciones, ayudantes, confianza, catálogo, búsqueda avanzada, tienda, equipate, denuncias, estadísticas.
- **Riesgo mayor:** el webhook de pagos es el camino del dinero y no tiene un solo test.
- **Acción:** priorizar tests de `procesarWebhook` (aprobado/rechazado/duplicado/firma inválida) y del flujo de disputas.

### I14. `cancelarOferta` no libera reservas tentativas
- **Archivo:** `backend/services/offers.service.js:143-146`
- **Descripción:** borra la oferta sin llamar `liberarReservasPorOferta(id)` (sí se llama al rechazar) → reservas `tentativa` huérfanas apuntando a una oferta inexistente, que pueden seguir bloqueando slots según cómo se consulten.
- **Acción:** liberar reservas antes/después del delete, en la misma operación.

### I15. Pool de PostgreSQL ignora la configuración documentada
- **Archivo:** `backend/config/db.js:5-15` — `max: 50, min: 5` hardcodeados; no lee `DB_POOL_MAX`, `DB_POOL_MIN` ni `DB_SSL` (las tres documentadas en `.env.example`).
- **Descripción:** contra una DB gestionada que exige SSL (típico en producción) la conexión falla sin opción de activarlo por env.
- **Acción:** respetar las env vars con los valores actuales como default; agregar soporte `ssl`.

### I16. Inventario de variables de entorno desincronizado
- **Usadas en código pero ausentes de `.env.example`:** `REDIS_URL`, `DB_BACKUP_PATH`, `PGPASSWORD_BACKUP`, `PSQL_PATH`.
- **Documentadas pero que ningún código lee:** `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `OSRM_URL`, `ADMIN_SECRET_KEY`, `DB_SSL`, `DB_POOL_MAX`, `DB_POOL_MIN`, `SMTP_SECURE`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`.
- **Acción:** alinear `.env.example`, `.env.production.example` y `setup.js` con lo que el código realmente consume.

### I17. Transacciones de DB abiertas durante llamadas de red a MercadoPago
- **Archivos:** `backend/services/pagos.service.js:62-131` (`crearPreferenciaTrabajo`: `BEGIN` → `preference.create` con 3 reintentos y backoff 1s/2s/4s → `COMMIT`), `:194-229` (`procesarWebhook`: `Payment.get` dentro de la transacción), `:340-404` (`pagarDirectoTrabajo`).
- **Descripción:** con latencia o reintentos, cada pago retiene una conexión del pool varios segundos; bajo carga se agota el pool (50) y se cae todo el API.
- **Acción:** crear el registro `pendiente` y commitear antes de llamar a MP; actualizar en una segunda transacción corta (patrón outbox).

---

## 🟡 MENOR

### M1. Branding "RType1" residual
- `frontend/public/js/modules/agenda.js:6` — clave de localStorage `rtype1_agenda_eventos`; `agenda-modal.js` y `marketplace.js` también mencionan RType1; `backend/scripts/setup.js:123` default DB `rtype1`. Cambiar la clave de storage requiere migrar los eventos guardados.

### M2. JS huérfano / código muerto (no referenciado por ningún HTML)
- `frontend/public/js/router.js` (SPA incompleto), `modules/planner3d.js`, `modules/agenda-modal.js`, `modules/marketplace.js` (no existe `marketplace.html`), `modal-handler.js`, `ui-components.js`, `components/video-card.js`. Confunden el mantenimiento; decidir si se borran o se conectan.

### M3. CSS stubs referenciados y sin contenido
- `cards.css` (3 líneas, lo cargan 4 páginas), `forms.css` (2 líneas, 1 página) — links que no aportan estilos. Otros stubs sin ninguna referencia: `animations.css`, `buttons.css`, `calendar.css`, `layout.css`, `responsive.css`. La ausencia de `responsive.css` real implica que el responsive depende de cada CSS de página (inconsistente entre páginas).

### M4. Inline `<style>` y `<script>` violando las convenciones del proyecto
- `<style>` inline en: `index.html`, `perfil-publico.html`, `publicar-trabajo.html`, `reset-password.html`, `terminos-y-condiciones.html`.
- `<script>` inline en: `feed.html` (incluye la inicialización del mapa Leaflet ~línea 495) y `reset-password.html` (todo el flujo de reset, funcional pero fuera de `/js/modules/`).

### M5. Eventos de agenda solo en localStorage
- `frontend/public/js/modules/agenda.js:40-51` — los eventos manuales viven en el dispositivo: no sincronizan entre dispositivos y se pierden al limpiar el navegador; se mezclan con los trabajos confirmados que sí vienen del API. Decisión de producto a revisar.

### M6. `pago-exitoso` con `payment_id=undefined`
- `backend/controllers/pagos.controller.js` (`callback`): si MP no manda `payment_id`, `new URLSearchParams({ payment_id })` genera literalmente `payment_id=undefined` en la URL de redirección.

### M7. Sin handler 404 JSON para rutas API desconocidas
- `backend/server.js` — un `GET /api/v1/inexistente` cae al static y devuelve el 404 HTML de Express en vez de `{ success:false, error:"No encontrado" }`. Agregar catch-all después de `v1Router`.

### M8. Falta `helmet` (headers de seguridad)
- `backend/server.js` no setea CSP/X-Frame-Options/etc. Bajo costo, buena práctica pre-deploy.

### M9. SQL crudo en archivos de rutas (bypass de capas)
- `backend/routes/notifications.routes.js` y `backend/routes/messages.routes.js` consultan `pool` directamente desde la ruta, salteando service/repository — única excepción a la arquitectura del resto del proyecto.

### M10. Consulta duplicada de perfil al crear oferta
- `backend/services/offers.service.js:21` y `:30` — `findPerfilTrabajador` se llama dos veces en el mismo flujo.

### M11. BOM UTF-8 en ~45 archivos
- 34 archivos del backend (controllers/routes/services) y 15 módulos del frontend empiezan con BOM (`EF BB BF`). No rompe Node, pero genera diffs ruidosos y ya provocó el artefacto `﻿const` visible al inicio de `pagos.controller.js`.

### M12. `crearPreferenciaVideo` sin transacción
- `backend/services/pagos.service.js:148-182` — si `preference.create` falla, queda un registro de pago huérfano en estado pendiente sin preference_id.

### M13. Ventana de confirmación de llegada ±3 min sin escape
- `backend/services/jobs.service.js:96-103` — si el trabajador llega 5 minutos tarde no puede confirmar nunca (no hay reintento ni override del dueño); y si `fecha_inicio` es null (agendamiento fallido) no hay ventana en absoluto. Revisar como decisión de producto.

### M14. Documentación desactualizada (CLAUDE.md / MEMORY)
- Afirmaciones de CLAUDE.md contradichas por el código: "Formato de respuesta API unificado" (ver I2), "Manejo de errores estandarizado en todos los controllers" (I3), "Validación de inputs con express-validator" (I4, solo 5 routes), "disputas.controller con AppError/apiResponse" (usa objetos planos y res.json directo), "Tests: 127/127 (script corregido Jest 30)" (cierto solo para el script de la **raíz**; `backend/package.json` mantiene Jest 29 y otro script). MEMORY.md referencia páginas que ya no existen (marketplace.html, videos-educativos.html, etc.).

---

## 📊 Resumen ejecutivo

| Severidad | Cantidad | Temas dominantes |
|---|---|---|
| 🔴 CRÍTICO | 4 | Double-booking de agenda (C1), dependencias Express 4/5 divididas (C2), cancelación sin refund/notificación (C3), retención/liberación de pago ficticia (C4) |
| 🟠 IMPORTANTE | 17 | Config de entorno desincronizada (I1, I6, I15, I16), inconsistencia de API/errores/validación (I2, I3, I4), flujos incompletos de dinero y disputas (I7, I17), scheduling (I5, I8, I14), frontend roto puntual (I9, I10, I11), calidad de tests (I12, I13) |
| 🟡 MENOR | 14 | Código muerto y branding residual (M1, M2), convenciones CSS/JS (M3, M4, M11), endurecimiento (M7, M8), docs desactualizadas (M14) |
| **Total** | **35** | |

### Lectura general
1. **El camino del dinero es el área más débil**: entre C3, C4, I7 e I17, el flujo pago→retención→liberación→disputa que el producto promete no está cerrado de punta a punta. Es lo primero a resolver antes de producción.
2. **El agendamiento automático tiene el bug más urgente** (C1 + I8): el sistema asigna horarios que él mismo no puede ver después.
3. **La configuración miente**: `.env.example` y el código divergen en Redis, MP, OSRM y pool de DB (I1, I5, I6, I15, I16) — un deploy "siguiendo la documentación" arranca degradado en silencio.
4. **La estandarización declarada en CLAUDE.md (respuestas, errores, validación) está aplicada en ~20% del backend** — funciona, pero cada módulo se comporta distinto ante el mismo error.
5. Los **127 tests pasan pero protegen poco** los módulos de mayor riesgo (pagos/webhook: 0 tests) y varias aserciones aceptan errores 500 como éxito.

### Orden de corrección sugerido
1. C1 (double-booking) + I14 + I8 — paquete "scheduling".
2. C4 + C3 + I7 + I17 — paquete "dinero" (requiere decisión de producto sobre payout).
3. C2 + I1 + I15 + I16 + I6 + I5 — paquete "config/deploy" (rápido y de alto impacto para producción).
4. I9, I10, I11 — fixes de frontend puntuales (minutos cada uno).
5. I2/I3/I4 — estandarización progresiva, módulo por módulo, con I12/I13 (tests) acompañando.

---

## C2 — RESUELTO (2026-06-10)

Consolidación de dependencias en un solo `package.json` (el del backend, donde apuntan `ci.yml` y `deploy.yml`). Cambios realizados:

1. **`backend/package.json`** ahora es el único dueño de dependencias:
   - Agregadas las 4 huérfanas que vivían solo en la raíz: `express-validator ^7.3.1`, `express-rate-limit ^8.3.1`, `bull ^4.16.5`, `node-cron ^4.2.1`.
   - Eliminado `bcrypt` (0 requires — el código usa `bcryptjs`). `express-session` (0 requires) no se agregó.
   - `jest` unificado en `^30.3.0` (antes raíz ^30 / backend ^29 divergían).
   - Express fijado deliberadamente en **5** (`^5.2.1`) — es la versión que el server resolvía en runtime y contra la que pasan los tests. Eliminada la declaración `^4.22.1` de la raíz.
   - `@aws-sdk/client-s3` queda en una sola declaración (`^3.1059.0`).
2. **`package.json` (raíz)** convertido a scripts-only (sin dependencias): `test`/`migrate`/`migrate:status`/`setup` delegan a backend vía `npm --prefix backend`; se mantienen `start` y los scripts de PM2. De paso se arregló el script `migrate` roto (apuntaba a un `migrate.js` inexistente en la raíz; el runner real es `backend/scripts/migrate.js`).
3. **Eliminados** el directorio de paquetes instalados y el `package-lock.json` de la raíz — ya nada resuelve "por accidente" subiendo el árbol; `backend/package-lock.json` es el único lockfile (consistente con el `cache-dependency-path` de `ci.yml`).
4. **Verificación:** install limpio en `backend/` + resolución confirmada de las 4 dependencias huérfanas desde el árbol de backend (con la raíz ya borrada) + `npm test` → **127/127 tests en verde** con Jest 30. Delegación raíz→backend probada con `npm run migrate:status`.

Sin cambios en archivos de lógica de negocio. Un `npm ci` limpio dentro de `backend/` (escenario de `deploy.yml`) ya no rompe el server.

> Nota observada durante la verificación (preexistente, no introducida por este fix): la tabla `migration_history` de la DB local está vacía — las 31 migraciones figuran "pendientes" en `migrate:status` porque se aplicaron manualmente por psql antes de existir el runner.

---

## C1 — RESUELTO (2026-06-10)

Double-booking en el agendamiento automático. El bug tenía dos partes conectadas y se corrigieron de forma consistente:

1. **El worker ahora persiste la reserva confirmada.** Nueva función `asignarSlotATrabajo(trabajadorId, trabajoId, slot)` en `scheduling.service.js`: en **una transacción** actualiza `trabajos.fecha_inicio` e inserta (o actualiza, idempotente) la fila `estado='confirmada'` en `reservas_tentativas` para la oferta aceptada. La reserva bloquea la **franja real** del trabajo (`hora_inicio` efectiva → inicio + duración de la oferta, nuevo campo `hora_fin_ocupada` del slot), no toda la ventana de disponibilidad — así un segundo trabajo el mismo día sigue siendo posible si caben los viajes.

2. **El detector de conflictos ya no descarta trabajos sin reserva.** La query de confirmados trae además `o.tiempo_estimado`; si un trabajo no tiene `rt_inicio/rt_fin` (auto-agendados previos a este fix, o agendados manualmente vía `PATCH /api/jobs/:id/agendar`), la franja ocupada se **deriva de `fecha_inicio` + duración de la oferta** (fallback 60 min). También se agregó `pendiente_confirmacion` a los estados considerados (consistente con `getOcupadosTrabajador`) y se excluye el propio `trabajoId` (evita auto-conflicto en re-agendamientos).

3. **Agravante (carrera entre dos aceptaciones en paralelo):** nueva función `agendarTrabajo(trabajadorId, trabajoId)` que serializa calcular+persistir por trabajador con un advisory lock de PostgreSQL (`pg_advisory_lock(47001, trabajadorId)`). `osrmWorker.js` ahora usa este camino único tanto en la cola Bull como en el fallback síncrono (lógica unificada en `_agendarYNotificar`, antes duplicada).

- **Archivos:** `backend/services/scheduling.service.js` (nuevas `asignarSlotATrabajo` + `agendarTrabajo`, query de confirmados, `_armarResultado`), `backend/workers/osrmWorker.js` (reescrito sobre `agendarTrabajo`).
- **Tests nuevos** en `backend/tests/scheduling.test.js` (describe "C1 + timezone"): (a) al auto-agendar existe la reserva `confirmada` y su `hora_inicio` coincide con `fecha_inicio` en hora argentina, bloqueando solo la duración real; (b) un segundo trabajo del mismo trabajador en una franja nocturna donde solo entra uno cae en **otro día** (con el bug viejo se agendaba encima). El log del detector confirma: `hayConflicto: true, confirmedHoyCount: 1`.
- Sin migración SQL: `reservas_tentativas` ya tenía todas las columnas necesarias.
- **Verificación:** `npm test` → **129/129 tests en verde** (127 existentes + 2 nuevos, 11 suites).

### I14 — verificado: NO APLICA (falso positivo de la auditoría)
`deleteOferta` hace `DELETE` físico de la oferta y las tres FKs de `reservas_tentativas` son `ON DELETE CASCADE` (verificado en la DB local: `confdeltype = 'c'`): al cancelar una oferta sus reservas se **eliminan en cascada**, no quedan huérfanas. Agregar `liberarReservasPorOferta` en `cancelarOferta` sería redundante (y llamarla antes del DELETE sería incorrecto: si el DELETE falla porque la oferta ya no está `pendiente`, liberaría reservas de una oferta viva). Sin cambios de código.

---

## TIMEZONE — RESUELTO (2026-06-10)

Cubre **I8**. Todas las comparaciones de calendario del sistema de scheduling usan ahora la zona horaria del negocio (`America/Argentina/Buenos_Aires`) vía **`date-fns-tz`** (agregada como dependencia junto con su peer `date-fns` en `backend/package.json`). Antes se usaba `toISOString().substring(0,10)` (UTC): un trabajo a las 21:00+ ART caía en el día UTC siguiente → conflictos evaluados contra el día equivocado y fecha corrida en `cuando`.

Cambios en `backend/services/scheduling.service.js` (constante `TZ`):
- **Iteración de días candidatos:** el "hoy" y los 60 días siguientes se construyen sobre el calendario ART (`formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd')` + ancla a mediodía UTC para sumar días sin saltos), y `dia_semana` sale de ese calendario — ya no depende de la timezone del server.
- **Comparación de días de trabajos confirmados:** `formatInTimeZone(tc.fecha_inicio, TZ, 'yyyy-MM-dd') === fechaStr` (antes UTC vs UTC del server).
- **Franja derivada de `fecha_inicio`:** la hora del día se extrae con `formatInTimeZone(..., 'HH:mm')` en ART.
- **`_armarResultado`:** `fecha_inicio` se construye como instante real con `fromZonedTime('fecha hora', TZ)` (la hora del slot interpretada como hora argentina, independiente de la timezone del server) y `cuando` se formatea desde la fecha de calendario ART. El formato visible (`DD/MM/YYYY de HH:MM a HH:MM`) no cambió.

El test (b) de la sección C1 ejercita exactamente el caso límite: trabajos a las 21:45 ART (= 00:45 UTC del día siguiente) se comparan en el día argentino correcto.

---

## C4 — RESUELTO (2026-06-10)

El flujo retención→liberación→payout ahora existe de verdad. Decisión de producto tomada: **payout por saldo + retiro manual** (MP split payments queda descartado para el MVP — requiere onboarding OAuth de cada trabajador como vendedor de MP).

1. **Gate de pago en `iniciarTrabajo`** (`jobs.service.js`): confirmar llegada exige un pago `tipo='trabajo'`, `estado='aprobado'` para el trabajo (nueva `findPagoAprobadoPorTrabajo` en `jobs.repository.js`) → si no hay, **402** con mensaje claro. La aprobación viene solo de MercadoPago (webhook, pago directo o `POST /api/pagos/dev/aprobar/:trabajo_id` en development). Como `marcarCompletado` y `confirmarCompletado` exigen estados posteriores a `trabajador_llego`, un solo gate cubre todo el flujo.
2. **Retención real**: `insertDistribucion` (`pagos.repository.js`) ahora inserta las distribuciones con `estado='pendiente'` (antes nacían `'procesado'` en el momento de aprobarse el pago — la "retención" no existía).
3. **Liberación real**: eliminadas `updatePagoAprobado` e `insertPago` de `jobs.repository.js` (falsificaban un pago aprobado que nunca pasó por MP, y encima pisaban `monto_trabajador` con el monto bruto sin descontar comisión). `confirmarCompletado` ahora llama `liberarDistribucionesPorTrabajo(id, client)` **dentro de la misma transacción** que `setCompletado`: las distribuciones del pago aprobado pasan a `'procesado'` + `procesado_en=NOW()`. Si no había nada para liberar se loguea `warn`.
4. **Payout — saldo + retiro manual**:
   - Migración `database/migrations/retiros.sql` (tabla `retiros`: monto, estado `solicitado|pagado|rechazado`, `datos_cobro` CBU/CVU/alias, `nota_admin`). Aplicada en `rtype1` y `rtype1_test`.
   - Saldo (`findSaldoUsuario`): `retenido` (distribuciones pendientes), `liberado` (procesadas), `en_retiro` (retiros solicitados), `retirado` (pagados), `disponible = liberado − en_retiro − retirado`.
   - Endpoints trabajador: `GET /api/pagos/saldo`, `GET/POST /api/pagos/retiros`. La solicitud valida saldo bajo `pg_advisory_xact_lock(47002, usuarioId)` (dos requests simultáneos no pueden retirar el doble del disponible).
   - Endpoints admin: `GET /api/admin/retiros`, `PATCH /api/admin/retiros/:id/resolver` (`pagado` tras transferir manualmente, o `rechazado` con motivo — el monto rechazado vuelve solo al disponible). El UPDATE exige `estado='solicitado'` (sin doble resolución).
   - UI: página nueva `mis-pagos.html` (+ `mis-pagos.css`, `mis-pagos.js`) con tarjetas de saldo, form de retiro y historial — link "Mis Pagos" en sidebar (rol trabajador) y en `main.js` pageMap; tab "Retiros" en `admin.html`/`admin.js`.
5. **Fix lateral en `backend/scripts/migrate.js`**: strip de BOM UTF-8 al leer los `.sql` (`indices_escalabilidad.sql` tenía BOM y rompía el runner, bloqueando todas las migraciones alfabéticamente posteriores). Tras el fix, las 32 migraciones quedaron registradas en `migration_history` de ambas DBs (resuelve la nota de C2 sobre la tabla vacía).
- **Tests** (`npm test` → **135/135**, 6 nuevos): helper `aprobarPagoTrabajo` en `tests/helpers.js` (simula lo que hace el webhook: pago aprobado + distribución pendiente); `flujo-completo.test.js` ahora cubre gate 402 sin pago, retención pendiente al pagar, liberación a `procesado` al confirmar, saldo disponible correcto (8500 − 10% = 7650), retiro mayor al disponible → 400, retiro válido → 201 con saldo actualizado; `geolocalizacion.test.js` siembra pagos aprobados antes de confirmar llegada.
- **Pendiente relacionado:** ~~C3 (cancelación sin refund)~~ resuelto el 2026-06-10 (ver abajo); ~~I7 (disputa no congela el pago)~~ resuelto el 2026-06-11 (ver abajo); ~~I17 (transacciones abiertas durante llamadas a MP)~~ resuelto el 2026-06-11 (ver abajo) — el paquete "dinero" queda cerrado.

---

## C3 — RESUELTO (2026-06-10)

Cancelación con salvaguardas por estado y rol. Con la retención real de C4 activa, cancelar un trabajo pagado dejaba distribuciones `'pendiente'` sin camino de vuelta al dueño (plata atrapada). Reglas implementadas en `cancelarTrabajo` (`jobs.service.js`):

| Estado del trabajo | Dueño | Trabajador asignado | Admin | Efecto económico |
|---|---|---|---|---|
| `publicado` / `en_negociacion` sin pago | ✅ libre | ✅ | ✅ | ninguno |
| `en_negociacion` con pago aprobado (no iniciado) | ✅ | ✅ | ✅ | **reembolso automático** |
| `trabajador_llego` / `en_curso` (iniciado) | ❌ 403 | ✅ | ✅ | sin reembolso automático — el dinero queda retenido y el reembolso parcial lo decide el admin vía disputa |
| `pendiente_confirmacion` / `completado` | ❌ 403 | ❌ 403 | ✅ (vía disputa) | sin movimiento automático |
| `cancelado` | 404 (idempotencia: ya cancelado) | 404 | 404 | — |

Detalle de implementación:

1. **Todo en una transacción** (`BEGIN` … `COMMIT` con `SELECT … FOR UPDATE` sobre el trabajo, mismo patrón que `iniciarTrabajo`/`confirmarCompletado`): validación de estado y rol → `setCancelado` → reembolso (si corresponde) → liberación de reservas. Usuarios sin relación con el trabajo (ni dueño, ni trabajador asignado, ni admin) reciben 404 — no se filtra la existencia del trabajo.
2. **Reembolso automático** (`reembolsarPagoPorTrabajo` en `jobs.repository.js`): las distribuciones `'pendiente'` del pago aprobado vuelven a `NULL` (dejan de contar como retenido en `findSaldoUsuario`, que filtra por `'pendiente'`/`'procesado'`) y el pago `'aprobado'` pasa a `'reembolsado'` — queda como evento de reembolso registrado en `pagos`. Migración `database/migrations/pagos_reembolsado.sql` agrega `'reembolsado'` al CHECK de `pagos.estado` (idempotente, aplicada en `rtype1` y `rtype1_test`).
3. **Liberación de reservas** (`liberarReservasPorTrabajo`): los slots `'tentativa'` **y `'confirmada'`** de todas las ofertas del trabajo pasan a `'liberada'` en la misma transacción (antes el slot del trabajador quedaba bloqueado para siempre — era parte del hallazgo original).
4. **Notificación** (`notificarTrabajoCancelado`, tipo `trabajo_cancelado`): si el trabajo tenía trabajador asignado se notifica a la contraparte del que canceló (al trabajador si canceló el dueño/admin, al dueño si canceló el trabajador), con mención explícita del reembolso cuando lo hubo.
5. **Nota sobre MercadoPago:** el reembolso es contable (el dinero nunca salió de la cuenta de la plataforma — modelo payout por saldo de C4). La devolución real vía API de refunds de MP queda como mejora cuando haya credenciales de producción.
- **Tests** (`backend/tests/jobs.test.js`, describe `C3`): cancelación libre sin pago + notificación, cancelación con reembolso (pago `'reembolsado'`, distribución `NULL`, saldo retenido en 0, notificación con mención de reembolso), dueño bloqueado en `trabajador_llego` (403, pago sigue `'aprobado'`), trabajador cancela en progreso (200 sin reembolso automático, distribución sigue `'pendiente'`), bloqueo total en `completado` (403 para ambos). Los 3 tests preexistentes de cancelación siguen pasando sin cambios.

---

## I7 — RESUELTO (2026-06-11)

Una disputa activa ahora **congela la liberación del pago** y la resolución del admin decide el destino del dinero retenido. Cierra el hueco que dejaba C4: el dueño podía `confirmarCompletado` con una disputa en curso y el dinero llegaba al saldo del trabajador en pleno conflicto.

1. **Gate en `confirmarCompletado`** (`jobs.service.js`): dentro de la transacción existente (después del `FOR UPDATE` sobre el trabajo y el chequeo de estado) se consulta `findDisputaActivaPorTrabajo` (nueva en `jobs.repository.js`) — si hay una disputa `'abierta'` o `'en_revision'` para el trabajo → **403** con mensaje "Hay una disputa activa. El pago se liberará cuando el admin la resuelva.". La consulta usa `FOR UPDATE` sobre la fila de la disputa para serializar contra una resolución concurrente del admin.
2. **`resolverDisputa` con efecto económico** (`disputas.service.js`): reescrita en transacción. El admin ahora debe indicar `resultado` (obligatorio, **400** si falta):
   - `'trabajador'` → libera las distribuciones `'pendiente'` → `'procesado'` (reutiliza `liberarDistribucionesPorTrabajo`, mismo efecto que `confirmarCompletado`).
   - `'dueno'` → reembolso contable (nueva `reembolsarPagoPorDisputa` en `jobs.repository.js`): distribuciones → `NULL` y pago `'aprobado'` → `'reembolsado'`, igual que C3, **pero también revierte distribuciones ya `'procesado'`** — una disputa puede abrirse sobre un trabajo `'completado'` cuyo dinero ya se liberó, y sin esa reversión el trabajador cobraría además del reembolso al dueño (si ya retiró, el saldo absorbe el ajuste y puede quedar en deuda visible para el admin).
   - El `UPDATE` de la disputa a `'resuelta'` + el efecto económico ocurren en la misma transacción. **Orden de locks idéntico a `confirmarCompletado` (trabajos → disputas)** para evitar deadlocks: primero se lee `trabajo_id` sin lock, se bloquea el trabajo con `FOR UPDATE`, recién después la disputa (re-chequeando que siga activa).
3. **Migración `database/migrations/disputas_resultado.sql`**: columna `disputas.resultado VARCHAR(20) CHECK IN ('dueno','trabajador')` (NULL = sin resolver o resuelta antes de esta migración). Aplicada en `rtype1` y `rtype1_test`.
4. **Admin**: `resolverDisputaAdmin` (`admin.controller.js`) pasa `resultado` del body; el modal de `admin.html`/`admin.js` agrega un select obligatorio ("A favor del trabajador — liberar el pago retenido" / "A favor del dueño — reembolsar el pago").
5. **Pendiente — resolución parcial por porcentaje** (ej. 70% al trabajador, 30% reembolso): no implementada. Requiere partir la distribución en dos (una `'procesado'` y otra anulada) y registrar el pago como parcialmente reembolsado — el CHECK actual de `pagos.estado` no modela estados parciales. Mientras tanto el admin resuelve todo-o-nada y puede compensar diferencias menores vía nota en la resolución + ajuste manual del retiro.
- **Tests** (`backend/tests/jobs.test.js`, describe `I7` — `npm test` → **144/144**, 4 nuevos): confirmar con disputa activa → 403 con el trabajo aún `pendiente_confirmacion` y la distribución `'pendiente'`; resolver sin `resultado` → 400; resolución a favor del dueño → pago `'reembolsado'`, distribución `NULL` y el saldo retenido del trabajador baja exactamente el neto (delta antes/después); resolución a favor del trabajador → distribución `'procesado'` con pago `'aprobado'`, y el `confirmarCompletado` posterior funciona sin re-liberar nada.

---

## I17 — RESUELTO (2026-06-11)

Patrón outbox en los tres flujos de pago: **ninguna transacción de PostgreSQL queda abierta durante las llamadas de red a MercadoPago**. Antes, `crearPreferenciaTrabajo`, `procesarWebhook` y `pagarDirectoTrabajo` abrían `BEGIN`, llamaban a MP (con retry exponencial de hasta ~7s) y recién después commiteaban — bajo carga, cada pago retenía una conexión del pool (50) durante segundos y el API entero se caía.

1. **`crearPreferenciaTrabajo` y `pagarDirectoTrabajo`** (`pagos.service.js`): divididos en dos transacciones cortas.
   - Tx 1: validaciones + `insertPago` con `estado='iniciando'` → commit inmediato (statements sueltos sobre el pool, sin client retenido). Las credenciales de MP se validan **antes** del insert para no dejar registros huérfanos si MP no está configurado.
   - Llamada HTTP a MP **fuera de toda transacción**, con los reintentos existentes (`conRetry` 3 intentos, backoff 1s/2s/4s).
   - Tx 2 corta: si MP respondió, `activarPagoConPreferencia` (preferencia → `estado='pendiente'`) o `aplicarResultadoMP` (pago directo → estado final + efectos). Si MP falló tras los reintentos, `marcarPagoFallido` (`estado='fallido'`, causa en `mp_detail`) y el error se propaga al caller. Ambos UPDATEs solo pisan `'iniciando'` — no clobberean un estado que otro flujo ya fijó.
2. **`procesarWebhook`**: la consulta `Payment.get` quedó fuera de toda transacción. **Adaptación respecto del plan original**: el pago no puede marcarse `'procesando'` antes de la llamada porque recién se identifica con el `external_reference` que devuelve `Payment.get` — el marcador idempotente pre-red es la tabla `webhook_events` (pre-check sin transacción). La transacción corta final agrupa atómicamente: dedupe definitivo (`INSERT ... ON CONFLICT DO NOTHING` en `webhook_events`) + estado final + efectos. Si MP o la transacción fallan, no queda nada escrito y el retry del webhook de MP reprocesa desde cero (la semántica de reintento del código anterior se conserva).
3. **`aplicarResultadoMP`** (helper nuevo, compartido por webhook y pago directo): bloquea la fila del pago con `FOR UPDATE` (`findPagoByIdForUpdate`), y si el pago ya está `'aprobado'` o `'reembolsado'` **no vuelve a procesar** — idempotencia ante el webhook que MP manda por el mismo payment que `pagarDirectoTrabajo` ya aplicó (antes ese camino duplicaba distribuciones), y ante webhooks tardíos sobre pagos ya reembolsados. `'rechazado'` no se trata como final: en Checkout Pro el dueño puede reintentar el pago de la misma preferencia y el webhook posterior debe poder aprobarla.
4. **Resiliencia extra del pago directo**: si la Tx 2 fallara después de un cobro real en MP, el pago queda `'iniciando'` pero el webhook de MP aplica el resultado más tarde por la misma vía (`aplicarResultadoMP`).
5. **Migración `database/migrations/pagos_estados_outbox.sql`**: agrega `'iniciando'`, `'procesando'` y `'fallido'` al CHECK de `pagos.estado` (idempotente, mismo patrón que `pagos_reembolsado.sql`). Aplicada en `rtype1` y `rtype1_test`. `'procesando'` queda reservado (hoy su rol lo cumple `webhook_events`, ver punto 2). Los estados nuevos son inertes para el resto del backend: todos los consumidores (gate 402, saldo, reembolsos) filtran `estado='aprobado'`.
6. **Repository** (`pagos.repository.js`): `insertPago` acepta `estado` (default `'pendiente'` — `simularPagoAprobadoDev` no cambia), nuevas `activarPagoConPreferencia`, `marcarPagoFallido` y `findPagoByIdForUpdate`; eliminadas `updatePagoPreferenceId` y `findPagoById` (reemplazadas).
7. **Fix lateral en `tests/helpers.js`**: `webhook_events` agregada al TRUNCATE de `limpiarTablas` — los eventos de un run anterior hacían que el dedupe descartara webhooks legítimos del run siguiente.
- **Tests** (`backend/tests/pagos.test.js`, nuevo — `npm test` → **150/150**, 6 nuevos, primer suite que cubre `pagos.service`/webhook): con el SDK de MP mockeado (`jest.mock('mercadopago')`), cada flujo verifica desde **otra conexión del pool, durante la llamada a MP**, que el pago ya está commiteado como `'iniciando'` (con el código anterior la fila era invisible — es la prueba directa de I17); preferencia OK → `'pendiente'` con `mp_preference_id`; MP caído → `'fallido'` sin distribuciones y error propagado; pago directo aprobado → `'aprobado'` + 2 distribuciones `'pendiente'` (retención real); webhook aprueba + retry del mismo evento ni consulta a MP (dedupe `webhook_events`); webhook posterior a un pago directo ya aprobado no duplica distribuciones (guard de estado). El test restaura `mp_access_token=''` al terminar para no contaminar los suites que no mockean MP.
