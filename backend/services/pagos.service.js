const pool = require("../config/db");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const logger = require("../config/logger");
const pagosRepo = require("../repositories/pagos.repository");

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// ─── RETRY HELPER ─────────────────────────────────────────────────────────────

const _esErrorReintentable = (err) => {
    const status = err?.status || err?.response?.status;
    if (status >= 500) return true;
    const msg = String(err?.message || err || '').toLowerCase();
    return msg.includes('timeout') || msg.includes('econnreset') || msg.includes('etimedout') || msg.includes('econnrefused');
};

const conRetry = async (fn, intentos = 3, delayBase = 1000) => {
    let ultimo;
    for (let i = 0; i < intentos; i++) {
        try {
            return await fn();
        } catch (err) {
            ultimo = err;
            if (!_esErrorReintentable(err) || i === intentos - 1) throw err;
            await new Promise(r => setTimeout(r, delayBase * Math.pow(2, i)));
        }
    }
    throw ultimo;
};

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const getConfig = async (clave) => pagosRepo.findConfigValue(clave);

const getConfigMulti = async (claves) => pagosRepo.findConfigValues(claves);

const getMPClient = async () => {
  const token = await getConfig('mp_access_token');
  if (!token) throw new Error("MercadoPago no configurado");
  return new MercadoPagoConfig({ accessToken: token });
};

// ─── CALCULAR COMISION ────────────────────────────────────────────────────────

const calcularComision = async (montoTotal) => {
  const configs = await getConfigMulti(['comision_porcentaje', 'comision_minima']);
  const pct = parseFloat(configs.comision_porcentaje || '10') / 100;
  const minima = parseFloat(configs.comision_minima || '500');
  const comision = Math.max(montoTotal * pct, minima);
  const neto = montoTotal - comision;
  return {
    monto_total: montoTotal,
    comision: Math.round(comision * 100) / 100,
    neto: Math.round(neto * 100) / 100,
    porcentaje: pct * 100
  };
};

