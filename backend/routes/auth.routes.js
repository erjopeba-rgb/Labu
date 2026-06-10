const express = require("express");
const router = express.Router();
const { register, login, verificarSesion, cambiarPerfil, aceptarTyCController, olvideMiPassword, resetearPasswordController, verificarEmailController, reenviarVerificacionController, cambiarPasswordController } = require("../controllers/auth.controller");
const { verificarToken } = require("../middlewares/auth.middleware");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");

const validarRegistro = [
  body("email")
    .isEmail().withMessage("El email no es válido"),
  body("password")
    .isLength({ min: 8 }).withMessage("La contraseña debe tener al menos 8 caracteres"),
  body("tipo_perfil")
    .isIn(["dueno", "trabajador"]).withMessage("El tipo de perfil debe ser 'dueno' o 'trabajador'"),
  (req, res, next) => {
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
      return res.status(400).json({ errores: errores.array().map(e => e.msg) });
    }
    next();
  },
];

const esModoTest = process.env.NODE_ENV === "test";
const pasarAdelante = (_req, _res, next) => next();

const limiterLogin = esModoTest ? pasarAdelante : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Intentá de nuevo en 15 minutos" },
});

const limiterRegistro = esModoTest ? pasarAdelante : rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Intentá de nuevo en 60 minutos" },
});

const limiterRecuperacion = esModoTest ? pasarAdelante : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes de recuperación. Intentá de nuevo en 15 minutos" },
});

router.post("/register", limiterRegistro, validarRegistro, register);
router.post("/login", limiterLogin, login);
router.get("/verify", verificarToken, verificarSesion);
router.patch("/cambiar-perfil", verificarToken, cambiarPerfil);
router.post("/aceptar-tyc", verificarToken, aceptarTyCController);
router.post("/forgot-password", limiterRecuperacion, olvideMiPassword);
router.post("/reset-password", resetearPasswordController);
router.get("/verify-email", verificarEmailController);
router.post("/resend-verification", verificarToken, reenviarVerificacionController);
router.post("/change-password", verificarToken, cambiarPasswordController);

module.exports = router;