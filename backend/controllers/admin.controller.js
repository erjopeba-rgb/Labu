const adminService = require("../services/admin.service");
const disputasSvc = require("../services/disputas.service");
const pagosSvc = require("../services/pagos.service");
const backupService = require("../services/backup.service");
const AppError = require("../utils/AppError");
const { successResponse } = require("../utils/apiResponse");

const getUsuarios = async (req, res, next) => {
  try {
    const usuarios = await adminService.listarUsuarios();
    successResponse(res, { usuarios });
  } catch (err) {
    next(err);
  }
};

const suspenderUsuario = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || id < 1) throw new AppError("ID de usuario inválido", 400);
    const { suspendido } = req.body;
    const resultado = await adminService.suspenderUsuario(id, suspendido);
    successResponse(res, { usuario: resultado });
  } catch (err) {
    next(err);
  }
};

const getReportes = async (req, res, next) => {
  try {
    const reportes = await adminService.listarReportes();
    successResponse(res, { reportes });
  } catch (err) {
    next(err);
  }
};

const resolverReporte = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || id < 1) throw new AppError("ID de reporte inválido", 400);
    const { accion } = req.body;
    if (!["resolver", "desestimar"].includes(accion)) {
      throw new AppError("accion debe ser 'resolver' o 'desestimar'", 400);
    }
    const resultado = await adminService.resolverReporte(id, accion);
    successResponse(res, { reporte: resultado });
  } catch (err) {
    next(err);
  }
};

const getConfig = async (req, res, next) => {
  try {
    const config = await adminService.obtenerConfig();
    successResponse(res, { config });
  } catch (err) {
    next(err);
  }
};

const updateConfig = async (req, res, next) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates) || !updates.length) {
      throw new AppError("updates debe ser un array con al menos un item", 400);
    }
    const resultado = await adminService.actualizarConfig(updates);
    successResponse(res, { config: resultado });
  } catch (err) {
    next(err);
  }
};

const getVerificaciones = async (req, res, next) => {
  try {
    const estado = req.query.estado || null;
    const verificaciones = await adminService.listarVerificaciones(estado);
    successResponse(res, { verificaciones });
  } catch (err) {
    next(err);
  }
};

const aprobarVerificacion = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || id < 1) throw new AppError("ID de verificación inválido", 400);
    const resultado = await adminService.aprobarVerificacion(id);
    successResponse(res, { verificacion: resultado });
  } catch (err) {
    next(err);
  }
};

const rechazarVerificacion = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || id < 1) throw new AppError("ID de verificación inválido", 400);
    const { motivo } = req.body;
    if (!motivo || !motivo.trim()) {
      throw new AppError("El motivo de rechazo es obligatorio", 400);
    }
    const resultado = await adminService.rechazarVerificacion(id, motivo.trim());
    successResponse(res, { verificacion: resultado });
  } catch (err) {
    next(err);
  }
};

const getDisputas = async (req, res, next) => {
  try {
    const disputas = await disputasSvc.getDisputasAdmin();
    successResponse(res, { disputas });
  } catch (err) {
    next(err);
  }
};

const marcarDisputaEnRevision = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || id < 1) throw new AppError("ID de disputa inválido", 400);
    const disputa = await disputasSvc.marcarEnRevision(id);
    successResponse(res, { disputa });
  } catch (err) {
    next(err);
  }
};

const resolverDisputaAdmin = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || id < 1) throw new AppError("ID de disputa inválido", 400);
    const { resolucion, resultado } = req.body;
    if (!resolucion || !resolucion.trim()) {
      throw new AppError("La resolución es obligatoria", 400);
    }
    const disputa = await disputasSvc.resolverDisputa(id, resolucion.trim(), resultado);
    successResponse(res, { disputa });
  } catch (err) {
    next(err);
  }
};

const getErrores = async (req, res, next) => {
  try {
    const errores = await adminService.listarErrores();
    successResponse(res, { errores });
  } catch (err) {
    next(err);
  }
};

const getRetiros = async (req, res, next) => {
  try {
    const estado = req.query.estado || null;
    const retiros = await pagosSvc.listarRetirosAdmin(estado);
    successResponse(res, { retiros });
  } catch (err) {
    next(err);
  }
};

const resolverRetiro = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || id < 1) throw new AppError("ID de retiro inválido", 400);
    const { accion, nota } = req.body;
    if (!["pagado", "rechazado"].includes(accion)) {
      throw new AppError("accion debe ser 'pagado' o 'rechazado'", 400);
    }
    if (accion === "rechazado" && (!nota || !nota.trim())) {
      throw new AppError("El motivo de rechazo es obligatorio", 400);
    }
    const retiro = await pagosSvc.resolverRetiro(id, accion, nota ? nota.trim() : null);
    successResponse(res, { retiro });
  } catch (err) {
    next(err);
  }
};

const getBackups = async (req, res, next) => {
  try {
    const status = await backupService.getBackupStatus();
    successResponse(res, status);
  } catch (err) {
    next(err);
  }
};

const runManualBackup = async (req, res, next) => {
  try {
    const resultado = await backupService.runBackup();
    const s3Url = await backupService.uploadBackupToS3(resultado.filePath);
    const keepLast = parseInt(process.env.BACKUP_KEEP_LAST) || 7;
    const { eliminados } = await backupService.cleanOldBackups(keepLast);
    successResponse(res, { ok: true, backup: resultado, s3Url, eliminados });
  } catch (err) {
    next(err);
  }
};

const downloadBackup = async (req, res, next) => {
  try {
    const { filename } = req.params;
    if (!/^backup-[\d-]+\.sql\.gz$/.test(filename)) {
      throw new AppError("Nombre de archivo inválido", 400);
    }
    const path = require("path");
    const fs   = require("fs");
    const backupDir = process.env.BACKUP_DIR || path.join(__dirname, "../../backups");
    const filePath  = path.join(backupDir, filename);
    if (!fs.existsSync(filePath)) {
      throw new AppError("Backup no encontrado", 404);
    }
    res.download(filePath, filename);
  } catch (err) {
    next(err);
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
