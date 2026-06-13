const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const {
    obtenerDisponibilidad,
    obtenerDisponibilidadTrabajador,
    guardarDisponibilidad,
    crearReservas,
    obtenerReservasOferta,
    confirmarSlot,
    confirmarSlotDirectoCtrl,
    obtenerReservasConfirmadas,
    obtenerReservasConfirmadasDueno,
    obtenerOcupadosTrabajador
} = require("../controllers/disponibilidad.controller");
const { verificarToken } = require("../middlewares/auth.middleware");
const { manejarErrores, validarIdParam, REGEX_HORA } = require("../middlewares/validacion.middleware");

const validarGuardarDisponibilidad = [
  body("slots")
    .isArray().withMessage("Se esperaba un array de slots"),
  body("slots.*.dia_semana")
    .isInt({ min: 0, max: 6 }).withMessage("dia_semana debe ser un entero entre 0 (lunes) y 6 (domingo)"),
  body("slots.*.hora_inicio")
    .matches(REGEX_HORA).withMessage("hora_inicio debe tener formato HH:MM"),
  body("slots.*.hora_fin")
    .matches(REGEX_HORA).withMessage("hora_fin debe tener formato HH:MM"),
  body("tiempo_preparacion_minutos")
    .optional({ nullable: true })
    .isInt({ min: 0 }).withMessage("tiempo_preparacion_minutos debe ser un entero mayor o igual a 0"),
  manejarErrores,
];

const validarCrearReservas = [
  body("oferta_id")
    .isInt({ min: 1 }).withMessage("oferta_id debe ser un número entero válido"),
  body("trabajo_id")
    .isInt({ min: 1 }).withMessage("trabajo_id debe ser un número entero válido"),
  body("slots")
    .isArray({ min: 1 }).withMessage("Se esperaba un array de slots con al menos un elemento"),
  body("slots.*.dia_semana")
    .isInt({ min: 0, max: 6 }).withMessage("dia_semana debe ser un entero entre 0 (lunes) y 6 (domingo)"),
  body("slots.*.hora_inicio")
    .matches(REGEX_HORA).withMessage("hora_inicio debe tener formato HH:MM"),
  body("slots.*.hora_fin")
    .matches(REGEX_HORA).withMessage("hora_fin debe tener formato HH:MM"),
  manejarErrores,
];

const validarConfirmarSlot = [
  body("hora_inicio")
    .optional({ nullable: true })
    .matches(REGEX_HORA).withMessage("hora_inicio debe tener formato HH:MM"),
  body("hora_fin")
    .optional({ nullable: true })
    .matches(REGEX_HORA).withMessage("hora_fin debe tener formato HH:MM"),
  body("fecha_inicio")
    .optional({ nullable: true })
    .isISO8601().withMessage("fecha_inicio debe ser una fecha ISO8601 válida"),
  manejarErrores,
];

const validarSlotDirecto = [
  body("dia_semana")
    .isInt({ min: 0, max: 6 }).withMessage("dia_semana debe ser un entero entre 0 (lunes) y 6 (domingo)"),
  body("hora_inicio")
    .matches(REGEX_HORA).withMessage("hora_inicio debe tener formato HH:MM"),
  body("hora_fin")
    .matches(REGEX_HORA).withMessage("hora_fin debe tener formato HH:MM"),
  body("fecha_inicio")
    .optional({ nullable: true })
    .isISO8601().withMessage("fecha_inicio debe ser una fecha ISO8601 válida"),
  manejarErrores,
];

// Disponibilidad semanal del trabajador
router.get("/",                        verificarToken, obtenerDisponibilidad);
router.put("/",                        verificarToken, validarGuardarDisponibilidad, guardarDisponibilidad);
router.get("/trabajador/:id",          verificarToken, validarIdParam("id"), obtenerDisponibilidadTrabajador);
router.get("/trabajador/:id/ocupados", verificarToken, validarIdParam("id"), obtenerOcupadosTrabajador);

// Reservas tentativas
router.post("/reservas",                                    verificarToken, validarCrearReservas, crearReservas);
router.get("/reservas/confirmadas",                         verificarToken, obtenerReservasConfirmadas);
router.get("/reservas/confirmadas-dueno",                   verificarToken, obtenerReservasConfirmadasDueno);
router.get("/reservas/oferta/:oferta_id",                   verificarToken, validarIdParam("oferta_id"), obtenerReservasOferta);
router.post("/reservas/:id/confirmar",                      verificarToken, validarIdParam("id"), validarConfirmarSlot, confirmarSlot);
router.post("/reservas/oferta/:oferta_id/aceptar",          verificarToken, validarIdParam("oferta_id"), validarSlotDirecto, confirmarSlotDirectoCtrl);

module.exports = router;
