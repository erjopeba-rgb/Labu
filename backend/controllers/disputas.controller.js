const svc            = require("../services/disputas.service");
const { uploadToS3 } = require("../services/upload.service");
const AppError       = require("../utils/AppError");
const { successResponse } = require("../utils/apiResponse");

const crear = async (req, res, next) => {
  try {
    const { trabajo_id, motivo, descripcion, evidencia_urls } = req.body;
    if (!trabajo_id || !motivo) {
      throw new AppError("trabajo_id y motivo son obligatorios", 400);
    }
    const disputa = await svc.crearDisputa({
      trabajoId:    parseInt(trabajo_id),
      iniciadorId:  req.usuario.id,
      motivo,
      descripcion:  descripcion || null,
      evidenciaUrls: evidencia_urls || [],
    });
    successResponse(res, { disputa }, 201);
  } catch (err) {
    next(err);
  }
};

const getMisDisputas = async (req, res, next) => {
  try {
    const disputas = await svc.getMisDisputas(req.usuario.id);
    successResponse(res, { disputas });
  } catch (err) {
    next(err);
  }
};

const subirEvidencia = async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            throw new AppError("Se requiere al menos un archivo", 400);
        }
        const urls = await Promise.all(
            req.files.map(f => uploadToS3(f, "evidencia-disputas"))
        );
        const evidencia_urls = await svc.agregarEvidencia(parseInt(req.params.id), req.usuario.id, urls);
        successResponse(res, { evidencia_urls });
    } catch (err) {
        next(err);
    }
};

module.exports = { crear, getMisDisputas, subirEvidencia };
