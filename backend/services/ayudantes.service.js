const pool = require("../config/db");
const AppError = require("../utils/AppError");

const crearSolicitud = async ({ trabajoId, trabajadorLiderId, cantidadNecesaria, pagoPorAyudante, descripcion }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [trabajo] } = await client.query(
      `SELECT t.id, o.trabajador_id FROM trabajos t
       JOIN ofertas o ON o.trabajo_id = t.id AND o.estado = 'aceptada'
       WHERE t.id = $1`,
      [trabajoId]
    );
    if (!trabajo) throw new AppError("Trabajo no encontrado", 404);
    if (trabajo.trabajador_id !== trabajadorLiderId) throw new AppError("Solo el trabajador principal puede solicitar ayudantes", 403);

    const { rows: [sol] } = await client.query(
      `INSERT INTO solicitudes_ayudante (trabajo_id, trabajador_lider_id, cantidad_necesaria, pago_por_ayudante, descripcion)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [trabajoId, trabajadorLiderId, cantidadNecesaria, pagoPorAyudante, descripcion||null]
    );

    await client.query(
      "UPDATE trabajos SET tiene_solicitud_ayudantes = TRUE WHERE id = $1",
      [trabajoId]
    );

    await client.query("COMMIT");
    return sol;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const getSolicitud = async (solicitudId) => {
  const { rows: [sol] } = await pool.query(
    `SELECT s.*, t.titulo AS trabajo_titulo, u.nombre AS lider_nombre,
            (SELECT COUNT(*) FROM aplicaciones_ayudante WHERE solicitud_id = s.id AND estado = 'aceptado') AS ayudantes_aceptados
     FROM solicitudes_ayudante s
     JOIN trabajos t ON t.id = s.trabajo_id
     JOIN perfiles u ON u.usuario_id = s.trabajador_lider_id
     WHERE s.id = $1`,
    [solicitudId]
  );
  if (!sol) throw new AppError("Solicitud no encontrada", 404);
  return sol;
};

const getSolicitudesAbiertas = async () => {
  const { rows } = await pool.query(
    `SELECT s.*, t.titulo AS trabajo_titulo, t.ciudad, t.rubro_id,
            r.nombre AS rubro_nombre,
            u.nombre AS lider_nombre,
            (SELECT COUNT(*) FROM aplicaciones_ayudante WHERE solicitud_id = s.id AND estado = 'aceptado') AS ayudantes_aceptados
     FROM solicitudes_ayudante s
     JOIN trabajos t ON t.id = s.trabajo_id
     JOIN rubros r ON r.id = t.rubro_id
     JOIN perfiles u ON u.usuario_id = s.trabajador_lider_id
     WHERE s.estado = 'abierta'
     ORDER BY s.creado_en DESC`
  );
  return rows;
};

const aplicarComoAyudante = async ({ solicitudId, ayudanteId }) => {
  const { rows: [sol] } = await pool.query(
    "SELECT id, trabajador_lider_id, estado FROM solicitudes_ayudante WHERE id = $1",
    [solicitudId]
  );
  if (!sol) throw new AppError("Solicitud no encontrada", 404);
  if (sol.estado !== 'abierta') throw new AppError("Esta solicitud ya no esta disponible", 409);
  if (sol.trabajador_lider_id === ayudanteId) throw new AppError("No puedes aplicar a tu propia solicitud", 400);

  const { rows: [app] } = await pool.query(
    `INSERT INTO aplicaciones_ayudante (solicitud_id, ayudante_id)
     VALUES ($1,$2) RETURNING *`,
    [solicitudId, ayudanteId]
  );
  return app;
};

const responderAplicacion = async ({ aplicacionId, liderId, estado }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [app] } = await client.query(
      `SELECT a.*, s.trabajador_lider_id, s.cantidad_necesaria, s.pago_por_ayudante, s.trabajo_id
       FROM aplicaciones_ayudante a
       JOIN solicitudes_ayudante s ON s.id = a.solicitud_id
       WHERE a.id = $1`,
      [aplicacionId]
    );
    if (!app) throw new AppError("Aplicacion no encontrada", 404);
    if (app.trabajador_lider_id !== liderId) throw new AppError("Sin permiso", 403);

    await client.query(
      "UPDATE aplicaciones_ayudante SET estado = $1 WHERE id = $2",
      [estado, aplicacionId]
    );

    if (estado === 'aceptado') {
      const { rows: [count] } = await client.query(
        "SELECT COUNT(*) FROM aplicaciones_ayudante WHERE solicitud_id = $1 AND estado = 'aceptado'",
        [app.solicitud_id]
      );
      if (parseInt(count.count) >= app.cantidad_necesaria) {
        await client.query(
          "UPDATE solicitudes_ayudante SET estado = 'cubierta' WHERE id = $1",
          [app.solicitud_id]
        );
      }

      await client.query(
        `INSERT INTO pagos_ayudante (aplicacion_id, trabajo_id, ayudante_id, trabajador_lider_id, monto)
         VALUES ($1,$2,$3,$4,$5)`,
        [aplicacionId, app.trabajo_id, app.ayudante_id, liderId, app.pago_por_ayudante]
      );
    }

    await client.query("COMMIT");
    return app;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const procesarPagoAyudante = async (trabajoId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: pagos } = await client.query(
      "SELECT * FROM pagos_ayudante WHERE trabajo_id = $1 AND estado = 'pendiente'",
      [trabajoId]
    );

    for (const pago of pagos) {
      await client.query(
        "UPDATE pagos_ayudante SET estado = 'procesado', procesado_en = NOW() WHERE id = $1",
        [pago.id]
      );
    }

    await client.query("COMMIT");
    return pagos.length;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const registrarAmonestacion = async ({ usuarioId, trabajoId, descripcion }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [count] } = await client.query(
      "SELECT COUNT(*) FROM amonestaciones WHERE usuario_id = $1 AND tipo = 'ayudante_no_registrado'",
      [usuarioId]
    );
    const numero = parseInt(count.count) + 1;

    await client.query(
      `INSERT INTO amonestaciones (usuario_id, trabajo_id, tipo, descripcion, numero_amonestacion)
       VALUES ($1,$2,'ayudante_no_registrado',$3,$4)`,
      [usuarioId, trabajoId||null, descripcion, numero]
    );

    if (numero === 1) {
      await client.query(
        `UPDATE perfiles SET descripcion = CONCAT(descripcion, ' [ADVERTENCIA: uso de ayudantes no registrados]')
         WHERE usuario_id = $1`,
        [usuarioId]
      );
    } else if (numero === 2) {
      const hasta = new Date(Date.now() + 7 * 86400000);
      await client.query(
        "UPDATE usuarios SET suspendido = TRUE, suspension_hasta = $1 WHERE id = $2",
        [hasta, usuarioId]
      );
    } else if (numero >= 3) {
      await client.query(
        "UPDATE usuarios SET suspendido = TRUE, suspension_hasta = NULL WHERE id = $1",
        [usuarioId]
      );
    }

    await client.query("COMMIT");
    return { numero_amonestacion: numero };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const getMisAyudantes = async (liderId) => {
  const { rows } = await pool.query(
    `SELECT a.*, p.nombre AS ayudante_nombre, p.promedio_calificacion,
            s.trabajo_id, t.titulo AS trabajo_titulo, s.pago_por_ayudante
     FROM aplicaciones_ayudante a
     JOIN solicitudes_ayudante s ON s.id = a.solicitud_id
     JOIN trabajos t ON t.id = s.trabajo_id
     JOIN perfiles p ON p.usuario_id = a.ayudante_id
     WHERE s.trabajador_lider_id = $1 AND a.estado = 'aceptado'
     ORDER BY a.creado_en DESC`,
    [liderId]
  );
  return rows;
};

const getMisSolicitudesConAplicaciones = async (liderId) => {
  const { rows } = await pool.query(
    `SELECT s.id AS solicitud_id, s.estado AS solicitud_estado,
            s.cantidad_necesaria, s.pago_por_ayudante, s.descripcion,
            t.id AS trabajo_id, t.titulo AS trabajo_titulo,
            a.id AS aplicacion_id, a.estado AS aplicacion_estado,
            a.creado_en AS aplicacion_fecha,
            p.nombre AS ayudante_nombre, p.promedio_calificacion,
            a.ayudante_id
     FROM solicitudes_ayudante s
     JOIN trabajos t ON t.id = s.trabajo_id
     LEFT JOIN aplicaciones_ayudante a ON a.solicitud_id = s.id AND a.estado = 'pendiente'
     LEFT JOIN perfiles p ON p.usuario_id = a.ayudante_id
     WHERE s.trabajador_lider_id = $1
     ORDER BY s.creado_en DESC, a.creado_en DESC`,
    [liderId]
  );
  return rows;
};

module.exports = {
  crearSolicitud, getSolicitud, getSolicitudesAbiertas,
  aplicarComoAyudante, responderAplicacion,
  procesarPagoAyudante, registrarAmonestacion, getMisAyudantes,
  getMisSolicitudesConAplicaciones
};
