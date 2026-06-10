const { randomUUID } = require("crypto");
const logger = require("../config/logger");
const { requestContext } = logger;

const requestLogger = (req, res, next) => {
    const requestId = randomUUID();
    req.requestId = requestId;

    const inicio = Date.now();

    res.once("finish", () => {
        const ctx = {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            ms: Date.now() - inicio,
            requestId,
        };
        if (req.usuario?.id) ctx.userId = req.usuario.id;
        logger.info(ctx, "request");
    });

    requestContext.run({ requestId }, next);
};

module.exports = requestLogger;
