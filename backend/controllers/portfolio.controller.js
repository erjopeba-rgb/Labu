const {
  getPortfolio, addPortfolioItem, updatePortfolioItem, deletePortfolioItem,
  getHistorial, registrarHistorial, getCalendario, addEvento, getPortfolioFeed
} = require("../services/portfolio.service");
const { saveFile, generarNombreArchivo } = require("../config/storage");

const getPortfolioPublico = async (req, res) => {
  try {
    res.json(await getPortfolio(parseInt(req.params.trabajador_id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getMiPortfolio = async (req, res) => {
  try {
    res.json(await getPortfolio(req.usuario.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const addItem = async (req, res) => {
  try {
    const { titulo, descripcion, trabajo_id, rubro_id, foto_antes_url, foto_despues_url, fotos_urls, video_url, destacado } = req.body;
    if (!titulo) return res.status(400).json({ error: "titulo es requerido" });

    let fotoAntesUrl  = foto_antes_url  || null;
    let fotoDespuesUrl = foto_despues_url || null;
    if (req.files) {
      if (req.files.foto_antes && req.files.foto_antes[0]) {
        const f = req.files.foto_antes[0];
        fotoAntesUrl  = await saveFile(f.buffer, generarNombreArchivo(f.originalname), "portfolio");
      }
      if (req.files.foto_despues && req.files.foto_despues[0]) {
        const f = req.files.foto_despues[0];
        fotoDespuesUrl = await saveFile(f.buffer, generarNombreArchivo(f.originalname), "portfolio");
      }
    }

    const item = await addPortfolioItem({
      trabajadorId: req.usuario.id,
      trabajoId: trabajo_id || null,
      titulo, descripcion,
      rubroId: rubro_id || null,
      fotoAntesUrl,
      fotoDespuesUrl,
      fotosUrls: fotos_urls || null,
      videoUrl: video_url || null,
      destacado: destacado || false
    });
    res.status(201).json({ success: true, item });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const updateItem = async (req, res) => {
  try {
    const item = await updatePortfolioItem(parseInt(req.params.id), req.usuario.id, req.body);
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const deleteItem = async (req, res) => {
  try {
    await deletePortfolioItem(parseInt(req.params.id), req.usuario.id);
    res.json({ mensaje: "Item eliminado del portfolio" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getHistorialPublico = async (req, res) => {
  try {
    res.json(await getHistorial(parseInt(req.params.trabajador_id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getCalendarioTrabajador = async (req, res) => {
  try {
    const mes = parseInt(req.query.mes) || new Date().getMonth() + 1;
    const anio = parseInt(req.query.anio) || new Date().getFullYear();
    res.json(await getCalendario(parseInt(req.params.trabajador_id), mes, anio));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const addEventoCalendario = async (req, res) => {
  try {
    const { trabajo_id, titulo, fecha_inicio, fecha_fin, rubro_id, tipo } = req.body;
    if (!titulo || !fecha_inicio) return res.status(400).json({ error: "titulo y fecha_inicio son requeridos" });
    const ev = await addEvento({
      trabajadorId: req.usuario.id,
      trabajoId: trabajo_id || null,
      titulo, fechaInicio: fecha_inicio, fechaFin: fecha_fin || null,
      rubroId: rubro_id || null, tipo: tipo || 'trabajo'
    });
    res.status(201).json(ev);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getPortfolioFeedController = async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit)  || 20, 50);
    const offset = parseInt(req.query.offset) || 0;
    const items  = await getPortfolioFeed(limit, offset);
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getPortfolioPublico, getMiPortfolio, addItem, updateItem, deleteItem, getHistorialPublico, getCalendarioTrabajador, addEventoCalendario, getPortfolioFeedController };
