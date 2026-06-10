const pool = require("../config/db");

const findByTrabajador = async (trabajador_id) => {
    const { rows } = await pool.query(
        `SELECT id, dia_semana, hora_inicio, hora_fin, tiempo_preparacion_minutos
         FROM disponibilidad_trabajador
         WHERE trabajador_id = $1 AND activo = TRUE
         ORDER BY dia_semana, hora_inicio`,
        [trabajador_id]
    );
    return rows;
};

// Reemplaza todos los slots del trabajador en una sola transacción
const replaceSlots = async (trabajador_id, slots, tiempo_preparacion_minutos = 15) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(
            "DELETE FROM disponibilidad_trabajador WHERE trabajador_id = $1",
            [trabajador_id]
        );
        if (slots.length > 0) {
            const dias = [], horasInicio = [], horasFin = [];
            for (const s of slots) {
                dias.push(s.dia_semana);
                horasInicio.push(s.hora_inicio);
                horasFin.push(s.hora_fin);
            }
            const tiempos = Array(slots.length).fill(tiempo_preparacion_minutos);
            await client.query(
                `INSERT INTO disponibilidad_trabajador (trabajador_id, dia_semana, hora_inicio, hora_fin, tiempo_preparacion_minutos)
                 SELECT $1, UNNEST($2::int[]), UNNEST($3::time[]), UNNEST($4::time[]), UNNEST($5::int[])`,
                [trabajador_id, dias, horasInicio, horasFin, tiempos]
            );
        }
        await client.query("COMMIT");
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
};

module.exports = { findByTrabajador, replaceSlots };
