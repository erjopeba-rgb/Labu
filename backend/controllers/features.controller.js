const svc = require("../services/features.service");

// ─── PLANNER ──────────────────────────────────────────────────────────────────

const getPlanners = async (req, res) => {
  try {
    res.json(await svc.getPlanners(req.usuario.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getPlanner = async (req, res) => {
  try {
    res.json(await svc.getPlanner(parseInt(req.params.id), req.usuario.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

const crearPlanner = async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: "nombre es requerido" });
    res.status(201).json(await svc.crearPlanner({ usuarioId: req.usuario.id, ...req.body }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const actualizarPlanner = async (req, res) => {
  try {
    res.json(await svc.actualizarPlanner(parseInt(req.params.id), req.usuario.id, req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const eliminarPlanner = async (req, res) => {
  try {
    await svc.eliminarPlanner(parseInt(req.params.id), req.usuario.id);
    res.json({ mensaje: "Planner eliminado" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ─── PROYECTOS ────────────────────────────────────────────────────────────────

const getProyectos = async (req, res) => {
  try {
    res.json(await svc.getProyectos(req.usuario.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getProyecto = async (req, res) => {
  try {
    res.json(await svc.getProyecto(parseInt(req.params.id), req.usuario.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

const crearProyecto = async (req, res) => {
  try {
    const { titulo } = req.body;
    if (!titulo) return res.status(400).json({ error: "titulo es requerido" });
    res.status(201).json(await svc.crearProyecto({ duenioId: req.usuario.id, ...req.body }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const actualizarProyecto = async (req, res) => {
  try {
    res.json(await svc.actualizarProyecto(parseInt(req.params.id), req.usuario.id, req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const agregarTrabajo = async (req, res) => {
  try {
    const { trabajo_id, orden, depende_de } = req.body;
    if (!trabajo_id) return res.status(400).json({ error: "trabajo_id es requerido" });
    res.status(201).json(await svc.agregarTrabajoProyecto(
      parseInt(req.params.id), req.usuario.id, trabajo_id, orden||0, depende_de||null
    ));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ─── HERRAMIENTAS ─────────────────────────────────────────────────────────────

const getHerramientas = async (req, res) => {
  try {
    const id = req.params.trabajador_id ? parseInt(req.params.trabajador_id) : req.usuario.id;
    res.json(await svc.getHerramientas(id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const addHerramienta = async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: "nombre es requerido" });
    res.status(201).json(await svc.addHerramienta({ trabajadorId: req.usuario.id, ...req.body }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const updateHerramienta = async (req, res) => {
  try {
    res.json(await svc.updateHerramienta(parseInt(req.params.id), req.usuario.id, req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const deleteHerramienta = async (req, res) => {
  try {
    await svc.deleteHerramienta(parseInt(req.params.id), req.usuario.id);
    res.json({ mensaje: "Herramienta eliminada" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ─── VIDEOS ───────────────────────────────────────────────────────────────────

const subirVideo = async (req, res) => {
  try {
    const { titulo, precio } = req.body;
    if (!titulo) return res.status(400).json({ error: "titulo es requerido" });
    res.status(201).json(await svc.subirVideo({ autorId: req.usuario.id, ...req.body }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getMisVideos = async (req, res) => {
  try {
    res.json(await svc.getMisVideos(req.usuario.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getPlanners, getPlanner, crearPlanner, actualizarPlanner, eliminarPlanner,
  getProyectos, getProyecto, crearProyecto, actualizarProyecto, agregarTrabajo,
  getHerramientas, addHerramienta, updateHerramienta, deleteHerramienta,
  subirVideo, getMisVideos
};
