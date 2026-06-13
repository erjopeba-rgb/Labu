const { solicitarVerificacion, obtenerEstado } = require("../services/verificacion.service");
const { saveFile, generarNombreArchivo } = require("../config/storage");
const AppError = require("../utils/AppError");
const { successResponse } = require("../utils/apiResponse");

const solicitar = async (req, res, next) => {
  try {
    const dniFrente = req.files && req.files["dni_frente"] && req.files["dni_frente"][0];
    const dniDorso  = req.files && req.files["dni_dorso"]  && req.files["dni_dorso"][0];
    const selfie    = req.files && req.files["selfie"]      && req.files["selfie"][0];

    if (!dniFrente || !dniDorso || !selfie) {
      throw new AppError("Se requieren las 3 fotos: dni_frente, dni_dorso y selfie", 400);
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
    successResponse(res, { verificacion: resultado }, 201);
  } catch (err) {
    next(err);
  }
};

const getEstado = async (req, res, next) => {
  try {
    const estado = await obtenerEstado(req.usuario.id);
    successResponse(res, { estado });
  } catch (err) {
    next(err);
  }
};

module.exports = { solicitar, getEstado };
