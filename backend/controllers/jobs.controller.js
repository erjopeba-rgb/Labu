const logger = require("../config/logger");
const { successResponse } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const { saveFile, generarNombreArchivo } = require("../config/storage");
const {
    obtenerTrabajos, crearTrabajo, obtenerTrabajoPorId, obtenerMisTrabajos,
    obtenerTrabajosAsignados, obtenerTrabajosConUsuario, agendarTrabajo,
    cancelarTrabajo, iniciarTrabajo,
    marcarCompletado, confirmarCompletado,
    agregarComentario, obtenerComentarios
} = require("../services/jobs.service");

const getJobs = async (req, res, next) => {
    try {
        const trabajador_id = req.usuario?.id || null;
        const jobs = await obtenerTrabajos({ ...req.query, trabajador_id });
        successResponse(res, { jobs, total: jobs.length });
    } catch (err) {
        next(err);
    }
};

const createJob = async (req, res, next) => {
    let body = req.body;
    if (body.data) {
        try { body = { ...JSON.parse(body.data) }; } catch (_) { /* mantener body original */ }
    }

    let { titulo, descripcion } = body;
    if (!titulo && !descripcion) {
        return next(new AppError("La descripción del trabajo es requerida", 400));
    }
    if (!titulo) titulo = descripcion;
    if (!descripcion) descripcion = titulo;

    let fotosUrls = [];
    if (req.files && req.files.length > 0) {
        fotosUrls = await Promise.all(
            req.files.map(f => saveFile(f.buffer, generarNombreArchivo(f.originalname), "jobs"))
        );
    }

    try {
        const job = await crearTrabajo({ dueno_id: req.usuario.id, ...body, titulo, descripcion, fotosUrls });
        successResponse(res, { job }, 201);
    } catch (err) {
        next(err);
    }
};

const getJobById = async (req, res, next) => {
    try {
        const job = await obtenerTrabajoPorId(req.params.id);
        successResponse(res, { job });
    } catch (err) {
        next(err);
    }
};

const getMyJobs = async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const page = parseInt(req.query.page) || 1;
        const offset = (page - 1) * limit;
        const { data, total } = await obtenerMisTrabajos(req.usuario.id, limit, offset);
        successResponse(res, { data, total, page, limit });
    } catch (err) {
        next(err);
    }
};

// GET /api/jobs/asignados → trabajos donde el usuario tiene una oferta aceptada
const getTrabajosAsignados = async (req, res, next) => {
    try {
        const jobs = await obtenerTrabajosAsignados(req.usuario.id);
        successResponse(res, { jobs });
    } catch (err) {
        next(err);
    }
};

const cancelJob = async (req, res, next) => {
    try {
        await cancelarTrabajo(req.params.id, req.usuario.id);
        successResponse(res, {});
    } catch (err) {
        next(err);
    }
};

const startJob = async (req, res, next) => {
    try {
        const { latitud, longitud } = req.body || {};
        const job = await iniciarTrabajo(req.params.id, req.usuario.id, latitud, longitud);
        successResponse(res, { job });
    } catch (err) {
        next(err);
    }
};

// Paso 6: Trabajador marca trabajo completado + sube foto
const completeJob = async (req, res, next) => {
    let fotoUrl = null;
    if (req.file) {
        fotoUrl = await saveFile(req.file.buffer, generarNombreArchivo(req.file.originalname), "jobs/resultados");
    }
    const textoResultado = req.body?.texto_resultado || null;

    try {
        const job = await marcarCompletado(req.params.id, req.usuario.id, fotoUrl, textoResultado);
        successResponse(res, { job });
    } catch (err) {
        next(err);
    }
};

// Paso 7: Dueño confirma que el trabajo está correcto
const confirmCompletedJob = async (req, res, next) => {
    try {
        const job = await confirmarCompletado(req.params.id, req.usuario.id);
        successResponse(res, { job });
    } catch (err) {
        next(err);
    }
};

// GET /api/jobs/con-usuario/:userId → trabajos en común con otro usuario
const getTrabajosConUsuario = async (req, res, next) => {
    try {
        const jobs = await obtenerTrabajosConUsuario(req.usuario.id, req.params.userId);
        successResponse(res, { jobs });
    } catch (err) {
        next(err);
    }
};

// PATCH /api/jobs/:id/agendar → guardar fecha_inicio acordada
const scheduleJob = async (req, res, next) => {
    try {
        const { fecha_inicio } = req.body;
        if (!fecha_inicio) throw new AppError('fecha_inicio es requerida', 400);
        const job = await agendarTrabajo(req.params.id, req.usuario.id, fecha_inicio);
        successResponse(res, { job });
    } catch (err) {
        next(err);
    }
};

const addComentario = async (req, res, next) => {
    const { contenido } = req.body || {};
    if (!contenido || !contenido.trim()) {
        return next(new AppError('El comentario no puede estar vacío', 400));
    }
    try {
        const comentario = await agregarComentario(req.params.id, req.usuario.id, contenido.trim());
        successResponse(res, { comentario }, 201);
    } catch (err) {
        next(err);
    }
};

const getComentarios = async (req, res, next) => {
    try {
        const comentarios = await obtenerComentarios(req.params.id);
        successResponse(res, { comentarios });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getJobs, createJob, getJobById, getMyJobs, getTrabajosAsignados,
    getTrabajosConUsuario, scheduleJob,
    cancelJob, startJob, completeJob, confirmCompletedJob,
    addComentario, getComentarios
};
