---
name: migraciones-db
description: Flujo completo para crear y aplicar migraciones SQL en Labu (PostgreSQL) — idempotencia, ambas DBs (dev y test), npm run migrate, TABLAS_CORE y lista TRUNCATE de tests.
---

# Migraciones de DB — Labu

## Contexto
- DB de desarrollo: `rtype1` · DB de tests: `rtype1_test` (usuario `postgres`, puerto 5432).
- psql: `C:\Program Files\PostgreSQL\18\bin\psql.exe`
- Runner: `backend/scripts/migrate.js` — lee los `.sql` de `database/migrations/` en **orden alfabético**, registra cada una en la tabla `migration_history`, omite las ya aplicadas.
- Guardar los `.sql` **sin BOM** (un BOM ya rompió el runner una vez).

## Paso 1 — Escribir la migración
Archivo nuevo en `database/migrations/<nombre_descriptivo>.sql`. Reglas de idempotencia (deben poder correrse dos veces sin error):
- `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- Seeds: `INSERT ... ON CONFLICT DO NOTHING`
- Modificar un CHECK constraint: usar un bloque `DO $$` que detecta si el cambio ya está aplicado y dropea/recrea el constraint (ver `pagos_estados_outbox.sql` o `pagos_reembolsado.sql` como plantilla).
- Convenciones: nombres en español, `TIMESTAMPTZ` (no `TIMESTAMP` — fix I8 de timezone), FKs con `ON DELETE` explícito.

## Paso 2 — Aplicar en AMBAS bases
La causa #1 de tests rotos es aplicar solo en dev. El runner usa `DB_NAME` del `backend/.env` (default `rtype1`); una variable de entorno ya seteada tiene precedencia sobre el `.env`:

```powershell
# 1. Dev (rtype1, lee backend/.env)
npm run migrate

# 2. Test (rtype1_test, override por env var)
$env:DB_NAME = 'rtype1_test'; npm run migrate; Remove-Item Env:DB_NAME
```

Verificar estado: `npm run migrate:status` (con el mismo override para la DB de test).

## Paso 3 — Actualizar el código que conoce las tablas
Si la migración crea una **tabla nueva**, actualizar SIEMPRE:
1. **`backend/scripts/setup.js`** → agregar la tabla al array `TABLAS_CORE` (línea ~54) si es una tabla central del flujo.
2. **`backend/tests/helpers.js`** → agregarla a la lista `tablas` de `limpiarTablas()` (TRUNCATE), en orden **leaf-first** (hijas antes que padres). Olvidarla contamina datos entre tests.
3. Si necesita datos base, el seed va en la misma migración con `ON CONFLICT DO NOTHING`.

## Paso 4 — Validar
- `npm test` desde la raíz — toda la suite verde.
- `npm run migrate` una segunda vez debe terminar sin errores (prueba de idempotencia).

## Notas
- CI (`ci.yml`) levanta PostgreSQL como service y corre las migraciones antes de `npm test` — si la migración no es idempotente u ordenable alfabéticamente, rompe el pipeline.
- NUNCA eliminar tablas sin preguntar primero (regla del CLAUDE.md).
- Blueprints de creación inicial viven en `database/data/blueprints/` — las migraciones posteriores van siempre en `database/migrations/`.
