const express = require("express");
const router = express.Router();
const {
    getMisEstadisticas, getEstadisticasPublicas,
    getMisBadges, getBadgesPublicos,
    getComparativaRubro, recalcular
} = require("../controllers/estadisticas.controller");
const { verificarToken } = require("../middlewares/auth.middleware");

router.get("/",                            verificarToken, getMisEstadisticas);
router.get("/badges",                      verificarToken, getMisBadges);
router.post("/recalcular",                 verificarToken, recalcular);
router.get("/comparativa/:rubro_id",       verificarToken, getComparativaRubro);
router.get("/trabajador/:trabajador_id",               getEstadisticasPublicas);
router.get("/trabajador/:trabajador_id/badges",        getBadgesPublicos);

module.exports = router;
