const pool = require("../config/db");
const AppError = require("../utils/AppError");

/**
 * Crea una solicitud de verificación de identidad con 3 fotos.
 * Si el usuario ya tiene una rechazada, la elimina para permitir reenvío.
 * Si ya tiene pendiente o aprobada, lanza error.
 */
const solicitarVerificacion = async (usuarioId, { dniFrenteUrl, dniDorsoUrl, selfieUrl }) => {
  const { rows: existente } = await pool.query(
    `SELECT id, estado FROM verificaciones_identidad
     WHERE usuario_id = $1 AND estado IN ('pendiente', 'aprobado')
     LIMIT 1`,
    [usuarioId]
  );

  if (existente.length) {
    const est = existente[0].estado;
    if (est === "aprobado") throw new AppError("Tu identidad ya está verificada", 400);
    if (est === "pendiente") throw new AppError("Ya tenés una solicitud pendiente de revisión", 400);
  }

  // Eliminar rechazadas anteriores para permitir reenvío
  await pool.query(
    `DELETE FROM verificaciones_identidad
     WHERE usuario_id = $1 AND estado = 'rechazado'`,
    [usuarioId]
  );

  const { rows } = await pool.query(
    `INSERT INTO verificaciones_identidad
       (usuario_id, dni_frente_url, dni_dorso_url, selfie_url, estado)
     VALUES ($1, $2, $3, $4, 'pendiente')
     RETURNING id, estado, creado_en`,
    [usuarioId, dniFrenteUrl, dniDorsoUrl, selfieUrl]
  );
  return rows[0];
};

/**
 * Devuelve el estado de verificación del usuario.
 */
const obtenerEstado = async (usuarioId) => {
  const { rows } = await pool.query(
    `SELECT v.id, v.estado, v.motivo_rechazo, v.creado_en, p.verificado
     FROM perfiles p
     LEFT JOIN verificaciones_identidad v
       ON v.usuario_id = p.usuario_id
     WHERE p.usuario_id = $1
     ORDER BY v.creado_en DESC
     LIMIT 1`,
    [usuarioId]
  );
  if (!rows.length) return { estado: "no_verificado", verificado: false };
  const r = rows[0];
  return {
    verificacion_id: r.id,
    estado:          r.estado || "no_verificado",
    motivo_rechazo:  r.motivo_rechazo,
    creado_en:       r.creado_en,
    verificado:      r.verificado,
  };
};

/**
 * Lista todas las solicitudes de verificación (para admin).
 * Filtra por estado si se indica.
 */
const listarVerificaciones = async (estado) => {
  const condicion = estado ? `AND v.estado = $1` : "";
  const params    = estado ? [estado] : [];
  const { rows } = await pool.query(
    `SELECT v.id, v.usuario_id, v.dni_frente_url, v.dni_dorso_url, v.selfie_url,
            v.estado, v.motivo_rechazo, v.creado_en, v.actualizado_en,
            p.nombre, p.apellido, u.email
     FROM verificaciones_identidad v
     JOIN usuarios u ON u.id = v.usuario_id
     LEFT JOIN perfiles p ON p.usuario_id = v.usuario_id
     WHERE 1=1 ${condicion}
     ORDER BY v.creado_en ASC`,
    params
  );
  return rows;
};

/**
 * Aprueba una verificación y actualiza perfiles.verificado = true.
 */
const aprobarVerificacion = async (id) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE verificaciones_identidad
       SET estado = 'aprobado', motivo_rechazo = NULL, actualizado_en = NOW()
       WHERE id = $1 AND estado = 'pendiente'
       RETURNING id, usuario_id, estado`,
      [id]
    );
    if (!rows.length) throw new AppError("Verificación no encontrada o ya procesada", 404);
    await client.query(
      `UPDATE perfiles SET verificado = TRUE WHERE usuario_id = $1`,
      [rows[0].usuario_id]
    );
    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Rechaza una verificación con motivo obligatorio.
 */
const rechazarVerificacion = async (id, motivo) => {
  const { rows } = await pool.query(
    `UPDATE verificaciones_identidad
     SET estado = 'rechazado', motivo_rechazo = $1, actualizado_en = NOW()
     WHERE id = $2 AND estado = 'pendiente'
     RETURNING id, usuario_id, estado, motivo_rechazo`,
    [motivo, id]
  );
  if (!rows.length) throw new AppError("Verificación no encontrada o ya procesada", 404);
  return rows[0];
};

module.exports = {
  solicitarVerificacion,
  obtenerEstado,
  listarVerificaciones,
  aprobarVerificacion,
  rechazarVerificacion,
};
