const express = require("express");
const router = express.Router();
const {
    advertencias, confirmarAdv, checkAdv,
    getTyC, acceptTyC,
    getServiciosMod, resolverServicio,
    createGrabacion, getGrabacionesByTrabajo
} = require("../controllers/seguridad.controller");
const { verificarToken } = require("../middlewares/auth.middleware");

router.get("/advertencias",                              advertencias);
router.post("/advertencias/confirmar",    verificarToken, confirmarAdv);
router.get("/advertencias/:contratacion_id", verificarToken, checkAdv);
router.get("/tyc",                                       getTyC);
router.post("/tyc/aceptar",               verificarToken, acceptTyC);
router.get("/moderacion/servicios",       verificarToken, getServiciosMod);
router.post("/moderacion/:trabajo_id",    verificarToken, resolverServicio);
router.post("/grabaciones/:trabajo_id",   verificarToken, createGrabacion);
router.get("/grabaciones/:trabajo_id",    verificarToken, getGrabacionesByTrabajo);

module.exports = router;
