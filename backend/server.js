require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const { iniciarSocket } = require("./socket");
const AppError = require("./utils/AppError");

const app = express();
const httpServer = http.createServer(app);

// Headers de seguridad (M8). El CSP está afinado para NO romper la app actual:
//  - script-src/style-src 'unsafe-inline': el frontend tiene ~600 usos de inline
//    (<script>, <style>, onclick=, style="...") — ver M4 del AUDIT. TODO: cuando se
//    mueva ese inline a /js/modules y /css, endurecer a nonces/hashes y sacar 'unsafe-inline'.
//  - script-src-attr 'unsafe-inline': sin esto el default 'none' de helmet bloquea todos
//    los handlers onclick= del HTML.
//  - unpkg.com / cdnjs.cloudflare.com: Leaflet (JS y CSS) en feed y búsqueda avanzada.
//  - connect-src ws:/wss': transporte WebSocket de Socket.io (mismo origen, http y https).
//    nominatim.openstreetmap.org: geocoding inverso al publicar trabajo.
//  - img-src https: + data: + blob': tiles de OpenStreetMap, uploads en S3 y avatares.
//  - upgrade-insecure-requests desactivado: en dev la app corre sobre http://localhost y
//    forzar https rompería la carga de los assets same-origin.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdnjs.cloudflare.com"],
      "script-src-attr": ["'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdnjs.cloudflare.com"],
      "img-src": ["'self'", "data:", "blob:", "https:"],
      "connect-src": ["'self'", "ws:", "wss:", "https://nominatim.openstreetmap.org"],
      "upgrade-insecure-requests": null,
    },
  },
}));

const origenesPermitidos = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map(o => o.trim());
app.use(cors({ origin: origenesPermitidos }));
app.use(express.json());
app.use(require("./middlewares/requestLogger.middleware"));

app.use(require("./middlewares/apiVersion.middleware"));

app.use(express.static(path.join(__dirname, "../frontend/public")));
app.use(express.static(path.join(__dirname, "../frontend/views")));

const rateLimitGlobal = require("./middlewares/rateLimitGlobal.middleware");
app.use("/api", rateLimitGlobal);

const v1Router = require("./routes/v1.router");
app.use("/api/v1", v1Router);
app.use("/api",    v1Router);

// 404 JSON para rutas /api desconocidas (M7) — formato unificado vía errorHandler global
app.use("/api", (req, res, next) => next(new AppError("Ruta no encontrada", 404)));

const errorHandler = require("./middlewares/errorHandler.middleware");
app.use(errorHandler);

// Registrar workers de Bull (se inicializan al importar)
require("./workers/emailWorker");
require("./workers/osrmWorker");
require("./workers/portfolioWorker");

// Job de backup automático (excluido en tests)
if (process.env.NODE_ENV !== "test") {
  require("./jobs/backup.job");
}

const logger = require("./config/logger");
const PORT = process.env.PORT || 3000;

(async () => {
  const io = await iniciarSocket(httpServer);
  app.set("io", io);
  httpServer.listen(PORT, () => logger.info({ port: PORT }, `Servidor en http://localhost:${PORT}`));
})();
