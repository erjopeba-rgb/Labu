const crypto = require("crypto");
const svc = require("../services/pagos.service");
const logger = require("../config/logger");

/**
 * Middleware que verifica la firma HMAC-SHA256 del webhook de MercadoPago.
 *
 * MP envía el header:  x-signature: ts=<timestamp>,v1=<hmac-hex>
 * El manifest firmado: "id:<data.id>;request-id:<x-request-id>;ts:<timestamp>;"
 *
 * Si MP_WEBHOOK_SECRET no está configurado (desarrollo local) se permite el request
 * con un warning, para no bloquear pruebas sin credenciales reales.
 */
const verificarFirmaMP = (req, res, next) => {
  const secret = process.env.MP_WEBHOOK_SECRET;

  if (!secret) {
    logger.warn("[pagos] MP_WEBHOOK_SECRET no configurado — saltando verificación de firma (solo desarrollo)");
    return next();
  }

  const signatureHeader = req.headers["x-signature"];
  const requestId       = req.headers["x-request-id"] || "";

  if (!signatureHeader) {
    logger.warn("[pagos] Webhook rechazado: header x-signature ausente");
    return res.sendStatus(401);
  }

  // Parsear "ts=<timestamp>,v1=<hash>" → { ts, v1 }
  const partes = {};
  for (const parte of signatureHeader.split(",")) {
    const idx = parte.indexOf("=");
    if (idx !== -1) {
      partes[parte.slice(0, idx).trim()] = parte.slice(idx + 1).trim();
    }
  }

  const { ts, v1 } = partes;
  if (!ts || !v1) {
    logger.warn({ signatureHeader }, "[pagos] Webhook rechazado: formato de x-signature inválido");
    return res.sendStatus(401);
  }

  // data.id puede venir como query param (?data.id=...) o en el body
  const dataId   = req.query["data.id"] ?? req.body?.data?.id ?? "";
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;

  const esperado = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  // timingSafeEqual requiere buffers del mismo largo; si v1 está malformado los largos difieren
  const bufEsperado = Buffer.from(esperado);
  const bufRecibido = Buffer.from(v1);

  if (bufEsperado.length !== bufRecibido.length || !crypto.timingSafeEqual(bufEsperado, bufRecibido)) {
    logger.warn({ manifest }, "[pagos] Webhook rechazado: firma inválida");
    return res.sendStatus(401);
  }

  next();
};

const getDesglose = async (req, res) => {
  try {
    const data = await svc.getDesgloseTrabajo(parseInt(req.params.trabajo_id), req.usuario.id);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// DEPRECADO - Se mantiene como fallback cuando el SDK de MercadoPago.js no carga.
// El flujo principal usa pagarDirectoTrabajo con Checkout API.
const iniciarPagoTrabajo = async (req, res) => {
  try {
    const { monto_total, con_seguro } = req.body || {};
    const data = await svc.crearPreferenciaTrabajo({
      trabajoId: parseInt(req.params.trabajo_id),
      pagadorId: req.usuario.id,
      montoTotal: monto_total ? parseFloat(monto_total) : null,
      conSeguro: con_seguro || false
    });
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const iniciarPagoVideo = async (req, res) => {
  try {
    const data = await svc.crearPreferenciaVideo({
      videoId: parseInt(req.params.video_id),
      usuarioId: req.usuario.id
    });
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const webhook = async (req, res) => {
  try {
    const { type, data } = req.body;
    if (type === 'payment' && data?.id) {
      await svc.procesarWebhook(data.id);
    }
    res.sendStatus(200);
  } catch (err) {
    logger.error({ err: err.message }, "Webhook error");
    res.sendStatus(500);
  }
};

const callback = (req, res) => {
  const { status, payment_id } = req.query;
  const qs = new URLSearchParams({ status: status || 'pending', payment_id });
  res.redirect(`/pages/pago-exitoso.html?${qs}`);
};

const getHistorial = async (req, res) => {
  try {
    res.json(await svc.getHistorialPagos(req.usuario.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getVideos = async (req, res) => {
  try {
    const { rubro_id, gratis, limit, offset } = req.query;
    res.json(await svc.getVideos({
      rubroId: rubro_id ? parseInt(rubro_id) : null,
      gratis: gratis !== undefined ? gratis === 'true' : undefined,
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const checkAccesoVideo = async (req, res) => {
  try {
    const tiene = await svc.tieneAccesoVideo(req.usuario.id, parseInt(req.params.video_id));
    res.json({ tiene_acceso: tiene });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getConfig = async (req, res) => {
  try {
    const configs = await svc.getConfigMulti(['comision_porcentaje', 'seguro_precio', 'mp_public_key']);
    res.json({
      comision_porcentaje: configs.comision_porcentaje || null,
      seguro_precio:       configs.seguro_precio || null,
      mp_public_key:       configs.mp_public_key || null,
      dev_mode:            process.env.NODE_ENV === 'development'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const pagarDirecto = async (req, res) => {
  try {
    const { card_token, payment_method_id, payer_email, installments } = req.body || {};
    if (!card_token || !payment_method_id || !payer_email) {
      return res.status(400).json({ error: 'card_token, payment_method_id y payer_email son requeridos' });
    }
    const data = await svc.pagarDirectoTrabajo({
      trabajoId: parseInt(req.params.trabajo_id),
      pagadorId: req.usuario.id,
      cardToken: card_token,
      paymentMethodId: payment_method_id,
      payerEmail: payer_email,
      installments: installments || 1
    });
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const devAprobarPago = async (req, res) => {
  if (process.env.NODE_ENV !== 'development') return res.status(404).json({ error: 'No disponible' });
  try {
    const result = await svc.simularPagoAprobadoDev(
      parseInt(req.params.trabajo_id),
      req.usuario.id
    );
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

module.exports = { verificarFirmaMP, getDesglose, iniciarPagoTrabajo, iniciarPagoVideo, pagarDirecto, webhook, callback, getHistorial, getVideos, checkAccesoVideo, getConfig, devAprobarPago };
