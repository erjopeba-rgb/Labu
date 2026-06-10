const { crearCalificacion, obtenerCalificacionesPorUsuario } = require("../services/calificaciones.service");

const calificar = async (req, res) => {
  try {
    const trabajoId = parseInt(req.params.trabajo_id);
    const { puntaje, comentario } = req.body;
    if (!puntaje || puntaje < 1 || puntaje > 5) {
      return res.status(400).json({ error: "El puntaje debe estar entre 1 y 5" });
    }
    const cal = await crearCalificacion({
      trabajoId,
      calificadorId: req.usuario.id,
      puntaje: parseFloat(puntaje),
      comentario: comentario || null
    });
    res.status(201).json({ ...cal, puntaje: parseFloat(cal.puntaje) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.error || err.message });
  }
};

const getCalificaciones = async (req, res) => {
  try {
    const data = await obtenerCalificacionesPorUsuario(
      parseInt(req.params.usuario_id),
      parseInt(req.query.limit) || 10,
      parseInt(req.query.offset) || 0
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener calificaciones" });
  }
};

module.exports = { calificar, getCalificaciones };
