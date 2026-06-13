const {
  getPortfolio, addPortfolioItem, updatePortfolioItem, deletePortfolioItem,
  getHistorial, registrarHistorial, getCalendario, addEvento, getPortfolioFeed
} = require("../services/portfolio.service");
const { saveFile, generarNombreArchivo } = require("../config/storage");
const AppError = require("../utils/AppError");
const { successResponse } = require("../utils/apiResponse");

const getPortfolioPublico = async (req, res, next) => {
  try {
    successResponse(res, { items: await getPortfolio(parseInt(req.params.trabajador_id)) });
  } catch (err) {
    next(err);
  }
};

const getMiPortfolio = async (req, res, next) => {
  try {
    successResponse(res, { items: await getPortfolio(req.usuario.id) });
  } catch (err) {
    next(err);
  }
};

const addItem = async (req, res, next) => {
  try {
    const { titulo, descripcion, trabajo_id, rubro_id, foto_antes_url, foto_despues_url, fotos_urls, video_url, destacado } = req.body;
    if (!titulo) throw new AppError("titulo es requerido", 400);

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
    successResponse(res, { item }, 201);
  } catch (err) {
    next(err);
  }
};

const updateItem = async (req, res, next) => {
  try {
    const item = await updatePortfolioItem(parseInt(req.params.id), req.usuario.id, req.body);
    successResponse(res, { item });
  } catch (err) {
    next(err);
  }
};

const deleteItem = async (req, res, next) => {
  try {
    await deletePortfolioItem(parseInt(req.params.id), req.usuario.id);
    successResponse(res, { mensaje: "Item eliminado del portfolio" });
  } catch (err) {
    next(err);
  }
};

const getHistorialPublico = async (req, res, next) => {
  try {
    successResponse(res, { historial: await getHistorial(parseInt(req.params.trabajador_id)) });
  } catch (err) {
    next(err);
  }
};

const getCalendarioTrabajador = async (req, res, next) => {
  try {
    const mes = parseInt(req.query.mes) || new Date().getMonth() + 1;
    const anio = parseInt(req.query.anio) || new Date().getFullYear();
    successResponse(res, { eventos: await getCalendario(parseInt(req.params.trabajador_id), mes, anio) });
  } catch (err) {
    next(err);
  }
};

const addEventoCalendario = async (req, res, next) => {
  try {
    const { trabajo_id, titulo, fecha_inicio, fecha_fin, rubro_id, tipo } = req.body;
    if (!titulo || !fecha_inicio) throw new AppError("titulo y fecha_inicio son requeridos", 400);
    const ev = await addEvento({
      trabajadorId: req.usuario.id,
      trabajoId: trabajo_id || null,
      titulo, fechaInicio: fecha_inicio, fechaFin: fecha_fin || null,
      rubroId: rubro_id || null, tipo: tipo || 'trabajo'
    });
    successResponse(res, { evento: ev }, 201);
  } catch (err) {
    next(err);
  }
};

const getPortfolioFeedController = async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit)  || 20, 50);
    const offset = parseInt(req.query.offset) || 0;
    const items  = await getPortfolioFeed(limit, offset);
    successResponse(res, { items });
  } catch (err) {
    next(err);
  }
};

module.exports = { getPortfolioPublico, getMiPortfolio, addItem, updateItem, deleteItem, getHistorialPublico, getCalendarioTrabajador, addEventoCalendario, getPortfolioFeedController };
