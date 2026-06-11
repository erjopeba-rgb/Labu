const pool = require("../config/db");

// ─── Feed ─────────────────────────────────────────────────────────────────────

const findFeed = async (trabajadorId, { rubro_id, modalidad, urgente } = {}, limit, offset) => {
    let query = `
        SELECT
            t.id, t.dueno_id, t.titulo, t.descripcion, t.modalidad,
            t.ciudad, t.provincia, t.presupuesto_min, t.presupuesto_max,
            t.es_urgente, t.estado, t.creado_en, t.fotos_urls,
            u.email AS dueno_email,
            p.nombre AS dueno_nombre, p.apellido AS dueno_apellido, p.avatar_url,
            r.nombre AS rubro_nombre,
            COALESCE(et.total_trabajos, 0) AS dueno_total_trabajos,
            COUNT(DISTINCT o.id) AS total_ofertas,
            (SELECT COUNT(*) FROM comentarios c WHERE c.trabajo_id = t.id) AS total_comentarios,
            EXISTS(
                SELECT 1 FROM ofertas oa
                WHERE oa.trabajo_id = t.id
                  AND oa.trabajador_id = $1
                  AND oa.estado IN ('pendiente', 'contraoferta')
            ) AS ya_oferte
        FROM trabajos t
        JOIN usuarios u ON t.dueno_id = u.id
        LEFT JOIN perfiles p ON t.dueno_id = p.usuario_id
        LEFT JOIN rubros r ON t.rubro_id = r.id
        LEFT JOIN estadisticas_trabajador et ON et.trabajador_id = t.dueno_id
        LEFT JOIN ofertas o ON t.id = o.trabajo_id
        WHERE t.estado = 'publicado'
    `;

    // $1 está reservado para trabajador_id en el subquery EXISTS
    const params = [trabajadorId || null];
    let paramCount = 2;

    if (rubro_id) { query += ` AND t.rubro_id = $${paramCount++}`; params.push(rubro_id); }
    if (modalidad) { query += ` AND t.modalidad = $${paramCount++}`; params.push(modalidad); }
    if (urgente === 'true') { query += ` AND t.es_urgente = true`; }

    query += ` GROUP BY t.id, t.dueno_id, u.email, p.nombre, p.apellido, p.avatar_url, r.nombre, et.total_trabajos`;
    query += ` ORDER BY t.es_urgente DESC, t.creado_en DESC`;
    query += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const { rows } = await pool.query(query, params);
    return rows;
};

// ─── CRUD básico ──────────────────────────────────────────────────────────────

