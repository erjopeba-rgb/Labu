const { createDenuncia, getDenuncias, resolverDenuncia } = require("../services/denuncias.service");
const { successResponse } = require("../utils/apiResponse");

const create = async (req, res, next) => {
  try {
    const { denunciado_id, trabajo_id, tipo, categoria, descripcion, evidencia_urls } = req.body;
    const d = await createDenuncia({
      denuncianteId: req.usuario.id,
      denunciadoId: denunciado_id || null,
      trabajoId: trabajo_id || null,
      tipo,
      categoria,
      descripcion,
      evidenciaUrls: evidencia_urls || []
    });
    successResponse(res, { denuncia: d }, 201);
  } catch (err) {
    next(err);
  }
};

const getAll = async (req, res, next) => {
  try {
    successResponse(res, { denuncias: await getDenuncias(req.query.estado || null) });
  } catch (err) {
    next(err);
  }
};

const resolver = async (req, res, next) => {
  try {
    const d = await resolverDenuncia({
      denunciaId: parseInt(req.params.id),
      moderadorId: req.usuario.id,
      estado: req.body.estado,
      resolucion: req.body.resolucion
    });
    successResponse(res, { denuncia: d });
  } catch (err) {
    next(err);
  }
};

module.exports = { create, getAll, resolver };
