const pool = require("../config/db");
const AppError = require("../utils/AppError");

/**
 * Determina el tipo de relacion segun los roles de los dos usuarios.
 * Dueno -> Trabajador = seguidor (auto-aceptado, sin notificacion de solicitud)
 * Resto             = amigo   (necesita aceptacion mutua)
 */
const _determinarTipo = async (solicitanteId, receptorId) => {
    const res = await pool.query(
        "SELECT id, tipo_perfil FROM usuarios WHERE id = ANY($1::int[])",
        [[solicitanteId, receptorId]]
    );
    const por_id = {};
    res.rows.forEach(u => { por_id[u.id] = u.tipo_perfil; });
    if (por_id[solicitanteId] === 'dueno' && por_id[receptorId] === 'trabajador') return 'seguidor';
    return 'amigo';
};

/**
 * Estado de la relacion entre userId y otroId desde el punto de vista de userId.
 * Devuelve: { estado, id, tipo }
 * estado: 'ninguno' | 'pendiente_enviada' | 'pendiente_recibida' | 'aceptado' | 'siguiendo'
 */
const getEstadoContacto = async (userId, otroId) => {
    const tipo = await _determinarTipo(userId, otroId);

    const { rows } = await pool.query(
        `SELECT id, solicitante_id, estado, tipo
         FROM relaciones_usuarios
         WHERE (solicitante_id = $1 AND receptor_id = $2)
            OR (solicitante_id = $2 AND receptor_id = $1)
         LIMIT 1`,
        [userId, otroId]
    );

    if (rows.length === 0) return { estado: 'ninguno', id: null, tipo };

    const rel = rows[0];
    const esSolicitante = String(rel.solicitante_id) === String(userId);

    if (rel.estado === 'aceptado') {
        return {
            estado: rel.tipo === 'seguidor' ? 'siguiendo' : 'aceptado',
            id: rel.id,
            tipo: rel.tipo
        };
    }

    // pendiente
    if (esSolicitante) return { estado: 'pendiente_enviada', id: rel.id, tipo: rel.tipo };
    return { estado: 'pendiente_recibida', id: rel.id, tipo: rel.tipo };
};

/**
 * Envia solicitud de amistad o comienza a seguir (segun roles).
 * Si el tipo es 'seguidor', se auto-acepta sin notificacion de solicitud.
 */
const enviarSolicitud = async (solicitanteId, receptorId, io) => {
    if (String(solicitanteId) === String(receptorId)) {
        throw new AppError('No podes agregarte a vos mismo', 400);
    }

    const tipo   = await _determinarTipo(solicitanteId, receptorId);
    const estado = tipo === 'seguidor' ? 'aceptado' : 'pendiente';

    const { rows } = await pool.query(
        `INSERT INTO relaciones_usuarios (solicitante_id, receptor_id, tipo, estado)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (solicitante_id, receptor_id) DO NOTHING
         RETURNING id`,
        [solicitanteId, receptorId, tipo, estado]
    );

    if (rows.length === 0) throw new AppError('Ya existe una relacion con este usuario', 409);

    // Solo notificar si es solicitud de amistad pendiente
    if (tipo === 'amigo') {
        const perfilRes = await pool.query(
            `SELECT COALESCE(p.nombre || ' ' || COALESCE(p.apellido,''), u.email) AS nombre
             FROM usuarios u LEFT JOIN perfiles p ON p.usuario_id = u.id
             WHERE u.id = $1`,
            [solicitanteId]
        );
        const nombre = (perfilRes.rows[0]?.nombre || 'Un usuario').trim();

        await pool.query(
            `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, referencia_tipo, referencia_id)
             VALUES ($1, 'solicitud_amistad', 'Nueva solicitud de amistad', $2, 'relacion', $3)`,
            [receptorId, `${nombre} te envio una solicitud de amistad`, rows[0].id]
        );

        if (io) {
            io.to(`user_${receptorId}`).emit('nueva_notificacion', {
                tipo: 'solicitud_amistad',
                titulo: 'Nueva solicitud de amistad',
                mensaje: `${nombre} te envio una solicitud de amistad`
            });
        }
    }

    return { id: rows[0].id, tipo, estado };
};

/**
 * Acepta una solicitud de amistad pendiente. Solo el receptor puede hacerlo.
 */
