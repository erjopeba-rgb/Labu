const childProcess = require("child_process");
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");

const getBackupDir = () =>
  process.env.BACKUP_DIR || path.join(__dirname, "../../backups");

const _formatFecha = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
};

async function runBackup() {
  const backupDir = getBackupDir();
  fs.mkdirSync(backupDir, { recursive: true });

  const now = new Date();
  const filename = `backup-${_formatFecha(now)}.sql.gz`;
  const filePath = path.join(backupDir, filename);

  const pgDumpPath = process.env.PG_DUMP_PATH || "pg_dump";
  const env = { ...process.env, PGPASSWORD: process.env.DB_PASSWORD || "" };
  const args = [
    "-h", process.env.DB_HOST     || "localhost",
    "-p", String(process.env.DB_PORT || "5432"),
    "-U", process.env.DB_USER     || "postgres",
    "-d", process.env.DB_NAME     || "rtype1",
    "--no-password",
  ];

  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (err) => {
      if (!settled) {
        settled = true;
        fs.unlink(filePath, () => {});
        reject(err);
      }
    };

    let exitCode = null;
    let finished = false;

    const tryResolve = () => {
      if (settled || exitCode === null || !finished) return;
      settled = true;
      if (exitCode !== 0) {
        fs.unlink(filePath, () => {});
        reject(new Error(`pg_dump terminó con código ${exitCode}`));
      } else {
        try {
          resolve({ filePath, filename, size: fs.statSync(filePath).size });
        } catch (e) {
          reject(e);
        }
      }
    };

    const pgDump = childProcess.spawn(pgDumpPath, args, { env });
    const gzip   = zlib.createGzip();
    const output = fs.createWriteStream(filePath);

    pgDump.stdout.pipe(gzip).pipe(output);

    pgDump.stderr.on("data", () => {});
    pgDump.on("error", fail);
    gzip.on("error", fail);
    output.on("error", fail);

    pgDump.on("close", (code) => {
      exitCode = code;
      if (code !== 0) fail(new Error(`pg_dump terminó con código ${code}`));
      else tryResolve();
    });
    output.on("finish", () => { finished = true; tryResolve(); });
  });
}

async function uploadBackupToS3(filePath) {
  const bucket = process.env.BACKUP_S3_BUCKET || process.env.AWS_S3_BUCKET;
  if (!bucket) {
    logger.info("[backup] S3 no configurado — backup solo local");
    return null;
  }

  const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
  const s3 = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const key = `backups/${path.basename(filePath)}`;
  const fileBuffer = await fs.promises.readFile(filePath);

  await s3.send(new PutObjectCommand({
    Bucket:      bucket,
    Key:         key,
    Body:        fileBuffer,
    ContentType: "application/gzip",
  }));

  const region = process.env.AWS_REGION || "us-east-1";
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

async function cleanOldBackups(keepLast = 7) {
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) return { eliminados: 0 };

  const archivos = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith("backup-") && f.endsWith(".sql.gz"))
    .map((f) => {
      const fp = path.join(backupDir, f);
      return { nombre: f, ruta: fp, mtime: fs.statSync(fp).mtime };
    })
    .sort((a, b) => b.mtime - a.mtime);

  const aEliminar = archivos.slice(keepLast);
  for (const f of aEliminar) {
    await fs.promises.unlink(f.ruta);
  }
  return { eliminados: aEliminar.length };
}

async function getBackupStatus() {
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) return { backups: [], total: 0 };

  const backups = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith("backup-") && f.endsWith(".sql.gz"))
    .map((f) => {
      const fp   = path.join(backupDir, f);
      const stats = fs.statSync(fp);
      return { nombre: f, tamanio: stats.size, fecha: stats.mtime };
    })
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  return { backups, total: backups.length };
}

module.exports = { runBackup, uploadBackupToS3, cleanOldBackups, getBackupStatus };
