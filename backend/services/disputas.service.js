const pool = require("../config/db");
const notif = require("./notifications.service");
const logger = require("../config/logger");
const jobsRepo = require("../repositories/jobs.repository");

const crearDisputa = async ({ trabajoId, iniciadorId, motivo, descripcion, evidenciaUrls }) => {
  // Solo se permite abrir disputa en estados relevantes
  const { rows: [trabajo] } = await pool.query(
    `SELECT t.id, t.titulo, t.dueno_id, o.trabajador_id
     FROM trabajos t
     JOIN ofertas o ON o.trabajo_id = t.id AND o.estado = 'aceptada'
     WHERE t.id = $1 AND t.estado IN ('completado', 'pendiente_confirmacion')`,
    [trabajoId]
  );
  if (!trabajo) {
    throw { status: 400, error: "El trabajo no existe o no está en un estado que permita abrir una disputa (debe ser completado o pendiente_confirmacion)" };
  }

  const esDueno = trabajo.dueno_id === iniciadorId;
  const esTrabajador = trabajo.trabajador_id === iniciadorId;
  if (!esDueno && !esTrabajador) {
    throw { status: 403, error: "No tenés permiso para abrir una disputa en este trabajo" };
  }

  const acusadoId = esDueno ? trabajo.trabajador_id : trabajo.dueno_id;

  // Evitar disputas duplicadas activas
  const { rows: existente } = await pool.query(
    `SELECT id FROM disputas WHERE trabajo_id = $1 AND estado NOT IN ('resuelta', 'cerrada')`,
    [trabajoId]
  );
  if (existente.length > 0) {
    throw { status: 409, error: "Ya existe una disputa activa para este trabajo" };
  }

  const { rows: [disputa] } = await pool.query(
    `INSERT INTO disputas (trabajo_id, iniciador_id, acusado_id, motivo, descripcion, evidencia_urls)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [trabajoId, iniciadorId, acusadoId, motivo, descripcion || null, JSON.stringify(evidenciaUrls || [])]
  );

  // Notificar a ambas partes (no bloquea si falla)
  try {
    await Promise.all([
      notif.notificarDisputaAbierta(iniciadorId, trabajo.titulo, trabajoId),
      notif.notificarDisputaAbierta(acusadoId,   trabajo.titulo, trabajoId),
    ]);
  } catch (e) {
    logger.error({ err: e.message }, "[disputas] Error enviando notificaciones al abrir disputa");
  }

  logger.info({ disputaId: disputa.id, trabajoId, iniciadorId }, "disputa abierta");
  return disputa;
};

const getMisDisputas = async (usuarioId) => {
  const { rows } = await pool.query(
    `SELECT d.*,
            t.titulo AS trabajo_titulo,
            u1.email AS iniciador_email,
            u2.email AS acusado_email
     FROM disputas d
     JOIN trabajos t  ON t.id  = d.trabajo_id
     JOIN usuarios u1 ON u1.id = d.iniciador_id
     JOIN usuarios u2 ON u2.id = d.acusado_id
     WHERE d.iniciador_id = $1 OR d.acusado_id = $1
     ORDER BY d.creado_en DESC`,
    [usuarioId]
  );
  return rows;
};

const getDisputasAdmin = async () => {
  const { rows } = await pool.query(
    `SELECT d.*,
            t.titulo AS trabajo_titulo,
            u1.email AS iniciador_email,
            u2.email AS acusado_email
     FROM disputas d
     JOIN trabajos t  ON t.id  = d.trabajo_id
     JOIN usuarios u1 ON u1.id = d.iniciador_id
     JOIN usuarios u2 ON u2.id = d.acusado_id
     ORDER BY
       CASE d.estado
         WHEN 'abierta'     THEN 1
         WHEN 'en_revision' THEN 2
         ELSE 3
       END,
       d.creado_en ASC`
  );
  return rows;
};

const marcarEnRevision = async (disputaId) => {
  const { rows: [d] } = await pool.query(
    `UPDATE disputas SET estado = 'en_revision'
     WHERE id = $1 AND estado = 'abierta'
     RETURNING *`,
    [disputaId]
  );
  if (!d) throw { status: 404, error: "Disputa no encontrada o ya no está en estado abierta" };
  return d;
};

// I7: la resolución de la disputa decide el destino del dinero retenido (C4):
// resultado 'trabajador' → liberación (distribuciones 'pendiente' → 'procesado')
// resultado 'dueno'      → reembolso contable (pago 'reembolsado', distribuciones anuladas)
// Resolución parcial por porcentaje: pendiente (ver AUDIT.md, I7).
const RESULTADOS_VALIDOS = ["dueno", "trabajador"];

const resolverDisputa = async (disputaId, resolucion, resultado) => {
  if (!resolucion || !resolucion.trim()) {
    throw { status: 400, error: "La resolución es obligatoria" };
  }
  if (!RESULTADOS_VALIDOS.includes(resultado)) {
    throw { status: 400, error: "El resultado es obligatorio: 'dueno' (reembolsar al dueño) o 'trabajador' (liberar el pago al trabajador)" };
  }

  const client = await pool.connect();
  let d;
  let efecto = {};
  try {
    await client.query("BEGIN");

    // Lectura sin lock solo para conocer el trabajo: los locks se toman en el
    // mismo orden que confirmarCompletado (trabajos → disputas) para evitar deadlocks
    const { rows: [previa] } = await client.query(
      `SELECT trabajo_id FROM disputas WHERE id = $1`,
      [disputaId]
    );
    if (!previa) throw { status: 404, error: "Disputa no encontrada" };

    await client.query(`SELECT id FROM trabajos WHERE id = $1 FOR UPDATE`, [previa.trabajo_id]);

    const { rows: [activa] } = await client.query(
      `SELECT id, trabajo_id FROM disputas
       WHERE id = $1 AND estado IN ('abierta', 'en_revision')
       FOR UPDATE`,
      [disputaId]
    );
    if (!activa) throw { status: 404, error: "Disputa no encontrada o ya fue resuelta" };

    // Efecto económico sobre el dinero retenido, en la misma transacción
    if (resultado === "trabajador") {
      const liberadas = await jobsRepo.liberarDistribucionesPorTrabajo(activa.trabajo_id, client);
      efecto = { distribucionesLiberadas: liberadas };
    } else {
      const reembolsados = await jobsRepo.reembolsarPagoPorDisputa(activa.trabajo_id, client);
      efecto = { pagosReembolsados: reembolsados.length };
    }

    ({ rows: [d] } = await client.query(
      `UPDATE disputas SET estado = 'resuelta', resolucion = $1, resultado = $2
       WHERE id = $3 RETURNING *`,
      [resolucion.trim(), resultado, disputaId]
    ));

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  // Notificar a ambas partes (no bloquea si falla)
  try {
    const { rows: [trabajo] } = await pool.query("SELECT titulo FROM trabajos WHERE id = $1", [d.trabajo_id]);
    const titulo = trabajo?.titulo || "el trabajo";
    await Promise.all([
      notif.notificarDisputaResuelta(d.iniciador_id, titulo, d.resolucion, d.trabajo_id),
      notif.notificarDisputaResuelta(d.acusado_id,   titulo, d.resolucion, d.trabajo_id),
    ]);
  } catch (e) {
    logger.error({ err: e.message }, "[disputas] Error enviando notificaciones al resolver disputa");
  }

  logger.info({ disputaId, resolucion: d.resolucion, resultado, ...efecto }, "disputa resuelta");
  return d;
};

const agregarEvidencia = async (disputaId, usuarioId, urls) => {
    const { rows: [disputa] } = await pool.query(
        `SELECT id, estado FROM disputas WHERE id = $1 AND (iniciador_id = $2 OR acusado_id = $2)`,
        [disputaId, usuarioId]
    );
    if (!disputa) throw { status: 404, error: "Disputa no encontrada o no tenés permiso" };
    if (['resuelta', 'cerrada'].includes(disputa.estado)) {
        throw { status: 400, error: "No se puede agregar evidencia a una disputa cerrada" };
    }
    const { rows: [updated] } = await pool.query(
        `UPDATE disputas SET evidencia_urls = evidencia_urls || $1::jsonb WHERE id = $2 RETURNING evidencia_urls`,
        [JSON.stringify(urls), disputaId]
    );
    return updated.evidencia_urls;
};

module.exports = { crearDisputa, getMisDisputas, getDisputasAdmin, marcarEnRevision, resolverDisputa, agregarEvidencia };
