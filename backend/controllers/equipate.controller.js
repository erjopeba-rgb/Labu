const svc = require("../services/equipate.service");
const AppError = require("../utils/AppError");
const { successResponse } = require("../utils/apiResponse");

const getProductos = async (req, res, next) => {
  try {
    const { rubro_id, destacado, limit, offset } = req.query;
    successResponse(res, { productos: await svc.getProductosRecomendados({
      rubroId: rubro_id ? parseInt(rubro_id) : null,
      destacado: destacado === 'true',
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0
    }) });
  } catch (err) {
    next(err);
  }
};

const click = async (req, res, next) => {
  try {
    await svc.registrarClick({
      productoRecomendadoId: parseInt(req.params.id),
      usuarioId: req.usuario?.id || null,
      ipAddress: req.ip
    });
    successResponse(res, { ok: true });
  } catch (err) {
    next(err);
  }
};

const getEstadisticas = async (req, res, next) => {
  try {
    const tienda = await require("../services/tienda.service").getPerfilTienda(req.usuario.id);
    if (!tienda) throw new AppError("Perfil de tienda no encontrado", 404);
    successResponse(res, await svc.getEstadisticasEquipate(tienda.id));
  } catch (err) {
    next(err);
  }
};

const getBadgeCamara = async (req, res, next) => {
  try {
    successResponse(res, await svc.getBadgeCamara(req.usuario.id));
  } catch (err) {
    next(err);
  }
};

module.exports = { getProductos, click, getEstadisticas, getBadgeCamara };
