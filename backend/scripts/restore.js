// restore.js — restaura la base de datos desde un backup comprimido
// Uso: node scripts/restore.js <nombre-del-backup.sql.gz>
// Ejemplo: node scripts/restore.js backup-2026-04-09-02.sql.gz

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BACKUP_DIR = process.env.DB_BACKUP_PATH
  ? path.resolve(process.env.DB_BACKUP_PATH)
  : path.resolve(__dirname, '../../backups');

const DB_NAME = process.env.DB_NAME || 'rtype1';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '5432';
const PSQL = process.env.PSQL_PATH || 'psql';

function listarBackups() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('[restore] No existe el directorio de backups:', BACKUP_DIR);
    return [];
  }
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('backup-') && f.endsWith('.sql.gz'))
    .sort()
    .reverse(); // más reciente primero
}

function mostrarBackupsDisponibles() {
  const lista = listarBackups();
  if (lista.length === 0) {
    console.log('[restore] No hay backups disponibles en:', BACKUP_DIR);
    return;
  }
  console.log('[restore] Backups disponibles (más reciente primero):');
  lista.forEach((f, i) => {
    const ruta = path.join(BACKUP_DIR, f);
    const stats = fs.statSync(ruta);
    const tamanoMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`  ${i + 1}. ${f}  (${tamanoMB} MB)`);
  });
}

function restaurar(nombreArchivo) {
  const rutaArchivo = path.isAbsolute(nombreArchivo)
    ? nombreArchivo
    : path.join(BACKUP_DIR, nombreArchivo);

  if (!fs.existsSync(rutaArchivo)) {
    console.error(`[restore] Archivo no encontrado: ${rutaArchivo}`);
    mostrarBackupsDisponibles();
    process.exit(1);
  }

  console.log(`[restore] Restaurando "${DB_NAME}" desde: ${rutaArchivo}`);
  console.log('[restore] ADVERTENCIA: esto sobreescribirá la base de datos actual.');

  // Descomprimir en memoria
  const comprimido = fs.readFileSync(rutaArchivo);
  let sqlBuffer;
  try {
    sqlBuffer = zlib.gunzipSync(comprimido);
  } catch (err) {
    console.error('[restore] Error al descomprimir el archivo:', err.message);
    process.exit(1);
  }

  const env = {
    ...process.env,
    PGPASSWORD: process.env.PGPASSWORD_BACKUP || process.env.PGPASSWORD || '',
  };

  // Ejecutar psql con el SQL descomprimido por stdin
  try {
    execSync(
      `"${PSQL}" -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} --no-password`,
      {
        input: sqlBuffer,
        env,
        stdio: ['pipe', 'inherit', 'inherit'],
        maxBuffer: 500 * 1024 * 1024,
      }
    );
  } catch (err) {
    console.error('[restore] Error al ejecutar psql:', err.message);
    process.exit(1);
  }

  console.log('[restore] Restauración completada exitosamente.');
}

// --- Main ---
const argArchivo = process.argv[2];

if (!argArchivo) {
  console.log('Uso: node scripts/restore.js <nombre-del-backup.sql.gz>');
  console.log('     node scripts/restore.js --list   (para ver backups disponibles)\n');
  mostrarBackupsDisponibles();
  process.exit(0);
}

if (argArchivo === '--list') {
  mostrarBackupsDisponibles();
} else {
  restaurar(argArchivo);
}
