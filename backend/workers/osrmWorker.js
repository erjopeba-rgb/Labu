const { getQueue, QUEUES } = require('../config/queue');
const { agendarTrabajo } = require('../services/scheduling.service');
const notif = require('../services/notifications.service');
const logger = require('../config/logger');

const queue = getQueue(QUEUES.OSRM);

// Camino único para cola y fallback: agendarTrabajo calcula el slot bajo advisory lock
// por trabajador y persiste fecha_inicio + reserva confirmada en la misma transacción.
const _agendarYNotificar = async ({ trabajadorId, trabajoId, duenoId, tituloTrabajo }) => {
    const slot = await agendarTrabajo(trabajadorId, trabajoId);
    if (!slot) {
        logger.warn({ trabajoId }, '[osrmWorker] Sin slot disponible');
        return null;
    }

    if (tituloTrabajo) {
        await notif.notificarHorarioAutoAsignado(trabajadorId, tituloTrabajo, slot.cuando, trabajoId);
        await notif.notificarHorarioAutoAsignado(duenoId, tituloTrabajo, slot.cuando, trabajoId);
    }

    logger.info({ trabajoId, slot: slot.cuando }, '[osrmWorker] Horario asignado');
    return slot;
};

if (queue) {
    queue.process((job) => _agendarYNotificar(job.data));
    logger.info('[osrmWorker] Worker de agendamiento OSRM iniciado');
}

const _ejecutarAgendamiento = async (datos) => {
    try {
        await _agendarYNotificar(datos);
    } catch (err) {
        logger.error({ err: err.message, trabajoId: datos.trabajoId }, '[osrmWorker] Error en agendamiento fallback');
    }
};

/**
 * Encola el cálculo de slot OSRM + actualización de fecha_inicio + reserva confirmada + notificaciones.
 * Fallback: ejecuta fire-and-forget sin bloquear al llamador.
 * El horario llega al usuario vía notificación in-app en ambos casos.
 */
const encolarAgendamiento = async ({ trabajadorId, trabajoId, duenoId, tituloTrabajo }) => {
    if (queue) {
        try {
            await queue.add({ trabajadorId, trabajoId, duenoId, tituloTrabajo }, {
                attempts: 2,
                backoff: { type: 'exponential', delay: 2000 },
                removeOnComplete: 50,
                removeOnFail: 100,
            });
            return;
        } catch (err) {
            logger.warn({ err: err.message, trabajoId }, '[osrmWorker] Cola no disponible, ejecutando fallback');
        }
    }
    // Fire-and-forget: no bloquea la respuesta al cliente
    _ejecutarAgendamiento({ trabajadorId, trabajoId, duenoId, tituloTrabajo });
};

module.exports = { encolarAgendamiento };
