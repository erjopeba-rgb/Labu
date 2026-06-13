// I17 — patrón outbox en pagos: las llamadas de red a MercadoPago ocurren fuera
// de toda transacción de DB. El SDK de MP está mockeado: acá se prueba la máquina
// de estados del pago (iniciando → pendiente/aprobado/fallido), que el registro
// esté commiteado durante la llamada de red y la idempotencia del webhook.

const mockMP = {
  preferenceCreate: jest.fn(),
  paymentGet: jest.fn(),
  paymentCreate: jest.fn()
};

jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn(),
  Preference: jest.fn(() => ({ create: mockMP.preferenceCreate })),
  Payment: jest.fn(() => ({ get: mockMP.paymentGet, create: mockMP.paymentCreate }))
}));

const request = require('supertest');
const app = require('./app');
const { limpiarTablas, registrar } = require('./helpers');
const pagosSvc = require('../services/pagos.service');

let pool;
let tokenDueno, tokenTrabajador, idDueno, idTrabajador;

// Crea un trabajo del dueño con oferta aceptada del trabajador → en_negociacion
const crearTrabajoConOfertaAceptada = async (titulo) => {
  const resJob = await request(app)
    .post('/api/jobs')
    .set('Authorization', `Bearer ${tokenDueno}`)
    .field('titulo', titulo)
    .field('descripcion', 'Trabajo para tests del patrón outbox de pagos (I17)');
  const trabajoId = resJob.body.job.id;

  const resOferta = await request(app)
    .post('/api/offers')
    .set('Authorization', `Bearer ${tokenTrabajador}`)
    .send({ trabajo_id: trabajoId, monto_propuesto: 6000, mensaje: 'Puedo hacerlo', tiempo_estimado: 1, unidad_tiempo: 'dias' });

  await request(app)
    .patch(`/api/offers/${resOferta.body.oferta.id}/accept`)
    .set('Authorization', `Bearer ${tokenDueno}`);

  return trabajoId;
};

const getPagos = async (trabajoId) => {
  const { rows } = await pool.query(
    `SELECT * FROM pagos WHERE referencia_id = $1 AND tipo = 'trabajo' ORDER BY id DESC`,
    [trabajoId]
  );
  return rows;
};

