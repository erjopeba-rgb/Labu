const pool = require("../config/db");
const calRepo = require("../repositories/calificaciones.repository");

const crearCalificacion = async ({ trabajoId, calificadorId, puntaje, comentario }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const trabajo = await calRepo.findTrabajoCompletado(trabajoId, client);
    if (!trabajo) throw { status: 404, error: "Trabajo no encontrado o no completado" };

    const esDueno = trabajo.dueno_id === calificadorId;
    const esTrabajador = trabajo.trabajador_id === calificadorId;
    if (!esDueno && !esTrabajador) throw { status: 403, error: "No tienes permiso para calificar este trabajo" };

    const calificadoId = esDueno ? trabajo.trabajador_id : trabajo.dueno_id;
    const tipo = esDueno ? "dueno_a_trabajador" : "trabajador_a_dueno";

    const cal = await calRepo.insertCalificacion(
      { trabajoId, calificadorId, calificadoId, puntaje, comentario, tipo },
      client
    );
    if (!cal) throw { status: 409, error: "Ya calificaste este trabajo" };

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
