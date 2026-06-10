/**
 * Fábrica de colas Bull.
 * Si REDIS_URL no está definido o Bull no puede conectar, las funciones encolarX hacen fallback directo.
 * En NODE_ENV=test: siempre retorna null (sin colas) para no romper la suite.
 */

const logger = require('./logger');

let Bull;
try { Bull = require('bull'); } catch (_) { Bull = null; }

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const _instancias = {};

const getQueue = (nombre) => {
    if (process.env.NODE_ENV === 'test') return null;
    if (!Bull) {
        logger.warn({ nombre }, '[queue] Bull no instalado — tareas ejecutadas síncronamente');
        return null;
    }

    if (!(nombre in _instancias)) {
        try {
            const q = new Bull(nombre, REDIS_URL, {
                redis: { maxRetriesPerRequest: 3, connectTimeout: 3000, enableOfflineQueue: true }
            });
            q.on('error', (err) => {
                logger.warn({ err: err.message, nombre }, '[queue] Error de cola Bull');
            });
            q.on('failed', (job, err) => {
                logger.error({ jobId: job.id, err: err.message, nombre }, '[queue] Job fallido');
            });
            _instancias[nombre] = q;
        } catch (err) {
            logger.warn({ err: err.message, nombre }, '[queue] No se pudo crear la cola');
            _instancias[nombre] = null;
        }
    }
    return _instancias[nombre];
};

const QUEUES = {
    EMAIL:     'rtype1:email',
    OSRM:      'rtype1:osrm',
    PORTFOLIO: 'rtype1:portfolio',
};

module.exports = { getQueue, QUEUES };
