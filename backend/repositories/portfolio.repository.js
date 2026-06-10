const pool = require("../config/db");

const findByTrabajador = async (trabajadorId) => {
    const { rows } = await pool.query(
        `SELECT p.*, r.nombre AS rubro_nombre
         FROM portfolio_items p
         LEFT JOIN rubros r ON r.id = p.rubro_id
         WHERE ((p.trabajador_id = $1 AND p.dueno_id IS NULL) OR p.dueno_id = $1) AND p.activo = TRUE
         ORDER BY p.destacado DESC, p.creado_en DESC`,
        [trabajadorId]
    );
    return rows;
};

const insertItem = async ({ trabajadorId, duenoId, trabajoId, titulo, descripcion, rubroId, fotoAntesUrl, fotoDespuesUrl, fotosUrls, videoUrl, destacado }) => {
    const { rows: [item] } = await pool.query(
        `INSERT INTO portfolio_items (trabajador_id, dueno_id, trabajo_id, titulo, descripcion, rubro_id, foto_antes_url, foto_despues_url, fotos_urls, video_url, destacado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [trabajadorId, duenoId || null, trabajoId || null, titulo, descripcion || null, rubroId || null, fotoAntesUrl || null, fotoDespuesUrl || null, fotosUrls || null, videoUrl || null, destacado || false]
    );
    return item;
};

const updateItem = async (itemId, trabajadorId, datos) => {
    const { rows: [item] } = await pool.query(
        `UPDATE portfolio_items SET
           titulo = COALESCE($1, titulo),
           descripcion = COALESCE($2, descripcion),
           foto_antes_url = COALESCE($3, foto_antes_url),
           foto_despues_url = COALESCE($4, foto_despues_url),
           fotos_urls = COALESCE($5, fotos_urls),
           video_url = COALESCE($6, video_url),
           destacado = COALESCE($7, destacado)
         WHERE id = $8 AND trabajador_id = $9 RETURNING *`,
        [datos.titulo || null, datos.descripcion || null, datos.foto_antes_url || null, datos.foto_despues_url || null, datos.fotos_urls || null, datos.video_url || null, datos.destacado ?? null, itemId, trabajadorId]
    );
    return item || null;
};

const softDeleteItem = async (itemId, trabajadorId) => {
    const { rows: [item] } = await pool.query(
        "UPDATE portfolio_items SET activo = FALSE WHERE id = $1 AND trabajador_id = $2 RETURNING id",
        [itemId, trabajadorId]
    );
    return item || null;
};

const findHistorialByTrabajador = async (trabajadorId) => {
    const { rows } = await pool.query(
        `SELECT h.*, t.titulo AS trabajo_titulo, ta.nombre AS tarea_nombre, r.nombre AS rubro_nombre
         FROM historial_laboral h
         JOIN trabajos t ON t.id = h.trabajo_id
         LEFT JOIN tareas ta ON ta.id = h.tarea_id
         LEFT JOIN rubros r ON r.id = h.rubro_id
         WHERE h.trabajador_id = $1
         ORDER BY h.fecha_fin DESC`,
        [trabajadorId]
    );
    return rows;
};

const upsertHistorial = async ({ trabajadorId, trabajoId, tareaId, rubroId, fechaInicio, monto, calificacion, comoAyudante }) => {
    const { rows: [h] } = await pool.query(
        `INSERT INTO historial_laboral (trabajador_id, trabajo_id, tarea_id, rubro_id, fecha_inicio, monto_cobrado, calificacion_recibida, como_ayudante)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (trabajador_id, trabajo_id) DO UPDATE SET
           monto_cobrado = EXCLUDED.monto_cobrado,
           calificacion_recibida = EXCLUDED.calificacion_recibida
         RETURNING *`,
        [trabajadorId, trabajoId, tareaId || null, rubroId || null, fechaInicio || null, monto || null, calificacion || null, comoAyudante || false]
    );
    return h;
};

const findCalendario = async (trabajadorId, mes, anio) => {
    const { rows } = await pool.query(
        `SELECT e.*, r.nombre AS rubro_nombre, r.icono AS rubro_icono
         FROM eventos_calendario e
         LEFT JOIN rubros r ON r.id = e.rubro_id
         WHERE e.trabajador_id = $1
           AND EXTRACT(MONTH FROM e.fecha_inicio) = $2
           AND EXTRACT(YEAR FROM e.fecha_inicio) = $3
         ORDER BY e.fecha_inicio ASC`,
        [trabajadorId, mes, anio]
    );
    return rows;
};

const insertEvento = async ({ trabajadorId, trabajoId, titulo, fechaInicio, fechaFin, rubroId, tipo }) => {
    const { rows: [ev] } = await pool.query(
        `INSERT INTO eventos_calendario (trabajador_id, trabajo_id, titulo, fecha_inicio, fecha_fin, rubro_id, tipo)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [trabajadorId, trabajoId || null, titulo, fechaInicio, fechaFin || null, rubroId || null, tipo || 'trabajo']
    );
    return ev;
};

const findFeed = async (limit = 20, offset = 0) => {
    const { rows } = await pool.query(
        `SELECT p.*, r.nombre AS rubro_nombre,
                u.email AS trabajador_email,
                perf.nombre AS trabajador_nombre,
                perf.apellido AS trabajador_apellido
         FROM portfolio_items p
         LEFT JOIN rubros r ON r.id = p.rubro_id
         JOIN usuarios u ON u.id = p.trabajador_id
         LEFT JOIN perfiles perf ON perf.usuario_id = p.trabajador_id
         WHERE p.activo = TRUE
         ORDER BY p.creado_en DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
    );
    return rows;
};

module.exports = { findByTrabajador, insertItem, updateItem, softDeleteItem, findHistorialByTrabajador, upsertHistorial, findCalendario, insertEvento, findFeed };
