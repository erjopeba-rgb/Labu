const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const { verificarToken } = require("../middlewares/auth.middleware");
const { verificarAdmin } = require("../middlewares/admin.middleware");
const { manejarErrores, validarIdParam } = require("../middlewares/validacion.middleware");
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
  getRetiros,
  resolverRetiro,
  getBackups,
  runManualBackup,
  downloadBackup,
} = require("../controllers/admin.controller");

// Todos los endpoints requieren token válido + rol admin
router.use(verificarToken, verificarAdmin);

const validarSuspension = [
  body("suspendido")
    .isBoolean().withMessage("suspendido debe ser booleano"),
  manejarErrores,
];

const validarResolverReporte = [
  body("accion")
    .isIn(["resolver", "desestimar"]).withMessage("accion debe ser 'resolver' o 'desestimar'"),
  manejarErrores,
];

const validarUpdateConfig = [
  body("updates")
    .isArray({ min: 1 }).withMessage("updates debe ser un array con al menos un item"),
  body("updates.*.clave")
    .notEmpty().withMessage("Cada update necesita una clave"),
  manejarErrores,
];

const validarRechazoVerificacion = [
  body("motivo")
    .trim()
    .notEmpty().withMessage("El motivo de rechazo es obligatorio"),
  manejarErrores,
];

const validarResolverDisputa = [
  body("resolucion")
    .trim()
    .notEmpty().withMessage("La resolución es obligatoria"),
  body("resultado")
    .isIn(["dueno", "trabajador"]).withMessage("resultado debe ser 'dueno' (reembolsar al dueño) o 'trabajador' (liberar el pago al trabajador)"),
  manejarErrores,
];

const validarResolverRetiro = [
  body("accion")
    .isIn(["pagado", "rechazado"]).withMessage("accion debe ser 'pagado' o 'rechazado'"),
  body("nota")
    .if(body("accion").equals("rechazado"))
    .trim()
    .notEmpty().withMessage("El motivo de rechazo es obligatorio"),
  manejarErrores,
];

router.get("/usuarios",                    getUsuarios);
router.patch("/usuarios/:id/suspender",    validarIdParam("id"), validarSuspension, suspenderUsuario);
router.get("/reportes",                    getReportes);
router.patch("/reportes/:id/resolver",     validarIdParam("id"), validarResolverReporte, resolverReporte);
router.get("/config",                      getConfig);
router.put("/config",                      validarUpdateConfig, updateConfig);
router.get("/verificaciones",              getVerificaciones);
router.patch("/verificaciones/:id/aprobar",  validarIdParam("id"), aprobarVerificacion);
router.patch("/verificaciones/:id/rechazar", validarIdParam("id"), validarRechazoVerificacion, rechazarVerificacion);
router.get("/disputas",                      getDisputas);
router.patch("/disputas/:id/en-revision",    validarIdParam("id"), marcarDisputaEnRevision);
router.patch("/disputas/:id/resolver",       validarIdParam("id"), validarResolverDisputa, resolverDisputaAdmin);
router.get("/errores",                       getErrores);
router.get("/retiros",                       getRetiros);
router.patch("/retiros/:id/resolver",        validarIdParam("id"), validarResolverRetiro, resolverRetiro);
router.get("/backups",                       getBackups);
router.post("/backups/run",                  runManualBackup);
router.get("/backups/:filename",             downloadBackup);

module.exports = router;
