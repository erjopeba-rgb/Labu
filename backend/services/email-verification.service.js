const crypto = require("crypto");
const pool = require("../config/db");
const { encolarEmail } = require("../workers/emailWorker");
const logger = require("../config/logger");
const AppError = require("../utils/AppError");

// TTL del token: 24 horas
const EXPIRACION_MS = 24 * 60 * 60 * 1000;

const _templateVerificacion = (link) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
  <h2 style="color: #222;">Verificá tu email en Labu</h2>
  <p style="color: #555;">Hacé click en el botón para activar tu cuenta:</p>
  <a href="${link}"
     style="display: inline-block; background: #007bff; color: #fff;
            padding: 12px 28px; text-decoration: none; border-radius: 6px;
            font-size: 16px; margin: 16px 0;">
    Verificar email
  </a>
  <p style="color: #999; font-size: 12px; margin-top: 24px;">
    Este link expira en 24 horas.<br>
    Si no creaste una cuenta en Labu, podés ignorar este email.
  </p>
</div>`.trim();

const generarTokenVerificacion = async (usuarioId) => {
    // Eliminar tokens previos del mismo usuario
    await pool.query("DELETE FROM email_verifications WHERE usuario_id = $1", [usuarioId]);

    const token = crypto.randomBytes(48).toString("hex");
    const expires_at = new Date(Date.now() + EXPIRACION_MS);

    await pool.query(
        "INSERT INTO email_verifications (usuario_id, token, expires_at) VALUES ($1, $2, $3)",
        [usuarioId, token, expires_at]
    );

    // Link relativo — sirve para tests y para construir la URL absoluta del email.
    const linkRelativo = `/api/auth/verify-email?token=${token}`;
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const linkAbsoluto = `${appUrl}${linkRelativo}`;

    // Enviar email si hay dirección disponible (no en tests).
    // El fallo de email no bloquea el registro — el usuario puede reenviar con el botón correspondiente.
    if (process.env.NODE_ENV !== "test") {
        const { rows } = await pool.query("SELECT email FROM usuarios WHERE id = $1", [usuarioId]);
        if (rows.length > 0) {
            try {
                await encolarEmail({
                    to: rows[0].email,
                    subject: "Verificá tu email en Labu",
                    html: _templateVerificacion(linkAbsoluto),
                });
            } catch (err) {
                logger.error({ err, usuarioId }, "[email-verification] No se pudo enviar el email de verificación");
            }
        }
    }

    return { token, link: linkRelativo };
};

const verificarEmailToken = async (token) => {
    if (!token) throw new AppError("Token requerido", 400);

    const { rows } = await pool.query(
        "SELECT usuario_id FROM email_verifications WHERE token = $1 AND expires_at > NOW()",
        [token]
    );

    if (rows.length === 0) {
        throw new AppError("El link de verificación es inválido o ya expiró", 400);
    }

    const usuarioId = rows[0].usuario_id;

    await pool.query("UPDATE usuarios SET email_verificado = TRUE WHERE id = $1", [usuarioId]);
    await pool.query("DELETE FROM email_verifications WHERE token = $1", [token]);

    return { mensaje: "Email verificado correctamente" };
};

const reenviarVerificacion = async (usuarioId) => {
    const { rows } = await pool.query(
        "SELECT email_verificado FROM usuarios WHERE id = $1 AND activo = TRUE",
        [usuarioId]
    );

    if (rows.length === 0) throw new AppError("Usuario no encontrado", 404);
    if (rows[0].email_verificado) throw new AppError("El email ya está verificado", 400);

    await generarTokenVerificacion(usuarioId);

    return { mensaje: "Se envió un nuevo link de verificación a tu email." };
};

module.exports = { generarTokenVerificacion, verificarEmailToken, reenviarVerificacion };
