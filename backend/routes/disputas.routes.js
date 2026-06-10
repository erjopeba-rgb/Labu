const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/disputas.controller");
const { verificarToken } = require("../middlewares/auth.middleware");
const { verificarNoSuspendido, verificarTyC } = require("../middlewares/seguridad.middleware");
const { uploadEvidencia } = require("../middlewares/upload.middleware");

const auth = [verificarToken, verificarNoSuspendido, verificarTyC];

router.post("/",                     auth, ctrl.crear);
router.get("/mis-disputas",          auth, ctrl.getMisDisputas);
router.post("/:id/evidencia",        auth, uploadEvidencia, ctrl.subirEvidencia);

module.exports = router;
