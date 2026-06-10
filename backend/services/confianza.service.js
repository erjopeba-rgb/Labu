const pool = require("../config/db");

// ─── TRABAJADORES DE CONFIANZA ────────────────────────────────────────────────

const getTrabajadoresConfianza = async (duenioId) => {
  const { rows } = await pool.query(
    `SELECT tc.*, p.nombre, p.apellido, p.avatar_url, p.ciudad, p.provincia,
            p.promedio_calificacion, p.total_trabajos_completados, p.clasificacion
     FROM trabajadores_confianza tc
     JOIN perfiles p ON p.usuario_id = tc.trabajador_id
     WHERE tc.dueno_id = $1
     ORDER BY tc.creado_en DESC`,
    [duenioId]
  );
  return rows;
};

const addTrabajadorConfianza = async (duenioId, trabajadorId, nota) => {
  if (duenioId === trabajadorId) throw new Error("No puedes agregarte a ti mismo");
  const { rows: [u] } = await pool.query(
    "SELECT tipo_perfil FROM usuarios WHERE id = $1", [trabajadorId]
  );
  if (!u || u.tipo_perfil !== 'trabajador') throw new Error("El usuario no es un trabajador");
  const { rows: [tc] } = await pool.query(
    `INSERT INTO trabajadores_confianza (dueno_id, trabajador_id, nota)
     VALUES ($1,$2,$3)
     ON CONFLICT (dueno_id, trabajador_id) DO UPDATE SET nota = EXCLUDED.nota
     RETURNING *`,
    [duenioId, trabajadorId, nota || null]
  );
  return tc;
};

const removeTrabajadorConfianza = async (duenioId, trabajadorId) => {
  const { rows: [tc] } = await pool.query(
    "DELETE FROM trabajadores_confianza WHERE dueno_id = $1 AND trabajador_id = $2 RETURNING id",
    [duenioId, trabajadorId]
  );
  if (!tc) throw new Error("Trabajador no encontrado en tu lista de confianza");
};

// ─── HISTORIAL COMPARTIDO ─────────────────────────────────────────────────────

const getHistorialCompartido = async (duenioId, trabajadorId) => {
  const { rows } = await pool.query(
    `SELECT t.*, r.nombre AS rubro_nombre, ta.nombre AS tarea_nombre,
            o.monto_propuesto, o.creado_en AS oferta_fecha,
            c.puntaje AS calificacion_al_trabajador,
            comp.numero_comprobante
     FROM trabajos t
     JOIN ofertas o ON o.trabajo_id = t.id AND o.estado = 'aceptada' AND o.trabajador_id = $2
     LEFT JOIN rubros r ON r.id = t.rubro_id
     LEFT JOIN tareas ta ON ta.id = t.tarea_id
     LEFT JOIN calificaciones c ON c.trabajo_id = t.id AND c.calificador_id = $1
     LEFT JOIN comprobantes comp ON comp.trabajo_id = t.id
     WHERE t.dueno_id = $1
     ORDER BY t.creado_en DESC`,
    [duenioId, trabajadorId]
  );
  return rows;
};

// ─── MANTENIMIENTO RECURRENTE ─────────────────────────────────────────────────

const getMantenimientos = async (duenioId) => {
  const { rows } = await pool.query(
    `SELECT m.*, p.nombre AS trabajador_nombre, p.avatar_url,
            r.nombre AS rubro_nombre, ta.nombre AS tarea_nombre,
            m.proximo_vencimiento <= NOW()::date AS vencido
     FROM mantenimientos_recurrentes m
     JOIN perfiles p ON p.usuario_id = m.trabajador_id
     LEFT JOIN rubros r ON r.id = m.rubro_id
     LEFT JOIN tareas ta ON ta.id = m.tarea_id
     WHERE m.dueno_id = $1 AND m.activo = TRUE
     ORDER BY m.proximo_vencimiento ASC`,
    [duenioId]
  );
  return rows;
};

