const express = require("express");
const router = express.Router();
const { getProductos, click, getEstadisticas, getBadgeCamara } = require("../controllers/equipate.controller");
const { verificarToken } = require("../middlewares/auth.middleware");

router.get("/",                    getProductos);
router.post("/:id/click",          click);
router.get("/estadisticas",        verificarToken, getEstadisticas);
router.get("/badge-camara",        verificarToken, getBadgeCamara);

module.exports = router;
