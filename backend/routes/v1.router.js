// Router v1 — fuente única de verdad para todas las rutas /api/v1/...
// Montado en /api/v1 (versión explícita) y /api (alias de compatibilidad)
const { Router } = require("express");
const router = Router();

router.use("/auth",           require("./auth.routes"));
router.use("/jobs",           require("./jobs.routes"));
router.use("/offers",         require("./offers.routes"));
router.use("/profile",        require("./profile.routes"));
router.use("/rubros",         require("./rubros.routes"));
router.use("/users",          require("./users.routes"));
router.use("/disponibilidad", require("./disponibilidad.routes"));
router.use("/calificaciones", require("./calificaciones.routes"));
router.use("/catalogo",       require("./catalogo.routes"));
router.use("/portfolio",      require("./portfolio.routes"));
router.use("/geo",            require("./geolocalizacion.routes"));
router.use("/pagos",          require("./pagos.routes"));
router.use("/chat",           require("./chat.routes"));
router.use("/notifications",  require("./notifications.routes"));
router.use("/messages",       require("./messages.routes"));
router.use("/contactos",      require("./contactos.routes"));
router.use("/reportes",       require("./reportes.routes"));
router.use("/verificacion",   require("./verificacion.routes"));
router.use("/disputas",       require("./disputas.routes"));
router.use("/admin",          require("./admin.routes"));
router.use("/confianza",      require("./confianza.routes"));
router.use("/ayudantes",      require("./ayudantes.routes"));
router.use("/denuncias",      require("./denuncias.routes"));
router.use("/seguridad",      require("./seguridad.routes"));
router.use("/estadisticas",   require("./estadisticas.routes"));
router.use("/tienda",         require("./tienda.routes"));
router.use("/equipate",       require("./equipate.routes"));
router.use("/features",       require("./features.routes"));

router.get("/health", async (req, res) => {
  const timestamp = new Date().toISOString();
  try {
    const pool = require("../config/db");
    await pool.query("SELECT 1");
    res.json({ status: "ok", timestamp, db: "ok" });
  } catch {
    res.status(503).json({ status: "degraded", timestamp, db: "error" });
  }
});

module.exports = router;