const contarDistribuciones = async (trabajoId) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM distribuciones_pago d
     JOIN pagos p ON p.id = d.pago_id
     WHERE p.referencia_id = $1 AND p.tipo = 'trabajo'`,
    [trabajoId]
  );
  return rows[0].n;
};

beforeAll(async () => {
  pool = require('../config/db');
  await limpiarTablas();

  // El dueño se registra primero y toma id 1: la distribución 'plataforma' de
  // procesarPagoAprobado usa destinatario_id = 1 con FK a usuarios.
  const regDueno = await registrar({ email: 'dueno.pagos@test.com', tipo_perfil: 'dueno' });
  idDueno = regDueno.body.usuario.id;
  tokenDueno = regDueno.body.token;

  const regTrabajador = await registrar({ email: 'worker.pagos@test.com', tipo_perfil: 'trabajador' });
  idTrabajador = regTrabajador.body.usuario.id;
  tokenTrabajador = regTrabajador.body.token;

  // medio_transporte es requerido para ofertar
  await request(app)
    .post('/api/profile/complete')
    .set('Authorization', `Bearer ${tokenTrabajador}`)
    .send({ nombre: 'Worker Pagos', medio_transporte: 'auto' });

  // getMPClient lee el access token desde configuracion_plataforma
  await pool.query(
    `INSERT INTO configuracion_plataforma (clave, valor) VALUES ('mp_access_token', 'TEST-TOKEN-I17')
     ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor`
  );
});

afterAll(async () => {
  // Restaurar el token vacío: los demás test files no mockean MP y con un token
  // presente intentarían llamadas de red reales al aceptar ofertas
  await pool.query(`UPDATE configuracion_plataforma SET valor = '' WHERE clave = 'mp_access_token'`);
  await pool.end();
});

beforeEach(() => {
  mockMP.preferenceCreate.mockReset();
  mockMP.paymentGet.mockReset();
  mockMP.paymentCreate.mockReset();
  // Aceptar una oferta dispara crearPreferenciaTrabajo automáticamente
  // (offers.service): default benigno para ese auto-pago
  mockMP.preferenceCreate.mockResolvedValue({ id: 'PREF-AUTO', init_point: 'https://mp.test/auto' });
});

// ─── crearPreferenciaTrabajo ──────────────────────────────────────────────────

describe('I17 — crearPreferenciaTrabajo (outbox)', () => {
  test('el pago está commiteado como iniciando durante la llamada a MP y queda pendiente al finalizar', async () => {
    const trabajoId = await crearTrabajoConOfertaAceptada('I17 preferencia ok');

    let estadoDuranteMP = null;
    mockMP.preferenceCreate.mockImplementation(async () => {
      // Consulta desde otra conexión del pool: solo ve el pago si la inserción
      // fue commiteada antes de la llamada de red (el corazón de I17).
      // Se toma el último pago: aceptar la oferta ya creó uno automático.
      const { rows } = await pool.query(
        `SELECT estado FROM pagos WHERE referencia_id = $1 AND tipo = 'trabajo' ORDER BY id DESC LIMIT 1`,
        [trabajoId]
      );
      estadoDuranteMP = rows[0] ? rows[0].estado : null;
      return { id: 'PREF-I17', init_point: 'https://mp.test/init' };
    });

    const res = await pagosSvc.crearPreferenciaTrabajo({
      trabajoId, pagadorId: idDueno, montoTotal: null, conSeguro: false
    });

    expect(estadoDuranteMP).toBe('iniciando');
    expect(res.preference_id).toBe('PREF-I17');
    expect(res.init_point).toBe('https://mp.test/init');

    const [pago] = await getPagos(trabajoId);
    expect(pago.estado).toBe('pendiente');
    expect(pago.mp_preference_id).toBe('PREF-I17');
  });

  test('si MP falla tras los reintentos, el pago queda fallido y el error se propaga', async () => {
    const trabajoId = await crearTrabajoConOfertaAceptada('I17 preferencia falla');

    // status 400 → no reintentable → falla inmediato sin esperar el backoff
    mockMP.preferenceCreate.mockRejectedValue(Object.assign(new Error('invalid card'), { status: 400 }));

    await expect(pagosSvc.crearPreferenciaTrabajo({
      trabajoId, pagadorId: idDueno, montoTotal: null, conSeguro: false
    })).rejects.toThrow('MercadoPago error');

    const [pago] = await getPagos(trabajoId);
    expect(pago.estado).toBe('fallido');
    expect(await contarDistribuciones(trabajoId)).toBe(0);
  });
});

// ─── pagarDirectoTrabajo ──────────────────────────────────────────────────────

describe('I17 — pagarDirectoTrabajo (outbox)', () => {
  test('pago aprobado: iniciando durante la llamada, aprobado con distribuciones retenidas al final', async () => {
    const trabajoId = await crearTrabajoConOfertaAceptada('I17 directo ok');

    let estadoDuranteMP = null;
    mockMP.paymentCreate.mockImplementation(async () => {
      const { rows } = await pool.query(
        `SELECT estado FROM pagos WHERE referencia_id = $1 AND tipo = 'trabajo' ORDER BY id DESC LIMIT 1`,
        [trabajoId]
      );
      estadoDuranteMP = rows[0] ? rows[0].estado : null;
      return { id: 90001, status: 'approved', status_detail: 'accredited' };
    });

    const res = await pagosSvc.pagarDirectoTrabajo({
      trabajoId, pagadorId: idDueno, cardToken: 'tok-test',
      paymentMethodId: 'visa', payerEmail: 'dueno.pagos@test.com'
    });

    expect(estadoDuranteMP).toBe('iniciando');
    expect(res.status).toBe('approved');

    const [pago] = await getPagos(trabajoId);
    expect(pago.estado).toBe('aprobado');
    expect(pago.mp_payment_id).toBe('90001');

    // Retención real: distribuciones trabajador + plataforma nacen 'pendiente'
    expect(await contarDistribuciones(trabajoId)).toBe(2);
    const { rows: dists } = await pool.query(
      `SELECT DISTINCT d.estado FROM distribuciones_pago d WHERE d.pago_id = $1`,
      [pago.id]
    );
    expect(dists).toHaveLength(1);
    expect(dists[0].estado).toBe('pendiente');
  });

  test('si MP falla, el pago queda fallido sin distribuciones', async () => {
    const trabajoId = await crearTrabajoConOfertaAceptada('I17 directo falla');

    mockMP.paymentCreate.mockRejectedValue(Object.assign(new Error('cc_rejected'), { status: 400 }));

    await expect(pagosSvc.pagarDirectoTrabajo({
      trabajoId, pagadorId: idDueno, cardToken: 'tok-test',
      paymentMethodId: 'visa', payerEmail: 'dueno.pagos@test.com'
    })).rejects.toThrow('MercadoPago error');

    const [pago] = await getPagos(trabajoId);
    expect(pago.estado).toBe('fallido');
    expect(await contarDistribuciones(trabajoId)).toBe(0);
  });
});

// ─── procesarWebhook ──────────────────────────────────────────────────────────

describe('I17 — procesarWebhook (outbox + idempotencia)', () => {
  test('aprueba el pago con distribuciones y un retry del mismo evento no reprocesa', async () => {
    const trabajoId = await crearTrabajoConOfertaAceptada('I17 webhook');

    // Pago 'pendiente' como lo deja crearPreferenciaTrabajo antes de que el dueño pague
    const { rows: [pago] } = await pool.query(
      `INSERT INTO pagos (usuario_id, tipo, referencia_id, monto_total, monto_plataforma, monto_trabajador, estado, metadata)
       VALUES ($1, 'trabajo', $2, 6000, 600, 5400, 'pendiente', $3) RETURNING *`,
      [idDueno, trabajoId, JSON.stringify({ trabajo_id: trabajoId, trabajador_id: idTrabajador, con_seguro: false, monto: 6000 })]
    );

    mockMP.paymentGet.mockResolvedValue({
      external_reference: String(pago.id), status: 'approved', status_detail: 'accredited'
    });

    await pagosSvc.procesarWebhook('MP-EVT-I17-1');

    const [pagoActualizado] = await getPagos(trabajoId);
    expect(pagoActualizado.estado).toBe('aprobado');
    expect(await contarDistribuciones(trabajoId)).toBe(2);

    // Retry del mismo payment id: dedupe por webhook_events, ni siquiera consulta a MP
    mockMP.paymentGet.mockClear();
    await pagosSvc.procesarWebhook('MP-EVT-I17-1');
    expect(mockMP.paymentGet).not.toHaveBeenCalled();
    expect(await contarDistribuciones(trabajoId)).toBe(2);
  });

  test('webhook posterior a un pago directo ya aprobado no duplica distribuciones (guard de estado)', async () => {
    const trabajoId = await crearTrabajoConOfertaAceptada('I17 webhook tras directo');

    mockMP.paymentCreate.mockResolvedValue({ id: 90002, status: 'approved', status_detail: 'accredited' });
    const res = await pagosSvc.pagarDirectoTrabajo({
      trabajoId, pagadorId: idDueno, cardToken: 'tok-test',
      paymentMethodId: 'visa', payerEmail: 'dueno.pagos@test.com'
    });
    expect(await contarDistribuciones(trabajoId)).toBe(2);

    // MP notifica el mismo payment por webhook (pagarDirecto no registra webhook_events):
    // el guard de estado detecta el pago ya aprobado y no vuelve a distribuir
    mockMP.paymentGet.mockResolvedValue({
      external_reference: String(res.pago_id), status: 'approved', status_detail: 'accredited'
    });
    await pagosSvc.procesarWebhook('90002');

    const [pago] = await getPagos(trabajoId);
    expect(pago.estado).toBe('aprobado');
    expect(await contarDistribuciones(trabajoId)).toBe(2);
  });
});

// ─── I13: verificación de firma HMAC-SHA256 del webhook ──────────────────────
//
//  MP firma: x-signature: ts=<timestamp>,v1=<hmac-hex>
//  Manifest: "id:<data.id>;request-id:<x-request-id>;ts:<timestamp>;"

describe('I13 — firma HMAC del webhook (POST /api/pagos/mp/webhook)', () => {
  const crypto = require('crypto');
  const SECRET = 'test-secret-i13';

  const firmar = (dataId, requestId, ts) =>
    crypto.createHmac('sha256', SECRET)
      .update(`id:${dataId};request-id:${requestId};ts:${ts};`)
      .digest('hex');

  const postWebhook = (dataId, headers = {}) => {
    let req = request(app)
      .post(`/api/pagos/mp/webhook?data.id=${dataId}`);
    for (const [k, v] of Object.entries(headers)) req = req.set(k, v);
    return req.send({ type: 'payment', data: { id: dataId } });
  };

  beforeAll(() => { process.env.MP_WEBHOOK_SECRET = SECRET; });
  afterAll(() => { delete process.env.MP_WEBHOOK_SECRET; });

  test('firma válida → 200 y el webhook se procesa (pago aprobado)', async () => {
    const trabajoId = await crearTrabajoConOfertaAceptada('I13 firma válida');

    // Pago pendiente esperando la confirmación del webhook
    const { rows: [pago] } = await pool.query(
      `INSERT INTO pagos (usuario_id, tipo, referencia_id, monto_total, monto_plataforma, monto_trabajador, estado, metadata)
       VALUES ($1, 'trabajo', $2, 6000, 600, 5400, 'pendiente', $3) RETURNING *`,
      [idDueno, trabajoId, JSON.stringify({ trabajo_id: trabajoId, trabajador_id: idTrabajador, con_seguro: false, monto: 6000 })]
    );
    mockMP.paymentGet.mockResolvedValue({
      external_reference: String(pago.id), status: 'approved', status_detail: 'accredited'
    });

    const dataId = 'MP-EVT-HMAC-OK';
    const ts = Date.now().toString();
    const requestId = 'req-hmac-ok';

    const res = await postWebhook(dataId, {
      'x-signature':  `ts=${ts},v1=${firmar(dataId, requestId, ts)}`,
      'x-request-id': requestId
    });

    expect(res.status).toBe(200);
    expect(mockMP.paymentGet).toHaveBeenCalled();
    const [pagoFinal] = await getPagos(trabajoId);
    expect(pagoFinal.estado).toBe('aprobado');
  });

  test('firma inválida → 401 y el webhook NO se procesa', async () => {
    const dataId = 'MP-EVT-HMAC-BAD';
    const ts = Date.now().toString();

    const res = await postWebhook(dataId, {
      'x-signature':  `ts=${ts},v1=${'0'.repeat(64)}`,
      'x-request-id': 'req-hmac-bad'
    });

    expect(res.status).toBe(401);
    expect(mockMP.paymentGet).not.toHaveBeenCalled();
    const { rows } = await pool.query(
      `SELECT 1 FROM webhook_events WHERE payment_id = $1`, [dataId]
    );
    expect(rows).toHaveLength(0);
  });

  test('header x-signature ausente → 401', async () => {
    const res = await postWebhook('MP-EVT-HMAC-SIN-HEADER', { 'x-request-id': 'req-hmac-sin' });

    expect(res.status).toBe(401);
    expect(mockMP.paymentGet).not.toHaveBeenCalled();
  });

  test('x-signature con formato inválido (sin ts/v1) → 401', async () => {
    const res = await postWebhook('MP-EVT-HMAC-MALFORMADO', {
      'x-signature':  'basura-sin-formato',
      'x-request-id': 'req-hmac-malformado'
    });

    expect(res.status).toBe(401);
    expect(mockMP.paymentGet).not.toHaveBeenCalled();
  });

  test('firma calculada sobre otro data.id → 401 (manifest no coincide)', async () => {
    const ts = Date.now().toString();
    const requestId = 'req-hmac-cruzado';
    // Firma válida pero para OTRO evento: el manifest usa el data.id del request real
    const firmaDeOtroEvento = firmar('MP-EVT-DISTINTO', requestId, ts);

    const res = await postWebhook('MP-EVT-HMAC-CRUZADO', {
      'x-signature':  `ts=${ts},v1=${firmaDeOtroEvento}`,
      'x-request-id': requestId
    });

    expect(res.status).toBe(401);
    expect(mockMP.paymentGet).not.toHaveBeenCalled();
  });
});
