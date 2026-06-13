const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const ctrl = require("../controllers/ayudantes.controller");
const { verificarToken } = require("../middlewares/auth.middleware");
const { verificarNoSuspendido, verificarTyC } = require("../middlewares/seguridad.middleware");
const { manejarErrores, validarIdParam } = require("../middlewares/validacion.middleware");

const auth = [verificarToken, verificarNoSuspendido, verificarTyC];

const validarCrearSolicitud = [
  body("cantidad_necesaria")
    .isInt({ min: 1 }).withMessage("cantidad_necesaria debe ser un entero mayor a 0"),
  body("pago_por_ayudante")
    .isFloat({ min: 0.01 }).withMessage("pago_por_ayudante debe ser un número positivo"),
  body("descripcion")
    .optional({ nullable: true })
    .isLength({ max: 1000 }).withMessage("La descripción no puede superar los 1000 caracteres"),
  manejarErrores,
];

const validarResponderAplicacion = [
  body("estado")
    .isIn(["aceptado", "rechazado"]).withMessage("estado debe ser aceptado o rechazado"),
  manejarErrores,
];

// Como lider: mis ayudantes aceptados
router.get("/mis-ayudantes",            auth, ctrl.misAyudantes);
// Como lider: mis solicitudes con aplicaciones pendientes
router.get("/mis-solicitudes",          auth, ctrl.misSolicitudesConAplicaciones);
// Como lider: crear solicitud para un trabajo
router.post("/trabajos/:trabajo_id",    auth, validarIdParam("trabajo_id"), validarCrearSolicitud, ctrl.crear);
// Como lider: aceptar o rechazar una aplicacion
router.patch("/aplicaciones/:aplicacion_id", auth, validarIdParam("aplicacion_id"), validarResponderAplicacion, ctrl.responder);

// Buscar solicitudes abiertas para aplicar
router.get("/solicitudes",              auth, ctrl.getAbiertas);
router.get("/solicitudes/:id",          auth, validarIdParam("id"), ctrl.getById);
// Aplicar a una solicitud como ayudante
router.post("/solicitudes/:id/aplicar", auth, validarIdParam("id"), ctrl.aplicar);

module.exports = router;
