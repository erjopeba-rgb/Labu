// I13 — disponibilidad semanal y reservas tentativas: consultar/guardar
// disponibilidad, crear reservas, permisos y confirmación de slot.
// Nota de diseño: NO existe un 409 por "conflicto de reservas" — re-crear
// reservas para una oferta REEMPLAZA las tentativas anteriores (DELETE+INSERT),
// y el conflicto real de agenda lo previene el agendamiento automático
// (scheduling.service.js, fix C1: advisory lock + detector de conflictos).

const request = require('supertest');
const app = require('./app');
const { limpiarTablas, registrar } = require('./helpers');

let pool;
let tokenDueno, tokenTrabajador, tokenOtroTrabajador;
let idTrabajador;
let jobId, ofertaId;

const SLOTS_SEMANA = [
  { dia_semana: 0, hora_inicio: '09:00', hora_fin: '12:00' },
  { dia_semana: 2, hora_inicio: '14:00', hora_fin: '18:00' },
];

const putDisponibilidad = (token, body) =>
  request(app)
    .put('/api/disponibilidad')
    .set('Authorization', `Bearer ${token}`)
    .send(body);

beforeAll(async () => {
  pool = require('../config/db');
  await limpiarTablas();

  const regDueno = await registrar({ email: 'dueno.disp@test.com', tipo_perfil: 'dueno' });
  tokenDueno = regDueno.body.token;

  const regTrabajador = await registrar({ email: 'worker.disp@test.com', tipo_perfil: 'trabajador' });
  idTrabajador = regTrabajador.body.usuario.id;
  tokenTrabajador = regTrabajador.body.token;

  const regOtro = await registrar({ email: 'otro-worker.disp@test.com', tipo_perfil: 'trabajador' });
  tokenOtroTrabajador = regOtro.body.token;

  // medio_transporte es requerido para ofertar
  for (const token of [tokenTrabajador, tokenOtroTrabajador]) {
    await request(app)
      .post('/api/profile/complete')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Worker Disp', medio_transporte: 'auto' });
  }

  // Trabajo del dueño + oferta del trabajador (base para las reservas)
  const resJob = await request(app)
    .post('/api/jobs')
    .set('Authorization', `Bearer ${tokenDueno}`)
    .field('titulo', 'Trabajo para tests de disponibilidad')
    .field('descripcion', 'Trabajo usado por los tests de reservas tentativas (I13)');
  jobId = resJob.body.job.id;

  const resOferta = await request(app)
    .post('/api/offers')
    .set('Authorization', `Bearer ${tokenTrabajador}`)
    .send({ trabajo_id: jobId, monto_propuesto: 4000, mensaje: 'Oferta con slots' });
  ofertaId = resOferta.body.oferta.id;
});

afterAll(async () => {
  await pool.end();
});

// ─── Disponibilidad semanal ──────────────────────────────────────────────────

describe('GET/PUT /api/disponibilidad', () => {
  test('sin configurar → 200 con disponibilidad vacía', async () => {
    const res = await request(app)
      .get('/api/disponibilidad')
      .set('Authorization', `Bearer ${tokenTrabajador}`);

    expect(res.status).toBe(200);
    expect(res.body.disponibilidad).toEqual([]);
  });

  test('guarda slots válidos → 200 y la consulta los devuelve', async () => {
    const resPut = await putDisponibilidad(tokenTrabajador, {
      slots: SLOTS_SEMANA,
      tiempo_preparacion_minutos: 20
    });
    expect(resPut.status).toBe(200);

    const resGet = await request(app)
      .get('/api/disponibilidad')
      .set('Authorization', `Bearer ${tokenTrabajador}`);

    expect(resGet.status).toBe(200);
    expect(resGet.body.disponibilidad).toHaveLength(2);
    expect(resGet.body.tiempo_preparacion_minutos).toBe(20);
    const dias = resGet.body.disponibilidad.map(s => s.dia_semana).sort();
    expect(dias).toEqual([0, 2]);
  });

  test('otro usuario consulta la disponibilidad del trabajador → 200', async () => {
    const res = await request(app)
      .get(`/api/disponibilidad/trabajador/${idTrabajador}`)
      .set('Authorization', `Bearer ${tokenDueno}`);

    expect(res.status).toBe(200);
    expect(res.body.disponibilidad).toHaveLength(2);
  });

  test('dia_semana fuera de rango → 400 (validación declarativa)', async () => {
    const res = await putDisponibilidad(tokenTrabajador, {
      slots: [{ dia_semana: 7, hora_inicio: '09:00', hora_fin: '12:00' }]
    });

    expect(res.status).toBe(400);
    expect(res.body.errores).toEqual(
      expect.arrayContaining([expect.stringMatching(/dia_semana/i)])
    );
  });

  test('hora con formato inválido → 400 (validación declarativa)', async () => {
    const res = await putDisponibilidad(tokenTrabajador, {
      slots: [{ dia_semana: 1, hora_inicio: '25:00', hora_fin: '12:00' }]
    });

    expect(res.status).toBe(400);
    expect(res.body.errores).toEqual(
      expect.arrayContaining([expect.stringMatching(/hora_inicio/i)])
    );
  });

  test('id de trabajador no numérico → 400 (validación declarativa)', async () => {
    const res = await request(app)
      .get('/api/disponibilidad/trabajador/abc')
      .set('Authorization', `Bearer ${tokenDueno}`);

    expect(res.status).toBe(400);
  });

  test('sin autenticación → 401', async () => {
    const res = await request(app).get('/api/disponibilidad');
    expect(res.status).toBe(401);
  });
});

