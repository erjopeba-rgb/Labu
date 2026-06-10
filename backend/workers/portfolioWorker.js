const { getQueue, QUEUES } = require('../config/queue');
const { crearPortfolioAutoDesdeJob } = require('../services/portfolio.service');
const logger = require('../config/logger');

const queue = getQueue(QUEUES.PORTFOLIO);

if (queue) {
    queue.process(async (job) => {
        const { trabajo, oferta, dueno_id } = job.data;
        await crearPortfolioAutoDesdeJob(trabajo, oferta, dueno_id);
        logger.info({ trabajoId: trabajo?.id }, '[portfolioWorker] Portfolio auto-creado');
    });
    logger.info('[portfolioWorker] Worker de portfolio iniciado');
}

/**
 * Encola la creación automática de portfolio al completar un trabajo.
 * Fallback: ejecuta síncronamente si la cola no está disponible.
 */
const encolarPortfolio = async (trabajo, oferta, dueno_id) => {
    if (queue) {
        try {
            await queue.add({ trabajo, oferta, dueno_id }, {
                attempts: 3,
                backoff: { type: 'exponential', delay: 1000 },
                removeOnComplete: 50,
                removeOnFail: 100,
            });
            return;
        } catch (err) {
            logger.warn({ err: err.message, trabajoId: trabajo?.id }, '[portfolioWorker] Cola no disponible, ejecutando directo');
        }
    }
    await crearPortfolioAutoDesdeJob(trabajo, oferta, dueno_id);
};

module.exports = { encolarPortfolio };
