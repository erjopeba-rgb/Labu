const express = require("express");
const router = express.Router();
const {
  getPortfolioPublico, getMiPortfolio, addItem, updateItem, deleteItem,
  getHistorialPublico, getCalendarioTrabajador, addEventoCalendario,
  getPortfolioFeedController
} = require("../controllers/portfolio.controller");
const { verificarToken } = require("../middlewares/auth.middleware");
const { verificarNoSuspendido, verificarTyC } = require("../middlewares/seguridad.middleware");
const { uploadPortfolioMedia } = require("../middlewares/upload.middleware");

const auth = [verificarToken, verificarNoSuspendido, verificarTyC];

// Feed de portfolios (dueños ven trabajos realizados por trabajadores)
router.get("/feed", ...auth, getPortfolioFeedController);

// Portfolio publico
router.get("/trabajador/:trabajador_id",          getPortfolioPublico);
router.get("/trabajador/:trabajador_id/historial", getHistorialPublico);
router.get("/trabajador/:trabajador_id/calendario", getCalendarioTrabajador);

// Mi portfolio
router.get("/",        ...auth, getMiPortfolio);
router.post("/",       ...auth, (req, res, next) => uploadPortfolioMedia(req, res, next), addItem);
router.patch("/:id",   ...auth, updateItem);
router.delete("/:id",  ...auth, deleteItem);

// Mi calendario
router.post("/calendario", ...auth, addEventoCalendario);

module.exports = router;
