const pool = require("../config/db");

// ─── Configuración de plataforma ──────────────────────────────────────────────

const findConfigValue = async (clave) => {
    const { rows: [c] } = await pool.query(
        "SELECT valor FROM configuracion_plataforma WHERE clave = $1",
        [clave]
    );
    return c ? c.valor : null;
};

const findConfigValues = async (claves) => {
    const { rows } = await pool.query(
        "SELECT clave, valor FROM configuracion_plataforma WHERE clave = ANY($1)",
        [claves]
    );
    const result = {};
    for (const row of rows) result[row.clave] = row.valor;
    return result;
};

// ─── Pagos — transaccionales (aceptan db = pool | client) ────────────────────

const findTrabajoPagoData = async (trabajoId, db) => {
    const { rows: [trabajo] } = await db.query(
        `SELECT t.titulo, t.dueno_id, o.trabajador_id, o.id AS oferta_id, CAST(o.monto_propuesto AS float) AS monto_propuesto
         FROM trabajos t
         JOIN ofertas o ON o.trabajo_id = t.id AND o.estado = 'aceptada'
         WHERE t.id = $1`,
        [trabajoId]
    );
    return trabajo || null;
};

const insertPago = async ({ usuario_id, tipo, referencia_id, monto_total, monto_plataforma, monto_trabajador, monto_seguro, metadata }, db) => {
    const { rows: [pago] } = await db.query(
        `INSERT INTO pagos (usuario_id, tipo, referencia_id, monto_total, monto_plataforma, monto_trabajador, monto_seguro, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [usuario_id, tipo, referencia_id, monto_total, monto_plataforma, monto_trabajador, monto_seguro, metadata]
    );
    return pago;
};

const updatePagoPreferenceId = async (pagoId, prefId, db) => {
    await db.query(
        "UPDATE pagos SET mp_preference_id = $1 WHERE id = $2",
        [prefId, pagoId]
    );
};

const findPagoById = async (pagoId, db) => {
    const { rows: [pago] } = await db.query(
        "SELECT * FROM pagos WHERE id = $1",
        [pagoId]
    );
    return pago || null;
};

const updatePagoEstado = async ({ pagoId, estado, paymentId, mpStatus, mpDetail }, db) => {
    await db.query(
        "UPDATE pagos SET estado=$1, mp_payment_id=$2, mp_status=$3, mp_detail=$4, actualizado_en=NOW() WHERE id=$5",
        [estado, String(paymentId), mpStatus, mpDetail, pagoId]
    );
};

const insertDistribucion = async ({ pago_id, destinatario_id, tipo_destinatario, monto }, db) => {
    await db.query(
        `INSERT INTO distribuciones_pago (pago_id, destinatario_id, tipo_destinatario, monto, estado, procesado_en)
         VALUES ($1,$2,$3,$4,'procesado',NOW())`,
        [pago_id, destinatario_id, tipo_destinatario, monto]
    );
};

const findAyudantesPendientes = async (trabajoId, db) => {
    const { rows } = await db.query(
        `SELECT pa.ayudante_id, pa.monto FROM pagos_ayudante pa
         WHERE pa.trabajo_id = $1 AND pa.estado = 'pendiente'`,
        [trabajoId]
    );
    return rows;
};

const updateAyudanteProcesado = async (trabajoId, ayudanteId, db) => {
    await db.query(
        "UPDATE pagos_ayudante SET estado='procesado', procesado_en=NOW() WHERE trabajo_id=$1 AND ayudante_id=$2",
        [trabajoId, ayudanteId]
    );
};

const insertSeguro = async (trabajoId, pagoId, contratadoPor, db) => {
    await db.query(
        "INSERT INTO seguros_trabajo (trabajo_id, pago_id, contratado_por) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
        [trabajoId, pagoId, contratadoPor]
    );
};

const insertAccesoVideo = async (usuarioId, videoId, pagoId, db) => {
    await db.query(
        "INSERT INTO accesos_video (usuario_id, video_id, pago_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
        [usuarioId, videoId, pagoId]
    );
};

const updateVideoVistas = async (videoId, db) => {
    await db.query(
        "UPDATE videos_educativos SET vistas = vistas + 1 WHERE id = $1",
        [videoId]
    );
};

// ─── Videos y accesos — solo pool ────────────────────────────────────────────

const findVideoActivo = async (videoId) => {
    const { rows: [video] } = await pool.query(
        "SELECT * FROM videos_educativos WHERE id = $1 AND activo = TRUE",
        [videoId]
    );
    return video || null;
};

const findAccesoVideo = async (usuarioId, videoId) => {
    const { rows } = await pool.query(
        "SELECT id FROM accesos_video WHERE usuario_id = $1 AND video_id = $2",
        [usuarioId, videoId]
    );
    return rows;
};

const insertPagoVideo = async ({ usuario_id, referencia_id, monto_total, metadata }) => {
    const { rows: [pago] } = await pool.query(
        `INSERT INTO pagos (usuario_id, tipo, referencia_id, monto_total, monto_plataforma, metadata)
         VALUES ($1,'video',$2,$3,$3,$4) RETURNING *`,
        [usuario_id, referencia_id, monto_total, metadata]
    );
    return pago;
};

const updatePagoPreferenceIdSimple = async (pagoId, prefId) => {
    await pool.query(
        "UPDATE pagos SET mp_preference_id = $1 WHERE id = $2",
        [prefId, pagoId]
    );
};

// ─── Historial y desgloses ────────────────────────────────────────────────────

const findHistorialPagos = async (usuarioId) => {
    const { rows } = await pool.query(
        `SELECT p.*,
                CASE p.tipo
                  WHEN 'trabajo' THEN (SELECT titulo FROM trabajos WHERE id = p.referencia_id)
                  WHEN 'video' THEN (SELECT titulo FROM videos_educativos WHERE id = p.referencia_id)
                  ELSE NULL
                END AS referencia_nombre
         FROM pagos p
         WHERE p.usuario_id = $1
         ORDER BY p.creado_en DESC`,
        [usuarioId]
    );
    return rows;
};

const findTrabajoDueno = async (trabajoId) => {
    const { rows: [trabajo] } = await pool.query(
        "SELECT dueno_id FROM trabajos WHERE id = $1",
        [trabajoId]
    );
    return trabajo || null;
};

const findOfertaAceptadaMonto = async (trabajoId) => {
    const { rows: [oferta] } = await pool.query(
        "SELECT trabajador_id, monto_propuesto FROM ofertas WHERE trabajo_id = $1 AND estado = 'aceptada'",
        [trabajoId]
    );
    return oferta || null;
};

// ─── Videos (listado) ─────────────────────────────────────────────────────────

const findVideos = async ({ rubroId, gratis, limit, offset }) => {
    let where = "WHERE v.activo = TRUE";
    const params = [];
    let i = 1;
    if (rubroId) { where += ` AND v.rubro_id = $${i++}`; params.push(rubroId); }
    if (gratis !== undefined) { where += ` AND v.es_gratis = $${i++}`; params.push(gratis); }

    const { rows } = await pool.query(
        `SELECT v.*, u.nombre AS autor_nombre, r.nombre AS rubro_nombre,
                (SELECT ROUND(AVG(puntaje)::numeric,1) FROM calificaciones_video WHERE video_id = v.id) AS calificacion
         FROM videos_educativos v
         JOIN perfiles u ON u.usuario_id = v.autor_id
         LEFT JOIN rubros r ON r.id = v.rubro_id
         ${where}
         ORDER BY v.vistas DESC
         LIMIT $${i++} OFFSET $${i++}`,
        [...params, limit || 20, offset || 0]
    );
    return rows;
};

const findVideoEsGratis = async (videoId) => {
    const { rows: [v] } = await pool.query(
        "SELECT es_gratis FROM videos_educativos WHERE id = $1",
        [videoId]
    );
    return v || null;
};

// ─── Dev: buscar pago por trabajo ─────────────────────────────────────────────

const findPagoByTrabajo = async (trabajoId, db) => {
    const { rows: [pago] } = await (db || pool).query(
        "SELECT * FROM pagos WHERE tipo = 'trabajo' AND referencia_id = $1 ORDER BY creado_en DESC LIMIT 1",
        [trabajoId]
    );
    return pago || null;
};

// ─── Deduplicación de webhooks ────────────────────────────────────────────────

const findWebhookEvent = async (paymentId, tipo) => {
    const { rows } = await pool.query(
        "SELECT id FROM webhook_events WHERE payment_id = $1 AND tipo = $2",
        [String(paymentId), tipo]
    );
    return rows.length > 0;
};

/**
 * Intenta registrar el evento de webhook. Devuelve true si es nuevo (debe
 * procesarse) o false si ya existía (duplicado — ignorar).
 */
const insertWebhookEventIfNew = async (paymentId, tipo, db) => {
    const { rows } = await db.query(
        `INSERT INTO webhook_events (payment_id, tipo)
         VALUES ($1, $2)
         ON CONFLICT (payment_id, tipo) DO NOTHING
         RETURNING id`,
        [String(paymentId), tipo]
    );
    return rows.length > 0;
};

module.exports = {
    findConfigValue,
    findConfigValues,
    findPagoByTrabajo,
    findTrabajoPagoData,
    insertPago,
    updatePagoPreferenceId,
    findPagoById,
    updatePagoEstado,
    insertDistribucion,
    findAyudantesPendientes,
    updateAyudanteProcesado,
    insertSeguro,
    insertAccesoVideo,
    updateVideoVistas,
    findVideoActivo,
    findAccesoVideo,
    insertPagoVideo,
    updatePagoPreferenceIdSimple,
    findHistorialPagos,
    findTrabajoDueno,
    findOfertaAceptadaMonto,
    findVideos,
    findVideoEsGratis,
    findWebhookEvent,
    insertWebhookEventIfNew,
};
