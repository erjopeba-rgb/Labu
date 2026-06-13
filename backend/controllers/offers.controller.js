const {
    crearOferta, obtenerOfertasPorTrabajo, obtenerOfertaConDetalle,
    aceptarOferta, rechazarOferta,
    obtenerMisOfertas, cancelarOferta, contraofertar, aceptarContraoferta, rechazarContraoferta
} = require("../services/offers.service");
const { successResponse } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");

const createOffer = async (req, res, next) => {
    const { trabajo_id, monto_propuesto } = req.body;
    if (!trabajo_id || !monto_propuesto) {
        return next(new AppError("Trabajo y monto son requeridos", 400));
    }
    try {
        const oferta = await crearOferta({ trabajador_id: req.usuario.id, ...req.body });
        successResponse(res, { oferta }, 201);
    } catch (err) {
        next(err);
    }
};

const getOffersByJob = async (req, res, next) => {
    try {
        const ofertas = await obtenerOfertasPorTrabajo(req.params.trabajo_id);
        successResponse(res, { ofertas });
    } catch (err) {
        next(err);
    }
};

const acceptOffer = async (req, res, next) => {
    try {
        const result = await aceptarOferta(req.params.id, req.usuario.id);
        successResponse(res, result || {});
    } catch (err) {
        next(err);
    }
};

const rejectOffer = async (req, res, next) => {
    try {
        await rechazarOferta(req.params.id, req.usuario.id);
        successResponse(res, {});
    } catch (err) {
        next(err);
    }
};

const getMyOffers = async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const page = parseInt(req.query.page) || 1;
        const offset = (page - 1) * limit;
        const { data, total } = await obtenerMisOfertas(req.usuario.id, limit, offset);
        successResponse(res, { data, total, page, limit });
    } catch (err) {
        next(err);
    }
};

const cancelOffer = async (req, res, next) => {
    try {
        await cancelarOferta(req.params.id, req.usuario.id);
        successResponse(res, {});
    } catch (err) {
        next(err);
    }
};

const counterOffer = async (req, res, next) => {
    const { monto_contraoferta } = req.body;
    if (!monto_contraoferta) return next(new AppError("El monto de la contraoferta es requerido", 400));
    try {
        await contraofertar({ id: req.params.id, dueno_id: req.usuario.id, ...req.body });
        successResponse(res, {});
    } catch (err) {
        next(err);
    }
};

const acceptCounter = async (req, res, next) => {
    try {
        const result = await aceptarContraoferta(req.params.id, req.usuario.id);
        successResponse(res, result || {});
    } catch (err) {
        next(err);
    }
};

// Trabajador rechaza la contraoferta del dueño
const rejectCounter = async (req, res, next) => {
    try {
        await rechazarContraoferta(req.params.id, req.usuario.id);
        successResponse(res, {});
    } catch (err) {
        next(err);
    }
};

// GET /api/offers/detalle/:oferta_id — detalle completo para modal de notificación
const getOfferDetail = async (req, res, next) => {
    try {
        const oferta = await obtenerOfertaConDetalle(req.params.oferta_id);
        const userId = req.usuario.id;
        if (oferta.trabajador_id !== userId && oferta.dueno_id !== userId) {
            throw new AppError('No autorizado', 403);
        }
        successResponse(res, { oferta });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createOffer, getOffersByJob, getOfferDetail, acceptOffer, rejectOffer,
    getMyOffers, cancelOffer, counterOffer, acceptCounter, rejectCounter
};
