const logger = require('../config/logger');
const AppError = require('../utils/AppError');
const pool = require('../config/db');

const isDev = process.env.NODE_ENV === 'development';

const guardarErrorEnDB = (err, req) => {
    const usuarioId = req.usuario?.id || null;
    pool.query(
        `INSERT INTO error_logs (mensaje, stack, url, metodo, usuario_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
            err.message || 'Error sin mensaje',
            err.stack || null,
            req.originalUrl || req.path || null,
            req.method || null,
            usuarioId,
        ]
    ).catch((dbErr) => {
        logger.error({ err: dbErr }, 'No se pudo guardar el error en error_logs');
    });
};

const errorHandler = (err, req, res, next) => {
    // Violación de unicidad de PostgreSQL (unique constraint)
    if (err.code === '23505') {
        return res.status(409).json({ success: false, error: 'Ya existe un registro con estos datos' });
    }

    // Error operacional conocido (AppError)
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ success: false, error: err.message });
    }

    // Compatibilidad con objetos { status, error } lanzados por services aún no migrados
    if (err.status && err.error) {
        return res.status(err.status).json({ success: false, error: err.error });
    }

    // Error inesperado: loguear, guardar en DB y no exponer detalles internos en producción
    logger.error({ err, path: req.path, method: req.method }, 'Error inesperado en el servidor');
    if (process.env.NODE_ENV !== 'test') {
        guardarErrorEnDB(err, req);
    }
    const respuesta = { success: false, error: 'Error interno del servidor' };
    if (isDev) {
        respuesta.message = err.message;
        respuesta.stack = err.stack;
    }
    return res.status(500).json(respuesta);
};

module.exports = errorHandler;
