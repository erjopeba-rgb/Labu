const adminService = require("../services/admin.service");
const disputasSvc = require("../services/disputas.service");
const logger = require("../config/logger");
const { getLogger } = logger;

const getUsuarios = async (req, res) => {
  try {
    const usuarios = await adminService.listarUsuarios();
    res.json({ usuarios });
  } catch (err) {
    getLogger().error({ err }, "[AdminController] getUsuarios fallido");
    res.status(err.status || 500).json({ error: err.error || "Error al obtener usuarios" });
  }
};

const suspenderUsuario = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || id < 1) return res.status(400).json({ error: "ID de usuario inválido" });
    const { suspendido } = req.body;
    const resultado = await adminService.suspenderUsuario(id, suspendido);
    res.json({ usuario: resultado });
  } catch (err) {
    getLogger().error({ err }, "[AdminController] suspenderUsuario fallido");
    res.status(err.status || 500).json({ error: err.error || "Error al actualizar usuario" });
  }
};

const getReportes = async (req, res) => {
  try {
    const reportes = await adminService.listarReportes();
    res.json({ reportes });
  } catch (err) {
    getLogger().error({ err }, "[AdminController] getReportes fallido");
    res.status(500).json({ error: "Error al obtener reportes" });
  }
};

const resolverReporte = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || id < 1) return res.status(400).json({ error: "ID de reporte inválido" });
    const { accion } = req.body;
    if (!["resolver", "desestimar"].includes(accion)) {
      return res.status(400).json({ error: "accion debe ser 'resolver' o 'desestimar'" });
    }
    const resultado = await adminService.resolverReporte(id, accion);
    res.json({ reporte: resultado });
  } catch (err) {
    getLogger().error({ err }, "[AdminController] resolverReporte fallido");
    res.status(err.status || 500).json({ error: err.error || "Error al resolver reporte" });
  }
};

const getConfig = async (req, res) => {
  try {
    const config = await adminService.obtenerConfig();
    res.json({ config });
  } catch (err) {
    getLogger().error({ err }, "[AdminController] getConfig fallido");
    res.status(500).json({ error: "Error al obtener configuración" });
  }
};

const updateConfig = async (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates) || !updates.length) {
      return res.status(400).json({ error: "updates debe ser un array con al menos un item" });
    }
    const resultado = await adminService.actualizarConfig(updates);
    res.json({ config: resultado });
  } catch (err) {
    getLogger().error({ err }, "[AdminController] updateConfig fallido");
    res.status(500).json({ error: "Error al actualizar configuración" });
  }
};

const getVerificaciones = async (req, res) => {
  try {
    const estado = req.query.estado || null;
    const verificaciones = await adminService.listarVerificaciones(estado);
    res.json({ verificaciones });
  } catch (err) {
    getLogger().error({ err }, "[AdminController] getVerificaciones fallido");
    res.status(500).json({ error: "Error al obtener verificaciones" });
  }
};

const aprobarVerificacion = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || id < 1) return res.status(400).json({ error: "ID de verificación inválido" });
    const resultado = await adminService.aprobarVerificacion(id);
    res.json({ verificacion: resultado });
  } catch (err) {
    getLogger().error({ err }, "[AdminController] aprobarVerificacion fallido");
    res.status(err.status || 500).json({ error: err.error || "Error al aprobar verificación" });
  }
};

const rechazarVerificacion = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || id < 1) return res.status(400).json({ error: "ID de verificación inválido" });
    const { motivo } = req.body;
    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ error: "El motivo de rechazo es obligatorio" });
    }
    const resultado = await adminService.rechazarVerificacion(id, motivo.trim());
    res.json({ verificacion: resultado });
  } catch (err) {
    getLogger().error({ err }, "[AdminController] rechazarVerificacion fallido");
    res.status(err.status || 500).json({ error: err.error || "Error al rechazar verificación" });
  }
};

const getDisputas = async (req, res) => {
  try {
    const disputas = await disputasSvc.getDisputasAdmin();
    res.json({ disputas });
  } catch (err) {
    getLogger().error({ err }, "[AdminController] getDisputas fallido");
    res.status(500).json({ error: "Error al obtener disputas" });
  }
};

