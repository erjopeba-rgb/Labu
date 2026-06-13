const svc = require("../services/seguridad.service");
const AppError = require("../utils/AppError");
const { successResponse } = require("../utils/apiResponse");

const advertencias = (req, res) => successResponse(res, { advertencias: svc.getAdvertencias() });

const confirmarAdv = async (req, res, next) => {
  try {
    if (!req.body.contratacion_id) throw new AppError("contratacion_id requerido", 400);
    successResponse(res, await svc.confirmarAdvertencias({
      contratacionId: req.body.contratacion_id,
      usuarioId: req.usuario.id,
      ipAddress: req.ip
    }));
  } catch (err) {
    next(err);
  }
};

const checkAdv = async (req, res, next) => {
  try {
    successResponse(res, { confirmado: await svc.advertenciasConfirmadas(
      parseInt(req.params.contratacion_id),
      req.usuario.id
    )});
  } catch (err) {
    next(err);
  }
};

const getTyC = async (req, res, next) => {
  try {
    const tyc = await svc.getTyCVigente();
    if (!tyc) throw new AppError("No hay terminos activos", 404);
    successResponse(res, { tyc });
  } catch (err) {
    next(err);
  }
};

const acceptTyC = async (req, res, next) => {
  try {
    if (!req.body.version_tyc_id) throw new AppError("version_tyc_id requerido", 400);
    await svc.aceptarTyC({
      usuarioId: req.usuario.id,
      versionTycId: req.body.version_tyc_id,
      ipAddress: req.ip
    });
    successResponse(res, { mensaje: "Terminos aceptados" });
  } catch (err) {
    next(err);
  }
};

const getServiciosMod = async (req, res, next) => {
  try {
    successResponse(res, { servicios: await svc.getServiciosPendientes() });
  } catch (err) {
    next(err);
  }
};

const resolverServicio = async (req, res, next) => {
  try {
    successResponse(res, await svc.resolverModeracion({
      trabajoId: parseInt(req.params.trabajo_id),
      moderadorId: req.usuario.id,
      estado: req.body.estado,
      motivo: req.body.motivo,
      advertenciaPublica: req.body.advertencia_publica || null
    }));
  } catch (err) {
    next(err);
  }
};

const createGrabacion = async (req, res, next) => {
  try {
    if (!req.body.archivo_url) throw new AppError("archivo_url requerida", 400);
    successResponse(res, { grabacion: await svc.registrarGrabacion({
      trabajoId: parseInt(req.params.trabajo_id),
      trabajadorId: req.usuario.id,
      archivoUrl: req.body.archivo_url,
      duracionSegundos: req.body.duracion_segundos || null,
      tamanoBytes: req.body.tamanio_bytes || null,
      fechaGrabacion: req.body.fecha_grabacion || null
    }) }, 201);
  } catch (err) {
    next(err);
  }
};

const getGrabacionesByTrabajo = async (req, res, next) => {
  try {
    successResponse(res, { grabaciones: await svc.getGrabaciones(parseInt(req.params.trabajo_id), req.usuario.id) });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  advertencias, confirmarAdv, checkAdv,
  getTyC, acceptTyC,
  getServiciosMod, resolverServicio,
  createGrabacion, getGrabacionesByTrabajo
};
