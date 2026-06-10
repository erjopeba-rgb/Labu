const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/geolocalizacion.controller");
const { verificarToken } = require("../middlewares/auth.middleware");
const { verificarNoSuspendido, verificarTyC } = require("../middlewares/seguridad.middleware");

const auth = [verificarToken, verificarNoSuspendido, verificarTyC];

// Zonas del trabajador
router.get("/zonas",          ...auth, ctrl.getZonas);
router.put("/zonas",          ...auth, ctrl.setZonas);
router.post("/zonas",         ...auth, ctrl.addZona);
router.delete("/zonas/:id",   ...auth, ctrl.removeZona);

// Feed filtrado por zona
router.get("/feed",           ...auth, ctrl.getFeed);

// Busqueda con radio (publico)
router.get("/trabajadores",   ctrl.buscarTrabajadores);
router.get("/tiendas",        ctrl.buscarTiendas);

// Mapa de disponibilidad (publico)
router.get("/mapa",           ctrl.getMapa);

// Trabajadores cercanos - alias usado por sidebar y feed
router.get("/nearby",         ctrl.nearby);

// Actualizar ubicacion propia
router.patch("/ubicacion",    ...auth, ctrl.actualizarUbicacion);

module.exports = router;
