const pool = require("../config/db");
const AppError = require("../utils/AppError");

const crearReporte = async ({ tipo, referenciaId, reportadoPor, motivo }) => {
  const { rows } = await pool.query(
    `INSERT INTO reportes (tipo, referencia_id, reportado_por, motivo)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tipo, referencia_id, reportado_por) DO NOTHING
     RETURNING id`,
    [tipo, referenciaId, reportadoPor, motivo]
  );
  if (rows.length === 0) {
    throw new AppError("Ya reportaste este contenido anteriormente", 409);
  }
  return rows[0];
};

module.exports = { crearReporte };
