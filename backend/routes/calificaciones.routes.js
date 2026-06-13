const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const { calificar, getCalificaciones } = require("../controllers/calificaciones.controller");
const { verificarToken } = require("../middlewares/auth.middleware");
const { verificarNoSuspendido, verificarTyC } = require("../middlewares/seguridad.middleware");
const { manejarErrores, validarIdParam } = require("../middlewares/validacion.middleware");

const validarCalificacion = [
  body("puntaje")
    .isFloat({ min: 1, max: 5 }).withMessage("El puntaje debe estar entre 1 y 5"),
  body("comentario")
    .optional({ nullable: true })
    .isLength({ max: 1000 }).withMessage("El comentario no puede superar los 1000 caracteres"),
  manejarErrores,
];

router.post("/trabajo/:trabajo_id", verificarToken, verificarNoSuspendido, verificarTyC, validarIdParam("trabajo_id"), validarCalificacion, calificar);
router.get("/usuario/:usuario_id", validarIdParam("usuario_id"), getCalificaciones);

module.exports = router;