const aceptarSolicitud = async (relacionId, receptorId, io) => {
    const { rows } = await pool.query(
        `UPDATE relaciones_usuarios
         SET estado = 'aceptado'
         WHERE id = $1 AND receptor_id = $2 AND estado = 'pendiente'
         RETURNING solicitante_id`,
        [relacionId, receptorId]
    );

    if (rows.length === 0) throw new AppError('Solicitud no encontrada o ya procesada', 404);

    const solicitanteId = rows[0].solicitante_id;

    const perfilRes = await pool.query(
        `SELECT COALESCE(p.nombre || ' ' || COALESCE(p.apellido,''), u.email) AS nombre
         FROM usuarios u LEFT JOIN perfiles p ON p.usuario_id = u.id
         WHERE u.id = $1`,
        [receptorId]
    );
    const nombre = (perfilRes.rows[0]?.nombre || 'Un usuario').trim();

    await pool.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, referencia_tipo, referencia_id)
         VALUES ($1, 'solicitud_amistad', 'Solicitud aceptada', $2, 'relacion', $3)`,
        [solicitanteId, `${nombre} acepto tu solicitud de amistad`, relacionId]
    );

    if (io) {
        io.to(`user_${solicitanteId}`).emit('nueva_notificacion', {
            tipo: 'solicitud_amistad',
            titulo: 'Solicitud aceptada',
            mensaje: `${nombre} acepto tu solicitud de amistad`
        });
    }

    return { ok: true };
};

/**
 * Rechaza una solicitud pendiente o elimina una relacion existente.
 * Cualquiera de las dos partes puede hacerlo.
 */
const eliminarContacto = async (relacionId, usuarioId) => {
    const { rows } = await pool.query(
        `DELETE FROM relaciones_usuarios
         WHERE id = $1 AND (solicitante_id = $2 OR receptor_id = $2)
         RETURNING id`,
        [relacionId, usuarioId]
    );
    if (rows.length === 0) throw new AppError('Relacion no encontrada', 404);
    return { ok: true };
};

/**
 * Conteos de amigos y seguidores para mostrar en el perfil de un usuario.
 */
const getConteos = async (userId) => {
    const { rows } = await pool.query(
        `SELECT
            COUNT(*) FILTER (
                WHERE tipo = 'amigo' AND estado = 'aceptado'
            ) AS amigos,
            COUNT(*) FILTER (
                WHERE tipo = 'seguidor' AND estado = 'aceptado' AND receptor_id = $1
            ) AS seguidores,
            COUNT(*) FILTER (
                WHERE tipo = 'seguidor' AND estado = 'aceptado' AND solicitante_id = $1
            ) AS siguiendo
         FROM relaciones_usuarios
         WHERE solicitante_id = $1 OR receptor_id = $1`,
        [userId]
    );
    const row = rows[0] || {};
    return {
        amigos:     parseInt(row.amigos     || 0),
        seguidores: parseInt(row.seguidores || 0),
        siguiendo:  parseInt(row.siguiendo  || 0)
    };
};

/**
 * Contactos aceptados del usuario (amigos + seguidos).
 */
const getMisContactos = async (userId, limit = 20, offset = 0) => {
    const { rows } = await pool.query(
        `SELECT
             r.id,
             r.tipo,
             r.creado_en,
             CASE WHEN r.solicitante_id = $1 THEN r.receptor_id ELSE r.solicitante_id END AS otro_id,
             COALESCE(p.nombre || ' ' || COALESCE(p.apellido,''), u.email) AS nombre,
             p.avatar_url,
             u.tipo_perfil,
             COUNT(*) OVER() AS total_count
         FROM relaciones_usuarios r
         JOIN usuarios u ON u.id = CASE WHEN r.solicitante_id = $1 THEN r.receptor_id ELSE r.solicitante_id END
         LEFT JOIN perfiles p ON p.usuario_id = u.id
         WHERE (r.solicitante_id = $1 OR r.receptor_id = $1)
           AND r.estado = 'aceptado'
         ORDER BY nombre
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
    );
    const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0;
    const data = rows.map(({ total_count, ...r }) => r);
    return { data, total };
};

module.exports = {
    getEstadoContacto,
    enviarSolicitud,
    aceptarSolicitud,
    eliminarContacto,
    getConteos,
    getMisContactos
};
