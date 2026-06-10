# Análisis Técnico Completo — Labu.com
**Fecha:** 2026-04-03 | **Estado:** MVP 100% completo, pre-producción

---

## 1. Descripción de la plataforma

Labu es un marketplace de servicios del hogar que conecta **dueños** (personas con problemas técnicos en su hogar) con **trabajadores** (personas que saben resolverlos). Funciona de forma similar a Uber: el dueño publica un trabajo con foto del problema, los trabajadores ofertan, el dueño acepta y paga, se coordina la visita, el trabajador confirma llegada por GPS, ejecuta el trabajo, sube foto del resultado, y el dueño libera el pago. Al finalizar, ambos se califican mutuamente y se genera un portfolio automático antes/después.

**Diferenciadores clave:**
- Perfiles intercambiables: un mismo usuario puede actuar como dueño o trabajador
- Coordinación de horarios con minicalendario integrado al chat
- Confirmación de llegada por geolocalización
- Pago retenido en plataforma (escrow) liberado al confirmar completado
- Auto-portfolio generado automáticamente al terminar cada trabajo

---

## 2. Stack tecnológico

### Backend
| Tecnología | Versión | Rol |
|---|---|---|
| Node.js | LTS (≥18) | Runtime |
| Express | 4.22.1 | Framework HTTP |
| PostgreSQL | 18 | Base de datos principal |
| pg (node-postgres) | 8.18.0 | Driver PostgreSQL + Connection Pool |
| Socket.io | ~4.x | WebSockets / tiempo real |
| jsonwebtoken | ~9.x | Autenticación JWT |
| bcrypt | 6.0.0 | Hash de contraseñas |
| express-validator | 7.3.1 | Validación de inputs |
| express-rate-limit | 8.3.1 | Rate limiting |
| express-session | 1.19.0 | Sesiones HTTP (auxiliar) |
| pino | ~9.x | Logging estructurado JSON |
| pino-pretty | ~11.x | Formato legible en desarrollo |
| multer | ~1.x | Upload de archivos (multipart) |
| mercadopago | ~2.x | SDK de pagos |
| nodemailer | ~6.x | Envío de emails |
| dotenv | 17.3.1 | Variables de entorno |

### Frontend
| Tecnología | Notas |
|---|---|
| HTML5 | Sin frameworks — vanilla |
| CSS3 | Archivos externos por página (35 archivos CSS) |
| JavaScript vanilla | Módulos por página en `/public/js/modules/` (20 archivos) |

### Infraestructura local
| Componente | Valor |
|---|---|
| Servidor | http://localhost:3000 |
| DB host | localhost:5432 |
| DB name | rtype1 |
| DB user | postgres |
| psql path | `C:\Program Files\PostgreSQL\18\bin\psql.exe` |

---

## 3. Arquitectura actual

### 3.1 Estructura de carpetas

```
labu.com gpt5.2/
├── backend/
│   ├── config/
│   │   ├── db.js               ← Connection pool PostgreSQL (max:50, min:5)
│   │   ├── logger.js           ← Instancia pino + AsyncLocalStorage (requestId)
│   │   ├── cache.js            ← Interfaz caché en memoria (stub Redis-compatible)
│   │   └── socketAdapter.js    ← Stub adapter Redis para Socket.io multi-instancia
│   ├── controllers/            ← 17 controllers (uno por dominio)
│   ├── services/               ← 27 services (lógica de negocio)
│   ├── repositories/
│   │   ├── jobs.repository.js  ← Queries SQL de trabajos
│   │   └── offers.repository.js← Queries SQL de ofertas
│   ├── routes/                 ← 17 archivos de rutas Express
│   ├── middlewares/
│   │   ├── auth.middleware.js          ← Verificación JWT
│   │   ├── errorHandler.middleware.js  ← Middleware global de errores
│   │   ├── requestLogger.middleware.js ← UUID por request + log de latencia
│   │   ├── seguridad.middleware.js     ← TyC + suspensión de cuentas
│   │   └── upload.middleware.js        ← Multer para fotos/videos
│   └── utils/
│       ├── AppError.js     ← Clase de error operacional con statusCode
│       └── apiResponse.js  ← Helper successResponse(res, data, statusCode)
├── frontend/
│   ├── views/
│   │   ├── index.html              ← Landing / Login
│   │   ├── pages/                  ← 18 páginas HTML internas
│   │   └── components/             ← navbar.html, sidebar-left.html, sidebar-right.html
│   └── public/
│       ├── css/                    ← 35 archivos CSS por página/componente
│       ├── js/modules/             ← 20 módulos JS por página
│       └── uploads/                ← Archivos subidos localmente
├── database/
│   ├── data/blueprints/            ← 12 SQLs de creación de tablas (etapas 1-11)
│   └── migrations/                 ← 23 migraciones incrementales (IF NOT EXISTS)
├── docs/
│   ├── arquitectura.md
│   ├── features.md
│   ├── roadmap.md
│   ├── debug.md
│   ├── feature.md
│   └── refactor.md
├── skills/                         ← Skills de Claude Code
├── CLAUDE.md                       ← Instrucciones del proyecto para Claude Code
└── server.js                       ← Entry point Express + Socket.io
```

