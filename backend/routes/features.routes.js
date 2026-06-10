const express = require("express");
const router = express.Router();
const {
    getPlanners, getPlanner, crearPlanner, actualizarPlanner, eliminarPlanner,
    getProyectos, getProyecto, crearProyecto, actualizarProyecto, agregarTrabajo,
    getHerramientas, addHerramienta, updateHerramienta, deleteHerramienta,
    subirVideo, getMisVideos
} = require("../controllers/features.controller");
const { verificarToken } = require("../middlewares/auth.middleware");

router.get("/planners",                    verificarToken, getPlanners);
router.get("/planners/:id",                verificarToken, getPlanner);
router.post("/planners",                   verificarToken, crearPlanner);
router.put("/planners/:id",                verificarToken, actualizarPlanner);
router.delete("/planners/:id",             verificarToken, eliminarPlanner);

router.get("/proyectos",                   verificarToken, getProyectos);
router.get("/proyectos/:id",               verificarToken, getProyecto);
router.post("/proyectos",                  verificarToken, crearProyecto);
router.put("/proyectos/:id",               verificarToken, actualizarProyecto);
router.post("/proyectos/:id/trabajos",     verificarToken, agregarTrabajo);

router.get("/herramientas",                verificarToken, getHerramientas);
router.get("/herramientas/trabajador/:trabajador_id", verificarToken, getHerramientas);
router.post("/herramientas",               verificarToken, addHerramienta);
router.put("/herramientas/:id",            verificarToken, updateHerramienta);
router.delete("/herramientas/:id",         verificarToken, deleteHerramienta);

router.post("/videos",                     verificarToken, subirVideo);
router.get("/videos/mios",                 verificarToken, getMisVideos);

module.exports = router;
