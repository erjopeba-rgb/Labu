const pool = require("../config/db");

// ─── Transaccionales (aceptan db = pool | client) ─────────────────────────────

const findTrabajoCompletado = async (trabajoId, db) => {
    const { rows: [trabajo] } = await db.query(
        `SELECT t.id, t.dueno_id, o.trabajador_id
         FROM trabajos t
         JOIN ofertas o ON o.trabajo_id = t.id AND o.estado = 'aceptada'
         WHERE t.id = $1 AND t.estado = 'completado'`,
        [trabajoId]
    );
    return trabajo || null;
};

const insertCalificacion = async ({ trabajoId, calificadorId, calificadoId, puntaje, comentario, tipo }, db) => {
    const { rows: [cal] } = await db.query(
        `INSERT INTO calificaciones (trabajo_id, calificador_id, calificado_id, puntaje, comentario, tipo)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (trabajo_id, calificador_id) DO NOTHING
         RETURNING *`,
        [trabajoId, calificadorId, calificadoId, puntaje, comentario, tipo]
    );
    return cal || null;
};

const updatePromedioCalificacion = async (calificadoId, db) => {
    await db.query(
        `UPDATE perfiles SET
           promedio_calificacion = (SELECT ROUND(AVG(puntaje)::numeric,2) FROM calificaciones WHERE calificado_id=$1),
           total_calificaciones  = (SELECT COUNT(*) FROM calificaciones WHERE calificado_id=$1)
         WHERE usuario_id = $1`,
        [calificadoId]
    );
};

// ─── Solo pool ────────────────────────────────────────────────────────────────

const findCalificacion = async (trabajoId, calificadorId) => {
    const { rows } = await pool.query(
        "SELECT id FROM calificaciones WHERE trabajo_id=$1 AND calificador_id=$2",
        [trabajoId, calificadorId]
    );
    return rows;
};

const findCalificacionesPorUsuario = async (usuarioId, limit, offset) => {
    const { rows } = await pool.query(
        `SELECT c.*, p.nombre AS calificador_nombre, p.foto_url AS calificador_foto, t.titulo AS trabajo_titulo
         FROM calificaciones c
         LEFT JOIN perfiles p ON p.usuario_id = c.calificador_id
         JOIN trabajos t ON t.id = c.trabajo_id
         WHERE c.calificado_id = $1
         ORDER BY c.created_at DESC LIMIT $2 OFFSET $3`,
        [usuarioId, limit, offset]
    );
    return rows;
};

module.exports = {
    findTrabajoCompletado,
    insertCalificacion,
    updatePromedioCalificacion,
    findCalificacion,
    findCalificacionesPorUsuario,
};
