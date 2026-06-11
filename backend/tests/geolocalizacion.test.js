const request = require('supertest');
const app = require('./app');
const { limpiarTablas, registrar, aprobarPagoTrabajo } = require('./helpers');

let pool;
let tokenDueno, tokenTrabajador;
let idDueno, idTrabajador;
let jobConCoordsId, jobSinCoordsId;

beforeAll(async () => {
  pool = require('../config/db');
  await limpiarTablas();

  // Registrar dueño y trabajador
  const regDueno = await registrar({ email: 'geo.dueno@test.com', tipo_perfil: 'dueno' });
  tokenDueno = regDueno.body.token;
  idDueno = regDueno.body.usuario.id;

  const regTrabajador = await registrar({ email: 'geo.worker@test.com', tipo_perfil: 'trabajador' });
  tokenTrabajador = regTrabajador.body.token;
  idTrabajador = regTrabajador.body.usuario.id;

  // Completar perfil del trabajador (requerido para ofertar)
  await request(app)
    .post('/api/profile/complete')
    .set('Authorization', `Bearer ${tokenTrabajador}`)
    .send({ nombre: 'Geo Tester', medio_transporte: 'auto' });

  // Crear trabajo 1 — con coordenadas para calcular proximidad
  const resJob1 = await request(app)
    .post('/api/jobs')
    .set('Authorization', `Bearer ${tokenDueno}`)
    .field('titulo', 'Trabajo geo con coords')
    .field('descripcion', 'Arreglo de cañería cerca del centro')
    .field('latitud', '-34.6037')
    .field('longitud', '-58.3816');
  jobConCoordsId = resJob1.body.job.id;

  // Crear trabajo 2 — sin coordenadas, para test sin coords en iniciar
  const resJob2 = await request(app)
    .post('/api/jobs')
    .set('Authorization', `Bearer ${tokenDueno}`)
    .field('titulo', 'Trabajo geo sin coords')
    .field('descripcion', 'Pintura de paredes');
  jobSinCoordsId = resJob2.body.job.id;

  // Trabajador oferta en trabajo 1
  const resOferta1 = await request(app)
    .post('/api/offers')
    .set('Authorization', `Bearer ${tokenTrabajador}`)
    .send({
      trabajo_id: jobConCoordsId,
      monto_propuesto: 5000,
      mensaje: 'Puedo ir mañana',
      tiempo_estimado: 2,
      unidad_tiempo: 'horas'
    });

  // Dueño acepta oferta 1 → trabajo pasa a en_negociacion
  await request(app)
    .patch(`/api/offers/${resOferta1.body.oferta.id}/accept`)
    .set('Authorization', `Bearer ${tokenDueno}`);

  // Trabajador oferta en trabajo 2
  const resOferta2 = await request(app)
    .post('/api/offers')
    .set('Authorization', `Bearer ${tokenTrabajador}`)
    .send({
      trabajo_id: jobSinCoordsId,
      monto_propuesto: 3000,
      mensaje: 'Disponible esta semana',
      tiempo_estimado: 3,
      unidad_tiempo: 'horas'
    });

  // Dueño acepta oferta 2 → trabajo pasa a en_negociacion
  await request(app)
    .patch(`/api/offers/${resOferta2.body.oferta.id}/accept`)
    .set('Authorization', `Bearer ${tokenDueno}`);

  // Pago aprobado simulado en ambos trabajos (requisito para confirmar llegada)
  await aprobarPagoTrabajo({ jobId: jobConCoordsId, duenoId: idDueno, trabajadorId: idTrabajador, monto: 5000 });
  await aprobarPagoTrabajo({ jobId: jobSinCoordsId, duenoId: idDueno, trabajadorId: idTrabajador, monto: 3000 });
});

afterAll(async () => {
  await pool.end();
});

// ─── Buscar trabajadores (público) ───────────────────────────────────────────

describe('GET /api/geo/trabajadores', () => {
  test('devuelve lista con lat/lng válidos → 200', async () => {
    const res = await request(app)
      .get('/api/geo/trabajadores')
      .query({ lat: '-34.6037', lng: '-58.3816' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('sin coordenadas → 200 (devuelve todos sin filtro de distancia)', async () => {
    const res = await request(app)
      .get('/api/geo/trabajadores');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('con solo lat sin lng → 400', async () => {
    const res = await request(app)
      .get('/api/geo/trabajadores')
      .query({ lat: '-34.6037' });

    expect(res.status).toBe(400);
  });
});

// ─── Confirmar llegada del trabajador (PATCH /api/jobs/:id/iniciar) ──────────

describe('PATCH /api/jobs/:id/iniciar — confirmar llegada', () => {
  test('con coordenadas válidas → 200 con campo proximidad en respuesta', async () => {
    const res = await request(app)
      .patch(`/api/jobs/${jobConCoordsId}/iniciar`)
      .set('Authorization', `Bearer ${tokenTrabajador}`)
      .send({ latitud: -34.6037, longitud: -58.3816 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.job).toBeDefined();
    expect(res.body.job).toHaveProperty('proximidad');
    // Cuando el trabajo tiene coords y el trabajador envía coords, proximidad tiene distancia
    const { proximidad } = res.body.job;
    if (proximidad !== null) {
      expect(typeof proximidad.distanciaMetros).toBe('number');
      expect(typeof proximidad.dentroDelRadio).toBe('boolean');
    }
  });

  test('sin coordenadas → 200 igual (coordenadas son opcionales)', async () => {
    const res = await request(app)
      .patch(`/api/jobs/${jobSinCoordsId}/iniciar`)
      .set('Authorization', `Bearer ${tokenTrabajador}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.job).toBeDefined();
    expect(res.body.job.proximidad).toBeNull();
  });

  test('usuario que no es el trabajador asignado → 403', async () => {
    // Crear otro usuario e intentar iniciar un trabajo ajeno
    const regOtro = await registrar({ email: 'geo.otro@test.com', tipo_perfil: 'trabajador' });
    const tokenOtro = regOtro.body.token;

    // jobConCoordsId ya está en trabajador_llego, jobSinCoordsId también
    // Crear un nuevo job para que el otro usuario intente iniciarlo sin ser el asignado
    const resJobNuevo = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${tokenDueno}`)
      .field('titulo', 'Trabajo de tercero')
      .field('descripcion', 'Solo para test de 403');
    const jobNuevoId = resJobNuevo.body.job.id;

    // Publicar oferta del trabajador original y aceptarla
    const resOferta = await request(app)
      .post('/api/offers')
      .set('Authorization', `Bearer ${tokenTrabajador}`)
      .send({
        trabajo_id: jobNuevoId,
        monto_propuesto: 2000,
        mensaje: 'Puedo hacerlo',
        tiempo_estimado: 1,
        unidad_tiempo: 'horas'
      });
    await request(app)
      .patch(`/api/offers/${resOferta.body.oferta.id}/accept`)
      .set('Authorization', `Bearer ${tokenDueno}`);

    // El otro trabajador intenta iniciar → debe recibir 403
    const res = await request(app)
      .patch(`/api/jobs/${jobNuevoId}/iniciar`)
      .set('Authorization', `Bearer ${tokenOtro}`)
      .send({ latitud: -34.6, longitud: -58.4 });

    expect(res.status).toBe(403);
  });
});
