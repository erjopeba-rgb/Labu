const {
  crearSolicitud, getSolicitud, getSolicitudesAbiertas,
  aplicarComoAyudante, responderAplicacion,
  procesarPagoAyudante, registrarAmonestacion, getMisAyudantes,
  getMisSolicitudesConAplicaciones
} = require("../services/ayudantes.service");
const AppError = require("../utils/AppError");
const { successResponse } = require("../utils/apiResponse");

const crear = async (req, res, next) => {
  try {
    const { cantidad_necesaria, pago_por_ayudante, descripcion } = req.body;
    if (!cantidad_necesaria || !pago_por_ayudante) {
      throw new AppError("cantidad_necesaria y pago_por_ayudante son requeridos", 400);
    }
    const sol = await crearSolicitud({
      trabajoId: parseInt(req.params.trabajo_id),
      trabajadorLiderId: req.usuario.id,
      cantidadNecesaria: cantidad_necesaria,
      pagoPorAyudante: pago_por_ayudante,
      descripcion: descripcion || null
    });
    successResponse(res, { solicitud: sol }, 201);
  } catch (err) {
    next(err);
  }
};

const getAbiertas = async (req, res, next) => {
  try {
    successResponse(res, { solicitudes: await getSolicitudesAbiertas() });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    successResponse(res, { solicitud: await getSolicitud(parseInt(req.params.id)) });
  } catch (err) {
    next(err);
  }
};

const aplicar = async (req, res, next) => {
  try {
    const app = await aplicarComoAyudante({
      solicitudId: parseInt(req.params.id),
      ayudanteId: req.usuario.id
    });
    successResponse(res, { aplicacion: app }, 201);
  } catch (err) {
    next(err);
  }
};

const responder = async (req, res, next) => {
  try {
    const { estado } = req.body;
    if (!["aceptado", "rechazado"].includes(estado)) {
      throw new AppError("estado debe ser aceptado o rechazado", 400);
    }
    const app = await responderAplicacion({
      aplicacionId: parseInt(req.params.aplicacion_id),
      liderId: req.usuario.id,
      estado
    });
    successResponse(res, { aplicacion: app });
  } catch (err) {
    next(err);
  }
};

const procesarPago = async (req, res, next) => {
  try {
    const cantidad = await procesarPagoAyudante(parseInt(req.params.trabajo_id));
    successResponse(res, { mensaje: `${cantidad} pagos procesados` });
  } catch (err) {
    next(err);
  }
};

const amonestacion = async (req, res, next) => {
  try {
    const { usuario_id, trabajo_id, descripcion } = req.body;
    if (!usuario_id || !descripcion) {
      throw new AppError("usuario_id y descripcion son requeridos", 400);
    }
    const result = await registrarAmonestacion({
      usuarioId: usuario_id,
      trabajoId: trabajo_id || null,
      descripcion
    });
    successResponse(res, result, 201);
  } catch (err) {
    next(err);
  }
};

const misAyudantes = async (req, res, next) => {
  try {
    successResponse(res, { ayudantes: await getMisAyudantes(req.usuario.id) });
  } catch (err) {
    next(err);
  }
};

const misSolicitudesConAplicaciones = async (req, res, next) => {
  try {
    successResponse(res, { solicitudes: await getMisSolicitudesConAplicaciones(req.usuario.id) });
  } catch (err) {
    next(err);
  }
};

module.exports = { crear, getAbiertas, getById, aplicar, responder, procesarPago, amonestacion, misAyudantes, misSolicitudesConAplicaciones };
