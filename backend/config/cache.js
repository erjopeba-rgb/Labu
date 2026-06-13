/**
 * Interfaz de caché — usa Redis si REDIS_URL está configurado, Map en memoria si no.
 * El contrato de la interfaz es idéntico en ambos casos.
 */

const logger = require("./logger");

// ── Implementación en memoria (fallback) ──────────────────────────────────────
// { key -> { value, expiresAt: timestamp ms | null } }
const store = new Map();

// Eviction periódica: elimina keys expiradas del Map para evitar acumulación indefinida
// Solo aplica al fallback en memoria; Redis gestiona TTL por sí mismo.
setInterval(() => {
  const ahora = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt !== null && ahora > entry.expiresAt) store.delete(key);
  }
}, 5 * 60 * 1000).unref();

const memGet = (key) => {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
};

const memSet = (key, value, ttlSeconds = null) => {
  store.set(key, {
    value,
    expiresAt: ttlSeconds !== null ? Date.now() + ttlSeconds * 1000 : null,
  });
};

const memDel = (key) => store.delete(key);
const memFlush = () => store.clear();

// Elimina todas las keys que coincidan con un prefijo (para invalidación por patrón)
const memDelPattern = (pattern) => {
  const prefix = pattern.replace(/\*$/, "");
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
};

// ── Implementación Redis ───────────────────────────────────────────────────────
let redisClient = null;

if (process.env.REDIS_URL) {
  const Redis = require("ioredis");
  redisClient = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    connectTimeout: 3000,
    maxRetriesPerRequest: 2,
  });

  redisClient.connect().catch((err) => {
    logger.warn({ err: err.message }, "[cache] No se pudo conectar a Redis — usando caché en memoria");
    redisClient = null;
  });

  redisClient.on("error", (err) => {
    logger.warn({ err: err.message }, "[cache] Error de Redis — usando caché en memoria");
    redisClient = null;
  });
}

// ── Interfaz pública ──────────────────────────────────────────────────────────
const get = async (key) => {
  if (redisClient) {
    try {
      const raw = await redisClient.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      logger.warn({ err: err.message, key }, "[cache.get] Redis falló, leyendo de memoria");
    }
  }
  return memGet(key);
};

const set = async (key, value, ttlSeconds = null) => {
  if (redisClient) {
    try {
      if (ttlSeconds !== null) {
        await redisClient.set(key, JSON.stringify(value), "EX", ttlSeconds);
      } else {
        await redisClient.set(key, JSON.stringify(value));
      }
      return;
    } catch (err) {
      logger.warn({ err: err.message, key }, "[cache.set] Redis falló, escribiendo en memoria");
    }
  }
  memSet(key, value, ttlSeconds);
};

const del = async (key) => {
  if (redisClient) {
    try {
      await redisClient.del(key);
      return;
    } catch (err) {
      logger.warn({ err: err.message, key }, "[cache.del] Redis falló");
    }
  }
  memDel(key);
};

// Elimina todas las keys que coincidan con un patrón tipo "prefijo:*"
const delPattern = async (pattern) => {
  if (redisClient) {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) await redisClient.del(...keys);
      return;
    } catch (err) {
      logger.warn({ err: err.message, pattern }, "[cache.delPattern] Redis falló, limpiando memoria");
    }
  }
  memDelPattern(pattern);
};

const flush = async () => {
  if (redisClient) {
    try {
      await redisClient.flushdb();
      return;
    } catch (err) {
      logger.warn({ err: err.message }, "[cache.flush] Redis falló, limpiando memoria");
    }
  }
  memFlush();
};

// Script Lua: INCR + EXPIRE en una sola operación atómica.
// Evita que la key quede sin TTL si el proceso cae entre ambos comandos.
const LUA_INCR_EXPIRE = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
  return count
`;

// Incrementa una clave y devuelve el nuevo valor, garantizando TTL desde el primer INCR.
const incr = async (key, ttlSeconds = 60) => {
  if (redisClient) {
    try {
      const count = await redisClient.eval(LUA_INCR_EXPIRE, 1, key, String(ttlSeconds));
      return count;
    } catch (err) {
      logger.warn({ err: err.message, key }, "[cache.incr] Redis falló, usando memoria");
    }
  }
  const entry = store.get(key);
  const ahora = Date.now();
  if (!entry || (entry.expiresAt !== null && ahora > entry.expiresAt)) {
    store.set(key, { value: 1, expiresAt: ahora + ttlSeconds * 1000 });
    return 1;
  }
  entry.value += 1;
  return entry.value;
};

module.exports = { get, set, del, delPattern, flush, incr };
