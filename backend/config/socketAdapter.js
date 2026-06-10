/**
 * Adapter de Socket.io para escala horizontal.
 * Usa el Redis adapter si REDIS_URL está configurado; sin-op si no.
 *
 * Sin el adapter, múltiples instancias del proceso no comparten rooms ni eventos —
 * esto importa cuando se usa PM2 cluster o se despliega en más de un servidor.
 */

const logger = require("./logger");

const buildAdapter = async () => {
  if (!process.env.REDIS_URL) return null;

  try {
    const { createAdapter } = require("@socket.io/redis-adapter");
    const Redis = require("ioredis");

    const pub = new Redis(process.env.REDIS_URL);
    const sub = pub.duplicate();

    await Promise.all([
      new Promise((resolve, reject) => {
        pub.once("ready", resolve);
        pub.once("error", reject);
      }),
      new Promise((resolve, reject) => {
        sub.once("ready", resolve);
        sub.once("error", reject);
      }),
    ]);

    logger.info("[socketAdapter] Redis adapter conectado");
    return createAdapter(pub, sub);
  } catch (err) {
    logger.warn({ err: err.message }, "[socketAdapter] No se pudo conectar Redis adapter — usando adapter en memoria");
    return null;
  }
};

module.exports = { buildAdapter };
