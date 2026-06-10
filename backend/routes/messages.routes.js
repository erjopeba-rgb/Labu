const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verificarToken } = require("../middlewares/auth.middleware");
const { verificarNoSuspendido, verificarTyC } = require("../middlewares/seguridad.middleware");

const auth = [verificarToken, verificarNoSuspendido, verificarTyC];

// GET /api/messages?unread=true  → { count: N }
// GET /api/messages               → lista de conversaciones
router.get("/", ...auth, async (req, res, next) => {
  try {
    const unread = req.query.unread === "true";
    if (unread) {
      const { rows: [r] } = await pool.query(
        `SELECT COALESCE(SUM(
           (SELECT COUNT(*) FROM mensajes_chat m
            WHERE m.conversacion_id = pc.conversacion_id
              AND m.creado_en > COALESCE(pc.ultimo_leido_en, '1970-01-01')
              AND m.remitente_id != $1)
         ), 0) AS count
         FROM participantes_conversacion pc
         WHERE pc.usuario_id = $1`,
        [req.usuario.id]
      );
      return res.json({ count: parseInt(r.count) });
    }
    const svc = require("../services/chat.service");
    const conversaciones = await svc.getMisConversaciones(req.usuario.id);
    res.json(conversaciones);
  } catch (err) {
    next(err);
  }
});

// POST /api/messages  → busca/crea conversación directa y envía el mensaje
router.post("/", ...auth, async (req, res, next) => {
  const { contacto_id, mensaje } = req.body;

  if (!contacto_id || !mensaje) {
    return res.status(400).json({ error: "contacto_id y mensaje son requeridos" });
  }

  try {
    const svc = require("../services/chat.service");

    const conversacion_id = await svc.getOrCreateConversacion(
      'directo',
      null,
      [req.usuario.id, parseInt(contacto_id)]
    );

    await svc.enviarMensaje({
      conversacionId: conversacion_id,
      remitenteId: req.usuario.id,
      contenido: mensaje,
      tipo: 'texto'
    });

    res.json({ conversacion_id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