const marcarDisputaEnRevision = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || id < 1) return res.status(400).json({ error: "ID de disputa inválido" });
    const disputa = await disputasSvc.marcarEnRevision(id);
    res.json({ disputa });
  } catch (err) {
    getLogger().error({ err }, "[AdminController] marcarDisputaEnRevision fallido");
    res.status(err.status || 500).json({ error: err.error || "Error al actualizar la disputa" });
  }
};

const resolverDisputaAdmin = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || id < 1) return res.status(400).json({ error: "ID de disputa inválido" });
    const { resolucion, resultado } = req.body;
    if (!resolucion || !resolucion.trim()) {
      return res.status(400).json({ error: "La resolución es obligatoria" });
    }
    const disputa = await disputasSvc.resolverDisputa(id, resolucion.trim(), resultado);
    res.json({ disputa });
  } catch (err) {
    getLogger().error({ err }, "[AdminController] resolverDisputaAdmin fallido");
    res.status(err.status || 500).json({ error: err.error || "Error al resolver la disputa" });
  }
};

const getErrores = async (req, res) => {
  try {
    const errores = await adminService.listarErrores();
    res.json({ errores });
  } catch (err) {
    getLogger().error({ err }, "[AdminController] getErrores fallido");
    res.status(500).json({ error: "Error al obtener el log de errores" });
  }
};

const pagosSvc = require("../services/pagos.service");

const getRetiros = async (req, res) => {
  try {
    const estado = req.query.estado || null;
    const retiros = await pagosSvc.listarRetirosAdmin(estado);
    res.json({ retiros });
  } catch (err) {
    getLogger().error({ err }, "[AdminController] getRetiros fallido");
    res.status(500).json({ error: "Error al obtener retiros" });
  }
};

const resolverRetiro = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || id < 1) return res.status(400).json({ error: "ID de retiro inválido" });
    const { accion, nota } = req.body;
    if (!["pagado", "rechazado"].includes(accion)) {
      return res.status(400).json({ error: "accion debe ser 'pagado' o 'rechazado'" });
    }
    if (accion === "rechazado" && (!nota || !nota.trim())) {
      return res.status(400).json({ error: "El motivo de rechazo es obligatorio" });
    }
    const retiro = await pagosSvc.resolverRetiro(id, accion, nota ? nota.trim() : null);
    res.json({ retiro });
  } catch (err) {
    getLogger().error({ err }, "[AdminController] resolverRetiro fallido");
    res.status(400).json({ error: err.message || "Error al resolver el retiro" });
  }
};

const backupService = require("../services/backup.service");

const getBackups = async (req, res) => {
  try {
    const status = await backupService.getBackupStatus();
    res.json(status);
  } catch (err) {
    getLogger().error({ err }, "[AdminController] getBackups fallido");
    res.status(500).json({ error: "Error al obtener backups" });
  }
};

const runManualBackup = async (req, res) => {
  try {
    const resultado = await backupService.runBackup();
    const s3Url = await backupService.uploadBackupToS3(resultado.filePath);
    const keepLast = parseInt(process.env.BACKUP_KEEP_LAST) || 7;
    const { eliminados } = await backupService.cleanOldBackups(keepLast);
    res.json({ ok: true, backup: resultado, s3Url, eliminados });
  } catch (err) {
    getLogger().error({ err }, "[AdminController] runManualBackup fallido");
    res.status(500).json({ error: `Error ejecutando backup: ${err.message}` });
  }
};

const downloadBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    if (!/^backup-[\d-]+\.sql\.gz$/.test(filename)) {
      return res.status(400).json({ error: "Nombre de archivo inválido" });
    }
    const path = require("path");
    const fs   = require("fs");
    const backupDir = process.env.BACKUP_DIR || path.join(__dirname, "../../backups");
    const filePath  = path.join(backupDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Backup no encontrado" });
    }
    res.download(filePath, filename);
  } catch (err) {
    getLogger().error({ err }, "[AdminController] downloadBackup fallido");
    res.status(500).json({ error: "Error al descargar backup" });
  }
};

module.exports = {
  getUsuarios,
  suspenderUsuario,
  getReportes,
  resolverReporte,
  getConfig,
  updateConfig,
  getVerificaciones,
  aprobarVerificacion,
  rechazarVerificacion,
  getDisputas,
  marcarDisputaEnRevision,
  resolverDisputaAdmin,
  getErrores,
  getRetiros,
  resolverRetiro,
  getBackups,
  runManualBackup,
  downloadBackup,
};
