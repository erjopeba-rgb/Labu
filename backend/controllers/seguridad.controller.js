const svc = require("../services/seguridad.service");

const advertencias = (req, res) => res.json(svc.getAdvertencias());

const confirmarAdv = async (req, res) => {
  try {
    if (!req.body.contratacion_id) return res.status(400).json({ error: "contratacion_id requerido" });
    res.json(await svc.confirmarAdvertencias({
      contratacionId: req.body.contratacion_id,
      usuarioId: req.usuario.id,
      ipAddress: req.ip
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const checkAdv = async (req, res) => {
  try {
    res.json({ confirmado: await svc.advertenciasConfirmadas(
      parseInt(req.params.contratacion_id),
      req.usuario.id
    )});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getTyC = async (req, res) => {
  try {
    const tyc = await svc.getTyCVigente();
    if (!tyc) return res.status(404).json({ error: "No hay terminos activos" });
    res.json(tyc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const acceptTyC = async (req, res) => {
  try {
    if (!req.body.version_tyc_id) return res.status(400).json({ error: "version_tyc_id requerido" });
    await svc.aceptarTyC({
      usuarioId: req.usuario.id,
      versionTycId: req.body.version_tyc_id,
      ipAddress: req.ip
    });
    res.json({ mensaje: "Terminos aceptados" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getServiciosMod = async (req, res) => {
  try {
    res.json(await svc.getServiciosPendientes());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const resolverServicio = async (req, res) => {
  try {
    res.json(await svc.resolverModeracion({
      trabajoId: parseInt(req.params.trabajo_id),
      moderadorId: req.usuario.id,
      estado: req.body.estado,
      motivo: req.body.motivo,
      advertenciaPublica: req.body.advertencia_publica || null
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const createGrabacion = async (req, res) => {
  try {
    if (!req.body.archivo_url) return res.status(400).json({ error: "archivo_url requerida" });
    res.status(201).json(await svc.registrarGrabacion({
      trabajoId: parseInt(req.params.trabajo_id),
      trabajadorId: req.usuario.id,
      archivoUrl: req.body.archivo_url,
      duracionSegundos: req.body.duracion_segundos || null,
      tamanoBytes: req.body.tamanio_bytes || null,
      fechaGrabacion: req.body.fecha_grabacion || null
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getGrabacionesByTrabajo = async (req, res) => {
  try {
    res.json(await svc.getGrabaciones(parseInt(req.params.trabajo_id), req.usuario.id));
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
};

module.exports = {
  advertencias, confirmarAdv, checkAdv,
  getTyC, acceptTyC,
  getServiciosMod, resolverServicio,
  createGrabacion, getGrabacionesByTrabajo
};
