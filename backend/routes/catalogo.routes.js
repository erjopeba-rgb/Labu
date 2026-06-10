const express = require("express");
const router = express.Router();
const {
  getEstadisticas,
  getRubros, getTareas,
  getCatalogo, upsertItem, deleteItem,
  getPromedio, comparar,
  crearComprobante, verComprobante
} = require("../controllers/catalogo.controller");
const { verificarToken } = require("../middlewares/auth.middleware");
const { verificarNoSuspendido, verificarTyC } = require("../middlewares/seguridad.middleware");

const auth = [verificarToken, verificarNoSuspendido, verificarTyC];

// Rubros y tareas (publico)
router.get("/rubros/estadisticas",       getEstadisticas);
router.get("/rubros",                    getRubros);
router.get("/rubros/:rubro_id/tareas",   getTareas);

// Precios de referencia (publico)
router.get("/precios/:tarea_id",         getPromedio);
router.get("/precios/comparar",          comparar);

// Catalogo del trabajador
router.get("/mi-catalogo",              ...auth, getCatalogo);
router.post("/mi-catalogo",             ...auth, upsertItem);
router.delete("/mi-catalogo/:tarea_id", ...auth, deleteItem);

// Catalogo publico de un trabajador
router.get("/trabajador/:trabajador_id", getCatalogo);

// Comprobantes
router.post("/comprobante/trabajo/:trabajo_id", ...auth, crearComprobante);
router.get("/comprobante/trabajo/:trabajo_id",  ...auth, verComprobante);

module.exports = router;
