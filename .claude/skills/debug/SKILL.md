---
name: debug
description: Diagnosticar y corregir errores en Labu (RType1) con impacto mínimo. Usar cuando hay un bug, error 500, comportamiento inesperado o test que falla.
---

# Debug — Labu

## Objetivo
Encontrar la causa raíz y aplicar el fix mínimo, sin tocar código no relacionado.

## Procedimiento

### 1. Recolectar evidencia
- Leer el mensaje de error completo (stack trace, requestId).
- **Errores 5xx en producción/dev:** revisar la tabla `error_logs` (también visible en el tab "Errores" del panel admin `admin.html`).
- **Logs estructurados:** el backend usa pino con `requestId` por request (AsyncLocalStorage, `requestLogger.middleware.js`). Buscar por requestId para correlacionar.
- **Errores de frontend:** abrir consola del navegador; verificar que el JS de la página esté cargado en el HTML y que las funciones llamadas desde HTML estén exportadas a `window`.

### 2. Reproducir
- Servidor local: `npm start` → http://localhost:3000
- DB local: `rtype1` (usuario `postgres`, puerto 5432). psql: `C:\Program Files\PostgreSQL\18\bin\psql.exe`
- Si el bug es de un endpoint, probarlo directo con fetch/curl antes de tocar UI.

### 3. Causa raíz (no síntoma)
Errores comunes ya catalogados en este proyecto:
- JS de la página no cargado en el HTML correspondiente.
- Función llamada desde HTML sin exportar a `window.nombreFuncion`.
- `cerrarModal()` llamado antes de leer los datos del modal.
- Falta clase `visible` en `.form-error` al mostrar errores.
- `require("./services/...")` en socket.js (debe ser `"../services/..."`).
- Tabla nueva sin agregar a la lista TRUNCATE de `backend/tests/helpers.js` (tests contaminados entre sí).
- Migración aplicada en `rtype1` pero no en `rtype1_test` (o viceversa).
- Mismatch `data.data` al consumir respuestas del formato unificado `{ data, total, page, limit }`.

### 4. Fix mínimo
- Aplicar el cambio más chico que corrige la causa raíz.
- No refactorizar de paso (para eso está `/refactor`).
- Si el fix toca pagos/MercadoPago → leer primero la skill `pagos-mercadopago`.
- Si el fix requiere migración SQL → seguir la skill `migraciones-db`.

### 5. Validar
- `npm test` desde la raíz (Jest 30, suite completa debe quedar verde — 150/150 al momento de escribir esto).
- Si el bug era de UI, verificar manualmente en el navegador.

## Reglas
- Corregir la causa raíz, no el síntoma.
- Cambios mínimos y enfocados; no tocar código no relacionado.
- Variables y comentarios en **español**.
