const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/pagos.controller");
const { verificarToken } = require("../middlewares/auth.middleware");
const { verificarNoSuspendido, verificarTyC } = require("../middlewares/seguridad.middleware");

const auth = [verificarToken, verificarNoSuspendido, verificarTyC];

// Config publica
router.get("/config", ctrl.getConfig);

// Desglose de comision antes de pagar
router.get("/desglose/trabajo/:trabajo_id", ...auth, ctrl.getDesglose);

// Iniciar pagos
router.post("/trabajo/:trabajo_id/pagar-directo", ...auth, ctrl.pagarDirecto);
router.post("/trabajo/:trabajo_id", ...auth, ctrl.iniciarPagoTrabajo);
router.post("/video/:video_id",     ...auth, ctrl.iniciarPagoVideo);

// Historial
router.get("/historial", ...auth, ctrl.getHistorial);

// Saldo y retiros (payout manual del trabajador)
router.get("/saldo",    ...auth, ctrl.getSaldo);
router.get("/retiros",  ...auth, ctrl.getMisRetiros);
router.post("/retiros", ...auth, ctrl.solicitarRetiro);

// Videos
router.get("/videos",                    ctrl.getVideos);
router.get("/videos/:video_id/acceso",   ...auth, ctrl.checkAccesoVideo);

// MercadoPago
router.post("/mp/webhook",  ctrl.verificarFirmaMP, ctrl.webhook);
router.get("/mp/callback",  ctrl.callback);

// Simulación de pago (solo development)
if (process.env.NODE_ENV === 'development') {
  router.post("/dev/aprobar/:trabajo_id", ...auth, ctrl.devAprobarPago);
}

module.exports = router;
