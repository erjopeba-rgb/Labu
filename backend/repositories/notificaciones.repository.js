const pool = require("../config/db");

const insertNotificacion = async ({ usuarioId, tipo, titulo, mensaje, referenciaTipo, referenciaId, deduplicar = false }) => {
    if (deduplicar && referenciaId != null) {
        // Si ya existe una notificación no leída del mismo tipo para el mismo recurso, no insertar
        const { rows: [n] } = await pool.query(
            `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, referencia_tipo, referencia_id)
             SELECT $1,$2,$3,$4,$5,$6
             WHERE NOT EXISTS (
                 SELECT 1 FROM notificaciones
                 WHERE usuario_id = $1 AND tipo = $2 AND referencia_id = $6 AND leida = FALSE
             )
             RETURNING *`,
            [usuarioId, tipo, titulo, mensaje || null, referenciaTipo || null, referenciaId]
        );
        return n || null;
    }
    const { rows: [n] } = await pool.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, referencia_tipo, referencia_id)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [usuarioId, tipo, titulo, mensaje || null, referenciaTipo || null, referenciaId || null]
    );
    return n;
};

const findNotificaciones = async (usuarioId, soloNoLeidas, limit = 20, offset = 0) => {
    let where = "WHERE usuario_id = $1";
    if (soloNoLeidas) where += " AND leida = FALSE";
    const { rows } = await pool.query(
        `SELECT *, COUNT(*) OVER() AS total_count
         FROM notificaciones ${where}
         ORDER BY creado_en DESC
         LIMIT $2 OFFSET $3`,
        [usuarioId, limit, offset]
    );
    const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0;
    const data = rows.map(({ total_count, ...r }) => r);
    return { data, total };
};

const marcarNotificacionLeida = async (notificacionId, usuarioId) => {
    await pool.query(
        "UPDATE notificaciones SET leida = TRUE WHERE id = $1 AND usuario_id = $2",
        [notificacionId, usuarioId]
    );
};

const marcarTodasLeidas = async (usuarioId) => {
    await pool.query(
        "UPDATE notificaciones SET leida = TRUE WHERE usuario_id = $1",
        [usuarioId]
    );
};

const countNoLeidas = async (usuarioId) => {
    const { rows: [r] } = await pool.query(
        "SELECT COUNT(*) FROM notificaciones WHERE usuario_id = $1 AND leida = FALSE",
        [usuarioId]
    );
    return parseInt(r.count);
};

module.exports = { insertNotificacion, findNotificaciones, marcarNotificacionLeida, marcarTodasLeidas, countNoLeidas };
