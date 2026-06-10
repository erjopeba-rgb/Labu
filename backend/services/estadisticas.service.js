const pool = require("../config/db");

const getEstadisticas = async (trabajadorId) => {
  const { rows: [stats] } = await pool.query(
    `SELECT e.*,
            p.promedio_calificacion,
            p.clasificacion
     FROM estadisticas_trabajador e
     JOIN perfiles p ON p.usuario_id = e.trabajador_id
     WHERE e.trabajador_id = $1`,
    [trabajadorId]
  );
  return stats || null;
};

const getBadges = async (trabajadorId) => {
  const { rows } = await pool.query(
    `SELECT b.*, bu.desbloqueado_en
     FROM badges b
     JOIN badges_usuario bu ON bu.badge_id = b.id
     WHERE bu.usuario_id = $1
     ORDER BY bu.desbloqueado_en DESC`,
    [trabajadorId]
  );
  return rows;
};

const getAllBadges = async (trabajadorId) => {
  const { rows } = await pool.query(
    `SELECT b.*,
            bu.desbloqueado_en,
            CASE WHEN bu.id IS NOT NULL THEN TRUE ELSE FALSE END AS desbloqueado
     FROM badges b
     LEFT JOIN badges_usuario bu ON bu.badge_id = b.id AND bu.usuario_id = $1
     ORDER BY b.condicion_valor ASC`,
    [trabajadorId]
  );
  return rows;
};

const actualizarEstadisticas = async (trabajadorId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [stats] } = await client.query(
      `SELECT
         COUNT(DISTINCT h.trabajo_id) FILTER (WHERE h.como_ayudante = FALSE) AS total_trabajos,
         COUNT(DISTINCT h.trabajo_id) FILTER (WHERE h.como_ayudante = TRUE)  AS trabajos_ayudante,
         COUNT(h.calificacion_recibida) AS total_cal,
         COALESCE(SUM(h.calificacion_recibida), 0) AS suma_cal,
         COALESCE(
           COUNT(h.calificacion_recibida) FILTER (WHERE h.calificacion_recibida >= 4) * 100.0
           / NULLIF(COUNT(h.calificacion_recibida), 0), 0
         ) AS pct_positivas,
         MAX(h.fecha_fin) AS ultimo_trabajo
       FROM historial_laboral h
       WHERE h.trabajador_id = $1`,
      [trabajadorId]
    );

    await client.query(
      `INSERT INTO estadisticas_trabajador
         (trabajador_id, total_trabajos, trabajos_como_ayudante, total_calificaciones, suma_calificaciones, porcentaje_positivas, ultimo_trabajo_en, ultima_actividad_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT (trabajador_id) DO UPDATE SET
         total_trabajos            = EXCLUDED.total_trabajos,
         trabajos_como_ayudante    = EXCLUDED.trabajos_como_ayudante,
         total_calificaciones      = EXCLUDED.total_calificaciones,
         suma_calificaciones       = EXCLUDED.suma_calificaciones,
         porcentaje_positivas      = EXCLUDED.porcentaje_positivas,
         ultimo_trabajo_en         = EXCLUDED.ultimo_trabajo_en,
         ultima_actividad_en       = NOW(),
         actualizado_en            = NOW()`,
      [trabajadorId, stats.total_trabajos, stats.trabajos_ayudante, stats.total_cal, stats.suma_cal, stats.pct_positivas, stats.ultimo_trabajo]
    );

    await verificarYOtorgarBadges(client, trabajadorId, stats);

    await verificarEvolucion(client, trabajadorId, stats);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const verificarYOtorgarBadges = async (client, trabajadorId, stats) => {
  const { rows: badges } = await client.query("SELECT * FROM badges");
  const { rows: yaObtenidos } = await client.query(
    "SELECT badge_id FROM badges_usuario WHERE usuario_id = $1", [trabajadorId]
  );
  const obtenidosIds = yaObtenidos.map(b => b.badge_id);

  const promedio = stats.total_cal > 0 ? (stats.suma_cal / stats.total_cal) : 0;

  for (const badge of badges) {
    if (obtenidosIds.includes(badge.id)) continue;

    let cumple = false;
    if (badge.condicion_tipo === 'total_trabajos' && stats.total_trabajos >= badge.condicion_valor) cumple = true;
    if (badge.condicion_tipo === 'racha_dias'     && stats.racha_dias >= badge.condicion_valor)     cumple = true;
    if (badge.condicion_tipo === 'promedio_cal'   && promedio * 10 >= badge.condicion_valor)         cumple = true;
    if (badge.condicion_tipo === 'trabajos_ayud'  && stats.trabajos_ayudante >= badge.condicion_valor) cumple = true;

    if (cumple) {
      await client.query(
        "INSERT INTO badges_usuario (usuario_id, badge_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [trabajadorId, badge.id]
      );
      await client.query(
        "UPDATE perfiles SET total_badges = total_badges + 1 WHERE usuario_id = $1",
        [trabajadorId]
      );
    }
  }
};

const verificarEvolucion = async (client, trabajadorId, stats) => {
  const { rows: [perfil] } = await client.query(
    "SELECT clasificacion FROM perfiles WHERE usuario_id = $1", [trabajadorId]
  );
  if (!perfil || perfil.clasificacion !== 'ayudante') return;

  if (stats.total_trabajos >= 20) {
    await client.query(
      "UPDATE perfiles SET clasificacion = 'independiente' WHERE usuario_id = $1",
      [trabajadorId]
    );
  }
};

const getComparativa = async (trabajadorId, rubroId) => {
  const { rows: [miStats] } = await pool.query(
    "SELECT total_trabajos, porcentaje_positivas FROM estadisticas_trabajador WHERE trabajador_id = $1",
    [trabajadorId]
  );

  const { rows: [promedioRubro] } = await pool.query(
    `SELECT
       ROUND(AVG(e.total_trabajos)::numeric, 1) AS promedio_trabajos,
       ROUND(AVG(e.porcentaje_positivas)::numeric, 1) AS promedio_positivas,
       COUNT(*) AS total_trabajadores
     FROM estadisticas_trabajador e
     JOIN historial_laboral h ON h.trabajador_id = e.trabajador_id
     JOIN trabajos t ON t.id = h.trabajo_id
     WHERE t.rubro_id = $1`,
    [rubroId]
  );

  return {
    yo: miStats || { total_trabajos: 0, porcentaje_positivas: 0 },
    categoria: promedioRubro
  };
};

module.exports = { getEstadisticas, getBadges, getAllBadges, actualizarEstadisticas, getComparativa };
