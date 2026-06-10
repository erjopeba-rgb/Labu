const svc            = require("../services/disputas.service");
const { uploadToS3 } = require("../services/upload.service");

const crear = async (req, res) => {
  try {
    const { trabajo_id, motivo, descripcion, evidencia_urls } = req.body;
    if (!trabajo_id || !motivo) {
      return res.status(400).json({ error: "trabajo_id y motivo son obligatorios" });
    }
    const disputa = await svc.crearDisputa({
      trabajoId:    parseInt(trabajo_id),
      iniciadorId:  req.usuario.id,
      motivo,
      descripcion:  descripcion || null,
      evidenciaUrls: evidencia_urls || [],
    });
    res.status(201).json({ success: true, disputa });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.error || err.message || "Error al crear la disputa" });
  }
};

const getMisDisputas = async (req, res) => {
  try {
    const disputas = await svc.getMisDisputas(req.usuario.id);
    res.json({ success: true, disputas });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener tus disputas" });
  }
};

const subirEvidencia = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "Se requiere al menos un archivo" });
        }
        const urls = await Promise.all(
            req.files.map(f => uploadToS3(f, "evidencia-disputas"))
        );
        const evidencia_urls = await svc.agregarEvidencia(parseInt(req.params.id), req.usuario.id, urls);
        res.json({ success: true, evidencia_urls });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.error || err.message || "Error al subir evidencia" });
    }
};

module.exports = { crear, getMisDisputas, subirEvidencia };
