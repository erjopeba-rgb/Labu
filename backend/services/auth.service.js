const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { generarTokenVerificacion } = require("./email-verification.service");
const logger = require("../config/logger");
const { getLogger } = logger;
const AppError = require("../utils/AppError");
const authRepo = require("../repositories/auth.repository");

const verificarEdad = (fecha_nacimiento) => {
    const hoy = new Date();
    const nacimiento = new Date(fecha_nacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const cumpleEsteAnio = hoy >= new Date(hoy.getFullYear(), nacimiento.getMonth(), nacimiento.getDate());
    if (!cumpleEsteAnio) edad--;
    return edad;
};

const registrarUsuario = async ({ email, password, tipo_perfil, fecha_nacimiento }) => {
    const edad = verificarEdad(fecha_nacimiento);
    if (edad < 18) throw new AppError("Debés tener 18 años o más para registrarte", 403);

    const existe = await authRepo.findByEmail(email);
    if (existe) throw new AppError("El email ya está registrado", 409);

    const password_hash = await bcrypt.hash(password, 12);
    const usuario = await authRepo.insertUser(email, password_hash, tipo_perfil, fecha_nacimiento);

    const token = jwt.sign(
        { id: usuario.id, email: usuario.email, tipo_perfil: usuario.tipo_perfil, perfil_activo: usuario.perfil_activo, email_verificado: false },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const { link } = await generarTokenVerificacion(usuario.id);

    getLogger().info({ usuarioId: usuario.id, email: usuario.email }, 'usuario registrado');

    const respuesta = { token, usuario };
    if (process.env.NODE_ENV !== "production") {
        respuesta.dev_verification_link = link;
    }
    return respuesta;
};

const loginUsuario = async ({ email, password }) => {
    const usuario = await authRepo.findActiveByEmail(email);
    if (!usuario) throw new AppError("Credenciales inválidas", 401);

    const passwordValida = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValida) throw new AppError("Credenciales inválidas", 401);

    const perfil_activo = usuario.perfil_activo || usuario.tipo_perfil;

    const token = jwt.sign(
        {
            id: usuario.id,
            email: usuario.email,
            tipo_perfil: usuario.tipo_perfil,
            perfil_activo,
            email_verificado: usuario.email_verificado || false,
            suspendido: usuario.suspendido || false,
            suspension_hasta: usuario.suspension_hasta || null
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    getLogger().info({ usuarioId: usuario.id, email: usuario.email, perfil_activo }, 'login exitoso');
    return { token, usuario: { id: usuario.id, email: usuario.email, tipo_perfil: usuario.tipo_perfil, perfil_activo, email_verificado: usuario.email_verificado || false } };
};

const cambiarPerfilActivo = async (usuarioId, nuevoPerfil) => {
    const usuario = await authRepo.findById(usuarioId);
    if (!usuario) throw new AppError("Usuario no encontrado", 404);

    const perfilesValidos = ['dueno', 'trabajador'];
    if (!perfilesValidos.includes(nuevoPerfil)) {
        throw new AppError("Perfil inválido. Debe ser 'dueno' o 'trabajador'", 400);
    }

    const primer_vez = usuario.tipo_perfil !== 'ambos' && usuario.tipo_perfil !== nuevoPerfil;
    const nuevo_tipo = primer_vez ? 'ambos' : usuario.tipo_perfil;

    await authRepo.updatePerfilActivo(usuarioId, nuevoPerfil, nuevo_tipo);

    const token = jwt.sign(
        { id: usuario.id, email: usuario.email, tipo_perfil: nuevo_tipo, perfil_activo: nuevoPerfil },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return {
        token,
        usuario: { id: usuario.id, email: usuario.email, tipo_perfil: nuevo_tipo, perfil_activo: nuevoPerfil },
        primer_vez
    };
};

const aceptarTyC = async (usuarioId, ipAddress) => {
    const rowCount = await authRepo.updateTyC(usuarioId);
    if (rowCount === 0) throw new AppError("Usuario no encontrado", 404);

    const tyc = await authRepo.findVersionTyCVigente();
    if (tyc) {
        await authRepo.insertAceptacionTyC(usuarioId, tyc.id, ipAddress);
    }

    return { success: true };
};

const cambiarPassword = async (usuarioId, password_actual, password_nueva) => {
    const row = await authRepo.findPasswordHash(usuarioId);
    if (!row) throw new AppError("Usuario no encontrado", 404);

    const coincide = await bcrypt.compare(password_actual, row.password_hash);
    if (!coincide) throw new AppError("La contraseña actual es incorrecta", 400);

    const nuevo_hash = await bcrypt.hash(password_nueva, 12);
    await authRepo.updatePassword(usuarioId, nuevo_hash);

    return { mensaje: "Contraseña actualizada correctamente" };
};

const obtenerPerfilActivo = async (usuarioId) => {
    return authRepo.findPerfilActivo(usuarioId);
};

module.exports = { registrarUsuario, loginUsuario, cambiarPerfilActivo, aceptarTyC, cambiarPassword, obtenerPerfilActivo };
