const { getEstadisticas, getBadges, getAllBadges, actualizarEstadisticas, getComparativa } = require("../services/estadisticas.service");

const getMisEstadisticas = async (req, res) => {
  try {
    const data = await getEstadisticas(req.usuario.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getEstadisticasPublicas = async (req, res) => {
  try {
    const data = await getEstadisticas(parseInt(req.params.trabajador_id));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getMisBadges = async (req, res) => {
  try {
    const data = await getAllBadges(req.usuario.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getBadgesPublicos = async (req, res) => {
  try {
    const data = await getBadges(parseInt(req.params.trabajador_id));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getComparativaRubro = async (req, res) => {
  try {
    const rubroId = parseInt(req.params.rubro_id);
    const data = await getComparativa(req.usuario.id, rubroId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const recalcular = async (req, res) => {
  try {
    await actualizarEstadisticas(req.usuario.id);
    res.json({ mensaje: "Estadisticas actualizadas" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getMisEstadisticas, getEstadisticasPublicas, getMisBadges, getBadgesPublicos, getComparativaRubro, recalcular };
