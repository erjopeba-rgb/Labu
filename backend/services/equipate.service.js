const pool = require("../config/db");

const getProductosRecomendados = async ({ rubroId, destacado, limit, offset }) => {
  let where = "WHERE pr.activo = TRUE";
  const params = [];
  let i = 1;
  if (rubroId) { where += ` AND pr.rubro_id = $${i++}`; params.push(rubroId); }
  if (destacado) { where += ` AND pr.destacado = TRUE`; }

  const { rows } = await pool.query(
    `SELECT pr.*, r.nombre AS rubro_nombre,
            pt.nombre_tienda, pt.ciudad, pt.calificacion_promedio
     FROM productos_recomendados pr
     LEFT JOIN rubros r ON r.id = pr.rubro_id
     LEFT JOIN perfiles_tienda pt ON pt.id = pr.tienda_id
     ${where}
     ORDER BY pr.destacado DESC, pr.orden ASC, pr.creado_en DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, limit || 20, offset || 0]
  );
  return rows;
};

const registrarClick = async ({ productoRecomendadoId, usuarioId, ipAddress }) => {
  await pool.query(
    "INSERT INTO clicks_equipate (producto_recomendado_id, usuario_id, ip_address) VALUES ($1,$2,$3)",
    [productoRecomendadoId, usuarioId || null, ipAddress || null]
  );
  return { ok: true };
};

const getEstadisticasEquipate = async (tiendaId) => {
  const { rows: [stats] } = await pool.query(
    `SELECT
       COUNT(DISTINCT pr.id) AS total_productos,
       COUNT(ce.id) AS total_clicks,
       COUNT(ce.id) FILTER (WHERE ce.creado_en > NOW() - INTERVAL '30 days') AS clicks_ultimo_mes
     FROM productos_recomendados pr
     LEFT JOIN clicks_equipate ce ON ce.producto_recomendado_id = pr.id
     WHERE pr.tienda_id = $1`,
    [tiendaId]
  );
  return stats;
};

const getAcuerdoTienda = async (tiendaId) => {
  const { rows: [a] } = await pool.query(
    "SELECT * FROM acuerdos_tienda WHERE tienda_id = $1 AND activo = TRUE",
    [tiendaId]
  );
  return a || null;
};

const getBadgeCamara = async (trabajadorId) => {
  const { rows: [count] } = await pool.query(
    "SELECT COUNT(*) FROM registros_camara WHERE trabajador_id = $1 AND estado = 'activo'",
    [trabajadorId]
  );
  const total = parseInt(count.count);
  const tieneBadge = total >= 3;

  if (tieneBadge) {
    const { rows: [badge] } = await pool.query(
      "SELECT id FROM badges WHERE codigo = 'camara_verificada'",
    );
    if (badge) {
      await pool.query(
        "INSERT INTO badges_usuario (usuario_id, badge_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [trabajadorId, badge.id]
      );
    }
  }

  return { registros_camara: total, tiene_badge: tieneBadge, necesita: Math.max(0, 3 - total) };
};

module.exports = { getProductosRecomendados, registrarClick, getEstadisticasEquipate, getAcuerdoTienda, getBadgeCamara };
