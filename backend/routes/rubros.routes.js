const express = require("express");
const router = express.Router();
const { getRubros } = require("../controllers/rubros.controller");
const { verificarToken } = require("../middlewares/auth.middleware");

router.get("/", verificarToken, getRubros);

module.exports = router;