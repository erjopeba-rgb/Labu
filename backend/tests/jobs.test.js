const request = require('supertest');
const app = require('./app');
const { limpiarTablas, registrarYLogin } = require('./helpers');

let pool;
let tokenDueno;
let jobId;

beforeAll(async () => {
  pool = require('../config/db');
  await limpiarTablas();

  tokenDueno = await registrarYLogin({
    email: 'dueno.jobs@test.com',
    tipo_perfil: 'dueno'
  });
});

afterAll(async () => {
  await pool.end();
});

// ─── Crear trabajo ────────────────────────────────────────────────────────────

describe('POST /api/jobs', () => {
  test('crea trabajo con campos directos → 201', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${tokenDueno}`)
      .field('titulo', 'Reparación de baño')
      .field('descripcion', 'Necesito reparar la cañería del baño, hay pérdida de agua');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.job).toBeDefined();
    expect(res.body.job.titulo).toBe('Reparación de baño');
    expect(res.body.job.estado).toBe('publicado');
    jobId = res.body.job.id;
  });

  test('crea trabajo con campo data en JSON string → 201', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${tokenDueno}`)
      .field('data', JSON.stringify({
        titulo: 'Pintura de paredes',
        descripcion: 'Necesito pintar 3 habitaciones con pintura látex blanca'
      }));

    expect(res.status).toBe(201);
    expect(res.body.job.titulo).toBe('Pintura de paredes');
  });

  test('crea trabajo con foto adjunta → 201', async () => {
    const imagenFake = Buffer.from('fake-image-data');

    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${tokenDueno}`)
      .field('titulo', 'Trabajo con foto')
      .field('descripcion', 'Descripción del trabajo con foto adjunta')
      .attach('media', imagenFake, { filename: 'antes.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.job).toBeDefined();
  });

  test('rechaza sin autenticación → 401', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .field('titulo', 'Trabajo sin auth')
      .field('descripcion', 'Descripción');

    expect(res.status).toBe(401);
  });

  test('rechaza titulo vacío → 400', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${tokenDueno}`)
      .field('titulo', '')
      .field('descripcion', 'Descripción válida del trabajo');

    expect(res.status).toBe(400);
  });
});

// ─── Listar trabajos (feed) ───────────────────────────────────────────────────

describe('GET /api/jobs', () => {
  test('devuelve feed de trabajos publicados → 200', async () => {
    const res = await request(app)
      .get('/api/jobs')
      .set('Authorization', `Bearer ${tokenDueno}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.jobs)).toBe(true);
    expect(res.body.jobs.length).toBeGreaterThanOrEqual(1);
  });

  test('devuelve feed vacío sin autenticación → 401', async () => {
    const res = await request(app).get('/api/jobs');
    expect(res.status).toBe(401);
  });

  test('soporta paginación con limit y offset', async () => {
    const res = await request(app)
      .get('/api/jobs?limit=1&offset=0')
      .set('Authorization', `Bearer ${tokenDueno}`);

    expect(res.status).toBe(200);
    expect(res.body.jobs.length).toBeLessThanOrEqual(1);
  });
});

// ─── Obtener trabajo por ID ───────────────────────────────────────────────────

describe('GET /api/jobs/:id', () => {
  test('devuelve trabajo existente → 200', async () => {
    const res = await request(app)
      .get(`/api/jobs/${jobId}`)
      .set('Authorization', `Bearer ${tokenDueno}`);

    expect(res.status).toBe(200);
    expect(res.body.job.id).toBe(jobId);
    expect(res.body.job.titulo).toBe('Reparación de baño');
  });

  test('devuelve 404 para ID inexistente', async () => {
    const res = await request(app)
      .get('/api/jobs/999999')
      .set('Authorization', `Bearer ${tokenDueno}`);

    expect(res.status).toBe(404);
  });
});

// ─── Mis trabajos ─────────────────────────────────────────────────────────────

describe('GET /api/jobs/mis-trabajos', () => {
  test('devuelve los trabajos del dueño → 200', async () => {
    const res = await request(app)
      .get('/api/jobs/mis-trabajos')
      .set('Authorization', `Bearer ${tokenDueno}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some(j => j.id === jobId)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.page).toBe(1);
  });
});

// ─── Cancelar trabajo ─────────────────────────────────────────────────────────

describe('PATCH /api/jobs/:id/cancel', () => {
  let jobACancelar;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${tokenDueno}`)
      .field('titulo', 'Trabajo a cancelar')
      .field('descripcion', 'Este trabajo será cancelado en el test');
    jobACancelar = res.body.job.id;
  });

  test('cancela trabajo propio → 200', async () => {
    const res = await request(app)
      .patch(`/api/jobs/${jobACancelar}/cancel`)
      .set('Authorization', `Bearer ${tokenDueno}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('rechaza cancelar trabajo ya cancelado → 404', async () => {
    const res = await request(app)
      .patch(`/api/jobs/${jobACancelar}/cancel`)
      .set('Authorization', `Bearer ${tokenDueno}`);

    expect(res.status).toBe(404);
  });

  test('rechaza cancelar trabajo ajeno → 404', async () => {
    // Crear otro usuario e intentar cancelar el trabajo del dueño original
    const tokenOtro = await registrarYLogin({ email: 'otro.dueno@test.com', tipo_perfil: 'dueno' });
    const res = await request(app)
      .patch(`/api/jobs/${jobId}/cancel`)
      .set('Authorization', `Bearer ${tokenOtro}`);

    expect(res.status).toBe(404);
  });
});