// ─── Reservas tentativas ─────────────────────────────────────────────────────

describe('POST /api/disponibilidad/reservas', () => {
  const postReservas = (token, body) =>
    request(app)
      .post('/api/disponibilidad/reservas')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  test('el trabajador crea reservas tentativas para su oferta → 201', async () => {
    const res = await postReservas(tokenTrabajador, {
      oferta_id: ofertaId,
      trabajo_id: jobId,
      slots: SLOTS_SEMANA
    });

    expect(res.status).toBe(201);
    expect(res.body.reservas).toHaveLength(2);
    expect(res.body.reservas.every(r => r.estado === 'tentativa')).toBe(true);
  });

  test('la consulta por oferta devuelve los slots tentativas', async () => {
    const res = await request(app)
      .get(`/api/disponibilidad/reservas/oferta/${ofertaId}`)
      .set('Authorization', `Bearer ${tokenDueno}`);

    expect(res.status).toBe(200);
    expect(res.body.reservas).toHaveLength(2);
  });

  test('otro trabajador no puede reservar sobre una oferta ajena → 403', async () => {
    const res = await postReservas(tokenOtroTrabajador, {
      oferta_id: ofertaId,
      trabajo_id: jobId,
      slots: [SLOTS_SEMANA[0]]
    });

    expect(res.status).toBe(403);
  });

  test('re-crear reservas REEMPLAZA las tentativas anteriores (no duplica ni da conflicto)', async () => {
    const res = await postReservas(tokenTrabajador, {
      oferta_id: ofertaId,
      trabajo_id: jobId,
      slots: [{ dia_semana: 4, hora_inicio: '10:00', hora_fin: '13:00' }]
    });
    expect(res.status).toBe(201);
    expect(res.body.reservas).toHaveLength(1);

    // Solo queda la tentativa nueva: las dos anteriores fueron borradas
    const { rows } = await pool.query(
      `SELECT dia_semana, estado FROM reservas_tentativas WHERE oferta_id = $1 AND estado = 'tentativa'`,
      [ofertaId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].dia_semana).toBe(4);
  });

  test('slots vacíos → 400 (validación declarativa)', async () => {
    const res = await postReservas(tokenTrabajador, {
      oferta_id: ofertaId,
      trabajo_id: jobId,
      slots: []
    });

    expect(res.status).toBe(400);
    expect(res.body.errores).toBeDefined();
  });

  test('sin oferta_id → 400 (validación declarativa)', async () => {
    const res = await postReservas(tokenTrabajador, {
      trabajo_id: jobId,
      slots: SLOTS_SEMANA
    });

    expect(res.status).toBe(400);
  });
});

// ─── Confirmación de slot por el dueño ───────────────────────────────────────

describe('POST /api/disponibilidad/reservas/:id/confirmar', () => {
  let reservaId;

  beforeAll(async () => {
    // Dejar dos tentativas para verificar que la no elegida se libera
    await request(app)
      .post('/api/disponibilidad/reservas')
      .set('Authorization', `Bearer ${tokenTrabajador}`)
      .send({ oferta_id: ofertaId, trabajo_id: jobId, slots: SLOTS_SEMANA });

    const { rows } = await pool.query(
      `SELECT id FROM reservas_tentativas WHERE oferta_id = $1 AND estado = 'tentativa' ORDER BY id`,
      [ofertaId]
    );
    reservaId = rows[0].id;
  });

  test('un usuario que no es el dueño del trabajo → 403', async () => {
    const res = await request(app)
      .post(`/api/disponibilidad/reservas/${reservaId}/confirmar`)
      .set('Authorization', `Bearer ${tokenOtroTrabajador}`)
      .send({});

    expect(res.status).toBe(403);
  });

  test('el dueño confirma un slot → 200, el resto se libera y la oferta queda aceptada', async () => {
    const res = await request(app)
      .post(`/api/disponibilidad/reservas/${reservaId}/confirmar`)
      .set('Authorization', `Bearer ${tokenDueno}`)
      .send({});

    expect(res.status).toBe(200);

    const { rows: reservas } = await pool.query(
      `SELECT id, estado FROM reservas_tentativas WHERE oferta_id = $1 ORDER BY id`,
      [ofertaId]
    );
    const confirmadas = reservas.filter(r => r.estado === 'confirmada');
    expect(confirmadas).toHaveLength(1);
    expect(confirmadas[0].id).toBe(reservaId);
    expect(reservas.some(r => r.estado === 'tentativa')).toBe(false);

    const { rows: [oferta] } = await pool.query(
      'SELECT estado FROM ofertas WHERE id = $1', [ofertaId]
    );
    expect(oferta.estado).toBe('aceptada');
  });

  test('reserva inexistente → 404', async () => {
    const res = await request(app)
      .post('/api/disponibilidad/reservas/999999/confirmar')
      .set('Authorization', `Bearer ${tokenDueno}`)
      .send({});

    expect(res.status).toBe(404);
  });

  test('id de reserva no numérico → 400 (validación declarativa)', async () => {
    const res = await request(app)
      .post('/api/disponibilidad/reservas/abc/confirmar')
      .set('Authorization', `Bearer ${tokenDueno}`)
      .send({});

    expect(res.status).toBe(400);
  });
});
