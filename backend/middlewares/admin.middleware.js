const pool = require("../config/db");

const verificarAdmin = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT es_admin FROM usuarios WHERE id = $1 AND activo = TRUE",
      [req.usuario.id]
    );
    if (!rows.length || !rows[0].es_admin) {
      return res.status(403).json({ error: "Acceso denegado: se requiere rol administrador" });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: "Error verificando permisos de administrador" });
  }
};

module.exports = { verificarAdmin };
