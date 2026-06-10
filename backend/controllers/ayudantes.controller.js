const {
  crearSolicitud, getSolicitud, getSolicitudesAbiertas,
  aplicarComoAyudante, responderAplicacion,
  procesarPagoAyudante, registrarAmonestacion, getMisAyudantes,
  getMisSolicitudesConAplicaciones
} = require("../services/ayudantes.service");

const crear = async (req, res) => {
  try {
    const { cantidad_necesaria, pago_por_ayudante, descripcion } = req.body;
    if (!cantidad_necesaria || !pago_por_ayudante) {
      return res.status(400).json({ error: "cantidad_necesaria y pago_por_ayudante son requeridos" });
    }
    const sol = await crearSolicitud({
      trabajoId: parseInt(req.params.trabajo_id),
      trabajadorLiderId: req.usuario.id,
      cantidadNecesaria: cantidad_necesaria,
      pagoPorAyudante: pago_por_ayudante,
      descripcion: descripcion || null
    });
    res.status(201).json(sol);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getAbiertas = async (req, res) => {
  try {
    res.json(await getSolicitudesAbiertas());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getById = async (req, res) => {
  try {
    res.json(await getSolicitud(parseInt(req.params.id)));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

const aplicar = async (req, res) => {
  try {
    const app = await aplicarComoAyudante({
      solicitudId: parseInt(req.params.id),
      ayudanteId: req.usuario.id
    });
    res.status(201).json(app);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const responder = async (req, res) => {
  try {
    const { estado } = req.body;
    if (!["aceptado", "rechazado"].includes(estado)) {
      return res.status(400).json({ error: "estado debe ser aceptado o rechazado" });
    }
    const app = await responderAplicacion({
      aplicacionId: parseInt(req.params.aplicacion_id),
      liderId: req.usuario.id,
      estado
    });
    res.json(app);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const procesarPago = async (req, res) => {
  try {
    const cantidad = await procesarPagoAyudante(parseInt(req.params.trabajo_id));
    res.json({ mensaje: `${cantidad} pagos procesados` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const amonestacion = async (req, res) => {
  try {
    const { usuario_id, trabajo_id, descripcion } = req.body;
    if (!usuario_id || !descripcion) {
      return res.status(400).json({ error: "usuario_id y descripcion son requeridos" });
    }
    const result = await registrarAmonestacion({
      usuarioId: usuario_id,
      trabajoId: trabajo_id || null,
      descripcion
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const misAyudantes = async (req, res) => {
  try {
    res.json(await getMisAyudantes(req.usuario.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const misSolicitudesConAplicaciones = async (req, res) => {
  try {
    res.json(await getMisSolicitudesConAplicaciones(req.usuario.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { crear, getAbiertas, getById, aplicar, responder, procesarPago, amonestacion, misAyudantes, misSolicitudesConAplicaciones };
