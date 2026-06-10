const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/chat.controller");
const { verificarToken } = require("../middlewares/auth.middleware");
const { verificarNoSuspendido, verificarTyC } = require("../middlewares/seguridad.middleware");
const { body, validationResult } = require("express-validator");

const auth = [verificarToken, verificarNoSuspendido, verificarTyC];

const manejarErrores = (req, res, next) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(400).json({ errores: errores.array().map(e => e.msg) });
  }
  next();
};

const validarIniciarConversacion = [
  body("participantes")
    .isArray({ min: 1, max: 50 }).withMessage("participantes debe ser un array de entre 1 y 50 elementos"),
  body("participantes.*")
    .isInt({ min: 1 }).withMessage("Cada participante debe ser un entero válido mayor a 0"),
  manejarErrores,
];

// Conversaciones
router.get("/",              ...auth, ctrl.getConversaciones);
router.post("/",             ...auth, validarIniciarConversacion, ctrl.iniciarConversacion);
router.get("/:id/mensajes",  ...auth, ctrl.getMensajes);
router.post("/:id/mensajes", ...auth, ctrl.enviarMensaje);

// Notificaciones
router.get("/notificaciones",              ...auth, ctrl.getNotificaciones);
router.get("/notificaciones/count",        ...auth, ctrl.getConteoNoLeidas);
router.patch("/notificaciones/:id/leer",   ...auth, ctrl.marcarLeida);
router.patch("/notificaciones/leer-todas", ...auth, ctrl.marcarTodasLeidas);

module.exports = router;
