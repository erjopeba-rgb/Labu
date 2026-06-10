const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/ayudantes.controller");
const { verificarToken } = require("../middlewares/auth.middleware");
const { verificarNoSuspendido, verificarTyC } = require("../middlewares/seguridad.middleware");

const auth = [verificarToken, verificarNoSuspendido, verificarTyC];

// Como lider: mis ayudantes aceptados
router.get("/mis-ayudantes",            auth, ctrl.misAyudantes);
// Como lider: mis solicitudes con aplicaciones pendientes
router.get("/mis-solicitudes",          auth, ctrl.misSolicitudesConAplicaciones);
// Como lider: crear solicitud para un trabajo
router.post("/trabajos/:trabajo_id",    auth, ctrl.crear);
// Como lider: aceptar o rechazar una aplicacion
router.patch("/aplicaciones/:aplicacion_id", auth, ctrl.responder);

// Buscar solicitudes abiertas para aplicar
router.get("/solicitudes",              auth, ctrl.getAbiertas);
router.get("/solicitudes/:id",          auth, ctrl.getById);
// Aplicar a una solicitud como ayudante
router.post("/solicitudes/:id/aplicar", auth, ctrl.aplicar);

module.exports = router;
