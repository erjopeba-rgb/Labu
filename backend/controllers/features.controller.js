const svc = require("../services/features.service");
const AppError = require("../utils/AppError");
const { successResponse } = require("../utils/apiResponse");

// ─── PLANNER ──────────────────────────────────────────────────────────────────

const getPlanners = async (req, res, next) => {
  try {
    successResponse(res, { planners: await svc.getPlanners(req.usuario.id) });
  } catch (err) {
    next(err);
  }
};

const getPlanner = async (req, res, next) => {
  try {
    successResponse(res, { planner: await svc.getPlanner(parseInt(req.params.id), req.usuario.id) });
  } catch (err) {
    next(err);
  }
};

const crearPlanner = async (req, res, next) => {
  try {
    const { nombre } = req.body;
    if (!nombre) throw new AppError("nombre es requerido", 400);
    successResponse(res, { planner: await svc.crearPlanner({ usuarioId: req.usuario.id, ...req.body }) }, 201);
  } catch (err) {
    next(err);
  }
};

const actualizarPlanner = async (req, res, next) => {
  try {
    successResponse(res, { planner: await svc.actualizarPlanner(parseInt(req.params.id), req.usuario.id, req.body) });
  } catch (err) {
    next(err);
  }
};

const eliminarPlanner = async (req, res, next) => {
  try {
    await svc.eliminarPlanner(parseInt(req.params.id), req.usuario.id);
    successResponse(res, { mensaje: "Planner eliminado" });
  } catch (err) {
    next(err);
  }
};

// ─── PROYECTOS ────────────────────────────────────────────────────────────────

const getProyectos = async (req, res, next) => {
  try {
    successResponse(res, { proyectos: await svc.getProyectos(req.usuario.id) });
  } catch (err) {
    next(err);
  }
};

const getProyecto = async (req, res, next) => {
  try {
    successResponse(res, { proyecto: await svc.getProyecto(parseInt(req.params.id), req.usuario.id) });
  } catch (err) {
    next(err);
  }
};

const crearProyecto = async (req, res, next) => {
  try {
    const { titulo } = req.body;
    if (!titulo) throw new AppError("titulo es requerido", 400);
    successResponse(res, { proyecto: await svc.crearProyecto({ duenioId: req.usuario.id, ...req.body }) }, 201);
  } catch (err) {
    next(err);
  }
};

const actualizarProyecto = async (req, res, next) => {
  try {
    successResponse(res, { proyecto: await svc.actualizarProyecto(parseInt(req.params.id), req.usuario.id, req.body) });
  } catch (err) {
    next(err);
  }
};

const agregarTrabajo = async (req, res, next) => {
  try {
    const { trabajo_id, orden, depende_de } = req.body;
    if (!trabajo_id) throw new AppError("trabajo_id es requerido", 400);
    successResponse(res, { trabajo_proyecto: await svc.agregarTrabajoProyecto(
      parseInt(req.params.id), req.usuario.id, trabajo_id, orden||0, depende_de||null
    ) }, 201);
  } catch (err) {
    next(err);
  }
};

// ─── HERRAMIENTAS ─────────────────────────────────────────────────────────────

const getHerramientas = async (req, res, next) => {
  try {
    const id = req.params.trabajador_id ? parseInt(req.params.trabajador_id) : req.usuario.id;
    successResponse(res, { herramientas: await svc.getHerramientas(id) });
  } catch (err) {
    next(err);
  }
};

const addHerramienta = async (req, res, next) => {
  try {
    const { nombre } = req.body;
    if (!nombre) throw new AppError("nombre es requerido", 400);
    successResponse(res, { herramienta: await svc.addHerramienta({ trabajadorId: req.usuario.id, ...req.body }) }, 201);
  } catch (err) {
    next(err);
  }
};

const updateHerramienta = async (req, res, next) => {
  try {
    successResponse(res, { herramienta: await svc.updateHerramienta(parseInt(req.params.id), req.usuario.id, req.body) });
  } catch (err) {
    next(err);
  }
};

const deleteHerramienta = async (req, res, next) => {
  try {
    await svc.deleteHerramienta(parseInt(req.params.id), req.usuario.id);
    successResponse(res, { mensaje: "Herramienta eliminada" });
  } catch (err) {
    next(err);
  }
};

// ─── VIDEOS ───────────────────────────────────────────────────────────────────

const subirVideo = async (req, res, next) => {
  try {
    const { titulo } = req.body;
    if (!titulo) throw new AppError("titulo es requerido", 400);
    successResponse(res, { video: await svc.subirVideo({ autorId: req.usuario.id, ...req.body }) }, 201);
  } catch (err) {
    next(err);
  }
};

const getMisVideos = async (req, res, next) => {
  try {
    successResponse(res, { videos: await svc.getMisVideos(req.usuario.id) });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPlanners, getPlanner, crearPlanner, actualizarPlanner, eliminarPlanner,
  getProyectos, getProyecto, crearProyecto, actualizarProyecto, agregarTrabajo,
  getHerramientas, addHerramienta, updateHerramienta, deleteHerramienta,
  subirVideo, getMisVideos
};
