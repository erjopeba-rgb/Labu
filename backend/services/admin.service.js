const pool = require("../config/db");
const AppError = require("../utils/AppError");

const listarUsuarios = async () => {
  const { rows } = await pool.query(`
    SELECT u.id, u.email, u.tipo_perfil, u.activo, u.es_admin, u.created_at,
           p.nombre, p.apellido, p.avatar_url, p.calificacion_promedio
    FROM usuarios u
    LEFT JOIN perfiles p ON p.usuario_id = u.id
    ORDER BY u.created_at DESC
  `);
  return rows;
};

const suspenderUsuario = async (id, suspendido) => {
  const nuevoActivo = suspendido ? false : true;
  const { rows } = await pool.query(
    "UPDATE usuarios SET activo = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, activo",
    [nuevoActivo, id]
  );
  if (!rows.length) throw new AppError("Usuario no encontrado", 404);
  return rows[0];
};

const listarReportes = async () => {
  const { rows } = await pool.query(`
    SELECT r.id, r.tipo, r.referencia_id, r.motivo, r.estado, r.resolucion, r.creado_en,
           u.email AS reportado_por_email
    FROM reportes r
    JOIN usuarios u ON u.id = r.reportado_por
    ORDER BY r.creado_en DESC
  `);
  return rows;
};

const resolverReporte = async (id, accion) => {
  const resolucion = accion === "desestimar" ? "desestimado" : "resuelto";
  const { rows } = await pool.query(
    `UPDATE reportes SET estado = 'revisado', resolucion = $1
     WHERE id = $2 RETURNING id, estado, resolucion`,
    [resolucion, id]
  );
  if (!rows.length) throw new AppError("Reporte no encontrado", 404);
  return rows[0];
};

const obtenerConfig = async () => {
  const { rows } = await pool.query(
    "SELECT clave, valor, descripcion, actualizado_en FROM configuracion_plataforma ORDER BY clave"
  );
  return rows;
};

const actualizarConfig = async (updates) => {
  const resultados = [];
  for (const { clave, valor } of updates) {
    const { rows } = await pool.query(
      `UPDATE configuracion_plataforma
         SET valor = $1, actualizado_en = NOW()
       WHERE clave = $2
       RETURNING clave, valor`,
      [String(valor), clave]
    );
    if (rows.length) resultados.push(rows[0]);
  }
  return resultados;
};

const listarVerificaciones = async (estado) => {
  const { listarVerificaciones: listar } = require("./verificacion.service");
  return listar(estado);
};

const aprobarVerificacion = async (id) => {
  const { aprobarVerificacion: aprobar } = require("./verificacion.service");
  return aprobar(id);
};

const rechazarVerificacion = async (id, motivo) => {
  const { rechazarVerificacion: rechazar } = require("./verificacion.service");
  return rechazar(id, motivo);
};

const listarErrores = async () => {
  const { rows } = await pool.query(`
    SELECT el.id, el.mensaje, el.url, el.metodo, el.creado_en,
           u.email AS usuario_email
    FROM error_logs el
    LEFT JOIN usuarios u ON u.id = el.usuario_id
    ORDER BY el.creado_en DESC
    LIMIT 50
  `);
  return rows;
};

module.exports = {
  listarUsuarios,
  suspenderUsuario,
  listarReportes,
  resolverReporte,
  obtenerConfig,
  actualizarConfig,
  listarVerificaciones,
  aprobarVerificacion,
  rechazarVerificacion,
  listarErrores,
};
