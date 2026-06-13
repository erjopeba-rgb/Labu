---
name: refactor
description: Mejorar calidad de código en Labu (RType1) sin cambiar comportamiento. Usar para eliminar duplicación, simplificar lógica o alinear código viejo con los patrones actuales del proyecto.
---

# Refactor — Labu

## Objetivo
Mejorar la calidad del código **sin cambiar comportamiento observable**.

## Procedimiento

### 1. Línea base
- Correr `npm test` ANTES de tocar nada. Si la suite no está verde, frenar y avisar — no se refactoriza sobre tests rotos.
- Entender la lógica actual y por qué está como está (revisar historial en CLAUDE.md/AUDIT.md: mucho código tiene forma deliberada, p. ej. el patrón outbox en pagos o el orden de locks trabajos → disputas).

### 2. Objetivos de refactor válidos en este proyecto
- Mover SQL suelto en services al repository layer correspondiente (`backend/repositories/`).
- Reemplazar manejo de errores ad-hoc por `AppError` + `errorHandler` global.
- Unificar respuestas al formato `apiResponse` (`success`/`error`) y paginación `{ data, total, page, limit }`.
- Migrar `console.log` restantes a pino.
- Extraer lógica duplicada entre services a helpers.
- CSS inline → archivos externos en `frontend/public/css/`.

### 3. Zonas que requieren cuidado extra (no refactorizar a ciegas)
- `pagos.service.js` — patrón outbox: el orden commit-antes-de-red es intencional. Leer la skill `pagos-mercadopago` primero.
- `scheduling.service.js` — advisory locks por trabajador + timezone `America/Argentina/Buenos_Aires` con `date-fns-tz`. El orden de operaciones previene double-booking (C1 del AUDIT.md).
- Orden de locks `trabajos` → `disputas` en `confirmarCompletado` y `resolverDisputa` (previene deadlocks).
- `socket.js` — los requires son `"../services/..."`, no `"./services/..."`.

### 4. Ejecutar
- Pasos chicos y controlados; un refactor lógico por commit.
- No cambiar funcionalidad, firmas públicas de API ni formato de respuestas.
- No renombrar archivos que tienen referencias en otros archivos sin preguntar primero.

### 5. Validar
- `npm test` después de cada paso — la suite debe quedar igual de verde que la línea base.
- Si el refactor tocó frontend, verificar la página en el navegador.

## Reglas
- Comportamiento idéntico antes y después.
- Evitar rewrites grandes; preferir mejoras incrementales.
- Variables y comentarios en **español**.
