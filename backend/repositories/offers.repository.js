const pool = require("../config/db");

// ─── Crear oferta ─────────────────────────────────────────────────────────────

const findTrabajoPublicado = async (trabajoId) => {
    const { rows } = await pool.query(
        "SELECT * FROM trabajos WHERE id = $1 AND estado = 'publicado'",
        [trabajoId]
    );
    return rows[0] || null;
};

const insertOferta = async ({ trabajo_id, trabajador_id, monto_propuesto, mensaje, tiempo_estimado, unidad_tiempo, hora_inicio_propuesta, hora_fin_propuesta }) => {
    const { rows } = await pool.query(
        `INSERT INTO ofertas (trabajo_id, trabajador_id, monto_propuesto, mensaje, tiempo_estimado, unidad_tiempo, hora_inicio_propuesta, hora_fin_propuesta)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [trabajo_id, trabajador_id, monto_propuesto, mensaje || null, tiempo_estimado || null, unidad_tiempo || 'dias', hora_inicio_propuesta || null, hora_fin_propuesta || null]
    );
    return rows[0];
};

const findPerfilTrabajador = async (trabajadorId) => {
    const { rows } = await pool.query(
        "SELECT nombre, apellido, medio_transporte FROM perfiles WHERE usuario_id = $1",
        [trabajadorId]
    );
    return rows[0] || null;
};

// ─── Consultas ────────────────────────────────────────────────────────────────

const findOfertasPorTrabajo = async (trabajoId) => {
    const { rows } = await pool.query(
        `SELECT o.*, COALESCE(p.nombre, split_part(u.email, '@', 1)) AS nombre, p.apellido, p.calificacion_promedio
         FROM ofertas o
         JOIN usuarios u ON o.trabajador_id = u.id
         LEFT JOIN perfiles p ON o.trabajador_id = p.usuario_id
         WHERE o.trabajo_id = $1
         ORDER BY o.creado_en DESC`,
        [trabajoId]
    );
    return rows;
};

const findMisOfertas = async (trabajadorId, limit, offset) => {
    const { rows } = await pool.query(
        `SELECT o.*, t.titulo AS trabajo_titulo, t.ciudad AS trabajo_ciudad, t.fotos_urls AS trabajo_fotos_urls,
                t.dueno_id,
                p.nombre AS dueno_nombre, p.apellido AS dueno_apellido,
                COUNT(*) OVER() AS total_count
         FROM ofertas o
         JOIN trabajos t ON o.trabajo_id = t.id
         LEFT JOIN perfiles p ON t.dueno_id = p.usuario_id
         WHERE o.trabajador_id = $1
         ORDER BY o.creado_en DESC
         LIMIT $2 OFFSET $3`,
        [trabajadorId, limit, offset]
    );
    const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0;
    const data = rows.map(({ total_count, ...r }) => r);
    return { data, total };
};

const findOfertaConDetalle = async (ofertaId) => {
    const { rows } = await pool.query(
        `SELECT o.*,
            t.titulo, t.descripcion, t.fotos_urls, t.ciudad, t.provincia,
            t.estado AS trabajo_estado, t.dueno_id,
            p.nombre  AS trabajador_nombre,
            p.apellido AS trabajador_apellido,
            p.calificacion_promedio AS trabajador_calificacion,
            p.avatar_url AS trabajador_foto
         FROM ofertas o
         JOIN trabajos t ON o.trabajo_id = t.id
         LEFT JOIN perfiles p ON o.trabajador_id = p.usuario_id
         WHERE o.id = $1`,
        [ofertaId]
    );
    return rows[0] || null;
};

const findTituloTrabajo = async (trabajoId) => {
    const { rows } = await pool.query(
        "SELECT titulo FROM trabajos WHERE id = $1",
        [trabajoId]
    );
    return rows[0] || null;
};

// ─── Operaciones transaccionales (aceptan client o pool) ─────────────────────

const findOfertaParaAceptar = async (id, duenoId, db) => {
    const { rows } = await db.query(
        `SELECT o.trabajo_id, o.trabajador_id, o.monto_propuesto
         FROM ofertas o
         JOIN trabajos t ON o.trabajo_id = t.id
         WHERE o.id = $1
           AND o.estado IN ('pendiente', 'contraoferta')
           AND t.dueno_id = $2
         FOR UPDATE OF o`,
        [id, duenoId]
    );
    return rows[0] || null;
};


const updateOfertaAceptada = async (ofertaId, db) => {
    await db.query(
        `UPDATE ofertas SET estado = 'aceptada', actualizado_en = NOW() WHERE id = $1`,
        [ofertaId]
    );
};

const updateTrabajoEnNegociacion = async (trabajoId, db) => {
    await db.query(
        `UPDATE trabajos SET estado = 'en_negociacion', actualizado_en = NOW() WHERE id = $1`,
        [trabajoId]
    );
};

const rechazarOtrasOfertas = async (trabajoId, ofertaId, db) => {
    const { rows } = await db.query(
        `UPDATE ofertas SET estado = 'rechazada', actualizado_en = NOW()
         WHERE trabajo_id = $1 AND id != $2 AND estado IN ('pendiente', 'contraoferta')
         RETURNING id`,
        [trabajoId, ofertaId]
    );
    return rows;
};

const findOfertaParaContraoferta = async (id, trabajadorId, db) => {
    const { rows } = await (db || pool).query(
        `SELECT o.*, t.titulo, t.dueno_id, t.id AS t_id
         FROM ofertas o JOIN trabajos t ON o.trabajo_id = t.id
         WHERE o.id = $1 AND o.trabajador_id = $2 AND o.estado = 'contraoferta'
         FOR UPDATE OF o`,
        [id, trabajadorId]
    );
    return rows[0] || null;
};

// ─── Operaciones simples (solo pool) ─────────────────────────────────────────

const findOfertaConTrabajo = async (id) => {
    const { rows } = await pool.query(
        `SELECT o.trabajador_id, t.titulo, t.id AS trabajo_id, t.dueno_id
         FROM ofertas o JOIN trabajos t ON o.trabajo_id = t.id
         WHERE o.id = $1`,
        [id]
    );
    return rows[0] || null;
};

const rechazarOfertaByDueno = async (id, duenoId) => {
    await pool.query(
        `UPDATE ofertas SET estado = 'rechazada' WHERE id = $1 AND trabajo_id IN (SELECT id FROM trabajos WHERE dueno_id = $2)`,
        [id, duenoId]
    );
};

const deleteOferta = async (id, trabajadorId) => {
    const { rows } = await pool.query(
        `DELETE FROM ofertas WHERE id = $1 AND trabajador_id = $2 AND estado = 'pendiente' RETURNING *`,
        [id, trabajadorId]
    );
    return rows[0] || null;
};

const updateContraoferta = async (id, duenoId, monto, mensaje) => {
    const { rows } = await pool.query(
        `UPDATE ofertas SET
            estado = 'contraoferta',
            monto_contraoferta = $1,
            mensaje_contraoferta = $2,
            actualizado_en = NOW()
         WHERE id = $3
         AND trabajo_id IN (SELECT id FROM trabajos WHERE dueno_id = $4)
         RETURNING *`,
        [monto, mensaje || null, id, duenoId]
    );
    return rows[0] || null;
};

const rechazarOfertaById = async (id) => {
    await pool.query(
        `UPDATE ofertas SET estado = 'rechazada', actualizado_en = NOW() WHERE id = $1`,
        [id]
    );
};

module.exports = {
    findTrabajoPublicado,
    insertOferta,
    findPerfilTrabajador,
    findOfertasPorTrabajo,
    findMisOfertas,
    findOfertaConDetalle,
    findTituloTrabajo,
    findOfertaParaAceptar,
    updateOfertaAceptada,
    updateTrabajoEnNegociacion,
    rechazarOtrasOfertas,
    findOfertaParaContraoferta,
    findOfertaConTrabajo,
    rechazarOfertaByDueno,
    deleteOferta,
    updateContraoferta,
    rechazarOfertaById,
};
