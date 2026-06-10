// backup.js — genera pg_dump comprimido de la base de datos rtype1
// Uso: node scripts/backup.js
// Mantiene los últimos 7 backups, elimina los más viejos automáticamente.

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Directorio donde se guardan los backups (configurable por variable de entorno)
const BACKUP_DIR = process.env.DB_BACKUP_PATH
  ? path.resolve(process.env.DB_BACKUP_PATH)
  : path.resolve(__dirname, '../../backups');

const MAX_BACKUPS = 7;

// Parámetros de conexión
const DB_NAME = process.env.DB_NAME || 'rtype1';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '5432';

// Ruta al ejecutable de pg_dump (ajustar si es necesario)
const PG_DUMP = process.env.PG_DUMP_PATH || 'pg_dump';

function ahora() {
  const d = new Date();
  const YYYY = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const DD = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  return `${YYYY}-${MM}-${DD}-${HH}`;
}

function crearDirectorioSiNoExiste(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[backup] Directorio creado: ${dir}`);
  }
}

function eliminarBackupsAntiguos(dir) {
  const archivos = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('backup-') && f.endsWith('.sql.gz'))
    .map((f) => ({ nombre: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime); // más viejo primero

  const exceso = archivos.length - MAX_BACKUPS;
  for (let i = 0; i < exceso; i++) {
    const ruta = path.join(dir, archivos[i].nombre);
    fs.unlinkSync(ruta);
    console.log(`[backup] Eliminado backup antiguo: ${archivos[i].nombre}`);
  }
}

async function hacerBackup() {
  crearDirectorioSiNoExiste(BACKUP_DIR);

  const timestamp = ahora();
  const nombreArchivo = `backup-${timestamp}.sql.gz`;
  const rutaFinal = path.join(BACKUP_DIR, nombreArchivo);

  console.log(`[backup] Iniciando backup de "${DB_NAME}" → ${rutaFinal}`);

  // Variables de entorno para pg_dump
  const env = {
    ...process.env,
    PGPASSWORD: process.env.PGPASSWORD_BACKUP || process.env.PGPASSWORD || '',
  };

  // Ejecutar pg_dump y capturar stdout como buffer
  let sqlBuffer;
  try {
    sqlBuffer = execSync(
      `"${PG_DUMP}" -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} --no-password`,
      { env, maxBuffer: 500 * 1024 * 1024 } // 500 MB máximo
    );
  } catch (err) {
    console.error('[backup] Error al ejecutar pg_dump:', err.message);
    process.exit(1);
  }

  // Comprimir y guardar
  const comprimido = zlib.gzipSync(sqlBuffer);
  fs.writeFileSync(rutaFinal, comprimido);

  const tamanoMB = (comprimido.length / 1024 / 1024).toFixed(2);
  console.log(`[backup] Backup completado: ${nombreArchivo} (${tamanoMB} MB)`);

  // Limpiar backups viejos
  eliminarBackupsAntiguos(BACKUP_DIR);

  console.log('[backup] Proceso finalizado.');
}

hacerBackup();
