const express = require("express");
const router  = express.Router();
const { body } = require("express-validator");
const ctrl    = require("../controllers/confianza.controller");
const { verificarToken } = require("../middlewares/auth.middleware");
const { manejarErrores, validarIdParam } = require("../middlewares/validacion.middleware");

const auth = [verificarToken];

const validarAddConfianza = [
  body("trabajador_id")
    .isInt({ min: 1 }).withMessage("trabajador_id debe ser un número entero válido"),
  body("nota")
    .optional({ nullable: true })
    .isLength({ max: 500 }).withMessage("La nota no puede superar los 500 caracteres"),
  manejarErrores,
];

const validarCrearMantenimiento = [
  body("trabajador_id")
    .isInt({ min: 1 }).withMessage("trabajador_id debe ser un número entero válido"),
  body("titulo")
    .trim()
    .notEmpty().withMessage("El título es obligatorio")
    .isLength({ max: 100 }).withMessage("El título no puede superar los 100 caracteres"),
  body("frecuencia")
    .notEmpty().withMessage("La frecuencia es obligatoria"),
  body("proximo_vencimiento")
    .isISO8601().withMessage("proximo_vencimiento debe ser una fecha ISO8601 válida"),
  manejarErrores,
];

const validarActualizarVencimiento = [
  body("trabajo_id")
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage("trabajo_id debe ser un número entero válido"),
  manejarErrores,
];

// ─── Público ─────────────────────────────────────────────────────────────────
// Nivel de confianza de cualquier usuario (sin login)
router.get("/nivel/:usuario_id", validarIdParam("usuario_id"), ctrl.getNivel);

// ─── Autenticado ──────────────────────────────────────────────────────────────
// Lista de trabajadores de confianza del dueño
router.get("/",                                          ...auth, ctrl.getLista);
router.post("/",                                         ...auth, validarAddConfianza, ctrl.add);
router.delete("/:trabajador_id",                         ...auth, validarIdParam("trabajador_id"), ctrl.remove);

// Historial compartido con un trabajador
router.get("/historial/:trabajador_id",                  ...auth, validarIdParam("trabajador_id"), ctrl.getHistorial);

// Mantenimientos recurrentes
router.get("/mantenimientos",                            ...auth, ctrl.getMantenimientos);
router.post("/mantenimientos",                           ...auth, validarCrearMantenimiento, ctrl.crearMantenimiento);
router.patch("/mantenimientos/:id/vencimiento",          ...auth, validarIdParam("id"), validarActualizarVencimiento, ctrl.actualizarVencimiento);
router.delete("/mantenimientos/:id",                     ...auth, validarIdParam("id"), ctrl.eliminarMantenimiento);
router.get("/mantenimientos/vencimientos",               ...auth, ctrl.getVencimientos);

module.exports = router;