const insertJob = async ({ dueno_id, titulo, descripcion, rubro_id, modalidad, ciudad, provincia, presupuesto_min, presupuesto_max, es_urgente, fotosJson, latitud, longitud }) => {
    const { rows } = await pool.query(
        `INSERT INTO trabajos (dueno_id, titulo, descripcion, rubro_id, modalidad, ciudad, provincia, presupuesto_min, presupuesto_max, es_urgente, fotos_urls, latitud, longitud)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [dueno_id, titulo, descripcion, rubro_id || null, modalidad || 'presencial', ciudad || null, provincia || null, presupuesto_min || null, presupuesto_max || null, es_urgente || false, fotosJson, latitud || null, longitud || null]
    );
    return rows[0];
};

const findJobById = async (id) => {
    const { rows } = await pool.query(
        `SELECT t.*, u.email AS dueno_email, p.nombre AS dueno_nombre,
                p.apellido AS dueno_apellido, r.nombre AS rubro_nombre
         FROM trabajos t
         JOIN usuarios u ON t.dueno_id = u.id
         LEFT JOIN perfiles p ON t.dueno_id = p.usuario_id
         LEFT JOIN rubros r ON t.rubro_id = r.id
         WHERE t.id = $1`,
        [id]
    );
    return rows[0] || null;
};

const findMisTrabajos = async (dueno_id, limit, offset) => {
    const { rows } = await pool.query(
        `SELECT t.*, COUNT(o.id) AS total_ofertas,
                EXISTS(SELECT 1 FROM calificaciones c WHERE c.trabajo_id = t.id AND c.calificador_id = $1) AS ya_califique,
                (SELECT oa.trabajador_id FROM ofertas oa WHERE oa.trabajo_id = t.id AND oa.estado = 'aceptada' LIMIT 1) AS trabajador_aceptado_id,
                (SELECT TRIM(COALESCE(pa.nombre,'') || ' ' || COALESCE(pa.apellido,''))
                 FROM ofertas oa2
                 JOIN perfiles pa ON pa.usuario_id = oa2.trabajador_id
                 WHERE oa2.trabajo_id = t.id AND oa2.estado = 'aceptada' LIMIT 1) AS trabajador_aceptado_nombre,
                COUNT(*) OVER() AS total_count
         FROM trabajos t
         LEFT JOIN ofertas o ON t.id = o.trabajo_id
         WHERE t.dueno_id = $1
         GROUP BY t.id
         ORDER BY t.creado_en DESC
         LIMIT $2 OFFSET $3`,
        [dueno_id, limit, offset]
    );
    const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0;
    const data = rows.map(({ total_count, ...r }) => r);
    return { data, total };
};

const findTrabajosAsignados = async (trabajador_id) => {
    const { rows } = await pool.query(
        `SELECT t.*,
                o.monto_propuesto AS monto_acordado,
                o.id AS oferta_id,
                p.nombre AS dueno_nombre,
                p.apellido AS dueno_apellido,
                u.email AS dueno_email,
                r.nombre AS rubro_nombre,
                EXISTS(SELECT 1 FROM calificaciones c WHERE c.trabajo_id = t.id AND c.calificador_id = $1) AS ya_califique
         FROM trabajos t
         JOIN ofertas o ON o.trabajo_id = t.id AND o.trabajador_id = $1
             AND o.estado::text = 'aceptada'
         JOIN usuarios u ON t.dueno_id = u.id
         LEFT JOIN perfiles p ON t.dueno_id = p.usuario_id
         LEFT JOIN rubros r ON t.rubro_id = r.id
         WHERE t.estado::text IN ('en_negociacion', 'en_curso', 'trabajador_llego', 'pendiente_confirmacion', 'completado')
         ORDER BY t.actualizado_en DESC`,
        [trabajador_id]
    );
    return rows;
};

// ─── Cancelación (C3) ─────────────────────────────────────────────────────────

const findJobParaCancelar = async (id, db = pool) => {
    const { rows } = await db.query(
        `SELECT id, estado, dueno_id, titulo FROM trabajos WHERE id = $1 FOR UPDATE`,
        [id]
    );
    return rows[0] || null;
};

const setCancelado = async (id, db = pool) => {
    const { rows } = await db.query(
        `UPDATE trabajos SET estado = 'cancelado', actualizado_en = NOW() WHERE id = $1 RETURNING *`,
        [id]
    );
    return rows[0] || null;
};

// Reembolso al cancelar un trabajo no iniciado: las distribuciones retenidas se anulan
// (estado NULL: ni retenido ni liberado en el saldo) y el pago aprobado pasa a 'reembolsado'.
const reembolsarPagoPorTrabajo = async (jobId, db = pool) => {
    await db.query(
        `UPDATE distribuciones_pago d
         SET estado = NULL, procesado_en = NULL
         FROM pagos p
         WHERE d.pago_id = p.id
           AND p.referencia_id = $1 AND p.tipo = 'trabajo' AND p.estado = 'aprobado'
           AND d.estado = 'pendiente'`,
        [jobId]
    );
    const { rows } = await db.query(
        `UPDATE pagos SET estado = 'reembolsado', actualizado_en = NOW()
         WHERE referencia_id = $1 AND tipo = 'trabajo' AND estado = 'aprobado'
         RETURNING id, monto_total`,
        [jobId]
    );
    return rows;
};

// Al cancelar, los slots del trabajador (tentativas o confirmadas) vuelven a estar libres
const liberarReservasPorTrabajo = async (jobId, db = pool) => {
    await db.query(
        `UPDATE reservas_tentativas SET estado = 'liberada'
         WHERE estado IN ('tentativa', 'confirmada')
           AND oferta_id IN (SELECT id FROM ofertas WHERE trabajo_id = $1)`,
        [jobId]
    );
};

const findEsAdmin = async (usuarioId, db = pool) => {
    const { rows } = await db.query(
        `SELECT es_admin FROM usuarios WHERE id = $1`,
        [usuarioId]
    );
    return rows[0]?.es_admin === true;
};

// ─── Flujo de trabajo ─────────────────────────────────────────────────────────

const findOfertaAceptadaDelTrabajador = async (jobId, trabajadorId) => {
    const { rows } = await pool.query(
        `SELECT id FROM ofertas WHERE trabajo_id = $1 AND trabajador_id = $2 AND estado = 'aceptada'`,
        [jobId, trabajadorId]
    );
    return rows[0] || null;
};

const setTrabajadorLlego = async (id, db = pool) => {
    const { rows } = await db.query(
        `UPDATE trabajos SET estado = 'trabajador_llego', hora_inicio_real = NOW(), actualizado_en = NOW()
         WHERE id = $1 AND estado = 'en_negociacion'
         RETURNING id, titulo, dueno_id, hora_inicio_real, latitud, longitud`,
        [id]
    );
    return rows[0] || null;
};

const findOfertaAceptadaTrabajadorId = async (jobId, db = pool) => {
    const { rows } = await db.query(
        `SELECT trabajador_id FROM ofertas WHERE trabajo_id = $1 AND estado = 'aceptada' LIMIT 1`,
        [jobId]
    );
    return rows[0] || null;
};

const setPendienteConfirmacion = async (id, fotoResultadoUrl, textoResultado) => {
    const { rows } = await pool.query(
        `UPDATE trabajos SET
            estado = 'pendiente_confirmacion',
            foto_resultado_url = COALESCE($2, foto_resultado_url),
            texto_resultado    = COALESCE($3, texto_resultado),
            actualizado_en     = NOW()
         WHERE id = $1 AND estado = 'trabajador_llego'
         RETURNING id, titulo, dueno_id`,
        [id, fotoResultadoUrl || null, textoResultado || null]
    );
    return rows[0] || null;
};

const setCompletado = async (id, dueno_id, db = pool) => {
    const { rows } = await db.query(
        `UPDATE trabajos SET estado = 'completado', actualizado_en = NOW()
         WHERE id = $1 AND dueno_id = $2 AND estado = 'pendiente_confirmacion'
         RETURNING id, titulo, rubro_id, fotos_urls, foto_resultado_url, texto_resultado`,
        [id, dueno_id]
    );
    return rows[0] || null;
};

const findOfertaAceptadaConMonto = async (jobId) => {
    const { rows } = await pool.query(
        `SELECT trabajador_id, monto_propuesto FROM ofertas WHERE trabajo_id = $1 AND estado = 'aceptada' LIMIT 1`,
        [jobId]
    );
    return rows[0] || null;
};

// Un trabajo solo puede ejecutarse si el dueño ya pagó: la aprobación viene
// exclusivamente de MercadoPago (webhook / pago directo), nunca de este módulo.
const findPagoAprobadoPorTrabajo = async (jobId, db = pool) => {
    const { rows } = await db.query(
        `SELECT id, monto_total, monto_trabajador FROM pagos
         WHERE referencia_id = $1 AND tipo = 'trabajo' AND estado = 'aprobado'
         ORDER BY creado_en DESC LIMIT 1`,
        [jobId]
    );
    return rows[0] || null;
};

// Liberación del dinero retenido: las distribuciones del pago aprobado pasan
// de 'pendiente' (retenido en plataforma) a 'procesado' (saldo disponible).
const liberarDistribucionesPorTrabajo = async (jobId, db = pool) => {
    const { rowCount } = await db.query(
        `UPDATE distribuciones_pago d
         SET estado = 'procesado', procesado_en = NOW()
         FROM pagos p
         WHERE d.pago_id = p.id
           AND p.referencia_id = $1 AND p.tipo = 'trabajo' AND p.estado = 'aprobado'
           AND d.estado = 'pendiente'`,
        [jobId]
    );
    return rowCount;
};

// ─── Agendar ──────────────────────────────────────────────────────────────────

const findJobParaAgendar = async (jobId, usuarioId) => {
    const { rows } = await pool.query(
        `SELECT t.id, t.dueno_id, o.trabajador_id
         FROM trabajos t
         LEFT JOIN ofertas o ON o.trabajo_id = t.id AND o.estado = 'aceptada'
         WHERE t.id = $1 AND (t.dueno_id = $2 OR o.trabajador_id = $2)
         LIMIT 1`,
        [jobId, usuarioId]
    );
    return rows[0] || null;
};

const updateFechaInicio = async (jobId, fechaInicio) => {
    const { rows } = await pool.query(
        `UPDATE trabajos SET fecha_inicio = $1, actualizado_en = NOW()
         WHERE id = $2 RETURNING id, titulo, fecha_inicio`,
        [fechaInicio, jobId]
    );
    return rows[0] || null;
};

// ─── Trabajos en común entre usuarios ─────────────────────────────────────────

const findTrabajosConUsuario = async (miId, otroId) => {
    const { rows } = await pool.query(
        `SELECT t.id, t.titulo, t.estado, t.dueno_id, t.fecha_inicio,
                o.id AS oferta_id, o.trabajador_id, o.monto_propuesto,
                TRIM(COALESCE(pd.nombre,'') || ' ' || COALESCE(pd.apellido,'')) AS dueno_nombre
         FROM trabajos t
         JOIN ofertas o ON o.trabajo_id = t.id
         LEFT JOIN perfiles pd ON pd.usuario_id = t.dueno_id
         WHERE (t.dueno_id = $1 AND o.trabajador_id = $2)
            OR (t.dueno_id = $2 AND o.trabajador_id = $1)
         ORDER BY t.creado_en DESC
         LIMIT 30`,
        [miId, otroId]
    );
    return rows;
};

// ─── Comentarios ──────────────────────────────────────────────────────────────

const findJobExists = async (trabajoId) => {
    const { rows } = await pool.query(
        `SELECT id FROM trabajos WHERE id = $1`,
        [trabajoId]
    );
    return rows[0] || null;
};

const insertComentario = async (trabajoId, usuarioId, contenido) => {
    const { rows } = await pool.query(
        `INSERT INTO comentarios (trabajo_id, usuario_id, contenido)
         VALUES ($1, $2, $3)
         RETURNING id, contenido, creado_en`,
        [trabajoId, usuarioId, contenido]
    );
    return rows[0];
};

const findPerfilUsuario = async (usuarioId) => {
    const { rows } = await pool.query(
        `SELECT u.email, p.nombre, p.apellido
         FROM usuarios u
         LEFT JOIN perfiles p ON u.id = p.usuario_id
         WHERE u.id = $1`,
        [usuarioId]
    );
    return rows[0] || null;
};

const findComentarios = async (trabajoId) => {
    const { rows } = await pool.query(
        `SELECT c.id, c.contenido, c.creado_en,
                u.email AS usuario_email,
                p.nombre AS usuario_nombre, p.apellido AS usuario_apellido
         FROM comentarios c
         JOIN usuarios u ON c.usuario_id = u.id
         LEFT JOIN perfiles p ON u.id = p.usuario_id
         WHERE c.trabajo_id = $1
         ORDER BY c.creado_en DESC`,
        [trabajoId]
    );
    return rows;
};

module.exports = {
    findFeed,
    insertJob,
    findJobById,
    findMisTrabajos,
    findTrabajosAsignados,
    findJobParaCancelar,
    setCancelado,
    reembolsarPagoPorTrabajo,
    liberarReservasPorTrabajo,
    findEsAdmin,
    findOfertaAceptadaDelTrabajador,
    setTrabajadorLlego,
    findOfertaAceptadaTrabajadorId,
    setPendienteConfirmacion,
    setCompletado,
    findOfertaAceptadaConMonto,
    findPagoAprobadoPorTrabajo,
    liberarDistribucionesPorTrabajo,
    findJobParaAgendar,
    updateFechaInicio,
    findTrabajosConUsuario,
    findJobExists,
    insertComentario,
    findPerfilUsuario,
    findComentarios,
};