### 3.2 Capas de la arquitectura

```
HTTP Request
    │
    ▼
[Express Router] ── routes/*.routes.js (17 archivos)
    │
    ▼
[Middlewares] ── requestLogger → auth.middleware → seguridad.middleware → express-validator
    │
    ▼
[Controller] ── controllers/*.controller.js (17 archivos)
    │             Valida inputs, llama al service, formatea con apiResponse.js
    ▼
[Service] ── services/*.service.js (27 archivos)
    │          Lógica de negocio, transacciones, notificaciones, eventos
    ▼
[Repository] ── repositories/jobs.repository.js, offers.repository.js
    │             Queries SQL encapsuladas (para jobs y offers)
    ▼
[PostgreSQL Pool] ── config/db.js (pg.Pool, max:50, min:5)
    │
    ▼
[PostgreSQL 18]

Errores:   AppError → errorHandler.middleware.js
Respuestas: successResponse() → { success: true, ...data }
```

### 3.3 Middleware stack (orden de aplicación en server.js)

1. `cors` — CORS restringido por variable de entorno `ALLOWED_ORIGIN`
2. `express.json()` + `express.urlencoded()` — parseo de body
3. `requestLogger` — genera `requestId` UUID, almacena en `AsyncLocalStorage`, loguea latencia al finalizar el request
4. `express-rate-limit` — limita login/registro (15 req/15min por IP)
5. `auth.middleware.verificarToken` — valida JWT en rutas protegidas
6. `seguridad.middleware.verificarTyC` — bloquea si hay T&C pendientes de aceptar
7. `seguridad.middleware.verificarNoSuspendido` — bloquea cuentas suspendidas
8. `express-validator` — validación de inputs en endpoints críticos
9. `errorHandler.middleware` — captura errores, formatea respuesta, loguea internamente

### 3.4 Patrones aplicados

| Patrón | Dónde |
|---|---|
| Repository Pattern | `jobs.repository.js`, `offers.repository.js` |
| Service Layer | `services/*.service.js` — toda la lógica de negocio |
| Middleware Chain | Express middlewares en orden definido en `server.js` |
| Error Operacional vs Bug | `AppError.isOperational` distingue errores esperados de bugs |
| Respuesta unificada | `apiResponse.successResponse()` en todos los controllers |
| Context Propagation | `AsyncLocalStorage` para propagar `requestId` sin pasarlo manual |
| Transacciones atómicas | `BEGIN/COMMIT/ROLLBACK` en operaciones críticas |
| Promise.all | Operaciones independientes en paralelo (ej: confirmarCompletado) |
| CTE | Cálculo Haversine en `jobs.service.js` |
| UNNEST batch | Inserción masiva de slots en `reservas.service.js` |

---

## 4. Flujo principal completo con estados de DB

### Estados del campo `trabajos.estado`

```
publicado → en_proceso → trabajador_llego → pendiente_confirmacion → completado
                                                                    ↘ cancelado
```

### Flujo detallado paso a paso

