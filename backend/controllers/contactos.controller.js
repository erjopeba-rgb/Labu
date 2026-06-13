const svc = require("../services/contactos.service");
const { successResponse } = require("../utils/apiResponse");

const getEstado = async (req, res, next) => {
    try {
        const data = await svc.getEstadoContacto(req.usuario.id, parseInt(req.params.userId));
        successResponse(res, data);
    } catch (err) {
        next(err);
    }
};

const solicitar = async (req, res, next) => {
    try {
        const io   = req.app.get("io");
        const data = await svc.enviarSolicitud(req.usuario.id, parseInt(req.params.userId), io);
        successResponse(res, data);
    } catch (err) {
        next(err);
    }
};

const aceptar = async (req, res, next) => {
    try {
        const io   = req.app.get("io");
        const data = await svc.aceptarSolicitud(parseInt(req.params.id), req.usuario.id, io);
        successResponse(res, data);
    } catch (err) {
        next(err);
    }
};

const rechazar = async (req, res, next) => {
    try {
        const data = await svc.eliminarContacto(parseInt(req.params.id), req.usuario.id);
        successResponse(res, data);
    } catch (err) {
        next(err);
    }
};

const eliminar = async (req, res, next) => {
    try {
        const data = await svc.eliminarContacto(parseInt(req.params.id), req.usuario.id);
        successResponse(res, data);
    } catch (err) {
        next(err);
    }
};

const getConteos = async (req, res, next) => {
    try {
        const data = await svc.getConteos(parseInt(req.params.userId));
        successResponse(res, data);
    } catch (err) {
        next(err);
    }
};

const listarContactos = async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const page = parseInt(req.query.page) || 1;
        const offset = (page - 1) * limit;
        const { data, total } = await svc.getMisContactos(req.usuario.id, limit, offset);
        successResponse(res, { data, total, page, limit });
    } catch (err) {
        next(err);
    }
};

module.exports = { getEstado, solicitar, aceptar, rechazar, eliminar, getConteos, listarContactos };
