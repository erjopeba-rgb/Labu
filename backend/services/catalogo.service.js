const pool = require("../config/db");

// Obtener rubros con conteo de trabajadores por rubro
const getRubrosConConteo = async () => {
  const { rows } = await pool.query(
    `SELECT r.id, r.nombre, r.descripcion, r.icono,
            COUNT(DISTINCT ct.trabajador_id) AS total_trabajadores,
            COUNT(DISTINCT t.id) AS total_tareas
     FROM rubros r
     LEFT JOIN tareas t ON t.rubro_id = r.id AND t.activo = TRUE
     LEFT JOIN catalogo_trabajador ct ON ct.tarea_id = t.id AND ct.activo = TRUE
     WHERE r.activo = TRUE
     GROUP BY r.id, r.nombre, r.descripcion, r.icono
     ORDER BY r.nombre`
  );
  return rows;
};

// Obtener todos los rubros con sus tareas
const getRubrosConTareas = async () => {
  const { rows: rubros } = await pool.query(
    "SELECT * FROM rubros WHERE activo = TRUE ORDER BY nombre"
  );
  const { rows: tareas } = await pool.query(
    "SELECT * FROM tareas WHERE activo = TRUE ORDER BY rubro_id, nombre"
  );
  return rubros.map(r => ({
    ...r,
    tareas: tareas.filter(t => t.rubro_id === r.id)
  }));
};

// Obtener tareas de un rubro especifico
const getTareasByRubro = async (rubroId) => {
  const { rows } = await pool.query(
    "SELECT * FROM tareas WHERE rubro_id = $1 AND activo = TRUE ORDER BY nombre",
    [rubroId]
  );
  return rows;
};

// Catalogo del trabajador: sus tareas con precios propios
const getCatalogoTrabajador = async (trabajadorId) => {
  const { rows } = await pool.query(
    `SELECT ct.*, t.nombre AS tarea_nombre, t.unidad_medida AS unidad_referencia,
            t.precio_referencia_min, t.precio_referencia_max,
            r.nombre AS rubro_nombre
     FROM catalogo_trabajador ct
     JOIN tareas t ON t.id = ct.tarea_id
     JOIN rubros r ON r.id = t.rubro_id
     WHERE ct.trabajador_id = $1 AND ct.activo = TRUE
     ORDER BY r.nombre, t.nombre`,
    [trabajadorId]
  );
  return rows;
};

// Agregar o actualizar item en catalogo del trabajador
const upsertCatalogoItem = async ({ trabajadorId, tareaId, precio, unidadMedida, descripcionExtra }) => {
  // Verificar que no tenga trabajos activos con esta tarea
  const { rows: activos } = await pool.query(
    `SELECT t.id FROM trabajos t
     JOIN ofertas o ON o.trabajo_id = t.id AND o.estado = 'aceptada'
     WHERE o.trabajador_id = $1 AND t.tarea_id = $2
     AND t.estado NOT IN ('completado','cancelado','rechazado')`,
    [trabajadorId, tareaId]
  );
  if (activos.length > 0) {
    throw new Error("No puedes modificar el precio de una tarea con un trabajo activo");
  }

  const { rows: [item] } = await pool.query(
    `INSERT INTO catalogo_trabajador (trabajador_id, tarea_id, precio, unidad_medida, descripcion_extra)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (trabajador_id, tarea_id) DO UPDATE SET
       precio = EXCLUDED.precio,
       unidad_medida = EXCLUDED.unidad_medida,
       descripcion_extra = EXCLUDED.descripcion_extra,
       activo = TRUE,
       actualizado_en = NOW()
     RETURNING *`,
    [trabajadorId, tareaId, precio, unidadMedida, descripcionExtra || null]
  );
  return item;
};

// Eliminar item del catalogo
const deleteCatalogoItem = async (trabajadorId, tareaId) => {
  const { rows: activos } = await pool.query(
    `SELECT t.id FROM trabajos t
     JOIN ofertas o ON o.trabajo_id = t.id AND o.estado = 'aceptada'
     WHERE o.trabajador_id = $1 AND t.tarea_id = $2
     AND t.estado NOT IN ('completado','cancelado','rechazado')`,
    [trabajadorId, tareaId]
  );
  if (activos.length > 0) {
    throw new Error("No puedes eliminar una tarea con un trabajo activo");
  }
  await pool.query(
    "UPDATE catalogo_trabajador SET activo = FALSE WHERE trabajador_id = $1 AND tarea_id = $2",
    [trabajadorId, tareaId]
  );
};

