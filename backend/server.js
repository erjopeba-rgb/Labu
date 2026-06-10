require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const { iniciarSocket } = require("./socket");

const app = express();
const httpServer = http.createServer(app);

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
