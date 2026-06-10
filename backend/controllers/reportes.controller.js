const { crearReporte } = require("../services/reportes.service");
const { getLogger } = require("../config/logger");

const crear = async (req, res) => {
  try {
    const { tipo, referencia_id, motivo } = req.body;
    await crearReporte({
      tipo,
      referenciaId: parseInt(referencia_id),
      reportadoPor: req.usuario.id,
      motivo,
    });
    res.status(201).json({ mensaje: "Tu reporte fue enviado, lo revisaremos" });
  } catch (err) {
    getLogger().error({ err }, "[ReportesController] crear fallido");
    res.status(err.status || 500).json({ error: err.error || "Error al enviar el reporte" });
  }
};

module.exports = { crear };
