const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const ctrl = require("../controllers/pagos.controller");
const { verificarToken } = require("../middlewares/auth.middleware");
const { verificarNoSuspendido, verificarTyC } = require("../middlewares/seguridad.middleware");
const { manejarErrores, validarIdParam } = require("../middlewares/validacion.middleware");

const auth = [verificarToken, verificarNoSuspendido, verificarTyC];

const validarIniciarPago = [
  body("monto_total")
    .optional({ nullable: true })
    .isFloat({ min: 0.01 }).withMessage("monto_total debe ser un número positivo"),
  body("con_seguro")
    .optional()
    .isBoolean().withMessage("con_seguro debe ser booleano"),
  manejarErrores,
];

const validarPagoDirecto = [
  body("card_token")
    .notEmpty().withMessage("card_token es requerido"),
  body("payment_method_id")
    .notEmpty().withMessage("payment_method_id es requerido"),
  body("payer_email")
    .isEmail().withMessage("payer_email debe ser un email válido"),
  body("installments")
    .optional()
    .isInt({ min: 1, max: 24 }).withMessage("installments debe ser un entero entre 1 y 24"),
  manejarErrores,
];

const validarRetiro = [
  body("monto")
    .isFloat({ min: 0.01 }).withMessage("El monto del retiro debe ser un número positivo"),
  body("datos_cobro")
    .notEmpty().withMessage("Indicá CBU/CVU o alias para recibir la transferencia"),
  manejarErrores,
];

// Config publica
router.get("/config", ctrl.getConfig);

// Desglose de comision antes de pagar
router.get("/desglose/trabajo/:trabajo_id", ...auth, validarIdParam("trabajo_id"), ctrl.getDesglose);

// Iniciar pagos
router.post("/trabajo/:trabajo_id/pagar-directo", ...auth, validarIdParam("trabajo_id"), validarPagoDirecto, ctrl.pagarDirecto);
router.post("/trabajo/:trabajo_id", ...auth, validarIdParam("trabajo_id"), validarIniciarPago, ctrl.iniciarPagoTrabajo);
router.post("/video/:video_id",     ...auth, validarIdParam("video_id"), ctrl.iniciarPagoVideo);

// Historial
router.get("/historial", ...auth, ctrl.getHistorial);

// Saldo y retiros (payout manual del trabajador)
router.get("/saldo",    ...auth, ctrl.getSaldo);
router.get("/retiros",  ...auth, ctrl.getMisRetiros);
router.post("/retiros", ...auth, validarRetiro, ctrl.solicitarRetiro);

// Videos
router.get("/videos",                    ctrl.getVideos);
router.get("/videos/:video_id/acceso",   ...auth, validarIdParam("video_id"), ctrl.checkAccesoVideo);

// MercadoPago — el webhook NO lleva validación declarativa: su contrato con MP es
// 200 (procesado) / 500 (reintentar) y la firma HMAC ya filtra requests apócrifos
router.post("/mp/webhook",  ctrl.verificarFirmaMP, ctrl.webhook);
router.get("/mp/callback",  ctrl.callback);

// Simulación de pago (solo development)
if (process.env.NODE_ENV === 'development') {
  router.post("/dev/aprobar/:trabajo_id", ...auth, validarIdParam("trabajo_id"), ctrl.devAprobarPago);
}

module.exports = router;
