const request = require('supertest');
const app = require('./app');
const { limpiarTablas, registrarYLogin } = require('./helpers');

let pool;
let tokenDueno;
let tokenTrabajador;
let jobId;

beforeAll(async () => {
  pool = require('../config/db');
  await limpiarTablas();

  tokenDueno = await registrarYLogin({ email: 'dueno.reportes@test.com', tipo_perfil: 'dueno' });
  tokenTrabajador = await registrarYLogin({ email: 'trabajador.reportes@test.com', tipo_perfil: 'trabajador' });

  // Crear un trabajo para reportar
  const res = await request(app)
    .post('/api/jobs')
    .set('Authorization', `Bearer ${tokenDueno}`)
    .field('titulo', 'Trabajo para reportar')
    .field('descripcion', 'Descripción del trabajo que se va a reportar en tests');
  jobId = res.body.job?.id;
});

afterAll(async () => {
  await pool.end();
});

// ─── POST /api/reportes ───────────────────────────────────────────────────────

describe('POST /api/reportes', () => {
  test('sin token → 401', async () => {
    const res = await request(app)
      .post('/api/reportes')
      .send({ tipo: 'publicacion', referencia_id: 1, motivo: 'spam' });
    expect(res.status).toBe(401);
  });

  test('campos inválidos → 400', async () => {
    const res = await request(app)
      .post('/api/reportes')
      .set('Authorization', `Bearer ${tokenTrabajador}`)
      .send({ tipo: 'invalido', referencia_id: 0, motivo: 'motivo_raro' });
    expect(res.status).toBe(400);
    expect(res.body.errores).toBeDefined();
  });

  test('reporte de publicación válido → 201', async () => {
    const res = await request(app)
      .post('/api/reportes')
      .set('Authorization', `Bearer ${tokenTrabajador}`)
      .send({ tipo: 'publicacion', referencia_id: jobId, motivo: 'spam' });
    expect(res.status).toBe(201);
    expect(res.body.mensaje).toBe('Tu reporte fue enviado, lo revisaremos');
  });

  test('reportar dos veces el mismo contenido → 409', async () => {
    const res = await request(app)
      .post('/api/reportes')
      .set('Authorization', `Bearer ${tokenTrabajador}`)
      .send({ tipo: 'publicacion', referencia_id: jobId, motivo: 'spam' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/ya reportaste/i);
  });

  test('reporte de comentario válido → 201', async () => {
    // Crear un comentario primero
    const comentRes = await request(app)
      .post(`/api/jobs/${jobId}/comentarios`)
      .set('Authorization', `Bearer ${tokenTrabajador}`)
      .send({ contenido: 'Comentario de prueba para reportar' });
    const comentarioId = comentRes.body.comentario?.id;

    const res = await request(app)
      .post('/api/reportes')
      .set('Authorization', `Bearer ${tokenDueno}`)
      .send({ tipo: 'comentario', referencia_id: comentarioId, motivo: 'contenido_inapropiado' });
    expect(res.status).toBe(201);
    expect(res.body.mensaje).toBe('Tu reporte fue enviado, lo revisaremos');
  });

  test('todos los motivos válidos son aceptados', async () => {
    const motivos = ['contenido_inapropiado', 'spam', 'informacion_falsa', 'otro'];
    for (let i = 0; i < motivos.length; i++) {
      const res = await request(app)
        .post('/api/reportes')
        .set('Authorization', `Bearer ${tokenDueno}`)
        .send({ tipo: 'publicacion', referencia_id: i + 100, motivo: motivos[i] });
      // 201 o 409 si ya existe — lo que importa es que no sea 400
      expect([201, 409]).toContain(res.status);
    }
  });
});
