const { obtenerRubros } = require("../services/rubros.service");

const getRubros = async (req, res) => {
    try {
        const rubros = await obtenerRubros();
        res.json({ success: true, rubros });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.error || "Error interno" });
    }
};

module.exports = { getRubros };