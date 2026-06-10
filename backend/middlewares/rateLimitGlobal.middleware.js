/**
 * Rate limiting global usando Redis (con fallback en memoria).
 *
 * Límites por ventana de 60 segundos:
 *   - 100 req/min para métodos de lectura (GET, HEAD, OPTIONS)
 *   - 30 req/min para métodos de escritura (POST, PUT, PATCH, DELETE)
 *
 * Identificación: ID de usuario (JWT) si está autenticado, IP si no.
 * Desactivado en NODE_ENV=test.
 */

const jwt = require("jsonwebtoken");
const cache = require("../config/cache");
const logger = require("../config/logger");

const VENTANA_SEGUNDOS = 60;
const LIMITE_GENERAL = 100;
const LIMITE_ESCRITURA = 30;
const METODOS_ESCRITURA = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Prefijos explícitos para evitar colisiones de claves en el store compartido
const PREFIX_RL = "rl:";
const PREFIX_USER = "u:";
const PREFIX_IP = "ip:";

const rateLimitGlobal = async (req, res, next) => {
  if (process.env.NODE_ENV === "test") return next();

  // Usar req.usuario si ya fue seteado por verificarTokenOpcional; si no, soft-parse el JWT.
  // Evita verificar el token dos veces cuando ambos middlewares corren en el mismo request.
  let identificador;
  if (req.usuario?.id) {
    identificador = `${PREFIX_USER}${req.usuario.id}`;
  } else {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        identificador = `${PREFIX_USER}${decoded.id}`;
      } catch (_) {}
    }
  }
  if (!identificador) {
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    identificador = `${PREFIX_IP}${ip}`;
  }

  const esEscritura = METODOS_ESCRITURA.has(req.method);
  const limite = esEscritura ? LIMITE_ESCRITURA : LIMITE_GENERAL;
  const tipo = esEscritura ? "w" : "r";

  // Clave única por identificador + ventana de tiempo + tipo
  const ventana = Math.floor(Date.now() / (VENTANA_SEGUNDOS * 1000));
  const clave = `${PREFIX_RL}${identificador}:${ventana}:${tipo}`;

  try {
    const contador = await cache.incr(clave, VENTANA_SEGUNDOS);

    if (contador > limite) {
      const msTranscurridos = Date.now() % (VENTANA_SEGUNDOS * 1000);
      const retryAfter = Math.ceil((VENTANA_SEGUNDOS * 1000 - msTranscurridos) / 1000);
      logger.warn(
        { identificador, metodo: req.method, ruta: req.path, contador, limite },
        "[rateLimitGlobal] Límite de solicitudes superado"
      );
      res.setHeader("Retry-After", retryAfter);
      return res.status(429).json({
        success: false,
        error: `Demasiadas solicitudes. Intenta de nuevo en ${retryAfter} segundos.`,
      });
    }
  } catch (err) {
    // Si el rate limiter falla, dejar pasar la solicitud (no bloquear el servicio)
    logger.warn({ err: err.message }, "[rateLimitGlobal] Error al verificar límite — omitiendo");
  }

  next();
};

module.exports = rateLimitGlobal;
