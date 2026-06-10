// setup.js — verifica que el entorno esté listo para levantar Labu
// Uso: node scripts/setup.js
// Comprueba: variables de entorno, conexión a PostgreSQL y tablas core.

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Client } = require('pg');

// ─── Definición de variables ─────────────────────────────────────────────────

const VARS_REQUERIDAS = [
  { nombre: 'DB_HOST',      descripcion: 'Host de PostgreSQL' },
  { nombre: 'DB_PORT',      descripcion: 'Puerto de PostgreSQL' },
  { nombre: 'DB_NAME',      descripcion: 'Nombre de la base de datos' },
  { nombre: 'DB_USER',      descripcion: 'Usuario de PostgreSQL' },
  { nombre: 'DB_PASSWORD',  descripcion: 'Contraseña de PostgreSQL' },
  { nombre: 'JWT_SECRET',   descripcion: 'Clave secreta para JWT' },
  { nombre: 'PORT',         descripcion: 'Puerto del servidor Express' },
  { nombre: 'CORS_ORIGIN',  descripcion: 'Origen permitido por CORS' },
  { nombre: 'APP_URL',      descripcion: 'URL base de la aplicación' },
];

const VARS_OPCIONALES = [
  { nombre: 'NODE_ENV',          descripcion: 'Entorno (development/production/test)' },
  { nombre: 'JWT_EXPIRES_IN',    descripcion: 'Expiración del JWT (ej: 7d)' },
  { nombre: 'LOG_LEVEL',         descripcion: 'Nivel de log pino (debug/info/warn/error)' },
  { nombre: 'SMTP_HOST',         descripcion: 'Host SMTP (vacío → Ethereal en dev)' },
  { nombre: 'SMTP_USER',         descripcion: 'Usuario SMTP' },
  { nombre: 'SMTP_PASS',         descripcion: 'Contraseña SMTP' },
  { nombre: 'MP_ACCESS_TOKEN',   descripcion: 'Token de MercadoPago' },
  { nombre: 'MP_WEBHOOK_SECRET', descripcion: 'Secret de webhook MercadoPago' },
  { nombre: 'REDIS_URL',         descripcion: 'URL de Redis (vacío → cache en memoria)' },
  { nombre: 'AWS_S3_BUCKET',     descripcion: 'Bucket S3 (vacío → filesystem local)' },
  { nombre: 'AWS_ACCESS_KEY_ID', descripcion: 'Access key AWS' },
  { nombre: 'AWS_SECRET_ACCESS_KEY', descripcion: 'Secret key AWS' },
  { nombre: 'AWS_REGION',        descripcion: 'Región AWS' },
  { nombre: 'DB_BACKUP_PATH',    descripcion: 'Ruta para backups de PostgreSQL' },
  { nombre: 'PGPASSWORD_BACKUP', descripcion: 'Contraseña para pg_dump' },
  { nombre: 'PG_DUMP_PATH',      descripcion: 'Ruta a pg_dump si no está en PATH' },
  { nombre: 'PSQL_PATH',         descripcion: 'Ruta a psql si no está en PATH' },
];

// Tablas que deben existir después de aplicar blueprints + migraciones core
const TABLAS_CORE = [
  'usuarios',
  'perfiles',
  'trabajos',
  'ofertas',
  'rubros',
  'tareas',
  'mensajes_chat',
  'conversaciones',
  'notificaciones',
  'calificaciones',
  'disponibilidad_trabajador',
  'reservas_tentativas',
  'password_resets',
  'email_verifications',
  'comentarios',
  'reportes',
  'disputas',
  'estadisticas_trabajador',
];

// ─── Colores ANSI ────────────────────────────────────────────────────────────

const OK    = '\x1b[32m✔\x1b[0m';
const FALLO = '\x1b[31m✘\x1b[0m';
const AVISO = '\x1b[33m⚠\x1b[0m';
const TITULO = (t) => `\x1b[1m\x1b[36m${t}\x1b[0m`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(str, len) {
  return str.padEnd(len, ' ');
}

// ─── Verificaciones ──────────────────────────────────────────────────────────

function verificarVariablesEntorno() {
  console.log(`\n${TITULO('1. Variables de entorno')}`);

  const faltantes = [];
  let okCount = 0;

  for (const { nombre, descripcion } of VARS_REQUERIDAS) {
    const valor = process.env[nombre];
    if (!valor || valor.trim() === '') {
      console.log(`  ${FALLO}  ${pad(nombre, 28)} — FALTA  (${descripcion})`);
      faltantes.push(nombre);
    } else {
      const oculto = nombre.toLowerCase().includes('password') || nombre.toLowerCase().includes('secret') || nombre.toLowerCase().includes('token')
        ? '●'.repeat(Math.min(valor.length, 8))
        : valor.length > 40 ? valor.slice(0, 37) + '...' : valor;
      console.log(`  ${OK}  ${pad(nombre, 28)}  ${oculto}`);
      okCount++;
    }
  }

  console.log(`\n  ${TITULO('Opcionales:')}`);
  let opcionalesConfigurados = 0;
  for (const { nombre, descripcion } of VARS_OPCIONALES) {
    const valor = process.env[nombre];
    if (!valor || valor.trim() === '') {
      console.log(`  ${AVISO}  ${pad(nombre, 28)} — no configurada  (${descripcion})`);
    } else {
      opcionalesConfigurados++;
      console.log(`  ${OK}  ${pad(nombre, 28)}  configurada`);
    }
  }

  console.log(`\n  Requeridas: ${okCount}/${VARS_REQUERIDAS.length} OK${faltantes.length ? '' : ' ✔'}`);
  console.log(`  Opcionales: ${opcionalesConfigurados}/${VARS_OPCIONALES.length} configuradas`);

  return faltantes;
}

