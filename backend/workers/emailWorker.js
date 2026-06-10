const { getQueue, QUEUES } = require('../config/queue');
const { enviarEmail } = require('../config/mailer');
const logger = require('../config/logger');

const queue = getQueue(QUEUES.EMAIL);

if (queue) {
    queue.process(async (job) => {
        const { to, subject, html } = job.data;
        const result = await enviarEmail({ to, subject, html });
        logger.info({ to, messageId: result.messageId }, '[emailWorker] Email enviado');
        return result;
    });
    logger.info('[emailWorker] Worker de emails iniciado');
}

/**
 * Encola un email para envío asíncrono.
 * Fallback: envía directamente si la cola no está disponible.
 */
const encolarEmail = async ({ to, subject, html }) => {
    if (queue) {
        try {
            await queue.add({ to, subject, html }, {
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
                removeOnComplete: 100,
                removeOnFail: 200,
            });
            return { messageId: 'queued', previewUrl: null };
        } catch (err) {
            logger.warn({ err: err.message, to }, '[emailWorker] Cola no disponible, enviando directo');
        }
    }
    return enviarEmail({ to, subject, html });
};

module.exports = { encolarEmail };
