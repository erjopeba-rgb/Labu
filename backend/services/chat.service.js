const pool = require("../config/db");
const logger = require("../config/logger");
const chatRepo = require("../repositories/chat.repository");

// ─── CONVERSACIONES ───────────────────────────────────────────────────────────

const getOrCreateConversacion = async (tipo, referenciaId, participantesIds) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let convId;

    if (tipo === 'directo') {
      const [uid1, uid2] = [...participantesIds].sort((a, b) => a - b);
      const conv = await chatRepo.findConversacionDirecta(uid1, uid2, client);
      if (conv) {
        convId = conv.id;
      } else {
        const newConv = await chatRepo.insertConversacionDirecta(client);
        convId = newConv.id;
      }
    } else {
      const existing = await chatRepo.findConversacionByTipoRef(tipo, referenciaId, client);
      if (existing) {
        convId = existing.id;
      } else {
        const conv = await chatRepo.insertConversacion(tipo, referenciaId, client);
        convId = conv.id;
      }
    }

    for (const uid of participantesIds) {
      await chatRepo.insertParticipante(convId, uid, client);
    }

    await client.query("COMMIT");
    return convId;
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err: err.message }, "[getOrCreateConversacion] ERROR ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const getMisConversaciones = async (usuarioId, limit = 30, offset = 0) => {
  return chatRepo.findMisConversaciones(usuarioId, limit, offset);
};

const getMensajes = async (conversacionId, usuarioId, limit, offset) => {
  const acceso = await chatRepo.findAccesoConversacion(conversacionId, usuarioId);
  if (acceso.length === 0) throw { status: 403, error: "Sin acceso a esta conversacion" };

  const rows = await chatRepo.findMensajes(conversacionId, limit, offset);

  await chatRepo.marcarLeidoConversacion(conversacionId, usuarioId);

  return rows.reverse(); // cronológico
};

const enviarMensaje = async ({ conversacionId, remitenteId, contenido, tipo }) => {
  const acceso = await chatRepo.findAccesoConversacion(conversacionId, remitenteId);
  if (acceso.length === 0) {
    throw { status: 403, error: "Sin acceso a esta conversacion" };
  }

  const msg = await chatRepo.insertMensaje(conversacionId, remitenteId, contenido, tipo);

  await chatRepo.updateConversacionActualizada(conversacionId);

  const perfil = await chatRepo.findPerfilByUsuario(remitenteId);
  if (perfil) {
    msg.remitente_nombre = perfil.nombre;
    msg.remitente_avatar = perfil.avatar_url;
  }

  return msg;
};

// ─── NOTIFICACIONES ───────────────────────────────────────────────────────────

const crearNotificacion = async ({ usuarioId, tipo, titulo, mensaje, referenciaTipo, referenciaId, deduplicar = false }) => {
  return chatRepo.insertNotificacion({ usuarioId, tipo, titulo, mensaje, referenciaTipo, referenciaId, deduplicar });
};

const getNotificaciones = async (usuarioId, soloNoLeidas, limit = 20, offset = 0) => {
  return chatRepo.findNotificaciones(usuarioId, soloNoLeidas, limit, offset);
};

const marcarLeida = async (notificacionId, usuarioId) => {
  return chatRepo.marcarNotificacionLeida(notificacionId, usuarioId);
};

const marcarTodasLeidas = async (usuarioId) => {
  return chatRepo.marcarTodasLeidas(usuarioId);
};

const getNoLeidasCount = async (usuarioId) => {
  return chatRepo.countNoLeidas(usuarioId);
};

module.exports = {
  getOrCreateConversacion, getMisConversaciones, getMensajes, enviarMensaje,
  crearNotificacion, getNotificaciones, marcarLeida, marcarTodasLeidas, getNoLeidasCount
};
