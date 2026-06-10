const { solicitarVerificacion, obtenerEstado } = require("../services/verificacion.service");
const { getLogger } = require("../config/logger");
const { saveFile, generarNombreArchivo } = require("../config/storage");

const solicitar = async (req, res) => {
  try {
    const dniFrente = req.files && req.files["dni_frente"] && req.files["dni_frente"][0];
    const dniDorso  = req.files && req.files["dni_dorso"]  && req.files["dni_dorso"][0];
    const selfie    = req.files && req.files["selfie"]      && req.files["selfie"][0];

    if (!dniFrente || !dniDorso || !selfie) {
      return res.status(400).json({ error: "Se requieren las 3 fotos: dni_frente, dni_dorso y selfie" });
    }

    const [dniFrenteUrl, dniDorsoUrl, selfieUrl] = await Promise.all([
      saveFile(dniFrente.buffer, generarNombreArchivo(dniFrente.originalname), "verificaciones"),
      saveFile(dniDorso.buffer,  generarNombreArchivo(dniDorso.originalname),  "verificaciones"),
      saveFile(selfie.buffer,    generarNombreArchivo(selfie.originalname),    "verificaciones"),
    ]);

    const resultado = await solicitarVerificacion(req.usuario.id, {
      dniFrenteUrl,
      dniDorsoUrl,
      selfieUrl,
    });
    res.status(201).json({ verificacion: resultado });
  } catch (err) {
    getLogger().error({ err }, "[VerificacionController] solicitar fallido");
    res.status(err.status || 500).json({ error: err.error || "Error al enviar verificación" });
  }
};

const getEstado = async (req, res) => {
  try {
    const estado = await obtenerEstado(req.usuario.id);
    res.json({ estado });
  } catch (err) {
    getLogger().error({ err }, "[VerificacionController] getEstado fallido");
    res.status(500).json({ error: "Error al obtener estado de verificación" });
  }
};

module.exports = { solicitar, getEstado };
