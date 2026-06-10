const pool = require("../config/db");

const obtenerRubros = async () => {
    const resultado = await pool.query("SELECT * FROM rubros ORDER BY nombre");
    return resultado.rows;
};

module.exports = { obtenerRubros };