// Calculador de precio promedio para una tarea
const getPrecioPromedio = async (tareaId) => {
  const { rows: [tarea] } = await pool.query(
    "SELECT nombre, unidad_medida, precio_referencia_min, precio_referencia_max FROM tareas WHERE id = $1",
    [tareaId]
  );
  if (!tarea) throw new Error("Tarea no encontrada");

  const { rows: [stats] } = await pool.query(
    `SELECT 
       ROUND(AVG(precio)::numeric, 2) AS promedio,
       MIN(precio) AS minimo,
       MAX(precio) AS maximo,
       COUNT(*) AS total_trabajadores
     FROM catalogo_trabajador
     WHERE tarea_id = $1 AND activo = TRUE`,
    [tareaId]
  );

  return {
    tarea: tarea.nombre,
    unidad_medida: tarea.unidad_medida,
    precio_referencia_min: tarea.precio_referencia_min,
    precio_referencia_max: tarea.precio_referencia_max,
    mercado: {
      promedio: stats.promedio,
      minimo: stats.minimo,
      maximo: stats.maximo,
      total_trabajadores: parseInt(stats.total_trabajadores)
    }
  };
};

// Comparador: precio de una oferta vs promedio del mercado
const compararPrecio = async (tareaId, montoOferta) => {
  const data = await getPrecioPromedio(tareaId);
  const promedio = parseFloat(data.mercado.promedio) || 0;
  let evaluacion = "sin_datos";
  let diferencia_pct = null;

  if (promedio > 0) {
    diferencia_pct = Math.round(((montoOferta - promedio) / promedio) * 100);
    if (diferencia_pct < -20) evaluacion = "muy_bajo";
    else if (diferencia_pct < -5) evaluacion = "bajo";
    else if (diferencia_pct <= 5) evaluacion = "justo";
    else if (diferencia_pct <= 20) evaluacion = "alto";
    else evaluacion = "muy_alto";
  }

  return { ...data, oferta: montoOferta, evaluacion, diferencia_pct };
};

// Generar comprobante al completar trabajo
const generarComprobante = async (trabajoId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [trabajo] } = await client.query(
      `SELECT t.*, o.id AS oferta_id, o.trabajador_id, o.monto_propuesto,
              ta.nombre AS tarea_nombre, r.nombre AS rubro_nombre
       FROM trabajos t
       JOIN ofertas o ON o.trabajo_id = t.id AND o.estado = 'aceptada'
       LEFT JOIN tareas ta ON ta.id = t.tarea_id
       LEFT JOIN rubros r ON r.id = t.rubro_id
       WHERE t.id = $1 AND t.estado = 'completado'`,
      [trabajoId]
    );

    if (!trabajo) throw new Error("Trabajo no encontrado o no completado");

    // Verificar que no tenga ya comprobante
    const { rows: existe } = await client.query(
      "SELECT id FROM comprobantes WHERE trabajo_id = $1",
      [trabajoId]
    );
    if (existe.length > 0) throw new Error("Este trabajo ya tiene un comprobante");

    const numero = `RT-${Date.now()}-${String(await client.query("SELECT nextval('comprobantes_numero_seq')").then(r => r.rows[0].nextval)).padStart(6,'0')}`;

    const descripcion = trabajo.tarea_nombre
      ? `${trabajo.rubro_nombre} - ${trabajo.tarea_nombre}: ${trabajo.titulo}`
      : trabajo.titulo;

    const { rows: [comp] } = await client.query(
      `INSERT INTO comprobantes (trabajo_id, oferta_id, dueno_id, trabajador_id, monto_final, descripcion_trabajo, numero_comprobante)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [trabajoId, trabajo.oferta_id, trabajo.dueno_id, trabajo.trabajador_id, trabajo.monto_propuesto, descripcion, numero]
    );

    await client.query("COMMIT");
    return comp;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const getComprobante = async (trabajoId, usuarioId) => {
  const { rows: [comp] } = await pool.query(
    `SELECT c.*, 
            ud.nombre AS dueno_nombre, ud.email AS dueno_email,
            ut.nombre AS trabajador_nombre, ut.email AS trabajador_email,
            t.titulo, t.descripcion
     FROM comprobantes c
     JOIN usuarios ud ON ud.id = c.dueno_id
     JOIN usuarios ut ON ut.id = c.trabajador_id
     JOIN trabajos t ON t.id = c.trabajo_id
     WHERE c.trabajo_id = $1`,
    [trabajoId]
  );
  if (!comp) throw new Error("Comprobante no encontrado");
  if (comp.dueno_id !== usuarioId && comp.trabajador_id !== usuarioId) {
    throw new Error("No tienes permiso para ver este comprobante");
  }
  return comp;
};

module.exports = {
  getRubrosConConteo,
  getRubrosConTareas, getTareasByRubro,
  getCatalogoTrabajador, upsertCatalogoItem, deleteCatalogoItem,
  getPrecioPromedio, compararPrecio,
  generarComprobante, getComprobante
};
