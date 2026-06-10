const pool = require("../config/db");

// ─── Perfil principal ─────────────────────────────────────────────────────────

const upsertPerfil = async ({
    usuario_id, nombre, apellido, telefono, ciudad, provincia, descripcion,
    clasificacion, nombre_negocio,
    anios_experiencia, descripcion_habilidades, herramientas,
    disponibilidad_general, medioTransporte
}) => {
    await pool.query(
        `INSERT INTO perfiles (
            usuario_id, nombre, apellido, telefono, ciudad, provincia, descripcion,
            clasificacion, nombre_negocio,
            anios_experiencia, descripcion_habilidades, herramientas, disponibilidad_general,
            medio_transporte
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (usuario_id) DO UPDATE SET
            nombre = $2, apellido = $3, telefono = $4, ciudad = $5,
            provincia = $6, descripcion = $7, clasificacion = $8,
            nombre_negocio = $9, anios_experiencia = $10,
            descripcion_habilidades = $11, herramientas = $12,
            disponibilidad_general = $13,
            medio_transporte = COALESCE($14, perfiles.medio_transporte),
            actualizado_en = NOW()`,
        [
            usuario_id, nombre, apellido || null, telefono || null, ciudad || null,
            provincia || null, descripcion || null, clasificacion || null,
            nombre_negocio || null,
            anios_experiencia != null ? parseInt(anios_experiencia) : null,
            descripcion_habilidades || null,
            herramientas || null,
            disponibilidad_general || null,
            medioTransporte
        ]
    );
};

const updateAvatar = async (usuario_id, avatar_url) => {
    await pool.query(
        "UPDATE perfiles SET avatar_url = $1, actualizado_en = NOW() WHERE usuario_id = $2",
        [avatar_url, usuario_id]
    );
};

const findPerfil = async (usuario_id) => {
    const { rows } = await pool.query("SELECT * FROM perfiles WHERE usuario_id = $1", [usuario_id]);
    return rows[0] || null;
};

// ─── Rubros ───────────────────────────────────────────────────────────────────

const findRubros = async (usuario_id) => {
    const { rows } = await pool.query(
        `SELECT r.id, r.nombre, r.icono FROM perfil_rubros pr
         JOIN rubros r ON r.id = pr.rubro_id
         WHERE pr.usuario_id = $1`,
        [usuario_id]
    );
    return rows;
};

const replaceRubros = async (usuario_id, rubros) => {
    await pool.query("DELETE FROM perfil_rubros WHERE usuario_id = $1", [usuario_id]);
    for (const rubro_id of rubros) {
        await pool.query(
            "INSERT INTO perfil_rubros (usuario_id, rubro_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [usuario_id, rubro_id]
        );
    }
};

// ─── Zonas ────────────────────────────────────────────────────────────────────

const findZonas = async (usuario_id) => {
    const { rows } = await pool.query(
        "SELECT localidad FROM perfil_zonas WHERE usuario_id = $1 ORDER BY id",
        [usuario_id]
    );
    return rows;
};

const replaceZonas = async (usuario_id, zonas) => {
    await pool.query("DELETE FROM perfil_zonas WHERE usuario_id = $1", [usuario_id]);
    for (const localidad of zonas) {
        if (localidad && localidad.trim()) {
            await pool.query(
                "INSERT INTO perfil_zonas (usuario_id, localidad) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                [usuario_id, localidad.trim()]
            );
        }
    }
};

// ─── Perfil público ───────────────────────────────────────────────────────────

const findUsuarioActivo = async (usuario_id) => {
    const { rows } = await pool.query(
        "SELECT id, email, tipo_perfil FROM usuarios WHERE id = $1 AND activo = TRUE",
        [usuario_id]
    );
    return rows[0] || null;
};

const findStats = async (usuario_id) => {
    const { rows } = await pool.query(
        `SELECT
            COUNT(*)                                        AS trabajos_completados,
            AVG(c.puntaje)                                 AS rating,
            COUNT(c.id)                                    AS total_resenas,
            ROUND(COUNT(*) FILTER (WHERE t.estado = 'completado')::numeric
                  / NULLIF(COUNT(*), 0) * 100)             AS tasa_exito
         FROM trabajos t
         LEFT JOIN calificaciones c ON c.trabajo_id = t.id AND c.calificador_id != $1
         WHERE t.dueno_id = $1
            OR EXISTS (
                SELECT 1 FROM ofertas o
                WHERE o.trabajo_id = t.id AND o.trabajador_id = $1 AND o.estado = 'aceptada'
            )`,
        [usuario_id]
    );
    return rows[0] || {};
};

const findResenas = async (usuario_id) => {
    const { rows } = await pool.query(
        `SELECT c.puntaje AS rating, c.comentario, c.created_at,
                p.nombre AS autor_nombre, p.apellido AS autor_apellido
         FROM calificaciones c
         JOIN perfiles p ON p.usuario_id = c.calificador_id
         WHERE c.calificado_id = $1
         ORDER BY c.created_at DESC
         LIMIT 10`,
        [usuario_id]
    );
    return rows;
};

const findTotalTrabajosCompletados = async (usuario_id) => {
    const { rows } = await pool.query(
        "SELECT COALESCE(total_trabajos, 0) AS total FROM estadisticas_trabajador WHERE trabajador_id = $1",
        [usuario_id]
    );
    return rows[0] ? parseInt(rows[0].total) : 0;
};

module.exports = {
    upsertPerfil,
    updateAvatar,
    findPerfil,
    findRubros,
    replaceRubros,
    findZonas,
    replaceZonas,
    findUsuarioActivo,
    findStats,
    findResenas,
    findTotalTrabajosCompletados,
};
