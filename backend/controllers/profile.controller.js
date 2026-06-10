const { completarPerfil, actualizarAvatar, obtenerPerfil, obtenerPerfilPublico } = require("../services/profile.service");
const logger = require("../config/logger");
const { saveFile, generarNombreArchivo } = require("../config/storage");

const completeProfile = async (req, res) => {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: "El nombre es requerido" });

    // rubros y zonas vienen como JSON string desde el form
    let rubros = req.body.rubros;
    let zonas  = req.body.zonas;
    if (typeof rubros === 'string') {
        try { rubros = JSON.parse(rubros); } catch { rubros = []; }
    }
    if (typeof zonas === 'string') {
        try { zonas = JSON.parse(zonas); } catch { zonas = []; }
    }

    try {
        const perfil = await completarPerfil({
            usuario_id: req.usuario.id,
            ...req.body,
            rubros,
            zonas
        });
        res.json({ success: true, perfil });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.error || "Error interno del servidor" });
    }
};

const uploadProfileAvatar = async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No se recibió ninguna imagen" });

    try {
        const avatar_url = await saveFile(req.file.buffer, generarNombreArchivo(req.file.originalname), "avatars");
        await actualizarAvatar(req.usuario.id, avatar_url);
        res.json({ success: true, avatar_url });
    } catch (err) {
        res.status(500).json({ error: "Error al guardar la foto de perfil" });
    }
};

const getProfile = async (req, res) => {
    try {
        const perfil = await obtenerPerfil(req.usuario.id);
        res.json({ success: true, perfil });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.error || "Error interno" });
    }
};

const getPublicProfile = async (req, res) => {
    try {
        const data = await obtenerPerfilPublico(parseInt(req.params.id));
        if (!data) return res.status(404).json({ error: "Perfil no encontrado" });
        res.json({ success: true, ...data });
    } catch (err) {
        logger.error({ usuarioId: req.params.id, err: err.message }, '[getPublicProfile] Error en /api/users/:id/profile');
        res.status(500).json({ error: "Error interno" });
    }
};

module.exports = { completeProfile, uploadProfileAvatar, getProfile, getPublicProfile };