```
[1] DUEÑO PUBLICA
    INSERT trabajos (estado='publicado', foto_antes_url, lat, lng)
    → Aparece en feed de trabajadores

[2] TRABAJADOR OFERTA
    INSERT ofertas (estado='pendiente', monto_propuesto, tiempo_estimado)
    INSERT reservas_tentativas (slots de disponibilidad propuestos)
    → Notificación al dueño

[3] DUEÑO ACEPTA OFERTA (transacción atómica)
    UPDATE ofertas SET estado='aceptada'
    UPDATE trabajos SET estado='en_proceso', trabajador_id=X
    UPDATE reservas_tentativas SET estado='confirmada' (slot elegido)
    UPDATE reservas_tentativas SET estado='liberada' (resto)
    → Preferencia MercadoPago creada → cobro al dueño
    → Dinero retenido en plataforma
    → Chat especial con minicalendario abierto
    → Publicación desaparece del feed

[4] TRABAJADOR CONFIRMA LLEGADA
    Geolocalización validada contra coordenadas del trabajo
    UPDATE trabajos SET estado='trabajador_llego'
    → Notificación al dueño

[5] TRABAJADOR TERMINA
    Upload foto/video del resultado (multer)
    UPDATE trabajos SET estado='pendiente_confirmacion', foto_resultado_url=X
    → Notificación al dueño

[6] DUEÑO CONFIRMA COMPLETADO
    UPDATE trabajos SET estado='completado'
    Promise.all([
      → Liberar pago al trabajador (MercadoPago transfer)
      → Crear portfolio auto antes/después (portfolio.service.js)
      → Notificar al trabajador
    ])

[7] CALIFICACIONES MUTUAS (transacción atómica)
    INSERT calificaciones (dueño → trabajador, trabajador → dueño)
    UPDATE perfiles SET promedio_calificacion (calculado en la misma transacción)
```

### Estados de `ofertas.estado`

```
pendiente → aceptada
          → rechazada
          → contraoferta → pendiente (loop negociación)
                         → aceptada
                         → rechazada
```

---

## 5. Features implementadas al 100%

### Autenticación y usuarios
- Login / Registro con JWT + bcrypt
- Verificación de email al registrarse (token de un solo uso con expiración)
- Recuperación de contraseña por email (reset token con expiración)
- Perfiles intercambiables dueño/trabajador en la misma cuenta
- Términos y Condiciones con control de versión y aceptación obligatoria
- Suspensión de cuentas con fecha de expiración automática

### Feed y publicaciones
- Feed separado por rol (dueño ve sus publicaciones, trabajador ve trabajos disponibles)
- Filtros: rubro, modalidad, urgente
- Paginación de trabajos
- Geolocalización obligatoria al publicar (lat/lng)
- Cálculo de distancia Haversine con CTE (km al trabajador)
- Comentarios en publicaciones (carga lazy, prepend optimista, contador en tiempo real)
- Sistema de reportes (4 motivos, unique constraint por usuario+contenido, 409 si ya reportado)

### Sistema de ofertas
- Crear oferta con monto, mensaje, tiempo estimado y slots de disponibilidad
- Contraoferta bidireccional (loop hasta acuerdo)
- Rechazar oferta con liberación automática de reservas tentativas
- Paginación de ofertas

### Chat y coordinación
- Chat en tiempo real con Socket.io
- Rate limiting en Socket.io
- Chat especial post-aceptación con minicalendario integrado
- Paginación de mensajes (N+1 resuelto)

### Agenda y disponibilidad
- Configuración de disponibilidad semanal del trabajador (días y franjas horarias)
- Reservas tentativas al ofertar (slots propuestos por el trabajador)
- Confirmación de un slot al aceptar oferta (libera los demás automáticamente)
- Vista "Trabajos Agendados" con slots confirmados

### Flujo de trabajo end-to-end
- Confirmación de llegada por geolocalización
- Upload foto/video de resultado (multer)
- Confirmación de completado por el dueño
- Calificación mutua con actualización de promedio (transacción atómica)
- Auto-portfolio antes/después generado automáticamente al completar

### Pagos
- MercadoPago conectado al flujo real (modo sandbox activo)
- Webhook `POST /api/pagos/webhook` para notificaciones de pago
- Pago retenido en plataforma hasta confirmación de completado
- Liberación de pago automática al confirmar

### Notificaciones en tiempo real
- Socket.io para entrega inmediata
- Tipos cubiertos: oferta_recibida, oferta_rechazada, contraoferta_recibida/aceptada/rechazada, llegada_confirmada, resultado_subido, trabajo_completado, pedir_calificacion

