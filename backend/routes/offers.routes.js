const express = require("express");
const router = express.Router();
const {
    createOffer, getOffersByJob, getOfferDetail, acceptOffer, rejectOffer,
    getMyOffers, cancelOffer, counterOffer, acceptCounter, rejectCounter
} = require("../controllers/offers.controller");
const { verificarToken } = require("../middlewares/auth.middleware");
const { body } = require("express-validator");
const { manejarErrores, validarIdParam } = require("../middlewares/validacion.middleware");

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
router.get("/detalle/:oferta_id",      verificarToken, validarIdParam("oferta_id"), getOfferDetail);
router.get("/:trabajo_id",             verificarToken, validarIdParam("trabajo_id"), getOffersByJob);
router.patch("/:id/accept",            verificarToken, validarIdParam("id"), acceptOffer);
router.patch("/:id/reject",            verificarToken, validarIdParam("id"), rejectOffer);
router.patch("/:id/cancel",            verificarToken, validarIdParam("id"), cancelOffer);
router.patch("/:id/counter",           verificarToken, validarIdParam("id"), validarContraoferta, counterOffer);
router.patch("/:id/accept-counter",    verificarToken, validarIdParam("id"), acceptCounter);
router.patch("/:id/reject-counter",    verificarToken, validarIdParam("id"), rejectCounter);

module.exports = router;
