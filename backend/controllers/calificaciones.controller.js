const { crearCalificacion, obtenerCalificacionesPorUsuario } = require("../services/calificaciones.service");
const AppError = require("../utils/AppError");
const { successResponse } = require("../utils/apiResponse");

const calificar = async (req, res, next) => {
  try {
    const trabajoId = parseInt(req.params.trabajo_id);
    const { puntaje, comentario } = req.body;
    if (!puntaje || puntaje < 1 || puntaje > 5) {
      throw new AppError("El puntaje debe estar entre 1 y 5", 400);
    }
    const cal = await crearCalificacion({
      trabajoId,
      calificadorId: req.usuario.id,
      puntaje: parseFloat(puntaje),
      comentario: comentario || null
    });
    successResponse(res, { ...cal, puntaje: parseFloat(cal.puntaje) }, 201);
  } catch (err) {
    next(err);
  }
};

const getCalificaciones = async (req, res, next) => {
  try {
    const data = await obtenerCalificacionesPorUsuario(
      parseInt(req.params.usuario_id),
      parseInt(req.query.limit) || 10,
      parseInt(req.query.offset) || 0
    );
    successResponse(res, { data });
  } catch (err) {
    next(err);
  }
};

module.exports = { calificar, getCalificaciones };
