const express = require("express");
const router = express.Router();
const { crear } = require("../controllers/reportes.controller");
const { verificarToken } = require("../middlewares/auth.middleware");
const { body, validationResult } = require("express-validator");

const manejarErrores = (req, res, next) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(400).json({ errores: errores.array().map(e => e.msg) });
  }
  next();
};

const validarReporte = [
  body("tipo")
    .isIn(["comentario", "publicacion"])
    .withMessage("El tipo debe ser 'comentario' o 'publicacion'"),
  body("referencia_id")
    .isInt({ min: 1 })
    .withMessage("referencia_id debe ser un entero positivo"),
  body("motivo")
    .isIn(["contenido_inapropiado", "spam", "informacion_falsa", "otro"])
    .withMessage("Motivo no válido"),
  manejarErrores,
];

router.post("/", verificarToken, validarReporte, crear);

module.exports = router;
