const pool = require("../config/db");
const notifsRepo = require("./notificaciones.repository");

// ─── Conversaciones (transaccionales — aceptan db = pool | client) ────────────

// Buscar conversación directa entre dos usuarios exactos
const findConversacionDirecta = async (uid1, uid2, db) => {
    const { rows } = await db.query(
        `SELECT pc1.conversacion_id AS id
         FROM participantes_conversacion pc1
         JOIN participantes_conversacion pc2
           ON pc2.conversacion_id = pc1.conversacion_id AND pc2.usuario_id = $2
         JOIN conversaciones c
           ON c.id = pc1.conversacion_id AND c.tipo = 'directo'
         WHERE pc1.usuario_id = $1
           AND (SELECT COUNT(*) FROM participantes_conversacion WHERE conversacion_id = pc1.conversacion_id) = 2
         LIMIT 1`,
        [uid1, uid2]
    );
    return rows[0] || null;
};

// Buscar conversación por tipo + referencia_id
const findConversacionByTipoRef = async (tipo, referenciaId, db) => {
    const { rows } = await db.query(
        `SELECT id FROM conversaciones WHERE tipo = $1 AND referencia_id = $2 ORDER BY id ASC LIMIT 1`,
        [tipo, referenciaId || null]
    );
    return rows[0] || null;
};

// Insertar conversación directa (sin referencia_id)
const insertConversacionDirecta = async (db) => {
    const { rows: [conv] } = await db.query(
        "INSERT INTO conversaciones (tipo, referencia_id) VALUES ('directo', NULL) RETURNING id"
    );
    return conv;
};

// Insertar conversación por tipo+ref con ON CONFLICT DO NOTHING, luego releer
const insertConversacion = async (tipo, referenciaId, db) => {
    await db.query(
        "INSERT INTO conversaciones (tipo, referencia_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [tipo, referenciaId || null]
    );
    const { rows: [conv] } = await db.query(
        `SELECT id FROM conversaciones
         WHERE tipo = $1 AND (referencia_id = $2 OR ($2::int IS NULL AND referencia_id IS NULL))
         ORDER BY id ASC LIMIT 1`,
        [tipo, referenciaId || null]
    );
    return conv;
};

// Insertar participante (ON CONFLICT DO NOTHING)
const insertParticipante = async (convId, uid, db) => {
    await db.query(
        `INSERT INTO participantes_conversacion (conversacion_id, usuario_id)
         VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [convId, uid]
    );
};

// ─── Conversaciones (solo pool) ──────────────────────────────────────────────

const findMisConversaciones = async (usuarioId, limit, offset) => {
    const { rows } = await pool.query(
        `SELECT c.*,
                pc.ultimo_leido_en,
                ult.contenido     AS ultimo_mensaje,
                ult.creado_en     AS ultimo_mensaje_en,
                nl.no_leidos,
                part.otros_participantes
         FROM conversaciones c
         JOIN participantes_conversacion pc ON pc.conversacion_id = c.id AND pc.usuario_id = $1
         LEFT JOIN LATERAL (
           SELECT contenido, creado_en
           FROM mensajes_chat
           WHERE conversacion_id = c.id
           ORDER BY creado_en DESC
           LIMIT 1
         ) ult ON true
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::bigint AS no_leidos
           FROM mensajes_chat m
           WHERE m.conversacion_id = c.id
             AND m.creado_en > COALESCE(pc.ultimo_leido_en, '1970-01-01')
             AND m.remitente_id != $1
         ) nl ON true
         LEFT JOIN LATERAL (
           SELECT json_agg(json_build_object('id', u.id, 'nombre', p.nombre, 'avatar', p.avatar_url)) AS otros_participantes
           FROM participantes_conversacion pc2
           JOIN usuarios u ON u.id = pc2.usuario_id
           JOIN perfiles p ON p.usuario_id = u.id
           WHERE pc2.conversacion_id = c.id AND pc2.usuario_id != $1
         ) part ON true
         ORDER BY c.actualizado_en DESC
         LIMIT $2 OFFSET $3`,
        [usuarioId, limit, offset]
    );
    return rows;
};

const findAccesoConversacion = async (conversacionId, usuarioId) => {
    const { rows } = await pool.query(
        "SELECT id FROM participantes_conversacion WHERE conversacion_id = $1 AND usuario_id = $2",
        [conversacionId, usuarioId]
    );
    return rows;
};

const findMensajes = async (conversacionId, limit, offset) => {
    const { rows } = await pool.query(
        `SELECT m.*, p.nombre AS remitente_nombre, p.avatar_url AS remitente_avatar
         FROM mensajes_chat m
         LEFT JOIN perfiles p ON p.usuario_id = m.remitente_id
         WHERE m.conversacion_id = $1
         ORDER BY m.creado_en DESC
         LIMIT $2 OFFSET $3`,
        [conversacionId, limit || 50, offset || 0]
    );
    return rows;
};

const marcarLeidoConversacion = async (conversacionId, usuarioId) => {
    await pool.query(
        "UPDATE participantes_conversacion SET ultimo_leido_en = NOW() WHERE conversacion_id = $1 AND usuario_id = $2",
        [conversacionId, usuarioId]
    );
};

const insertMensaje = async (conversacionId, remitenteId, contenido, tipo) => {
    const { rows: [msg] } = await pool.query(
        `INSERT INTO mensajes_chat (conversacion_id, remitente_id, contenido, tipo)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [conversacionId, remitenteId, contenido, tipo || 'texto']
    );
    return msg;
};

const updateConversacionActualizada = async (conversacionId) => {
    await pool.query(
        "UPDATE conversaciones SET actualizado_en = NOW() WHERE id = $1",
        [conversacionId]
    );
};

const findPerfilByUsuario = async (usuarioId) => {
    const { rows: [perfil] } = await pool.query(
        "SELECT nombre, avatar_url FROM perfiles WHERE usuario_id = $1",
        [usuarioId]
    );
    return perfil || null;
};

// ─── Notificaciones (re-exportadas desde notificaciones.repository) ──────────

const { insertNotificacion, findNotificaciones, marcarNotificacionLeida, marcarTodasLeidas, countNoLeidas } = notifsRepo;

module.exports = {
    findConversacionDirecta,
    findConversacionByTipoRef,
    insertConversacionDirecta,
    insertConversacion,
    insertParticipante,
    findMisConversaciones,
    findAccesoConversacion,
    findMensajes,
    marcarLeidoConversacion,
    insertMensaje,
    updateConversacionActualizada,
    findPerfilByUsuario,
    insertNotificacion,
    findNotificaciones,
    marcarNotificacionLeida,
    marcarTodasLeidas,
    countNoLeidas,
};
