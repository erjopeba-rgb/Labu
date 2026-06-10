const express = require("express");
const router = express.Router();
const {
    createOffer, getOffersByJob, getOfferDetail, acceptOffer, rejectOffer,
    getMyOffers, cancelOffer, counterOffer, acceptCounter, rejectCounter
} = require("../controllers/offers.controller");
const { verificarToken } = require("../middlewares/auth.middleware");
const { body, validationResult } = require("express-validator");

const manejarErrores = (req, res, next) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(400).json({ errores: errores.array().map(e => e.msg) });
  }
  next();
};

const validarCrearOferta = [
  body("monto_propuesto")
    .isFloat({ min: 0.01 }).withMessage("El monto propuesto debe ser un número positivo"),
  body("trabajo_id")
    .isInt({ min: 1 }).withMessage("El ID del trabajo debe ser un número entero válido"),
  manejarErrores,
];

const validarContraoferta = [
  body("monto_contraoferta")
    .isFloat({ min: 0.01 }).withMessage("El monto de la contraoferta debe ser un número positivo"),
  manejarErrores,
];

router.post("/",                       verificarToken, validarCrearOferta, createOffer);
router.get("/mis-ofertas",             verificarToken, getMyOffers);
router.get("/detalle/:oferta_id",      verificarToken, getOfferDetail);
router.get("/:trabajo_id",             verificarToken, getOffersByJob);
router.patch("/:id/accept",            verificarToken, acceptOffer);
router.patch("/:id/reject",            verificarToken, rejectOffer);
router.patch("/:id/cancel",            verificarToken, cancelOffer);
router.patch("/:id/counter",           verificarToken, validarContraoferta, counterOffer);
router.patch("/:id/accept-counter",    verificarToken, acceptCounter);
router.patch("/:id/reject-counter",    verificarToken, rejectCounter);

module.exports = router;
