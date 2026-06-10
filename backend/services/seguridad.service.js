const pool = require("../config/db");

const ADVERTENCIAS = [
  { id:1, icono:"camara",   texto:"Ten camaras de seguridad activas en el hogar durante el servicio." },
  { id:2, icono:"valor",    texto:"Guarda objetos de valor en un lugar seguro antes de que llegue el trabajador." },
  { id:3, icono:"persona",  texto:"Asegurate de estar presente o tener a alguien en casa durante todo el trabajo." },
  { id:4, icono:"estrella", texto:"Revisa el historial de calificaciones del trabajador antes de confirmar." },
  { id:5, icono:"telefono", texto:"Comparte los datos del trabajo con alguien de confianza (nombre, hora, direccion)." },
  { id:6, icono:"llave",    texto:"No entregues llaves sin generar un registro formal en la plataforma." },
];

const getAdvertencias = () => ADVERTENCIAS;

const confirmarAdvertencias = async ({ contratacionId, usuarioId, ipAddress }) => {
  const { rows: [c] } = await pool.query(
    `INSERT INTO advertencias_confirmadas (contratacion_id, usuario_id, ip_address)
     VALUES ($1,$2,$3)
     ON CONFLICT (contratacion_id, usuario_id) DO UPDATE SET confirmado_en=NOW()
     RETURNING *`,
    [contratacionId, usuarioId, ipAddress]
  );
  return c;
};

const advertenciasConfirmadas = async (contratacionId, usuarioId) => {
  const { rows } = await pool.query(
    "SELECT id FROM advertencias_confirmadas WHERE contratacion_id=$1 AND usuario_id=$2",
    [contratacionId, usuarioId]
  );
  return rows.length > 0;
};

const getTyCVigente = async () => {
  const { rows: [tyc] } = await pool.query(
    "SELECT id, version, contenido, created_at FROM versiones_tyc WHERE vigente=TRUE LIMIT 1"
  );
  return tyc || null;
};

const aceptarTyC = async ({ usuarioId, versionTycId, ipAddress }) => {
  await pool.query(
    `INSERT INTO aceptaciones_tyc (usuario_id, version_tyc_id, ip_address)
     VALUES ($1,$2,$3)
     ON CONFLICT (usuario_id, version_tyc_id) DO NOTHING`,
    [usuarioId, versionTycId, ipAddress]
  );
};

const enviarAModeracion = async (trabajoId) => {
  await pool.query(
    `INSERT INTO moderacion_servicios (trabajo_id, estado) VALUES ($1,'pendiente')
     ON CONFLICT (trabajo_id) DO UPDATE SET estado='pendiente', updated_at=NOW()`,
    [trabajoId]
  );
};

const getServiciosPendientes = async () => {
  const { rows } = await pool.query(
    `SELECT m.*, t.titulo, t.descripcion, u.nombre AS creador_nombre
     FROM moderacion_servicios m
     JOIN trabajos t ON t.id=m.trabajo_id
     JOIN usuarios u ON u.id=t.dueno_id
     WHERE m.estado='pendiente'
     ORDER BY m.created_at ASC`
  );
  return rows;
};

const resolverModeracion = async ({ trabajoId, moderadorId, estado, motivo, advertenciaPublica }) => {
  const { rows: [m] } = await pool.query(
    `UPDATE moderacion_servicios
     SET estado=$1, motivo=$2, moderador_id=$3, advertencia_publica=$4, updated_at=NOW()
     WHERE trabajo_id=$5 RETURNING *`,
    [estado, motivo, moderadorId, advertenciaPublica||null, trabajoId]
  );
  if (estado === "rechazado") {
    await pool.query("UPDATE trabajos SET estado='rechazado' WHERE id=$1", [trabajoId]);
  }
  return m;
};

const isRubroSensible = async (rubroId) => {
  const { rows } = await pool.query(
    "SELECT id, advertencia_texto FROM rubros_sensibles WHERE rubro_id=$1 AND requiere_revision=TRUE",
    [rubroId]
  );
  return rows[0] || null;
};

const registrarGrabacion = async ({ trabajoId, trabajadorId, archivoUrl, duracionSegundos, tamanoBytes, fechaGrabacion }) => {
  const { rows: [trabajo] } = await pool.query(
    `SELECT t.id FROM trabajos t
     JOIN ofertas o ON o.trabajo_id=t.id AND o.estado='aceptada'
     WHERE t.id=$1 AND o.trabajador_id=$2 AND t.estado IN ('en_progreso','completado')`,
    [trabajoId, trabajadorId]
  );
  if (!trabajo) throw new Error("No puedes registrar grabaciones para este trabajo");
  const { rows: [reg] } = await pool.query(
    `INSERT INTO registros_camara (trabajo_id, trabajador_id, archivo_url, duracion_segundos, tamanio_bytes, fecha_grabacion)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [trabajoId, trabajadorId, archivoUrl, duracionSegundos||null, tamanoBytes||null, fechaGrabacion||new Date()]
  );
  return reg;
};

const getGrabaciones = async (trabajoId, solicitanteId) => {
  const { rows: [acceso] } = await pool.query(
    `SELECT t.dueno_id, o.trabajador_id, u.tipo_perfil
     FROM trabajos t
     JOIN ofertas o ON o.trabajo_id=t.id AND o.estado='aceptada'
     JOIN usuarios u ON u.id=$2
     WHERE t.id=$1`,
    [trabajoId, solicitanteId]
  );
  if (!acceso) throw new Error("Trabajo no encontrado");
  if (acceso.dueno_id !== solicitanteId && acceso.trabajador_id !== solicitanteId && acceso.tipo_perfil !== "moderador") {
    throw new Error("No tienes permiso para ver estas grabaciones");
  }
  const { rows } = await pool.query(
    `SELECT r.*, u.nombre AS trabajador_nombre
     FROM registros_camara r
     JOIN usuarios u ON u.id=r.trabajador_id
     WHERE r.trabajo_id=$1 AND r.estado='activo'
     ORDER BY r.fecha_grabacion ASC`,
    [trabajoId]
  );
  return rows;
};

module.exports = {
  getAdvertencias, confirmarAdvertencias, advertenciasConfirmadas,
  getTyCVigente, aceptarTyC,
  enviarAModeracion, getServiciosPendientes, resolverModeracion, isRubroSensible,
  registrarGrabacion, getGrabaciones
};