async function verificarPostgres() {
  console.log(`\n${TITULO('2. Conexión a PostgreSQL')}`);

  const client = new Client({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'rtype1',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    const res = await client.query('SELECT version()');
    const version = res.rows[0].version.split(' ').slice(0, 2).join(' ');
    console.log(`  ${OK}  Conectado a PostgreSQL — ${version}`);
    return client;
  } catch (err) {
    console.log(`  ${FALLO}  No se pudo conectar: ${err.message}`);
    console.log(`       Host: ${process.env.DB_HOST}:${process.env.DB_PORT}  DB: ${process.env.DB_NAME}  User: ${process.env.DB_USER}`);
    return null;
  }
}

async function verificarTablas(client) {
  console.log(`\n${TITULO('3. Tablas de la base de datos')}`);

  const res = await client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  const existentes = new Set(res.rows.map((r) => r.tablename));
  const faltantes = [];
  let okCount = 0;

  for (const tabla of TABLAS_CORE) {
    if (existentes.has(tabla)) {
      console.log(`  ${OK}  ${tabla}`);
      okCount++;
    } else {
      console.log(`  ${FALLO}  ${tabla}  — NO EXISTE`);
      faltantes.push(tabla);
    }
  }

  console.log(`\n  ${okCount}/${TABLAS_CORE.length} tablas core presentes`);

  if (faltantes.length > 0) {
    console.log(`\n  ${AVISO}  Para crear las tablas faltantes, aplicar en orden:`);
    console.log(`       1. database/data/blueprints/etapa1.sql`);
    console.log(`       2. database/data/blueprints/ (resto de etapas en orden)`);
    console.log(`       3. database/migrations/ (todos los archivos .sql)`);
    console.log(`       Usando: psql -U ${process.env.DB_USER} -d ${process.env.DB_NAME} -f <archivo.sql>`);
  }

  return faltantes;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`${TITULO('═══════════════════════════════════════════')}`);
  console.log(`${TITULO('    Labu — Verificación de entorno')}`);
  console.log(`${TITULO('═══════════════════════════════════════════')}`);

  // 1. Variables de entorno
  const varsIncompletas = verificarVariablesEntorno();

  // 2. Conexión a PostgreSQL (solo si las vars de DB están presentes)
  let client = null;
  let tablasFaltantes = [];

  if (!['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'].some((v) => varsIncompletas.includes(v))) {
    client = await verificarPostgres();
  } else {
    console.log(`\n${TITULO('2. Conexión a PostgreSQL')}`);
    console.log(`  ${AVISO}  Omitido — faltan variables de DB`);
  }

  // 3. Tablas
  if (client) {
    tablasFaltantes = await verificarTablas(client);
    await client.end();
  } else if (varsIncompletas.some((v) => ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'].includes(v))) {
    console.log(`\n${TITULO('3. Tablas de la base de datos')}`);
    console.log(`  ${AVISO}  Omitido — no hay conexión`);
  }

  // ─── Resumen final ───────────────────────────────────────────────────────
  console.log(`\n${TITULO('═══════════════════════════════════════════')}`);
  console.log(`${TITULO('    Resumen')}`);
  console.log(`${TITULO('═══════════════════════════════════════════')}`);

  const hayProblemas = varsIncompletas.length > 0 || !client || tablasFaltantes.length > 0;

  if (!hayProblemas) {
    console.log(`\n  ${OK}  Todo está OK. El proyecto puede levantarse con:\n`);
    console.log(`       cd backend && npm start\n`);
  } else {
    console.log('');
    if (varsIncompletas.length > 0) {
      console.log(`  ${FALLO}  Variables requeridas faltantes (${varsIncompletas.length}):`);
      varsIncompletas.forEach((v) => console.log(`       • ${v}`));
      console.log(`       → Copiar backend/.env.example a backend/.env y completar los valores.\n`);
    }
    if (!client) {
      console.log(`  ${FALLO}  PostgreSQL no accesible`);
      console.log(`       → Verificar que el servidor de DB esté corriendo y las credenciales sean correctas.\n`);
    }
    if (tablasFaltantes.length > 0) {
      console.log(`  ${FALLO}  Tablas faltantes (${tablasFaltantes.length}): ${tablasFaltantes.join(', ')}`);
      console.log(`       → Aplicar los blueprints y migraciones (ver sección 3 arriba).\n`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n[setup] Error inesperado:', err.message);
  process.exit(1);
});
