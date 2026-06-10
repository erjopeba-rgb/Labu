const express = require("express");
const router = express.Router();
const { calificar, getCalificaciones } = require("../controllers/calificaciones.controller");
const { verificarToken } = require("../middlewares/auth.middleware");
const { verificarNoSuspendido, verificarTyC } = require("../middlewares/seguridad.middleware");

router.post("/trabajo/:trabajo_id", verificarToken, verificarNoSuspendido, verificarTyC, calificar);
router.get("/usuario/:usuario_id", getCalificaciones);

module.exports = router;
