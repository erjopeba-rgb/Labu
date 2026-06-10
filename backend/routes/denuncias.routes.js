const express = require("express");
const router = express.Router();
const { create, getAll, resolver } = require("../controllers/denuncias.controller");
const { verificarToken } = require("../middlewares/auth.middleware");

router.post("/",           verificarToken, create);
router.get("/",            verificarToken, getAll);
router.patch("/:id/resolver", verificarToken, resolver);

module.exports = router;
