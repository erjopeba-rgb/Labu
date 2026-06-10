const { createDenuncia, getDenuncias, resolverDenuncia } = require("../services/denuncias.service");

const create = async (req, res) => {
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
    res.status(201).json(d);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getAll = async (req, res) => {
  try {
    res.json(await getDenuncias(req.query.estado || null));
  } catch (err) {
    res.status(500).json({ error: "Error al obtener denuncias" });
  }
};

const resolver = async (req, res) => {
  try {
    const d = await resolverDenuncia({
      denunciaId: parseInt(req.params.id),
      moderadorId: req.usuario.id,
      estado: req.body.estado,
      resolucion: req.body.resolucion
    });
    res.json(d);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = { create, getAll, resolver };
