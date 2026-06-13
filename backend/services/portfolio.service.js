const logger = require("../config/logger");
const repo = require("../repositories/portfolio.repository");
const AppError = require("../utils/AppError");

const getPortfolio = (trabajadorId) => repo.findByTrabajador(trabajadorId);

const addPortfolioItem = async (datos) => {
    const item = await repo.insertItem(datos);
    return item;
};

const updatePortfolioItem = async (itemId, trabajadorId, datos) => {
    const item = await repo.updateItem(itemId, trabajadorId, datos);
    if (!item) throw new AppError("Item no encontrado o sin permiso", 404);
    return item;
};

const deletePortfolioItem = async (itemId, trabajadorId) => {
    const item = await repo.softDeleteItem(itemId, trabajadorId);
    if (!item) throw new AppError("Item no encontrado o sin permiso", 404);
};

const getHistorial = (trabajadorId) => repo.findHistorialByTrabajador(trabajadorId);

const registrarHistorial = (datos) => repo.upsertHistorial(datos);

const getCalendario = (trabajadorId, mes, anio) => repo.findCalendario(trabajadorId, mes, anio);

const addEvento = (datos) => repo.insertEvento(datos);

const getPortfolioFeed = (limit = 20, offset = 0) => repo.findFeed(limit, offset);

const crearPortfolioAutoDesdeJob = async (job, oferta, dueno_id) => {
    if (!job.foto_resultado_url) return;

    const fotosAntes = (() => {
        if (!job.fotos_urls) return [];
        if (Array.isArray(job.fotos_urls)) return job.fotos_urls;
        try { return JSON.parse(job.fotos_urls); } catch (_) { return []; }
    })();

    const itemBase = {
        trabajoId:      job.id,
        titulo:         job.titulo,
        descripcion:    job.texto_resultado || null,
        rubroId:        job.rubro_id || null,
        fotoAntesUrl:   fotosAntes.length > 0 ? fotosAntes[0] : null,
        fotoDespuesUrl: job.foto_resultado_url,
        fotosUrls:      null,
        videoUrl:       null,
        destacado:      false
    };

    const promises = [];
    if (oferta) {
        promises.push(
            addPortfolioItem({ ...itemBase, trabajadorId: oferta.trabajador_id })
                .catch(e => logger.error({ err: e.message }, 'Error creando portfolio automático'))
        );
    }
    promises.push(
        addPortfolioItem({ ...itemBase, trabajadorId: oferta ? oferta.trabajador_id : null, duenoId: dueno_id })
            .catch(e => logger.error({ err: e.message }, 'Error creando actividad automática del dueño'))
    );

    await Promise.all(promises);
};

module.exports = { getPortfolio, addPortfolioItem, updatePortfolioItem, deletePortfolioItem, getHistorial, registrarHistorial, getCalendario, addEvento, getPortfolioFeed, crearPortfolioAutoDesdeJob };
