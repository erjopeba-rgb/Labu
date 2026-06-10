const svc = require("../services/chat.service");

const getConversaciones = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    res.json(await svc.getMisConversaciones(req.usuario.id, limit, offset));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const iniciarConversacion = async (req, res) => {
  try {
    const { tipo, referencia_id, participantes } = req.body;
    if (!tipo || !participantes || participantes.length === 0) {
      return res.status(400).json({ error: "tipo y participantes son requeridos" });
    }
    const todos = [...new Set([req.usuario.id, ...participantes])];
    const convId = await svc.getOrCreateConversacion(tipo, referencia_id || null, todos);
    res.status(201).json({ conversacion_id: convId });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.error || err.message });
  }
};

const getMensajes = async (req, res) => {
  try {
    const msgs = await svc.getMensajes(
      parseInt(req.params.id),
      req.usuario.id,
      parseInt(req.query.limit) || 50,
      parseInt(req.query.offset) || 0
    );
    res.json(msgs);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.error || err.message });
  }
};

const enviarMensaje = async (req, res) => {
  try {
    const { contenido, tipo } = req.body;
    if (!contenido) {
      return res.status(400).json({ error: "contenido es requerido" });
    }
    const msg = await svc.enviarMensaje({
      conversacionId: parseInt(req.params.id),
      remitenteId: req.usuario.id,
      contenido,
      tipo: tipo || 'texto'
    });
    // Emitir por socket si está disponible
    if (req.app.get('io')) {
      req.app.get('io').to(`conv_${msg.conversacion_id}`).emit('nuevo_mensaje', msg);
    }
    res.status(201).json(msg);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.error || err.message });
  }
};

const getNotificaciones = async (req, res) => {
  try {
    const soloNoLeidas = req.query.no_leidas === 'true';
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    const { data, total } = await svc.getNotificaciones(req.usuario.id, soloNoLeidas, limit, offset);
    res.json({ data, total, page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getConteoNoLeidas = async (req, res) => {
  try {
    const count = await svc.getNoLeidasCount(req.usuario.id);
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const marcarLeida = async (req, res) => {
  try {
    await svc.marcarLeida(parseInt(req.params.id), req.usuario.id);
    res.json({ mensaje: "Notificacion marcada como leida" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const marcarTodasLeidas = async (req, res) => {
  try {
    await svc.marcarTodasLeidas(req.usuario.id);
    res.json({ mensaje: "Todas las notificaciones marcadas como leidas" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getConversaciones, iniciarConversacion, getMensajes, enviarMensaje, getNotificaciones, getConteoNoLeidas, marcarLeida, marcarTodasLeidas };