const crearMantenimiento = async ({ duenioId, trabajadorId, tareaId, rubroId, titulo, descripcion, frecuencia, proximoVencimiento }) => {
  const { rows: [tc] } = await pool.query(
    "SELECT id FROM trabajadores_confianza WHERE dueno_id = $1 AND trabajador_id = $2",
    [duenioId, trabajadorId]
  );
  if (!tc) throw new Error("Solo puedes programar mantenimiento con trabajadores de tu lista de confianza");

  const { rows: [m] } = await pool.query(
    `INSERT INTO mantenimientos_recurrentes (dueno_id, trabajador_id, tarea_id, rubro_id, titulo, descripcion, frecuencia, proximo_vencimiento)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [duenioId, trabajadorId, tareaId||null, rubroId||null, titulo, descripcion||null, frecuencia, proximoVencimiento]
  );
  return m;
};

const actualizarVencimiento = async (mantenimientoId, duenioId, trabajoId) => {
  const { rows: [m] } = await pool.query(
    "SELECT * FROM mantenimientos_recurrentes WHERE id = $1 AND dueno_id = $2",
    [mantenimientoId, duenioId]
  );
  if (!m) throw new Error("Mantenimiento no encontrado");

  const fechas = {
    semanal: 7, quincenal: 15, mensual: 30,
    bimestral: 60, trimestral: 90, anual: 365
  };
  const dias = fechas[m.frecuencia] || 30;
  const nuevo = new Date();
  nuevo.setDate(nuevo.getDate() + dias);

  const { rows: [updated] } = await pool.query(
    `UPDATE mantenimientos_recurrentes
     SET proximo_vencimiento = $1, ultimo_trabajo_id = $2, actualizado_en = NOW()
     WHERE id = $3 RETURNING *`,
    [nuevo.toISOString().split('T')[0], trabajoId || null, mantenimientoId]
  );
  return updated;
};

const eliminarMantenimiento = async (mantenimientoId, duenioId) => {
  const { rows: [m] } = await pool.query(
    "UPDATE mantenimientos_recurrentes SET activo = FALSE WHERE id = $1 AND dueno_id = $2 RETURNING id",
    [mantenimientoId, duenioId]
  );
  if (!m) throw new Error("Mantenimiento no encontrado o sin permiso");
};

const getProximosVencimientos = async (duenioId, dias) => {
  const limite = new Date();
  limite.setDate(limite.getDate() + (dias || 7));
  const { rows } = await pool.query(
    `SELECT m.*, p.nombre AS trabajador_nombre, r.nombre AS rubro_nombre
     FROM mantenimientos_recurrentes m
     JOIN perfiles p ON p.usuario_id = m.trabajador_id
     LEFT JOIN rubros r ON r.id = m.rubro_id
     WHERE m.dueno_id = $1 AND m.activo = TRUE AND m.proximo_vencimiento <= $2
     ORDER BY m.proximo_vencimiento ASC`,
    [duenioId, limite.toISOString().split('T')[0]]
  );
  return rows;
};

// ─── NIVEL DE CONFIANZA ───────────────────────────────────────────────────────

/**
 * Calcula el nivel de confianza a partir de trabajos completados.
 * Nuevo → Bronce → Plata → Oro → Platino
 */
const calcularNivel = (totalTrabajos) => {
  const n = parseInt(totalTrabajos) || 0;
  if (n >= 100) return 'platino';
  if (n >= 50)  return 'oro';
  if (n >= 10)  return 'plata';
  if (n >= 1)   return 'bronce';
  return 'nuevo';
};

const getNivelConfianza = async (usuarioId) => {
  const { rows: [et] } = await pool.query(
    'SELECT COALESCE(total_trabajos, 0) AS total FROM estadisticas_trabajador WHERE trabajador_id = $1',
    [usuarioId]
  );
  const total = et ? parseInt(et.total) : 0;
  return { nivel: calcularNivel(total), total_trabajos: total };
};

module.exports = {
  getTrabajadoresConfianza, addTrabajadorConfianza, removeTrabajadorConfianza,
  getHistorialCompartido,
  getMantenimientos, crearMantenimiento, actualizarVencimiento, eliminarMantenimiento, getProximosVencimientos,
  calcularNivel, getNivelConfianza
};
