const crypto = require("crypto");
const svc = require("../services/pagos.service");
const logger = require("../config/logger");
const AppError = require("../utils/AppError");
const { successResponse } = require("../utils/apiResponse");

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

const getDesglose = async (req, res, next) => {
  try {
    const data = await svc.getDesgloseTrabajo(parseInt(req.params.trabajo_id), req.usuario.id);
    successResponse(res, data);
  } catch (err) {
    next(err);
  }
};

// DEPRECADO - Se mantiene como fallback cuando el SDK de MercadoPago.js no carga.
// El flujo principal usa pagarDirectoTrabajo con Checkout API.
const iniciarPagoTrabajo = async (req, res, next) => {
  try {
    const { monto_total, con_seguro } = req.body || {};
    const data = await svc.crearPreferenciaTrabajo({
      trabajoId: parseInt(req.params.trabajo_id),
      pagadorId: req.usuario.id,
      montoTotal: monto_total ? parseFloat(monto_total) : null,
      conSeguro: con_seguro || false
    });
    successResponse(res, data);
  } catch (err) {
    next(err);
  }
};

const iniciarPagoVideo = async (req, res, next) => {
  try {
    const data = await svc.crearPreferenciaVideo({
      videoId: parseInt(req.params.video_id),
      usuarioId: req.usuario.id
    });
    successResponse(res, data);
  } catch (err) {
    next(err);
  }
};

// Contrato con MercadoPago: siempre 200 (procesado) o 500 (reintentar) — no usa apiResponse
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
  const qs = new URLSearchParams({ status: status || 'pending' });
  if (payment_id) qs.set('payment_id', payment_id);
  res.redirect(`/pages/pago-exitoso.html?${qs}`);
};

const getSaldo = async (req, res, next) => {
  try {
    successResponse(res, await svc.getSaldo(req.usuario.id));
  } catch (err) {
    next(err);
  }
};

const solicitarRetiro = async (req, res, next) => {
  try {
    const { monto, datos_cobro } = req.body || {};
    const retiro = await svc.solicitarRetiro(req.usuario.id, monto, datos_cobro);
    successResponse(res, { retiro }, 201);
  } catch (err) {
    next(err);
  }
};

const getMisRetiros = async (req, res, next) => {
  try {
    successResponse(res, { retiros: await svc.getMisRetiros(req.usuario.id) });
  } catch (err) {
    next(err);
  }
};

const getHistorial = async (req, res, next) => {
  try {
    successResponse(res, { data: await svc.getHistorialPagos(req.usuario.id) });
  } catch (err) {
    next(err);
  }
};

const getVideos = async (req, res, next) => {
  try {
    const { rubro_id, gratis, limit, offset } = req.query;
    successResponse(res, { data: await svc.getVideos({
      rubroId: rubro_id ? parseInt(rubro_id) : null,
      gratis: gratis !== undefined ? gratis === 'true' : undefined,
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0
    }) });
  } catch (err) {
    next(err);
  }
};

const checkAccesoVideo = async (req, res, next) => {
  try {
    const tiene = await svc.tieneAccesoVideo(req.usuario.id, parseInt(req.params.video_id));
    successResponse(res, { tiene_acceso: tiene });
  } catch (err) {
    next(err);
  }
};

const getConfig = async (req, res, next) => {
  try {
    const configs = await svc.getConfigMulti(['comision_porcentaje', 'seguro_precio', 'mp_public_key']);
    successResponse(res, {
      comision_porcentaje: configs.comision_porcentaje || null,
      seguro_precio:       configs.seguro_precio || null,
      mp_public_key:       configs.mp_public_key || process.env.MP_PUBLIC_KEY || null,
      dev_mode:            process.env.NODE_ENV === 'development'
    });
  } catch (err) {
    next(err);
  }
};

const pagarDirecto = async (req, res, next) => {
  try {
    const { card_token, payment_method_id, payer_email, installments } = req.body || {};
    if (!card_token || !payment_method_id || !payer_email) {
      throw new AppError('card_token, payment_method_id y payer_email son requeridos', 400);
    }
    const data = await svc.pagarDirectoTrabajo({
      trabajoId: parseInt(req.params.trabajo_id),
      pagadorId: req.usuario.id,
      cardToken: card_token,
      paymentMethodId: payment_method_id,
      payerEmail: payer_email,
      installments: installments || 1
    });
    successResponse(res, data);
  } catch (err) {
    next(err);
  }
};

const devAprobarPago = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV !== 'development') throw new AppError('No disponible', 404);
    const result = await svc.simularPagoAprobadoDev(
      parseInt(req.params.trabajo_id),
      req.usuario.id
    );
    successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

module.exports = { verificarFirmaMP, getDesglose, iniciarPagoTrabajo, iniciarPagoVideo, pagarDirecto, webhook, callback, getHistorial, getVideos, checkAccesoVideo, getConfig, devAprobarPago, getSaldo, solicitarRetiro, getMisRetiros };
