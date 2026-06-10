const nodemailer = require("nodemailer");
const logger = require("./logger");

// Singleton del transporter — se inicializa una sola vez por proceso.
let _transporter = null;

const getTransporter = async () => {
  if (_transporter) return _transporter;

  // En tests: no-op para no hacer llamadas HTTP externas ni ralentizar la suite.
  if (process.env.NODE_ENV === "test") {
    _transporter = { sendMail: async () => ({ messageId: "test-noop", previewUrl: null }) };
    return _transporter;
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    // Producción / staging: usar el servidor SMTP configurado.
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    logger.info({ host: process.env.SMTP_HOST, port: process.env.SMTP_PORT }, "[mailer] SMTP configurado");
  } else {
    // Desarrollo sin SMTP: Ethereal (bandeja de pruebas online).
    // Los emails se pueden ver en https://ethereal.email con las credenciales logueadas.
    try {
      const cuenta = await nodemailer.createTestAccount();
      _transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: { user: cuenta.user, pass: cuenta.pass },
      });
      logger.info(
        { etherealUser: cuenta.user, etherealPass: cuenta.pass, url: "https://ethereal.email" },
        "[mailer] Ethereal listo — entrá con estas credenciales para ver los emails enviados."
      );
    } catch (err) {
      // Ethereal no disponible (sin internet, servicio caído) → no-op para no bloquear el registro.
      logger.warn({ err }, "[mailer] No se pudo crear cuenta Ethereal — emails desactivados en desarrollo.");
      _transporter = { sendMail: async () => ({ messageId: "noop-ethereal-down" }) };
    }
  }

  return _transporter;
};

/**
 * Envía un email HTML.
 * @returns {{ messageId: string, previewUrl: string|null }}
 *   previewUrl solo tiene valor cuando se usa Ethereal (desarrollo).
 */
const enviarEmail = async ({ to, subject, html }) => {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || '"Labu" <no-reply@labu.com>',
    to,
    subject,
    html,
  });

  const previewUrl = nodemailer.getTestMessageUrl
    ? nodemailer.getTestMessageUrl(info)
    : null;

  if (previewUrl) {
    logger.info({ to, previewUrl }, "[mailer] Email de desarrollo enviado a Ethereal");
  }

  return { messageId: info.messageId, previewUrl: previewUrl || null };
};

module.exports = { enviarEmail };
