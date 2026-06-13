const { completarPerfil, actualizarAvatar, obtenerPerfil, obtenerPerfilPublico } = require("../services/profile.service");
const { saveFile, generarNombreArchivo } = require("../config/storage");
const AppError = require("../utils/AppError");
const { successResponse } = require("../utils/apiResponse");

const completeProfile = async (req, res, next) => {
    try {
        const { nombre } = req.body;
        if (!nombre) throw new AppError("El nombre es requerido", 400);

        // rubros y zonas vienen como JSON string desde el form
        let rubros = req.body.rubros;
        let zonas  = req.body.zonas;
        if (typeof rubros === 'string') {
            try { rubros = JSON.parse(rubros); } catch { rubros = []; }
        }
        if (typeof zonas === 'string') {
            try { zonas = JSON.parse(zonas); } catch { zonas = []; }
        }

        const perfil = await completarPerfil({
            usuario_id: req.usuario.id,
            ...req.body,
            rubros,
            zonas
        });
        successResponse(res, { perfil });
    } catch (err) {
        next(err);
    }
};

const uploadProfileAvatar = async (req, res, next) => {
    try {
        if (!req.file) throw new AppError("No se recibió ninguna imagen", 400);

        const avatar_url = await saveFile(req.file.buffer, generarNombreArchivo(req.file.originalname), "avatars");
        await actualizarAvatar(req.usuario.id, avatar_url);
        successResponse(res, { avatar_url });
    } catch (err) {
        next(err);
    }
};

const getProfile = async (req, res, next) => {
    try {
        const perfil = await obtenerPerfil(req.usuario.id);
        successResponse(res, { perfil });
    } catch (err) {
        next(err);
    }
};

const getPublicProfile = async (req, res, next) => {
    try {
        const data = await obtenerPerfilPublico(parseInt(req.params.id));
        if (!data) throw new AppError("Perfil no encontrado", 404);
        successResponse(res, data);
    } catch (err) {
        next(err);
    }
};

module.exports = { completeProfile, uploadProfileAvatar, getProfile, getPublicProfile };
