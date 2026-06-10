const express = require("express");
const router = express.Router();
const { verificarToken } = require("../middlewares/auth.middleware");
const { verificarAdmin } = require("../middlewares/admin.middleware");
const {
  getUsuarios,
  suspenderUsuario,
  getReportes,
  resolverReporte,
  getConfig,
  updateConfig,
  getVerificaciones,
  aprobarVerificacion,
  rechazarVerificacion,
  getDisputas,
  marcarDisputaEnRevision,
  resolverDisputaAdmin,
  getErrores,
  getBackups,
  runManualBackup,
  downloadBackup,
} = require("../controllers/admin.controller");

// Todos los endpoints requieren token válido + rol admin
router.use(verificarToken, verificarAdmin);

router.get("/usuarios",                    getUsuarios);
router.patch("/usuarios/:id/suspender",    suspenderUsuario);
router.get("/reportes",                    getReportes);
router.patch("/reportes/:id/resolver",     resolverReporte);
router.get("/config",                      getConfig);
router.put("/config",                      updateConfig);
router.get("/verificaciones",              getVerificaciones);
router.patch("/verificaciones/:id/aprobar",  aprobarVerificacion);
router.patch("/verificaciones/:id/rechazar", rechazarVerificacion);
router.get("/disputas",                      getDisputas);
router.patch("/disputas/:id/en-revision",    marcarDisputaEnRevision);
router.patch("/disputas/:id/resolver",       resolverDisputaAdmin);
router.get("/errores",                       getErrores);
router.get("/backups",                       getBackups);
router.post("/backups/run",                  runManualBackup);
router.get("/backups/:filename",             downloadBackup);

module.exports = router;
