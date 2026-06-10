const svc = require("../services/equipate.service");

const getProductos = async (req, res) => {
  try {
    const { rubro_id, destacado, limit, offset } = req.query;
    res.json(await svc.getProductosRecomendados({
      rubroId: rubro_id ? parseInt(rubro_id) : null,
      destacado: destacado === 'true',
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const click = async (req, res) => {
  try {
    await svc.registrarClick({
      productoRecomendadoId: parseInt(req.params.id),
      usuarioId: req.usuario?.id || null,
      ipAddress: req.ip
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getEstadisticas = async (req, res) => {
  try {
    const tienda = await require("../services/tienda.service").getPerfilTienda(req.usuario.id);
    if (!tienda) return res.status(404).json({ error: "Perfil de tienda no encontrado" });
    res.json(await svc.getEstadisticasEquipate(tienda.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getBadgeCamara = async (req, res) => {
  try {
    res.json(await svc.getBadgeCamara(req.usuario.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getProductos, click, getEstadisticas, getBadgeCamara };
