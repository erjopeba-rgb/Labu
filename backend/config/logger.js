const pino = require("pino");
const { AsyncLocalStorage } = require("async_hooks");

// Store para propagar requestId por cada request HTTP
const requestContext = new AsyncLocalStorage();

let transport;
if (process.env.NODE_ENV === "development") {
    try {
        require.resolve("pino-pretty");
        transport = pino.transport({
            target: "pino-pretty",
            options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" }
        });
    } catch {
        // pino-pretty no instalado — usar salida JSON estándar
    }
}

const logger = pino(
    { level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug") },
    transport
);

// Devuelve child logger con requestId del request actual (si existe)
const getLogger = () => {
    const ctx = requestContext.getStore();
    return ctx ? logger.child(ctx) : logger;
};

module.exports = logger;
module.exports.getLogger = getLogger;
module.exports.requestContext = requestContext;
