const express = require("express");
const router = express.Router();
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

// Disponibilidad semanal del trabajador
router.get("/",                        verificarToken, obtenerDisponibilidad);
router.put("/",                        verificarToken, guardarDisponibilidad);
router.get("/trabajador/:id",          verificarToken, obtenerDisponibilidadTrabajador);
router.get("/trabajador/:id/ocupados", verificarToken, obtenerOcupadosTrabajador);

// Reservas tentativas
router.post("/reservas",                                    verificarToken, crearReservas);
router.get("/reservas/confirmadas",                         verificarToken, obtenerReservasConfirmadas);
router.get("/reservas/confirmadas-dueno",                   verificarToken, obtenerReservasConfirmadasDueno);
router.get("/reservas/oferta/:oferta_id",                   verificarToken, obtenerReservasOferta);
router.post("/reservas/:id/confirmar",                      verificarToken, confirmarSlot);
router.post("/reservas/oferta/:oferta_id/aceptar",          verificarToken, confirmarSlotDirectoCtrl);

module.exports = router;
