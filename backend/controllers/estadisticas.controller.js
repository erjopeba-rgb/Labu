const { getEstadisticas, getBadges, getAllBadges, actualizarEstadisticas, getComparativa } = require("../services/estadisticas.service");
const { successResponse } = require("../utils/apiResponse");

const getMisEstadisticas = async (req, res, next) => {
  try {
    successResponse(res, { estadisticas: await getEstadisticas(req.usuario.id) });
  } catch (err) {
    next(err);
  }
};

const getEstadisticasPublicas = async (req, res, next) => {
  try {
    successResponse(res, { estadisticas: await getEstadisticas(parseInt(req.params.trabajador_id)) });
  } catch (err) {
    next(err);
  }
};

const getMisBadges = async (req, res, next) => {
  try {
    successResponse(res, { badges: await getAllBadges(req.usuario.id) });
  } catch (err) {
    next(err);
  }
};

const getBadgesPublicos = async (req, res, next) => {
  try {
    successResponse(res, { badges: await getBadges(parseInt(req.params.trabajador_id)) });
  } catch (err) {
    next(err);
  }
};

const getComparativaRubro = async (req, res, next) => {
  try {
    const rubroId = parseInt(req.params.rubro_id);
    successResponse(res, { comparativa: await getComparativa(req.usuario.id, rubroId) });
  } catch (err) {
    next(err);
  }
};

const recalcular = async (req, res, next) => {
  try {
    await actualizarEstadisticas(req.usuario.id);
    successResponse(res, { mensaje: "Estadisticas actualizadas" });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMisEstadisticas, getEstadisticasPublicas, getMisBadges, getBadgesPublicos, getComparativaRubro, recalcular };
