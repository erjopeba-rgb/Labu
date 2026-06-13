const svc = require("../services/confianza.service");
const AppError = require("../utils/AppError");
const { successResponse } = require("../utils/apiResponse");

const getLista = async (req, res, next) => {
  try {
    successResponse(res, { trabajadores: await svc.getTrabajadoresConfianza(req.usuario.id) });
  } catch (err) {
    next(err);
  }
};

const add = async (req, res, next) => {
  try {
    const { trabajador_id, nota } = req.body;
    if (!trabajador_id) throw new AppError("trabajador_id es requerido", 400);
    successResponse(res, { trabajador: await svc.addTrabajadorConfianza(req.usuario.id, trabajador_id, nota || null) }, 201);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await svc.removeTrabajadorConfianza(req.usuario.id, parseInt(req.params.trabajador_id));
    successResponse(res, { mensaje: "Trabajador eliminado de tu lista de confianza" });
  } catch (err) {
    next(err);
  }
};

const getHistorial = async (req, res, next) => {
  try {
    successResponse(res, { historial: await svc.getHistorialCompartido(req.usuario.id, parseInt(req.params.trabajador_id)) });
  } catch (err) {
    next(err);
  }
};

const getMantenimientos = async (req, res, next) => {
  try {
    successResponse(res, { mantenimientos: await svc.getMantenimientos(req.usuario.id) });
  } catch (err) {
    next(err);
  }
};

const crearMantenimiento = async (req, res, next) => {
  try {
    const { trabajador_id, titulo, frecuencia, proximo_vencimiento } = req.body;
    if (!trabajador_id || !titulo || !frecuencia || !proximo_vencimiento) {
      throw new AppError("trabajador_id, titulo, frecuencia y proximo_vencimiento son requeridos", 400);
    }
    successResponse(res, { mantenimiento: await svc.crearMantenimiento({
      duenioId: req.usuario.id,
      trabajadorId: trabajador_id,
      tareaId: req.body.tarea_id || null,
      rubroId: req.body.rubro_id || null,
      titulo,
      descripcion: req.body.descripcion || null,
      frecuencia,
      proximoVencimiento: proximo_vencimiento
    }) }, 201);
  } catch (err) {
    next(err);
  }
};

const actualizarVencimiento = async (req, res, next) => {
  try {
    successResponse(res, { mantenimiento: await svc.actualizarVencimiento(
      parseInt(req.params.id),
      req.usuario.id,
      req.body.trabajo_id || null
    ) });
  } catch (err) {
    next(err);
  }
};

const eliminarMantenimiento = async (req, res, next) => {
  try {
    await svc.eliminarMantenimiento(parseInt(req.params.id), req.usuario.id);
    successResponse(res, { mensaje: "Mantenimiento eliminado" });
  } catch (err) {
    next(err);
  }
};

const getVencimientos = async (req, res, next) => {
  try {
    const dias = req.query.dias ? parseInt(req.query.dias) : 7;
    successResponse(res, { vencimientos: await svc.getProximosVencimientos(req.usuario.id, dias) });
  } catch (err) {
    next(err);
  }
};

const getNivel = async (req, res, next) => {
  try {
    const data = await svc.getNivelConfianza(parseInt(req.params.usuario_id));
    successResponse(res, data);
  } catch (err) {
    next(err);
  }
};

module.exports = { getLista, add, remove, getHistorial, getMantenimientos, crearMantenimiento, actualizarVencimiento, eliminarMantenimiento, getVencimientos, getNivel };
