// migrate.js — Runner de migraciones para Labu
// Uso:
//   node scripts/migrate.js            → aplica migraciones pendientes
//   node scripts/migrate.js --status   → muestra estado de todas las migraciones
//
// Lee todos los .sql de database/migrations/ en orden alfabético.
// Registra cada migración ejecutada en la tabla migration_history.

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs    = require('fs');
const path  = require('path');
const { Client } = require('pg');

// ─── Config ──────────────────────────────────────────────────────────────────

const MIGRATIONS_DIR = path.resolve(__dirname, '../../database/migrations');

const OK    = '\x1b[32m✔\x1b[0m';
const FALLO = '\x1b[31m✘\x1b[0m';
const SKIP  = '\x1b[33m–\x1b[0m';
const TITULO = (t) => `\x1b[1m\x1b[36m${t}\x1b[0m`;

// ─── DB ──────────────────────────────────────────────────────────────────────

async function conectar() {
  const client = new Client({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'rtype1',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 5000,
  });

  await client.connect();
  return client;
}

async function crearTablaSiNoExiste(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS migration_history (
      id          SERIAL PRIMARY KEY,
      nombre      TEXT NOT NULL UNIQUE,
      ejecutado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function obtenerEjecutadas(client) {
  const res = await client.query(
    'SELECT nombre FROM migration_history ORDER BY ejecutado_en'
  );
  return new Set(res.rows.map((r) => r.nombre));
}

// ─── Migraciones ─────────────────────────────────────────────────────────────

function leerMigraciones() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`${FALLO}  No se encontró el directorio: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()  // orden alfabético
    .map((f) => ({
      nombre: f,
      ruta:   path.join(MIGRATIONS_DIR, f),
    }));
}

async function ejecutarMigracion(client, migracion) {
  const sql = fs.readFileSync(migracion.ruta, 'utf8');

  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query(
      'INSERT INTO migration_history (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING',
      [migracion.nombre]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

// ─── Modos ───────────────────────────────────────────────────────────────────

async function modoStatus(client, migraciones, ejecutadas) {
  console.log(`\n${TITULO('Estado de migraciones')}\n`);

  const pendientes = migraciones.filter((m) => !ejecutadas.has(m.nombre));
  const aplicadas  = migraciones.filter((m) =>  ejecutadas.has(m.nombre));

  for (const m of migraciones) {
    const icono = ejecutadas.has(m.nombre) ? OK : SKIP;
    const estado = ejecutadas.has(m.nombre) ? 'aplicada ' : 'pendiente';
    console.log(`  ${icono}  [${estado}]  ${m.nombre}`);
  }

  console.log('');
  console.log(`  Aplicadas:  ${aplicadas.length}`);
  console.log(`  Pendientes: ${pendientes.length}`);
  console.log(`  Total:      ${migraciones.length}`);
  console.log('');

  if (pendientes.length > 0) {
    console.log(`  ${SKIP}  Hay migraciones pendientes. Ejecutar:\n`);
    console.log(`       cd backend && npm run migrate\n`);
  }
}

async function modoRun(client, migraciones, ejecutadas) {
  const pendientes = migraciones.filter((m) => !ejecutadas.has(m.nombre));

  if (pendientes.length === 0) {
    console.log(`\n  ${OK}  No hay migraciones pendientes.\n`);
    return;
  }

  console.log(`\n${TITULO(`Aplicando ${pendientes.length} migración(es) pendiente(s)`)}\n`);

  let okCount = 0;

  for (const migracion of pendientes) {
    process.stdout.write(`  Aplicando  ${migracion.nombre} ... `);
    try {
      await ejecutarMigracion(client, migracion);
      console.log(OK);
      okCount++;
    } catch (err) {
      console.log(`${FALLO}  FALLÓ`);
      console.error(`\n  Error: ${err.message}\n`);
      console.error(`  La migración fue revertida (ROLLBACK). Las anteriores ya aplicadas se mantienen.\n`);
      process.exit(1);
    }
  }

  console.log('');
  console.log(`  ${OK}  ${okCount} migración(es) aplicada(s) correctamente.\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const esStatus = process.argv.includes('--status');

  console.log(`${TITULO('═══════════════════════════════════════════')}`);
  console.log(`${TITULO('    Labu — Runner de migraciones')}`);
  console.log(`${TITULO('═══════════════════════════════════════════')}`);

  let client;
  try {
    client = await conectar();
  } catch (err) {
    console.error(`\n${FALLO}  No se pudo conectar a PostgreSQL: ${err.message}`);
    console.error(`   Host: ${process.env.DB_HOST}:${process.env.DB_PORT}  DB: ${process.env.DB_NAME}\n`);
    process.exit(1);
  }

  try {
    await crearTablaSiNoExiste(client);

    const migraciones = leerMigraciones();
    const ejecutadas  = await obtenerEjecutadas(client);

    if (esStatus) {
      await modoStatus(client, migraciones, ejecutadas);
    } else {
      await modoRun(client, migraciones, ejecutadas);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\n[migrate] Error inesperado:', err.message);
  process.exit(1);
});
