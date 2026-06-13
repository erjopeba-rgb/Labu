const pool = require("../config/db");
const calRepo = require("../repositories/calificaciones.repository");
const AppError = require("../utils/AppError");

const crearCalificacion = async ({ trabajoId, calificadorId, puntaje, comentario }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const trabajo = await calRepo.findTrabajoCompletado(trabajoId, client);
    if (!trabajo) throw new AppError("Trabajo no encontrado o no completado", 404);

    const esDueno = trabajo.dueno_id === calificadorId;
    const esTrabajador = trabajo.trabajador_id === calificadorId;
    if (!esDueno && !esTrabajador) throw new AppError("No tienes permiso para calificar este trabajo", 403);

    const calificadoId = esDueno ? trabajo.trabajador_id : trabajo.dueno_id;
    const tipo = esDueno ? "dueno_a_trabajador" : "trabajador_a_dueno";

    const cal = await calRepo.insertCalificacion(
      { trabajoId, calificadorId, calificadoId, puntaje, comentario, tipo },
      client
    );
    if (!cal) throw new AppError("Ya calificaste este trabajo", 409);

    await calRepo.updatePromedioCalificacion(calificadoId, client);

    await client.query("COMMIT");
    return cal;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const yaCalificado = async (trabajoId, calificadorId) => {
  const rows = await calRepo.findCalificacion(trabajoId, calificadorId);
  return rows.length > 0;
};

const obtenerCalificacionesPorUsuario = async (usuarioId, limit = 10, offset = 0) => {
  return calRepo.findCalificacionesPorUsuario(usuarioId, limit, offset);
};

module.exports = { crearCalificacion, yaCalificado, obtenerCalificacionesPorUsuario };
