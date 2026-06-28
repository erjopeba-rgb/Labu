const request = require('supertest');
const app = require('./app');

afterAll(async () => {
  await require('../config/db').end();
});

describe('M7 — 404 JSON para rutas /api desconocidas', () => {
  test('GET /api/v1/inexistente → 404 en formato unificado', async () => {
    const res = await request(app).get('/api/v1/inexistente');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toEqual({ success: false, error: 'Ruta no encontrada' });
  });

  test('POST /api/ruta-que-no-existe → 404 en formato unificado', async () => {
    const res = await request(app).post('/api/ruta-que-no-existe').send({});
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Ruta no encontrada');
  });
});