### Relaciones sociales
- Dueño ↔ Dueño: amistad bidireccional (requiere aceptación mutua)
- Dueño → Trabajador: seguimiento unidireccional (sin aceptación)
- Trabajador ↔ Trabajador: amistad bidireccional (requiere aceptación mutua)

### Performance y escalabilidad
- Connection pool configurado (max:50, min:5, idleTimeout:30s, connTimeout:5s)
- 6 índices de escalabilidad en DB (`indices_escalabilidad.sql`)
- Paginación en todas las listas (jobs, offers, chat, notificaciones)
- N+1 queries resuelto en chat
- CTE para Haversine, UNNEST batch para inserciones masivas

### Infraestructura de calidad
- Health check endpoint `GET /api/health`
- CORS restringido por `ALLOWED_ORIGIN`
- Rate limiting HTTP (login/registro) y WebSocket
- Validación de inputs con express-validator en endpoints críticos
- Transacciones atómicas en operaciones críticas
- Fix timezone `fecha_inicio` (TIMESTAMP → TIMESTAMPTZ)
- Unique constraints + manejo de error 409

---

## 6. Tests

**Estado global: 74/74 tests pasando.**

### Distribución por módulo

| Módulo | Tests |
|---|---|
| Auth (login, registro, JWT, reset, verificación email) | ~12 |
| Jobs (CRUD, flujo completo, estados, geolocalización) | ~14 |
| Offers (crear, aceptar, rechazar, contraoferta, paginación) | ~12 |
| Chat (mensajes, paginación, Socket.io) | ~8 |
| Disponibilidad y reservas (config semanal, slots, confirmar) | ~8 |
| Calificaciones (insertar, promedio, transacción) | ~6 |
| Notificaciones (emisión, tipos) | ~4 |
| Reportes y comentarios (crear, unique, 409) | ~5 |
| Health check y middlewares (auth, errorHandler, rateLimiting) | ~5 |
| **Total** | **74** |

---

## 7. Mejoras de arquitectura aplicadas

### 7.1 AppError + middleware global de errores

**`backend/utils/AppError.js`**
```js
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
        this.isOperational = true;
    }
}
```

**`backend/middlewares/errorHandler.middleware.js`** — middleware `(err, req, res, next)`:
- Código PostgreSQL `23505` (unique violation) → 409
- `AppError` operacional → devuelve `err.statusCode` + `err.message`
- Compatibilidad con objetos legacy `{ status, error }` de services no migrados
- Errores inesperados: `logger.error({ err })` internamente + 500 genérico al cliente (nunca expone detalles)

### 7.2 Formato de respuesta API unificado

**`backend/utils/apiResponse.js`** — helper `successResponse(res, data, statusCode=200)`:
- Respuestas exitosas: `{ success: true, ...data }`
- Errores: `{ success: false, error: "mensaje" }`
- Elimina inconsistencias entre controllers

### 7.3 Repository layer

**`backend/repositories/jobs.repository.js`** — encapsula todas las queries SQL de trabajos:
- `findFeed()`, `findById()`, `updateEstado()`, `findAsignados()`, etc.

**`backend/repositories/offers.repository.js`** — encapsula todas las queries SQL de ofertas:
- `findTrabajoPublicado()`, `insertOferta()`, `findByTrabajo()`, etc.

Los services importan el repository en lugar de llamar `db.query()` directamente. Esto separa acceso a datos de lógica de negocio y facilita testing.

### 7.4 Logging estructurado con pino + requestId por request

**`backend/config/logger.js`**:
- Instancia única de pino exportada como módulo
- Dev: salida legible con pino-pretty (colores, timestamps HH:MM:ss, sin pid/hostname)
- Prod: JSON estructurado (nivel `info` o configurable con `LOG_LEVEL`)
- `getLogger()` devuelve child logger con `requestId` del contexto actual

**`backend/middlewares/requestLogger.middleware.js`**:
- Genera `requestId` UUID por cada request HTTP con `crypto.randomUUID()`
- Almacena en `AsyncLocalStorage` para propagación automática a todos los logs del request
- Loguea `method`, `url`, `statusCode`, `ms` y `userId` (si autenticado) al finalizar

