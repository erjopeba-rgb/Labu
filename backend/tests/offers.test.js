const request = require('supertest');
const app = require('./app');
const { limpiarTablas, registrarYLogin } = require('./helpers');

let pool;
let tokenDueno;
let tokenTrabajador;
let tokenTrabajador2;
let jobId;
let ofertaId;

// Configura perfil con medio_transporte para que el trabajador pueda ofertar
const configurarPerfilTrabajador = (token) =>
  request(app)
    .post('/api/profile/complete')
    .set('Authorization', `Bearer ${token}`)
    .send({ nombre: 'Test', medio_transporte: 'auto' });

beforeAll(async () => {
  pool = require('../config/db');
  await limpiarTablas();

  tokenDueno      = await registrarYLogin({ email: 'dueno.offers@test.com',  tipo_perfil: 'dueno' });
  tokenTrabajador = await registrarYLogin({ email: 'worker.offers@test.com', tipo_perfil: 'trabajador' });
  tokenTrabajador2= await registrarYLogin({ email: 'worker2.offers@test.com',tipo_perfil: 'trabajador' });

  await configurarPerfilTrabajador(tokenTrabajador);
  await configurarPerfilTrabajador(tokenTrabajador2);

  // Publicar un trabajo que usarán todos los tests de ofertas
  const jobRes = await request(app)
    .post('/api/jobs')
    .set('Authorization', `Bearer ${tokenDueno}`)
    .field('titulo', 'Instalación de cerámica')
    .field('descripcion', 'Necesito instalar cerámica en cocina y baño');
  jobId = jobRes.body.job.id;
});

afterAll(async () => {
  await pool.end();
});

// ─── Crear oferta ─────────────────────────────────────────────────────────────

