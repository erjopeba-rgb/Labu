const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/confianza.controller");
const { verificarToken } = require("../middlewares/auth.middleware");

const auth = [verificarToken];

// ─── Público ─────────────────────────────────────────────────────────────────
// Nivel de confianza de cualquier usuario (sin login)
router.get("/nivel/:usuario_id", ctrl.getNivel);

// ─── Autenticado ──────────────────────────────────────────────────────────────
// Lista de trabajadores de confianza del dueño
router.get("/",                                          ...auth, ctrl.getLista);
router.post("/",                                         ...auth, ctrl.add);
router.delete("/:trabajador_id",                         ...auth, ctrl.remove);

// Historial compartido con un trabajador
router.get("/historial/:trabajador_id",                  ...auth, ctrl.getHistorial);

// Mantenimientos recurrentes
router.get("/mantenimientos",                            ...auth, ctrl.getMantenimientos);
router.post("/mantenimientos",                           ...auth, ctrl.crearMantenimiento);
router.patch("/mantenimientos/:id/vencimiento",          ...auth, ctrl.actualizarVencimiento);
router.delete("/mantenimientos/:id",                     ...auth, ctrl.eliminarMantenimiento);
router.get("/mantenimientos/vencimientos",               ...auth, ctrl.getVencimientos);

module.exports = router;