**Resultado:** todos los logs de un mismo request comparten el mismo `requestId` sin pasarlo manualmente. 24 `console.log/error` reemplazados. 6 eventos de negocio logueados con contexto estructurado.

### 7.5 Infraestructura preparada para Redis

**`backend/config/cache.js`** — interfaz de caché en memoria con contrato Redis-compatible:
```js
get(key)                    // null si expirado o inexistente
set(key, value, ttlSeconds) // almacena con TTL opcional
del(key)                    // elimina una entrada
flush()                     // limpia todo el store
```
Para migrar a Redis: reemplazar el `Map` interno por `ioredis` sin modificar el resto del código.

**`backend/config/socketAdapter.js`** — stub del adapter Redis para Socket.io:
- Actualmente no-op (instancia única de proceso)
- TODOs documentan exactamente cómo conectar `@socket.io/redis-adapter` con `ioredis`
- Necesario cuando se escale a múltiples instancias (PM2 cluster o multi-servidor)

### 7.6 Separación de responsabilidades en services

| Antes | Después |
|---|---|
| `disponibilidad.service.js` (todo junto) | `disponibilidad.service.js` → solo config semanal |
| | `reservas.service.js` → solo lógica de reservas |
| Lógica de portfolio inline en `jobs.service.js` | Extraída a `portfolio.service.js` como función exportada |

### 7.7 Optimizaciones de queries

| Optimización | Dónde | Beneficio |
|---|---|---|
| Haversine con CTE | `jobs.service.js` | Elimina subconsulta repetida |
| Helper `_aceptarOfertaYTrabajo` | `offers.service.js` | ~40 líneas deduplicadas |
| UNNEST batch | `reservas.service.js` | 1 INSERT en lugar de N inserts en loop |
| Promise.all en confirmarCompletado | `jobs.service.js` | 3 operaciones independientes en paralelo |

---

## 8. Seguridad implementada

| Medida | Implementación |
|---|---|
| Autenticación | JWT firmado con `JWT_SECRET`, verificado en cada request protegido |
| Contraseñas | bcrypt v6 con factor de costo alto |
| Rate limiting HTTP | express-rate-limit: 15 req/15min en login y registro |
| Rate limiting WebSocket | Límite de mensajes por segundo en Socket.io |
| CORS | Restringido a `ALLOWED_ORIGIN` (variable de entorno) |
| Validación de inputs | express-validator en todos los endpoints críticos |
| Inyección SQL | Queries parametrizadas (pg) — nunca concatenación de strings |
| XSS | Inputs sanitizados por express-validator antes de persistir |
| No exposición de errores | `errorHandler` devuelve mensajes genéricos en errores inesperados |
| No exposición de stack traces | `logger.error({ err })` loguea internamente, nunca expone al cliente |
| Suspensión de cuentas | `seguridad.middleware` bloquea usuarios suspendidos en cada request |
| T&C obligatorios | `seguridad.middleware` bloquea si hay nueva versión sin aceptar |
| Unique constraints | DB-level + manejo de error código `23505` → 409 |
| Archivos subidos | multer con validación de tipo y tamaño |
| Tokens de email | UUID de un solo uso con expiración (reset password y verificación) |

---

## 9. Escalabilidad: listo y pendiente

### Listo para escalar

| Componente | Estado |
|---|---|
| Connection pool PostgreSQL | max:50 conexiones, gestión automática por `pg.Pool` |
| 6 índices en DB | `indices_escalabilidad.sql` — índices en columnas de búsqueda frecuente |
| Paginación universal | Jobs, offers, chat, notificaciones — todos paginados con `LIMIT/OFFSET` |
| N+1 resuelto | JOINs optimizados en chat |
| Queries eficientes | CTE Haversine, UNNEST batch |
| Interfaz de caché | `cache.js` con contrato Redis-compatible |
| Stub Socket.io adapter | `socketAdapter.js` listo para conectar Redis |
| TIMESTAMPTZ | Preparado para servidores en distintas zonas horarias |
| Logging con requestId | Trazabilidad completa en producción |
| Health check | `GET /api/health` para load balancers y orquestadores |

### Pendiente para producción a escala

