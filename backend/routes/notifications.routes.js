const express = require("express");
const router = express.Router();
const svc = require("../services/chat.service");
const pool = require("../config/db");
const { verificarToken } = require("../middlewares/auth.middleware");
const { verificarNoSuspendido, verificarTyC } = require("../middlewares/seguridad.middleware");

const auth = [verificarToken, verificarNoSuspendido, verificarTyC];

// GET /api/notifications?unread=true  → { count: N }
// GET /api/notifications               → array completo
router.get("/", ...auth, async (req, res, next) => {
  try {
    const soloNoLeidas = req.query.unread === "true";
    if (soloNoLeidas) {
      const count = await svc.getNoLeidasCount(req.usuario.id);
      return res.json({ count });
    }
    const notificaciones = await svc.getNotificaciones(req.usuario.id, false);
    res.json(notificaciones);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/leer", ...auth, async (req, res) => {
  try {
    await svc.marcarLeida(parseInt(req.params.id), req.usuario.id);
    res.json({ mensaje: "Notificacion marcada como leida" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/notifications/sin-disponibilidad
// El trabajador notifica al dueño que no se encontró disponibilidad coincidente
router.post("/sin-disponibilidad", ...auth, async (req, res, next) => {
  const { trabajo_id } = req.body;
  if (!trabajo_id || isNaN(Number(trabajo_id))) {
    return res.status(400).json({ success: false, error: "trabajo_id requerido" });
  }
  try {
    // Verificar que el solicitante es el trabajador asignado a ese trabajo
    const { rows } = await pool.query(
      `SELECT t.id, t.dueno_id, t.titulo
       FROM trabajos t
       JOIN ofertas o ON o.trabajo_id = t.id AND o.estado = 'aceptada'
       WHERE t.id = $1 AND o.trabajador_id = $2
       LIMIT 1`,
      [Number(trabajo_id), req.usuario.id]
    );
    if (!rows.length) {
      return res.status(403).json({ success: false, error: "No autorizado" });
    }
    const { dueno_id, titulo } = rows[0];
    await svc.crearNotificacion({
      usuarioId: dueno_id,
      tipo: "sin_disponibilidad",
      titulo: "Coordinación manual requerida",
      mensaje: `No se encontró disponibilidad coincidente para el trabajo "${titulo}". Por favor coordiná el horario directamente con el trabajador.`,
      referenciaTipo: "trabajo",
      referenciaId: Number(trabajo_id),
      deduplicar: true
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.patch("/leer-todas", ...auth, async (req, res, next) => {
  try {
    await svc.marcarTodasLeidas(req.usuario.id);
    res.json({ mensaje: "Todas las notificaciones marcadas como leidas" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
