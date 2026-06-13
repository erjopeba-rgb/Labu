---
name: feature
description: Implementar funcionalidades nuevas en Labu (RType1) siguiendo los patrones establecidos del proyecto (route → controller → service → repository, migraciones idempotentes, frontend vanilla por página).
---

# Feature — Labu

## Objetivo
Implementar features nuevas de forma segura, paso a paso, respetando la arquitectura existente.

## Procedimiento

### 1. Analizar antes de codear
- Identificar archivos afectados y explicar el comportamiento actual.
- Preguntar si el cambio puede afectar otras partes del flujo (regla del CLAUDE.md).
- Si toca pagos/MercadoPago → leer primero la skill `pagos-mercadopago`. **Nunca** tocar pagos sin revisar.

### 2. Backend — patrón establecido (respetarlo siempre)
Capas, en este orden:
```
backend/routes/<modulo>.routes.js      → ruta Express + express-validator + seguridad.middleware
backend/controllers/<modulo>.controller.js → AppError para errores, apiResponse (success/error) para respuestas
backend/services/<modulo>.service.js   → lógica de negocio, transacciones
backend/repositories/<modulo>.repository.js → queries SQL
```
- Rutas nuevas se registran en `v1.router.js` (API versionada `/api/v1/` con alias `/api/`).
- Montar `seguridad.middleware.js` en toda ruta nueva.
- Errores: lanzar `AppError`, dejar que el `errorHandler` global responda. En routes con handlers propios usar `next(err)`.
- Listados: paginación unificada `{ data, total, page, limit }`.
- Transacciones: `SELECT ... FOR UPDATE` en operaciones críticas; idempotencia en acciones repetibles.
- Tareas secundarias (emails, OSRM, portfolio) → cola Bull (`emailWorker`/`osrmWorker`/`portfolioWorker`) con fallback síncrono si no hay `REDIS_URL`.
- Logging: pino (`logger.info/warn/error`), nunca `console.log`.

### 3. Base de datos
Si la feature necesita tablas/columnas nuevas → seguir la skill `migraciones-db` (SQL con `IF NOT EXISTS`, aplicar en **ambas DBs** dev y test, actualizar `TABLAS_CORE` y la lista TRUNCATE de tests).

### 4. Frontend
Si la feature tiene página nueva → seguir la skill `nueva-pagina-frontend` (checklist completo).
Para páginas existentes:
- JS de la página vive en `frontend/public/js/modules/<pagina>.js` y debe estar cargado en su HTML.
- Funciones llamadas desde HTML → exportar a `window.nombreFuncion`.
- CSS en archivos externos (`frontend/public/css/`), nunca inline.
- Llamadas API vía `App.apiRequest('/endpoint')` (agrega `/api` y el Bearer token solo).

### 5. Tests
- Tests de integración en `backend/tests/` con supertest + Jest 30.
- Helpers en `backend/tests/helpers.js` (`limpiarTablas`, registro de usuarios, `aprobarPagoTrabajo`, etc.).
- Tabla nueva → agregarla a la lista TRUNCATE de `helpers.js` (leaf-first).
- SDK de MercadoPago siempre mockeado en tests (ver `pagos.test.js`).

### 6. Validar
- `npm test` desde la raíz — toda la suite verde, no solo los tests nuevos.
- Probar la feature manualmente en http://localhost:3000.
- Actualizar CLAUDE.md (Estado del MVP + historial) si la feature es significativa.

## Reglas
- Explicar el plan antes de codear y confirmarlo con el usuario.
- Un cambio lógico por vez; no modificar código no relacionado.
- Variables y comentarios en **español**.
- Preferir soluciones simples que sigan los patrones ya existentes antes que inventar abstracciones nuevas.
