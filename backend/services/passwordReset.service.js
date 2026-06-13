const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { encolarEmail } = require("../workers/emailWorker");
const logger = require("../config/logger");
const AppError = require("../utils/AppError");

// Tiempo de expiración del token: 1 hora
const EXPIRACION_MS = 60 * 60 * 1000;

const _templateReset = (link) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
  <h2 style="color: #222;">Recuperá tu contraseña en Labu</h2>
  <p style="color: #555;">Recibimos una solicitud para resetear la contraseña de tu cuenta.</p>
  <a href="${link}"
     style="display: inline-block; background: #dc3545; color: #fff;
            padding: 12px 28px; text-decoration: none; border-radius: 6px;
            font-size: 16px; margin: 16px 0;">
    Resetear contraseña
  </a>
  <p style="color: #999; font-size: 12px; margin-top: 24px;">
    Este link expira en 1 hora.<br>
    Si no solicitaste el reset, podés ignorar este email — tu contraseña no cambia.
  </p>
</div>`.trim();

const solicitarRecuperacion = async (email) => {
    // Verificar si el email existe (respuesta siempre genérica para no revelar si existe)
    const { rows } = await pool.query(
        "SELECT id FROM usuarios WHERE email = $1 AND activo = TRUE",
        [email]
    );

    if (rows.length === 0) {
        return { mensaje: "Si el email está registrado, recibirás el link de recuperación." };
    }

    // Eliminar tokens previos del mismo email
    await pool.query("DELETE FROM password_resets WHERE email = $1", [email]);

    // Generar token seguro
    const token = crypto.randomBytes(48).toString("hex");
    const expires_at = new Date(Date.now() + EXPIRACION_MS);

    await pool.query(
        "INSERT INTO password_resets (email, token, expires_at) VALUES ($1, $2, $3)",
        [email, token, expires_at]
    );

    // Link relativo — sirve para tests y para construir la URL absoluta del email.
    const linkRelativo = `/pages/reset-password.html?token=${token}`;
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const linkAbsoluto = `${appUrl}${linkRelativo}`;

    // Enviar email si no estamos en test.
    // El fallo de email no bloquea el reset — el token ya está en la DB y el usuario puede reintentar.
    if (process.env.NODE_ENV !== "test") {
        try {
            await encolarEmail({
                to: email,
                subject: "Recuperá tu contraseña en Labu",
                html: _templateReset(linkAbsoluto),
            });
        } catch (err) {
            logger.error({ err, email }, "[passwordReset] No se pudo enviar el email de recuperación");
        }
    }

    const respuesta = { mensaje: "Si el email está registrado, recibirás el link de recuperación." };

    // Exponer el link solo fuera de producción para facilitar el desarrollo/tests.
    if (process.env.NODE_ENV !== "production") {
        respuesta.dev_reset_link = linkRelativo;
    }

    return respuesta;
};

const resetearPassword = async (token, nuevaPassword) => {
    if (!token || !nuevaPassword) {
        throw new AppError("Token y nueva contraseña son requeridos", 400);
    }

    if (nuevaPassword.length < 8) {
        throw new AppError("La contraseña debe tener al menos 8 caracteres", 400);
    }

    // Buscar token válido y no expirado
    const { rows } = await pool.query(
        "SELECT * FROM password_resets WHERE token = $1 AND expires_at > NOW()",
        [token]
    );

    if (rows.length === 0) {
        throw new AppError("El link de recuperación es inválido o ya expiró", 400);
    }

    const resetData = rows[0];

    // Actualizar la contraseña del usuario
    const password_hash = await bcrypt.hash(nuevaPassword, 12);
    const resultado = await pool.query(
        "UPDATE usuarios SET password_hash = $1 WHERE email = $2 AND activo = TRUE RETURNING id",
        [password_hash, resetData.email]
    );

    if (resultado.rowCount === 0) {
        throw new AppError("Usuario no encontrado", 404);
    }

    // Eliminar el token usado (single-use)
    await pool.query("DELETE FROM password_resets WHERE token = $1", [token]);

    return { mensaje: "Contraseña actualizada correctamente" };
};

module.exports = { solicitarRecuperacion, resetearPassword };
