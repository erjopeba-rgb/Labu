const express = require("express");
const router  = express.Router();
const { verificarToken } = require("../middlewares/auth.middleware");
const { verificarNoSuspendido } = require("../middlewares/seguridad.middleware");
const { uploadVerificacion } = require("../middlewares/upload.middleware");
const { solicitar, getEstado } = require("../controllers/verificacion.controller");

// Solo verificarNoSuspendido (sin verificarTyC para no bloquear el flujo de onboarding)
router.use(verificarToken, verificarNoSuspendido);

// GET  /api/verificacion/estado  → estado actual del usuario
router.get("/estado", getEstado);

// POST /api/verificacion/solicitar → sube 3 fotos y crea solicitud
router.post("/solicitar", uploadVerificacion, solicitar);

module.exports = router;
