const { registrarUsuario, loginUsuario, cambiarPerfilActivo, aceptarTyC, cambiarPassword, obtenerPerfilActivo } = require("../services/auth.service");
const { solicitarRecuperacion, resetearPassword } = require("../services/passwordReset.service");
const { verificarEmailToken, reenviarVerificacion } = require("../services/email-verification.service");
const { successResponse } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");

const register = async (req, res, next) => {
    const { email, password, tipo_perfil, fecha_nacimiento } = req.body;

    if (!email || !password || !tipo_perfil || !fecha_nacimiento) {
        return next(new AppError("Todos los campos son requeridos", 400));
    }

    try {
        const resultado = await registrarUsuario({ email, password, tipo_perfil, fecha_nacimiento });
        successResponse(res, resultado, 201);
    } catch (err) {
        next(err);
    }
};

const login = async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return next(new AppError("Email y contraseña requeridos", 400));
    }

    try {
        const resultado = await loginUsuario({ email, password });
        successResponse(res, resultado);
    } catch (err) {
        next(err);
    }
};

const verificarSesion = async (req, res) => {
    try {
        // Leer perfil_activo y email_verificado frescos desde la DB
        const fila = await obtenerPerfilActivo(req.usuario.id);
        const perfil_activo = fila
            ? (fila.perfil_activo || fila.tipo_perfil)
            : (req.usuario.perfil_activo || req.usuario.tipo_perfil);
        const email_verificado = fila ? (fila.email_verificado || false) : (req.usuario.email_verificado || false);

        successResponse(res, { valido: true, usuario: { ...req.usuario, perfil_activo, email_verificado } });
    } catch (e) {
        successResponse(res, { valido: true, usuario: req.usuario });
    }
};

const cambiarPerfil = async (req, res, next) => {
    const { nuevo_perfil } = req.body;

    if (!nuevo_perfil) {
        return next(new AppError("nuevo_perfil es requerido", 400));
    }

    try {
        const resultado = await cambiarPerfilActivo(req.usuario.id, nuevo_perfil);
        successResponse(res, resultado);
    } catch (err) {
        next(err);
    }
};

const aceptarTyCController = async (req, res, next) => {
    try {
        const resultado = await aceptarTyC(req.usuario.id, req.ip);
        successResponse(res, resultado);
    } catch (err) {
        next(err);
    }
};

const olvideMiPassword = async (req, res, next) => {
    const { email } = req.body;
    if (!email) return next(new AppError("El email es requerido", 400));

    try {
        const resultado = await solicitarRecuperacion(email);
        successResponse(res, resultado);
    } catch (err) {
        next(err);
    }
};

const resetearPasswordController = async (req, res, next) => {
    const { token, nueva_password } = req.body;

    try {
        const resultado = await resetearPassword(token, nueva_password);
        successResponse(res, resultado);
    } catch (err) {
        next(err);
    }
};

const verificarEmailController = async (req, res) => {
    const { token } = req.query;
    try {
        await verificarEmailToken(token);
        return res.redirect("/pages/feed.html?email_verificado=1");
    } catch (err) {
        return res.redirect("/index.html?verif_error=1");
    }
};

const reenviarVerificacionController = async (req, res, next) => {
    try {
        const resultado = await reenviarVerificacion(req.usuario.id);
        successResponse(res, resultado);
    } catch (err) {
        next(err);
    }
};

const cambiarPasswordController = async (req, res, next) => {
    const { password_actual, password_nueva } = req.body;

    if (!password_actual || !password_nueva) {
        return next(new AppError("password_actual y password_nueva son requeridos", 400));
    }

    try {
        const resultado = await cambiarPassword(req.usuario.id, password_actual, password_nueva);
        successResponse(res, resultado);
    } catch (err) {
        next(err);
    }
};

module.exports = { register, login, verificarSesion, cambiarPerfil, aceptarTyCController, olvideMiPassword, resetearPasswordController, verificarEmailController, reenviarVerificacionController, cambiarPasswordController };
