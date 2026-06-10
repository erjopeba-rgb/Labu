const pool = require("../config/db");

const verificarTyC = async (req, res, next) => {
  try {
    const { rows: [tyc] } = await pool.query(
      "SELECT id FROM versiones_tyc WHERE vigente = TRUE LIMIT 1"
    );
    if (!tyc) return next();
    const { rows } = await pool.query(
      "SELECT id FROM aceptaciones_tyc WHERE usuario_id = $1 AND version_tyc_id = $2",
      [req.usuario.id, tyc.id]
    );
    if (rows.length === 0) {
      return res.status(403).json({
        error: "TYCS_PENDIENTES",
        mensaje: "Debes aceptar los Terminos y Condiciones para continuar.",
        redirigir: "/terminos-y-condiciones"
      });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: "Error verificando terminos" });
  }
};

const verificarNoSuspendido = async (req, res, next) => {
  try {
    // Primera capa: verificar desde el payload del JWT (sin query a DB)
    const tokenSuspendido = req.usuario.suspendido;
    if (typeof tokenSuspendido !== "undefined") {
      if (!tokenSuspendido) return next();

      // Está suspendido según el token — verificar si la suspensión ya expiró
      const tokenHasta = req.usuario.suspension_hasta;
      if (tokenHasta && new Date(tokenHasta) < new Date()) {
        // Expiró: levantar suspensión en DB en segundo plano y permitir acceso
        pool.query(
          "UPDATE usuarios SET suspendido = FALSE, suspension_hasta = NULL WHERE id = $1",
          [req.usuario.id]
        ).catch(() => {});
        return next();
      }

      const hasta = tokenHasta
        ? `hasta el ${new Date(tokenHasta).toLocaleDateString("es-AR")}`
        : "de forma permanente";
      return res.status(403).json({
        error: "USUARIO_SUSPENDIDO",
        mensaje: `Tu cuenta esta suspendida ${hasta}.`
      });
    }

    // Fallback: token antiguo sin campo suspendido — consultar DB
    const { rows: [u] } = await pool.query(
      "SELECT suspendido, suspension_hasta FROM usuarios WHERE id = $1",
      [req.usuario.id]
    );
    if (!u) return res.status(401).json({ error: "Usuario no encontrado" });
    if (u.suspendido) {
      if (u.suspension_hasta && new Date(u.suspension_hasta) < new Date()) {
        await pool.query(
          "UPDATE usuarios SET suspendido = FALSE, suspension_hasta = NULL WHERE id = $1",
          [req.usuario.id]
        );
        return next();
      }
      const hasta = u.suspension_hasta
        ? `hasta el ${new Date(u.suspension_hasta).toLocaleDateString("es-AR")}`
        : "de forma permanente";
      return res.status(403).json({
        error: "USUARIO_SUSPENDIDO",
        mensaje: `Tu cuenta esta suspendida ${hasta}.`
      });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: "Error verificando estado de cuenta" });
  }
};

const soloModerador = (req, res, next) => {
  if (req.usuario.tipo_perfil !== "moderador") {
    return res.status(403).json({ error: "Acceso restringido a moderadores" });
  }
  next();
};

module.exports = { verificarTyC, verificarNoSuspendido, soloModerador };
