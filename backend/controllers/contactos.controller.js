const svc = require("../services/contactos.service");

const getEstado = async (req, res) => {
    try {
        const data = await svc.getEstadoContacto(req.usuario.id, parseInt(req.params.userId));
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Error interno" });
    }
};

const solicitar = async (req, res) => {
    try {
        const io   = req.app.get("io");
        const data = await svc.enviarSolicitud(req.usuario.id, parseInt(req.params.userId), io);
        res.json({ success: true, ...data });
    } catch (err) {
        res.status(err.status || 409).json({ error: err.message || "Error interno" });
    }
};

const aceptar = async (req, res) => {
    try {
        const io   = req.app.get("io");
        const data = await svc.aceptarSolicitud(parseInt(req.params.id), req.usuario.id, io);
        res.json({ success: true, ...data });
    } catch (err) {
        res.status(400).json({ error: err.message || "Error interno" });
    }
};

const rechazar = async (req, res) => {
    try {
        const data = await svc.eliminarContacto(parseInt(req.params.id), req.usuario.id);
        res.json({ success: true, ...data });
    } catch (err) {
        res.status(400).json({ error: err.message || "Error interno" });
    }
};

const eliminar = async (req, res) => {
    try {
        const data = await svc.eliminarContacto(parseInt(req.params.id), req.usuario.id);
        res.json({ success: true, ...data });
    } catch (err) {
        res.status(400).json({ error: err.message || "Error interno" });
    }
};

const getConteos = async (req, res) => {
    try {
        const data = await svc.getConteos(parseInt(req.params.userId));
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Error interno" });
    }
};

const listarContactos = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const page = parseInt(req.query.page) || 1;
        const offset = (page - 1) * limit;
        const { data, total } = await svc.getMisContactos(req.usuario.id, limit, offset);
        res.json({ success: true, data, total, page, limit });
    } catch (err) {
        res.status(500).json({ error: "Error interno" });
    }
};

module.exports = { getEstado, solicitar, aceptar, rechazar, eliminar, getConteos, listarContactos };
