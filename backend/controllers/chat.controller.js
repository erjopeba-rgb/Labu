const svc = require("../services/chat.service");
const AppError = require("../utils/AppError");
const { successResponse } = require("../utils/apiResponse");

const getConversaciones = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    successResponse(res, { conversaciones: await svc.getMisConversaciones(req.usuario.id, limit, offset) });
  } catch (err) {
    next(err);
  }
};

const iniciarConversacion = async (req, res, next) => {
  try {
    const { tipo, referencia_id, participantes } = req.body;
    if (!tipo || !participantes || participantes.length === 0) {
      throw new AppError("tipo y participantes son requeridos", 400);
    }
    const todos = [...new Set([req.usuario.id, ...participantes])];
    const convId = await svc.getOrCreateConversacion(tipo, referencia_id || null, todos);
    successResponse(res, { conversacion_id: convId }, 201);
  } catch (err) {
    next(err);
  }
};

const getMensajes = async (req, res, next) => {
  try {
    const msgs = await svc.getMensajes(
      parseInt(req.params.id),
      req.usuario.id,
      parseInt(req.query.limit) || 50,
      parseInt(req.query.offset) || 0
    );
    successResponse(res, { mensajes: msgs });
  } catch (err) {
    next(err);
  }
};

const enviarMensaje = async (req, res, next) => {
  try {
    const { contenido, tipo } = req.body;
    if (!contenido) {
      throw new AppError("contenido es requerido", 400);
    }
    const msg = await svc.enviarMensaje({
      conversacionId: parseInt(req.params.id),
      remitenteId: req.usuario.id,
      contenido,
      tipo: tipo || 'texto'
    });
    // Emitir por socket si está disponible
    if (req.app.get('io')) {
      req.app.get('io').to(`conv_${msg.conversacion_id}`).emit('nuevo_mensaje', msg);
    }
    successResponse(res, msg, 201);
  } catch (err) {
    next(err);
  }
};

const getNotificaciones = async (req, res, next) => {
  try {
    const soloNoLeidas = req.query.no_leidas === 'true';
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    const { data, total } = await svc.getNotificaciones(req.usuario.id, soloNoLeidas, limit, offset);
    successResponse(res, { data, total, page, limit });
  } catch (err) {
    next(err);
  }
};

const getConteoNoLeidas = async (req, res, next) => {
  try {
    const count = await svc.getNoLeidasCount(req.usuario.id);
    successResponse(res, { count });
  } catch (err) {
    next(err);
  }
};

const marcarLeida = async (req, res, next) => {
  try {
    await svc.marcarLeida(parseInt(req.params.id), req.usuario.id);
    successResponse(res, { mensaje: "Notificacion marcada como leida" });
  } catch (err) {
    next(err);
  }
};

const marcarTodasLeidas = async (req, res, next) => {
  try {
    await svc.marcarTodasLeidas(req.usuario.id);
    successResponse(res, { mensaje: "Todas las notificaciones marcadas como leidas" });
  } catch (err) {
    next(err);
  }
};

module.exports = { getConversaciones, iniciarConversacion, getMensajes, enviarMensaje, getNotificaciones, getConteoNoLeidas, marcarLeida, marcarTodasLeidas };
