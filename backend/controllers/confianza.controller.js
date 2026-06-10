const svc = require("../services/confianza.service");

const getLista = async (req, res) => {
  try {
    res.json(await svc.getTrabajadoresConfianza(req.usuario.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const add = async (req, res) => {
  try {
    const { trabajador_id, nota } = req.body;
    if (!trabajador_id) return res.status(400).json({ error: "trabajador_id es requerido" });
    res.status(201).json(await svc.addTrabajadorConfianza(req.usuario.id, trabajador_id, nota || null));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const remove = async (req, res) => {
  try {
    await svc.removeTrabajadorConfianza(req.usuario.id, parseInt(req.params.trabajador_id));
    res.json({ mensaje: "Trabajador eliminado de tu lista de confianza" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getHistorial = async (req, res) => {
  try {
    res.json(await svc.getHistorialCompartido(req.usuario.id, parseInt(req.params.trabajador_id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getMantenimientos = async (req, res) => {
  try {
    res.json(await svc.getMantenimientos(req.usuario.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const crearMantenimiento = async (req, res) => {
  try {
    const { trabajador_id, titulo, frecuencia, proximo_vencimiento } = req.body;
    if (!trabajador_id || !titulo || !frecuencia || !proximo_vencimiento) {
      return res.status(400).json({ error: "trabajador_id, titulo, frecuencia y proximo_vencimiento son requeridos" });
    }
    res.status(201).json(await svc.crearMantenimiento({
      duenioId: req.usuario.id,
      trabajadorId: trabajador_id,
      tareaId: req.body.tarea_id || null,
      rubroId: req.body.rubro_id || null,
      titulo,
      descripcion: req.body.descripcion || null,
      frecuencia,
      proximoVencimiento: proximo_vencimiento
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const actualizarVencimiento = async (req, res) => {
  try {
    res.json(await svc.actualizarVencimiento(
      parseInt(req.params.id),
      req.usuario.id,
      req.body.trabajo_id || null
    ));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const eliminarMantenimiento = async (req, res) => {
  try {
    await svc.eliminarMantenimiento(parseInt(req.params.id), req.usuario.id);
    res.json({ mensaje: "Mantenimiento eliminado" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getVencimientos = async (req, res) => {
  try {
    const dias = req.query.dias ? parseInt(req.query.dias) : 7;
    res.json(await svc.getProximosVencimientos(req.usuario.id, dias));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getNivel = async (req, res) => {
  try {
    const data = await svc.getNivelConfianza(parseInt(req.params.usuario_id));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getLista, add, remove, getHistorial, getMantenimientos, crearMantenimiento, actualizarVencimiento, eliminarMantenimiento, getVencimientos, getNivel };