// DEPRECADO - Se mantiene como fallback cuando el SDK de MercadoPago.js no carga.
// El flujo principal usa pagarDirectoTrabajo con Checkout API.
const crearPreferenciaTrabajo = async ({ trabajoId, pagadorId, montoTotal, conSeguro }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const trabajo = await pagosRepo.findTrabajoPagoData(trabajoId, client);
    if (!trabajo) throw new Error("Trabajo no encontrado");
    if (trabajo.dueno_id !== pagadorId) throw new Error("Solo el dueño puede iniciar el pago");

    const monto = montoTotal || trabajo.monto_propuesto;
    if (!monto) throw new Error("No se pudo determinar el monto del trabajo");

    const precioSeguro = conSeguro ? parseFloat(await getConfig('seguro_precio') || '2000') : 0;
    const montoFinal = monto + precioSeguro;
    const comision = await calcularComision(monto);

    const pago = await pagosRepo.insertPago({
      usuario_id: pagadorId,
      tipo: 'trabajo',
      referencia_id: trabajoId,
      monto_total: montoFinal,
      monto_plataforma: comision.comision,
      monto_trabajador: comision.neto,
      monto_seguro: precioSeguro > 0 ? precioSeguro : null,
      metadata: JSON.stringify({ trabajo_id: trabajoId, trabajador_id: trabajo.trabajador_id, con_seguro: conSeguro, monto })
    }, client);

    const token = await getConfig('mp_access_token');
    if (!token) throw new Error("MercadoPago no configurado");
    const mpClient = new MercadoPagoConfig({ accessToken: token });
    const tokenMasked = `${token.slice(0, 8)}...${token.slice(-4)}`;
    const preference = new Preference(mpClient);
    const esProduccion = !APP_URL.includes('localhost') && !APP_URL.includes('127.0.0.1');
    const mpBody = {
      items: [{
        title: `Pago trabajo: ${trabajo.titulo}`,
        quantity: 1,
        unit_price: montoFinal,
        currency_id: 'ARS'
      }],
      external_reference: String(pago.id),
      back_urls: {
        success: `${APP_URL}/api/pagos/mp/callback?status=success`,
        failure: `${APP_URL}/api/pagos/mp/callback?status=failure`,
        pending: `${APP_URL}/api/pagos/mp/callback?status=pending`
      },
      ...(esProduccion && { auto_return: 'approved' }),
      notification_url: `${APP_URL}/api/pagos/mp/webhook`
    };
    logger.info({ trabajoId, montoFinal, pagoId: pago.id, tokenMasked, mpBody }, '[pagos] llamando preference.create');
    let prefData;
    try {
      prefData = await conRetry(() => preference.create({ body: mpBody }));
    } catch (mpErr) {
      const causa = mpErr?.cause?.[0]?.description || mpErr?.message || String(mpErr);
      logger.error({
        err: mpErr,
        trabajoId,
        montoFinal,
        tokenMasked,
        mpErrStatus: mpErr?.status,
        mpErrCause: mpErr?.cause,
        mpErrMessage: mpErr?.message,
        mpErrFull: JSON.stringify(mpErr)
      }, `[pagos] MercadoPago preference.create falló después de reintentos: ${causa}`);
      throw new Error(`MercadoPago error: ${causa}`);
    }

    await pagosRepo.updatePagoPreferenceId(pago.id, prefData.id, client);

    await client.query("COMMIT");
    return {
      pago_id: pago.id,
      preference_id: prefData.id,
      init_point: prefData.init_point,
      desglose: { monto_trabajo: montoTotal, comision: comision.comision, seguro: precioSeguro, total: montoFinal }
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// ─── CREAR PREFERENCIA MP PARA VIDEO ─────────────────────────────────────────

const crearPreferenciaVideo = async ({ videoId, usuarioId }) => {
  const video = await pagosRepo.findVideoActivo(videoId);
  if (!video) throw new Error("Video no encontrado");
  if (video.es_gratis) throw new Error("Este video es gratuito");

  const acceso = await pagosRepo.findAccesoVideo(usuarioId, videoId);
  if (acceso.length > 0) throw new Error("Ya tenés acceso a este video");

  const pago = await pagosRepo.insertPagoVideo({
    usuario_id: usuarioId,
    referencia_id: videoId,
    monto_total: video.precio,
    metadata: JSON.stringify({ video_id: videoId })
  });

  const mpClient = await getMPClient();
  const preference = new Preference(mpClient);
  const prefData = await preference.create({
    body: {
      items: [{ title: video.titulo, quantity: 1, unit_price: parseFloat(video.precio), currency_id: 'ARS' }],
      external_reference: String(pago.id),
      back_urls: {
        success: `${APP_URL}/api/pagos/mp/callback?status=success`,
        failure: `${APP_URL}/api/pagos/mp/callback?status=failure`,
        pending: `${APP_URL}/api/pagos/mp/callback?status=pending`
      },
      auto_return: 'approved',
      notification_url: `${APP_URL}/api/pagos/mp/webhook`
    }
  });

  await pagosRepo.updatePagoPreferenceIdSimple(pago.id, prefData.id);

  return { pago_id: pago.id, preference_id: prefData.id, init_point: prefData.init_point };
};

// ─── WEBHOOK MP ───────────────────────────────────────────────────────────────

const procesarWebhook = async (paymentId) => {
  // Pre-check rápido sin abrir transacción: evita adquirir un client del pool para duplicados.
  // La verificación definitiva ocurre dentro de la transacción (ON CONFLICT DO NOTHING).
  if (await pagosRepo.findWebhookEvent(paymentId, 'payment')) {
    logger.info({ paymentId }, '[pagos] Webhook duplicado ignorado (pre-check)');
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const esNuevo = await pagosRepo.insertWebhookEventIfNew(paymentId, 'payment', client);
    if (!esNuevo) {
      logger.info({ paymentId }, '[pagos] Webhook duplicado ignorado (carrera)');
      await client.query("ROLLBACK");
      return;
    }

    const mpClient = await getMPClient();
    const paymentClient = new Payment(mpClient);
    const mpPago = await paymentClient.get({ id: paymentId });

    const pagoId = parseInt(mpPago.external_reference);
    const pago = await pagosRepo.findPagoById(pagoId, client);
    if (!pago) throw new Error("Pago no encontrado");

    const nuevoEstado = mpPago.status === 'approved' ? 'aprobado'
      : mpPago.status === 'rejected' ? 'rechazado'
      : mpPago.status === 'pending' ? 'pendiente' : 'en_proceso';

    await pagosRepo.updatePagoEstado({
      pagoId,
      estado: nuevoEstado,
      paymentId,
      mpStatus: mpPago.status,
      mpDetail: mpPago.status_detail
    }, client);

    if (nuevoEstado === 'aprobado') {
      await procesarPagoAprobado(client, pago);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const procesarPagoAprobado = async (client, pago) => {
  if (typeof pago.metadata === 'string') {
    try { pago.metadata = JSON.parse(pago.metadata); } catch (_) { pago.metadata = {}; }
  }
  const meta = pago.metadata || {};

  if (pago.tipo === 'trabajo') {
    await pagosRepo.insertDistribucion({
      pago_id: pago.id,
      destinatario_id: meta.trabajador_id,
      tipo_destinatario: 'trabajador',
      monto: pago.monto_trabajador
    }, client);
    await pagosRepo.insertDistribucion({
      pago_id: pago.id,
      destinatario_id: 1,
      tipo_destinatario: 'plataforma',
      monto: pago.monto_plataforma
    }, client);

    const ayudantes = await pagosRepo.findAyudantesPendientes(meta.trabajo_id, client);
    for (const a of ayudantes) {
      await pagosRepo.insertDistribucion({
        pago_id: pago.id,
        destinatario_id: a.ayudante_id,
        tipo_destinatario: 'ayudante',
        monto: a.monto
      }, client);
      await pagosRepo.updateAyudanteProcesado(meta.trabajo_id, a.ayudante_id, client);
    }

    if (meta.con_seguro) {
      await pagosRepo.insertSeguro(meta.trabajo_id, pago.id, pago.usuario_id, client);
    }
  }

  if (pago.tipo === 'video') {
    await pagosRepo.insertAccesoVideo(pago.usuario_id, meta.video_id, pago.id, client);
    await pagosRepo.updateVideoVistas(meta.video_id, client);
  }
};

// ─── SIMULACIÓN DE PAGO APROBADO (solo development) ──────────────────────────

const simularPagoAprobadoDev = async (trabajoId, pagadorId) => {
  if (process.env.NODE_ENV !== 'development') throw new Error('Solo disponible en desarrollo');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let pago = await pagosRepo.findPagoByTrabajo(trabajoId, client);

    if (!pago) {
      const trabajo = await pagosRepo.findTrabajoPagoData(trabajoId, client);
      if (!trabajo) throw new Error('Trabajo no encontrado o sin oferta aceptada');
      if (trabajo.dueno_id !== pagadorId) throw new Error('Solo el dueño puede simular el pago');

      const monto = parseFloat(trabajo.monto_propuesto);
      const comision = await calcularComision(monto);

      pago = await pagosRepo.insertPago({
        usuario_id: pagadorId,
        tipo: 'trabajo',
        referencia_id: trabajoId,
        monto_total: monto,
        monto_plataforma: comision.comision,
        monto_trabajador: comision.neto,
        monto_seguro: null,
        metadata: JSON.stringify({ trabajo_id: trabajoId, trabajador_id: trabajo.trabajador_id, con_seguro: false, monto })
      }, client);
    }

    if (pago.estado === 'aprobado') {
      await client.query('ROLLBACK');
      return { ya_aprobado: true };
    }

    await pagosRepo.updatePagoEstado({
      pagoId: pago.id,
      estado: 'aprobado',
      paymentId: 'DEV_SIM_' + Date.now(),
      mpStatus: 'approved',
      mpDetail: 'dev_simulation'
    }, client);

    await procesarPagoAprobado(client, pago);

    await client.query('COMMIT');
    logger.info({ trabajoId, pagoId: pago.id }, '[pagos] Pago simulado en desarrollo');
    return { simulado: true, pago_id: pago.id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── PAGO DIRECTO CON TARJETA (card token) ───────────────────────────────────

const pagarDirectoTrabajo = async ({ trabajoId, pagadorId, cardToken, paymentMethodId, payerEmail, installments = 1 }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const trabajo = await pagosRepo.findTrabajoPagoData(trabajoId, client);
    if (!trabajo) throw new Error('Trabajo no encontrado');
    if (trabajo.dueno_id !== pagadorId) throw new Error('Solo el dueño puede pagar');

    const monto = parseFloat(trabajo.monto_propuesto);
    if (!monto) throw new Error('No se pudo determinar el monto del trabajo');

    const comision = await calcularComision(monto);

    const pago = await pagosRepo.insertPago({
      usuario_id: pagadorId,
      tipo: 'trabajo',
      referencia_id: trabajoId,
      monto_total: monto,
      monto_plataforma: comision.comision,
      monto_trabajador: comision.neto,
      monto_seguro: null,
      metadata: JSON.stringify({ trabajo_id: trabajoId, trabajador_id: trabajo.trabajador_id, con_seguro: false, monto })
    }, client);

    const mpClient = await getMPClient();
    const paymentClient = new Payment(mpClient);

    let mpPago;
    try {
      mpPago = await conRetry(() => paymentClient.create({
        body: {
          transaction_amount: monto,
          token: cardToken,
          description: `Pago trabajo: ${trabajo.titulo}`,
          installments: parseInt(installments) || 1,
          payment_method_id: paymentMethodId,
          payer: { email: payerEmail },
          external_reference: String(pago.id),
          notification_url: `${APP_URL}/api/pagos/mp/webhook`
        }
      }));
    } catch (mpErr) {
      const causa = mpErr?.cause?.[0]?.description || mpErr?.message || String(mpErr);
      logger.error({ err: mpErr, trabajoId, causa }, '[pagos] Payment.create (directo) falló');
      throw new Error(`MercadoPago error: ${causa}`);
    }

    const mpStatus = mpPago.status;
    const nuevoEstado = mpStatus === 'approved' ? 'aprobado'
      : mpStatus === 'rejected' ? 'rechazado'
      : 'pendiente';

    await pagosRepo.updatePagoEstado({
      pagoId: pago.id,
      estado: nuevoEstado,
      paymentId: String(mpPago.id),
      mpStatus,
      mpDetail: mpPago.status_detail
    }, client);

    if (nuevoEstado === 'aprobado') {
      await procesarPagoAprobado(client, pago);
    }

    await client.query('COMMIT');
    logger.info({ trabajoId, pagoId: pago.id, mpStatus }, '[pagos] Pago directo procesado');
    return {
      status: mpStatus,
      pago_id: pago.id,
      mp_payment_id: mpPago.id,
      status_detail: mpPago.status_detail
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── SALDO Y RETIROS (payout manual) ──────────────────────────────────────────

// Namespace de advisory locks de retiros (scheduling usa 47001)
const RETIRO_LOCK_CLASS = 47002;

const getSaldo = async (usuarioId) => {
  return pagosRepo.findSaldoUsuario(usuarioId);
};

// Solicita un retiro del saldo disponible. El advisory lock por usuario serializa
// solicitudes concurrentes: sin él, dos requests simultáneos podrían pasar ambos
// la validación de saldo y retirar el doble de lo disponible.
const solicitarRetiro = async (usuarioId, monto, datosCobro) => {
  const montoNum = Math.round(parseFloat(monto) * 100) / 100;
  if (!montoNum || montoNum <= 0) throw new Error("El monto del retiro debe ser mayor a cero");
  if (!datosCobro || !String(datosCobro).trim()) throw new Error("Indicá CBU/CVU o alias para recibir la transferencia");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1, $2)", [RETIRO_LOCK_CLASS, usuarioId]);

    const saldo = await pagosRepo.findSaldoUsuario(usuarioId, client);
    if (montoNum > saldo.disponible) {
      throw new Error(`Saldo insuficiente: disponible $${saldo.disponible}`);
    }

    const retiro = await pagosRepo.insertRetiro({
      usuario_id: usuarioId,
      monto: montoNum,
      datos_cobro: String(datosCobro).trim()
    }, client);

    await client.query("COMMIT");
    logger.info({ usuarioId, retiroId: retiro.id, monto: montoNum }, "[pagos] Retiro solicitado");
    return retiro;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const getMisRetiros = async (usuarioId) => {
  return pagosRepo.findRetirosUsuario(usuarioId);
};

const listarRetirosAdmin = async (estado) => {
  return pagosRepo.findRetirosAdmin(estado);
};

// El admin marca el retiro como pagado (transferencia manual hecha) o rechazado.
// Si lo rechaza, el monto vuelve a estar disponible automáticamente (deja de sumar
// como 'en_retiro' en el cálculo de saldo).
const resolverRetiro = async (retiroId, accion, notaAdmin) => {
  if (!["pagado", "rechazado"].includes(accion)) throw new Error("accion debe ser 'pagado' o 'rechazado'");
  const retiro = await pagosRepo.updateRetiroEstado(retiroId, accion, notaAdmin);
  if (!retiro) throw new Error("Retiro no encontrado o ya resuelto");
  logger.info({ retiroId, accion }, "[pagos] Retiro resuelto por admin");
  return retiro;
};

// ─── HISTORIAL ────────────────────────────────────────────────────────────────

const getHistorialPagos = async (usuarioId) => {
  return pagosRepo.findHistorialPagos(usuarioId);
};

const getDesgloseTrabajo = async (trabajoId, usuarioId) => {
  const trabajo = await pagosRepo.findTrabajoDueno(trabajoId);
  const oferta = await pagosRepo.findOfertaAceptadaMonto(trabajoId);
  if (!oferta) throw new Error("No hay oferta aceptada para este trabajo");

  const esDueno = trabajo.dueno_id === usuarioId;
  const esTrabajador = oferta.trabajador_id === usuarioId;
  if (!esDueno && !esTrabajador) throw new Error("Sin permiso");

  const comision = await calcularComision(parseFloat(oferta.monto_propuesto));
  const precioSeguro = parseFloat(await getConfig('seguro_precio') || '2000');

  return {
    monto_oferta: oferta.monto_propuesto,
    comision_plataforma: comision.comision,
    porcentaje_comision: comision.porcentaje,
    trabajador_recibe: comision.neto,
    seguro_opcional: precioSeguro,
    total_con_seguro: parseFloat(oferta.monto_propuesto) + precioSeguro
  };
};

// ─── VIDEOS ───────────────────────────────────────────────────────────────────

const getVideos = async ({ rubroId, gratis, limit, offset }) => {
  return pagosRepo.findVideos({ rubroId, gratis, limit, offset });
};

const tieneAccesoVideo = async (usuarioId, videoId) => {
  const v = await pagosRepo.findVideoEsGratis(videoId);
  if (!v) throw new Error("Video no encontrado");
  if (v.es_gratis) return true;
  const rows = await pagosRepo.findAccesoVideo(usuarioId, videoId);
  return rows.length > 0;
};

module.exports = {
  calcularComision, getConfig, getConfigMulti,
  crearPreferenciaTrabajo, crearPreferenciaVideo,
  pagarDirectoTrabajo,
  procesarWebhook, getHistorialPagos, getDesgloseTrabajo,
  getVideos, tieneAccesoVideo,
  simularPagoAprobadoDev,
  getSaldo, solicitarRetiro, getMisRetiros,
  listarRetirosAdmin, resolverRetiro
};