describe('POST /api/offers', () => {
  test('crea oferta válida → 201', async () => {
    const res = await request(app)
      .post('/api/offers')
      .set('Authorization', `Bearer ${tokenTrabajador}`)
      .send({
        trabajo_id: jobId,
        monto_propuesto: 5000,
        mensaje: 'Puedo hacerlo en 2 días con materiales incluidos'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.oferta).toBeDefined();
    expect(Number(res.body.oferta.monto_propuesto)).toBe(5000);
    ofertaId = res.body.oferta.id;
  });

  test('rechaza oferta duplicada del mismo trabajador → 409', async () => {
    const res = await request(app)
      .post('/api/offers')
      .set('Authorization', `Bearer ${tokenTrabajador}`)
      .send({ trabajo_id: jobId, monto_propuesto: 4500 });

    expect(res.status).toBe(409);
  });

  test('rechaza que el dueño oferte en su propio trabajo → 400', async () => {
    const res = await request(app)
      .post('/api/offers')
      .set('Authorization', `Bearer ${tokenDueno}`)
      .send({ trabajo_id: jobId, monto_propuesto: 3000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/propio trabajo/i);
  });

  test('rechaza monto inválido → 400', async () => {
    const res = await request(app)
      .post('/api/offers')
      .set('Authorization', `Bearer ${tokenTrabajador2}`)
      .send({ trabajo_id: jobId, monto_propuesto: -100 });

    expect(res.status).toBe(400);
  });

  test('rechaza sin trabajo_id → 400', async () => {
    const res = await request(app)
      .post('/api/offers')
      .set('Authorization', `Bearer ${tokenTrabajador2}`)
      .send({ monto_propuesto: 3000 });

    expect(res.status).toBe(400);
  });

  test('rechaza trabajador sin medio_transporte configurado → 400', async () => {
    const tokenSinPerfil = await registrarYLogin({ email: 'sin-perfil.offers@test.com', tipo_perfil: 'trabajador' });
    const res = await request(app)
      .post('/api/offers')
      .set('Authorization', `Bearer ${tokenSinPerfil}`)
      .send({ trabajo_id: jobId, monto_propuesto: 3500 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/medio de transporte/i);
  });

  test('rechaza sin autenticación → 401', async () => {
    const res = await request(app)
      .post('/api/offers')
      .send({ trabajo_id: jobId, monto_propuesto: 3000 });

    expect(res.status).toBe(401);
  });
});

// ─── Listar ofertas ───────────────────────────────────────────────────────────

describe('GET /api/offers/:trabajo_id', () => {
  test('devuelve ofertas del trabajo → 200', async () => {
    const res = await request(app)
      .get(`/api/offers/${jobId}`)
      .set('Authorization', `Bearer ${tokenDueno}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.ofertas)).toBe(true);
    expect(res.body.ofertas.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Mis ofertas ──────────────────────────────────────────────────────────────

describe('GET /api/offers/mis-ofertas', () => {
  test('devuelve las ofertas del trabajador → 200', async () => {
    const res = await request(app)
      .get('/api/offers/mis-ofertas')
      .set('Authorization', `Bearer ${tokenTrabajador}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.page).toBe(1);
  });
});

// ─── Contraoferta ─────────────────────────────────────────────────────────────

describe('PATCH /api/offers/:id/counter', () => {
  test('dueño puede contraofertar → 200', async () => {
    const res = await request(app)
      .patch(`/api/offers/${ofertaId}/counter`)
      .set('Authorization', `Bearer ${tokenDueno}`)
      .send({ monto_contraoferta: 4000, mensaje_contraoferta: 'Te ofrezco 4000 en efectivo' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('rechaza contraofertar sin monto → 400', async () => {
    const res = await request(app)
      .patch(`/api/offers/${ofertaId}/counter`)
      .set('Authorization', `Bearer ${tokenDueno}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ─── Rechazar contraoferta (trabajador) ──────────────────────────────────────

describe('PATCH /api/offers/:id/reject-counter', () => {
  test('trabajador puede rechazar la contraoferta → 200', async () => {
    const res = await request(app)
      .patch(`/api/offers/${ofertaId}/reject-counter`)
      .set('Authorization', `Bearer ${tokenTrabajador}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── Tests de aceptar/rechazar oferta (con nueva oferta limpia) ───────────────

describe('PATCH /api/offers/:id/reject y /accept', () => {
  let jobParaRechazar;
  let ofertaParaRechazar;
  let ofertaParaAceptar;

  beforeAll(async () => {
    // Publicar trabajo nuevo para estos tests
    const jobRes = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${tokenDueno}`)
      .field('titulo', 'Trabajo para test aceptar/rechazar')
      .field('descripcion', 'Descripción del trabajo de prueba para aceptar y rechazar ofertas');
    jobParaRechazar = jobRes.body.job.id;

    // Crear oferta para rechazar
    const ofertaRejRes = await request(app)
      .post('/api/offers')
      .set('Authorization', `Bearer ${tokenTrabajador2}`)
      .send({ trabajo_id: jobParaRechazar, monto_propuesto: 3000 });
    ofertaParaRechazar = ofertaRejRes.body.oferta.id;

    // Crear oferta para aceptar (nuevo trabajador)
    const tokenTrabajador3 = await registrarYLogin({ email: 'worker3.offers@test.com', tipo_perfil: 'trabajador' });
    await configurarPerfilTrabajador(tokenTrabajador3);
    const ofertaAccRes = await request(app)
      .post('/api/offers')
      .set('Authorization', `Bearer ${tokenTrabajador3}`)
      .send({ trabajo_id: jobParaRechazar, monto_propuesto: 2500 });
    ofertaParaAceptar = ofertaAccRes.body.oferta.id;
  });

  test('dueño rechaza oferta → 200', async () => {
    const res = await request(app)
      .patch(`/api/offers/${ofertaParaRechazar}/reject`)
      .set('Authorization', `Bearer ${tokenDueno}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('dueño acepta oferta → 200 y trabajo pasa a en_negociacion', async () => {
    const res = await request(app)
      .patch(`/api/offers/${ofertaParaAceptar}/accept`)
      .set('Authorization', `Bearer ${tokenDueno}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verificar que el trabajo pasó a en_negociacion
    const jobRes = await request(app)
      .get(`/api/jobs/${jobParaRechazar}`)
      .set('Authorization', `Bearer ${tokenDueno}`);
    expect(jobRes.body.job.estado).toBe('en_negociacion');
  });

  test('rechaza aceptar oferta ya aceptada → 404', async () => {
    // findOfertaParaAceptar solo matchea ofertas pendientes/contraofertadas:
    // una oferta ya aceptada no se encuentra → 404
    const res = await request(app)
      .patch(`/api/offers/${ofertaParaAceptar}/accept`)
      .set('Authorization', `Bearer ${tokenDueno}`);

    expect(res.status).toBe(404);
  });
});
