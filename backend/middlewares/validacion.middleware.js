const { param, validationResult } = require("express-validator");

// Corta la cadena con 400 si alguna validación declarativa falló.
// Mismo formato de error que usan jobs/offers/auth routes: { errores: [...] }
const manejarErrores = (req, res, next) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(400).json({ errores: errores.array().map(e => e.msg) });
  }
  next();
};

// Valida que un parámetro de ruta sea un entero positivo.
// Evita que parseInt(req.params.x) → NaN llegue a las queries (error 500 de pg).
const validarIdParam = (nombre = "id") => [
  param(nombre)
    .isInt({ min: 1 }).withMessage(`El parámetro ${nombre} debe ser un número entero positivo`),
  manejarErrores,
];

// Formato de hora HH:MM o HH:MM:SS (para franjas de disponibilidad)
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

module.exports = { manejarErrores, validarIdParam, REGEX_HORA };
