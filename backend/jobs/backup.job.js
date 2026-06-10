const cron = require("node-cron");
const logger = require("../config/logger");
const { runBackup, uploadBackupToS3, cleanOldBackups } = require("../services/backup.service");
const { encolarEmail } = require("../workers/emailWorker");

const ejecutarBackupCompleto = async () => {
  logger.info("[backup.job] Iniciando backup programado");
  try {
    const { filePath, filename, size } = await runBackup();
    logger.info({ filename, size }, "[backup.job] pg_dump completado");

    const s3Url = await uploadBackupToS3(filePath);
    if (s3Url) logger.info({ s3Url }, "[backup.job] Backup subido a S3");

    const keepLast = parseInt(process.env.BACKUP_KEEP_LAST) || 7;
    const { eliminados } = await cleanOldBackups(keepLast);
    logger.info({ eliminados }, "[backup.job] Limpieza completada");

    logger.info("[backup.job] Backup programado completado con éxito");
  } catch (err) {
    logger.error({ err }, "[backup.job] Error en backup programado");

    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      try {
        await encolarEmail({
          to:      adminEmail,
          subject: "Error en backup automático de Labu",
          html:    `<p>El backup automático falló con el siguiente error:</p><pre>${err.message}</pre><p>Revisá los logs del servidor para más detalles.</p>`,
        });
      } catch (emailErr) {
        logger.error({ emailErr }, "[backup.job] Error enviando alerta por email");
      }
    }
  }
};

// Diario a las 3:00 AM
cron.schedule("0 3 * * *", ejecutarBackupCompleto);

logger.info("[backup.job] Job de backup programado (diario 3AM)");

module.exports = { ejecutarBackupCompleto };
