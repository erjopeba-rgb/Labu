const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const ctrl = require("../controllers/disputas.controller");
const { verificarToken } = require("../middlewares/auth.middleware");
const { verificarNoSuspendido, verificarTyC } = require("../middlewares/seguridad.middleware");
const { uploadEvidencia } = require("../middlewares/upload.middleware");
const { manejarErrores, validarIdParam } = require("../middlewares/validacion.middleware");

const auth = [verificarToken, verificarNoSuspendido, verificarTyC];

const validarCrearDisputa = [
  body("trabajo_id")
    .isInt({ min: 1 }).withMessage("trabajo_id debe ser un número entero válido"),
  body("motivo")
    .trim()
    .notEmpty().withMessage("El motivo es obligatorio")
    .isLength({ max: 100 }).withMessage("El motivo no puede superar los 100 caracteres"),
  body("descripcion")
    .optional({ nullable: true })
    .isLength({ max: 2000 }).withMessage("La descripción no puede superar los 2000 caracteres"),
  body("evidencia_urls")
    .optional()
    .isArray().withMessage("evidencia_urls debe ser un array"),
  manejarErrores,
];

router.post("/",                     auth, validarCrearDisputa, ctrl.crear);
router.get("/mis-disputas",          auth, ctrl.getMisDisputas);
router.post("/:id/evidencia",        auth, validarIdParam("id"), uploadEvidencia, ctrl.subirEvidencia);

module.exports = router;
