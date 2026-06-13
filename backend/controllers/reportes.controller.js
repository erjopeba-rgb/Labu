const { crearReporte } = require("../services/reportes.service");
const { successResponse } = require("../utils/apiResponse");

const crear = async (req, res, next) => {
  try {
    const { tipo, referencia_id, motivo } = req.body;
    await crearReporte({
      tipo,
      referenciaId: parseInt(referencia_id),
      reportadoPor: req.usuario.id,
      motivo,
    });
    successResponse(res, { mensaje: "Tu reporte fue enviado, lo revisaremos" }, 201);
  } catch (err) {
    next(err);
  }
};

module.exports = { crear };