| Componente | Qué falta | Impacto |
|---|---|---|
| **Redis** | Instanciar `ioredis`, reemplazar `cache.js` + activar `socketAdapter.js` | Escala horizontal de WebSockets y caché distribuida |
| **S3 o almacenamiento cloud** | Fotos/videos en `uploads/` local — no escala a múltiples instancias | Obligatorio para múltiples procesos |
| **Nginx + SSL** | Reverse proxy, HTTPS, certificado TLS (Let's Encrypt) | Obligatorio en producción |
| **PM2 o Docker** | Process manager para reinicios automáticos y clustering | Alta disponibilidad |
| **Logs centralizados** | Actualmente stdout — en prod: Datadog, CloudWatch, Loki, etc. | Observabilidad |
| **Backups automáticos DB** | PostgreSQL sin política de backup configurada | Recuperación ante desastres |
| **CDN para assets** | CSS/JS/imágenes servidas por Express — mejora con CDN | Performance para usuarios remotos |

---

## 10. Estado de producción

### Listo sin cambios de código

Todo el flujo funcional end-to-end:
- Autenticación JWT completa (login, registro, reset, verificación email)
- Feed con filtros y paginación
- Sistema de ofertas con negociación
- Chat en tiempo real con Socket.io
- Calendario de disponibilidad y reservas
- Flujo completo de trabajo (publicar → ofertar → aceptar → llegar → completar → calificar)
- Geolocalización de llegada
- Auto-portfolio antes/después
- Notificaciones en tiempo real
- Relaciones sociales (amigos/seguidores)
- Comentarios y reportes
- Rate limiting, CORS, validaciones, logging estructurado
- Error handling robusto sin exposición de detalles internos
- 74/74 tests pasando

### En modo prueba / sandbox

| Componente | Estado | Qué falta para producción |
|---|---|---|
| **MercadoPago** | Sandbox activo — flujo completo conectado y funcionando | Credenciales de producción: `MP_ACCESS_TOKEN` real + `MP_WEBHOOK_SECRET` |
| **Email (Nodemailer)** | Configurado, pendiente de credenciales SMTP | Credenciales SMTP reales (Gmail OAuth2, SendGrid, Resend, etc.) |

### Variables de entorno requeridas para producción

```env
NODE_ENV=production
PORT=3000

# Base de datos
DB_HOST=
DB_PORT=5432
DB_NAME=rtype1
DB_USER=
DB_PASSWORD=

# Auth
JWT_SECRET=<clave larga y aleatoria>

# CORS
ALLOWED_ORIGIN=https://labu.com

# MercadoPago
MP_ACCESS_TOKEN=<token de producción>
MP_WEBHOOK_SECRET=<secret para verificar webhooks>

# Email
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Logging (opcional)
LOG_LEVEL=info

# Redis (cuando esté disponible)
REDIS_URL=redis://localhost:6379
```

### Checklist de deployment

- [ ] Servidor Linux con Node.js ≥18
- [ ] PM2 instalado y configurado (`ecosystem.config.js`)
- [ ] PostgreSQL accesible y migrado (`blueprints/` + `migrations/`)
- [ ] Nginx configurado como reverse proxy
- [ ] Certificado SSL/TLS (Let's Encrypt con certbot)
- [ ] Variables de entorno configuradas
- [ ] Credenciales MercadoPago de producción
- [ ] Credenciales SMTP configuradas
- [ ] Almacenamiento de uploads (S3 o volumen persistente)
- [ ] Backup automático de PostgreSQL configurado

---

## Resumen ejecutivo

Labu es un MVP técnicamente sólido y completo. El código está estructurado en capas bien definidas (routes → controllers → services → repositories → DB), con patrones de arquitectura profesionales aplicados de forma consistente:

- **AppError** para manejo de errores operacionales vs bugs internos
- **apiResponse** para respuestas uniformes en toda la API
- **Repository layer** para separar acceso a datos de lógica de negocio
- **Logging estructurado** con pino y trazabilidad por request via `AsyncLocalStorage`
- **Infraestructura preparada** para Redis (caché + Socket.io adapter) sin cambios de interfaz
- **Transacciones atómicas** en todas las operaciones críticas
- **74/74 tests pasando**

Los únicos bloqueantes para ir a producción son las **credenciales de MercadoPago real**, las **credenciales SMTP** para emails transaccionales, y la **infraestructura de servidor** (Nginx + SSL + PM2 + variable `NODE_ENV=production`). El código en sí está listo.
