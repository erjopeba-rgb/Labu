const express = require("express");
const router = express.Router();
const {
    getJobs, createJob, getJobById, getMyJobs, getTrabajosAsignados,
    getTrabajosConUsuario, scheduleJob,
    cancelJob, startJob, completeJob, confirmCompletedJob,
    addComentario, getComentarios
} = require("../controllers/jobs.controller");
const { verificarToken } = require("../middlewares/auth.middleware");
const { uploadJobMedia, uploadResultadoMedia } = require("../middlewares/upload.middleware");
const { body } = require("express-validator");
const { manejarErrores, validarIdParam } = require("../middlewares/validacion.middleware");

const parsearBodyData = (req, res, next) => {
    if (req.body && req.body.data) {
        try { Object.assign(req.body, JSON.parse(req.body.data)); } catch (_) {}
    }
    next();
};

const validarCrearJob = [
  body("titulo")
    .notEmpty().withMessage("El título no puede estar vacío")
    .isLength({ max: 100 }).withMessage("El título no puede superar los 100 caracteres"),
  body("descripcion")
    .notEmpty().withMessage("La descripción no puede estar vacía")
    .isLength({ max: 1000 }).withMessage("La descripción no puede superar los 1000 caracteres"),
  manejarErrores,
];

const validarIniciarJob = [
  body("latitud")
    .optional()
    .isFloat({ min: -90, max: 90 }).withMessage("La latitud debe ser un número entre -90 y 90"),
  body("longitud")
    .optional()
    .isFloat({ min: -180, max: 180 }).withMessage("La longitud debe ser un número entre -180 y 180"),
  manejarErrores,
];

const validarAgendarJob = [
  body("fecha_inicio")
    .notEmpty().withMessage("La fecha de inicio es requerida").bail()
    .isISO8601().withMessage("La fecha de inicio debe ser una fecha ISO8601 válida"),
  manejarErrores,
];

router.get("/",                        verificarToken, getJobs);
router.post("/",                       verificarToken, uploadJobMedia, parsearBodyData, validarCrearJob, createJob);
router.get("/mis-trabajos",            verificarToken, getMyJobs);
router.get("/asignados",               verificarToken, getTrabajosAsignados);
router.get("/con-usuario/:userId",     verificarToken, validarIdParam("userId"), getTrabajosConUsuario);

router.patch("/:id/agendar",             verificarToken, validarIdParam("id"), validarAgendarJob, scheduleJob);
router.patch("/:id/cancel",              verificarToken, validarIdParam("id"), cancelJob);
router.patch("/:id/iniciar",             verificarToken, validarIdParam("id"), validarIniciarJob, startJob);
router.patch("/:id/completar",           verificarToken, validarIdParam("id"), uploadResultadoMedia, completeJob);
router.patch("/:id/confirmar-completado",verificarToken, validarIdParam("id"), confirmCompletedJob);

router.get("/:id/comentarios",  verificarToken, validarIdParam("id"), getComentarios);
router.post("/:id/comentarios", verificarToken, validarIdParam("id"),
    body("contenido").notEmpty().withMessage("El comentario no puede estar vacío").isLength({ max: 1000 }).withMessage("El comentario no puede superar los 1000 caracteres"),
    manejarErrores,
    addComentario);

router.get("/:id", verificarToken, validarIdParam("id"), getJobById);

module.exports = router;
