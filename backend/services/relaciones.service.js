const pool = require("../config/db");
const AppError = require("../utils/AppError");

/**
 * Determina el tipo de relacion entre dos usuarios segun sus roles.
 * Dueno -> Trabajador = seguidor (no necesita aceptacion)
 * Resto = amigo (necesita aceptacion)
 */
const determinarTipo = async (solicitanteId, receptorId) => {
    const res = await pool.query(
        "SELECT id, tipo_perfil FROM usuarios WHERE id = ANY($1)",
        [[solicitanteId, receptorId]]
    );
    const por_id = {};
    res.rows.forEach(u => { por_id[u.id] = u.tipo_perfil; });
    const tipoSol = por_id[solicitanteId];
    const tipoRec = por_id[receptorId];
    if (tipoSol === 'dueno' && tipoRec === 'trabajador') return 'seguidor';
    return 'amigo';
};

/**
 * Estado de la relacion entre miId y otroId desde el punto de vista de miId.
 * Devuelve: { estado, id, tipo }
 * estado: 'ninguno' | 'pendiente_enviada' | 'pendiente_recibida' | 'aceptado' | 'siguiendo'
 */
const obtenerEstadoRelacion = async (miId, otroId) => {
    const tipo = await determinarTipo(miId, otroId);

    const res = await pool.query(
        `SELECT id, solicitante_id, estado, tipo
         FROM relaciones_usuarios
         WHERE (solicitante_id = $1 AND receptor_id = $2)
            OR (solicitante_id = $2 AND receptor_id = $1)
         LIMIT 1`,
        [miId, otroId]
    );

    if (res.rows.length === 0) return { estado: 'ninguno', id: null, tipo };

    const rel = res.rows[0];
    const esSolicitante = String(rel.solicitante_id) === String(miId);

    if (rel.estado === 'aceptado') {
        return { estado: rel.tipo === 'seguidor' ? 'siguiendo' : 'aceptado', id: rel.id, tipo: rel.tipo };
    }

    // pendiente
    if (esSolicitante) return { estado: 'pendiente_enviada', id: rel.id, tipo: rel.tipo };
    return { estado: 'pendiente_recibida', id: rel.id, tipo: rel.tipo };
};

/**
 * Envia solicitud de amistad o comienza a seguir segun los roles.
 * Si es seguidor, auto-acepta directamente.
 */
const solicitarContacto = async (solicitanteId, receptorId, io) => {
    const tipo = await determinarTipo(solicitanteId, receptorId);
    const estado = tipo === 'seguidor' ? 'aceptado' : 'pendiente';

    const res = await pool.query(
        `INSERT INTO relaciones_usuarios (solicitante_id, receptor_id, tipo, estado)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (solicitante_id, receptor_id) DO NOTHING
         RETURNING id`,
        [solicitanteId, receptorId, tipo, estado]
    );

    if (res.rows.length === 0) {
        throw new AppError("Ya existe una relacion con este usuario", 409);
    }

    // Notificar solo si es solicitud de amistad (seguidor no necesita notificacion de accion)
    if (tipo === 'amigo') {
        const perfilRes = await pool.query(
            `SELECT p.nombre, p.apellido FROM perfiles p WHERE p.usuario_id = $1`,
            [solicitanteId]
        );
        const p = perfilRes.rows[0] || {};
        const nombreSol = [p.nombre, p.apellido].filter(Boolean).join(' ') || 'Un usuario';

        await pool.query(
            `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, referencia_tipo, referencia_id)
             VALUES ($1, 'solicitud_amistad', 'Nueva solicitud de amistad', $2, 'relacion', $3)`,
            [receptorId, `${nombreSol} te envio una solicitud de amistad`, res.rows[0].id]
        );

        if (io) {
            io.to(`user_${receptorId}`).emit('nueva_notificacion', {
                tipo: 'solicitud_amistad',
                titulo: 'Nueva solicitud de amistad',
                mensaje: `${nombreSol} te envio una solicitud de amistad`
            });
        }
    }

    return { id: res.rows[0].id, tipo, estado };
};

/**
 * Acepta una solicitud de amistad pendiente.
 * Solo el receptor puede aceptar.
 */
const aceptarSolicitud = async (relacionId, receptorId, io) => {
    const res = await pool.query(
        `UPDATE relaciones_usuarios
         SET estado = 'aceptado'
         WHERE id = $1 AND receptor_id = $2 AND estado = 'pendiente'
         RETURNING solicitante_id`,
        [relacionId, receptorId]
    );

    if (res.rows.length === 0) {
        throw new AppError("Solicitud no encontrada o ya procesada", 404);
    }

    const solicitanteId = res.rows[0].solicitante_id;

    // Notificar al solicitante
    const perfilRes = await pool.query(
        `SELECT p.nombre, p.apellido FROM perfiles p WHERE p.usuario_id = $1`,
        [receptorId]
    );
    const p = perfilRes.rows[0] || {};
    const nombreRec = [p.nombre, p.apellido].filter(Boolean).join(' ') || 'Un usuario';

    await pool.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, referencia_tipo, referencia_id)
         VALUES ($1, 'solicitud_amistad', 'Solicitud aceptada', $2, 'relacion', $3)`,
        [solicitanteId, `${nombreRec} acepto tu solicitud de amistad`, relacionId]
    );

    if (io) {
        io.to(`user_${solicitanteId}`).emit('nueva_notificacion', {
            tipo: 'solicitud_amistad',
            titulo: 'Solicitud aceptada',
            mensaje: `${nombreRec} acepto tu solicitud de amistad`
        });
    }

    return { ok: true };
};

/**
 * Rechaza o elimina una relacion.
 * El receptor puede rechazar una pendiente; cualquier parte puede eliminar una aceptada.
 */
const eliminarRelacion = async (relacionId, usuarioId) => {
    const res = await pool.query(
        `DELETE FROM relaciones_usuarios
         WHERE id = $1
           AND (solicitante_id = $2 OR receptor_id = $2)
         RETURNING id`,
        [relacionId, usuarioId]
    );

    if (res.rows.length === 0) {
        throw new AppError("Relacion no encontrada", 404);
    }

    return { ok: true };
};

/**
 * Conteos de amigos y seguidores de un usuario (para mostrar en perfil).
 */
const obtenerConteos = async (userId) => {
    const res = await pool.query(
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

    const row = res.rows[0] || {};
    return {
        amigos:    parseInt(row.amigos    || 0),
        seguidores: parseInt(row.seguidores || 0),
        siguiendo:  parseInt(row.siguiendo  || 0)
    };
};

module.exports = { obtenerEstadoRelacion, solicitarContacto, aceptarSolicitud, eliminarRelacion, obtenerConteos };
