const request = require('supertest');
const { formatInTimeZone } = require('date-fns-tz');
const app = require('./app');
const { limpiarTablas, registrarYLogin } = require('./helpers');
const schedulingSvc = require('../services/scheduling.service');
const { calcularProximoSlot } = schedulingSvc;

const TZ = 'America/Argentina/Buenos_Aires';

// I12: OSRM mockeado en toda la suite — los tests no dependen del demo público.
// 1200 segundos = 20 minutos (obtenerTiempoViaje retorna minutos).
const TIEMPO_VIAJE_MOCK_MIN = 20;

let pool;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getUserId = async (email) => {
  const res = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
  return res.rows[0]?.id;
};

// Configura disponibilidad L-D 09:00-17:00 (cubre todos los días para garantizar un slot)
const configurarDisponibilidadCompleta = (token) => {
  const slots = [0, 1, 2, 3, 4, 5, 6].map(d => ({
    dia_semana: d,
    hora_inicio: '09:00',
    hora_fin: '17:00'
  }));
  return request(app)
    .put('/api/disponibilidad')
    .set('Authorization', `Bearer ${token}`)
    .send({ slots });
};

const configurarPerfil = (token) =>
  request(app)
    .post('/api/profile/complete')
    .set('Authorization', `Bearer ${token}`)
    .send({ nombre: 'Test', medio_transporte: 'auto' });

// ─── Setup / Teardown ────────────────────────────────────────────────────────

beforeAll(async () => {
  pool = require('../config/db');
  await limpiarTablas();
  jest.spyOn(schedulingSvc, 'obtenerTiempoViaje').mockResolvedValue(TIEMPO_VIAJE_MOCK_MIN);
});

afterAll(async () => {
  await pool.end();
});

// ─── Test 1 y 2: calcularProximoSlot (llamada directa al servicio) ─────────

describe('calcularProximoSlot', () => {
  let trabajadorSinDispId;
  let trabajadorConDispId;
  let trabajoId;

  beforeAll(async () => {
    const tokenDueno   = await registrarYLogin({ email: 'dueno.sched@test.com',      tipo_perfil: 'dueno' });
    const tokenSinDisp = await registrarYLogin({ email: 'sin-disp.sched@test.com',   tipo_perfil: 'trabajador' });
    const tokenConDisp = await registrarYLogin({ email: 'con-disp.sched@test.com',   tipo_perfil: 'trabajador' });

    // Solo el segundo trabajador completa su perfil y disponibilidad
    await configurarPerfil(tokenConDisp);
    await configurarDisponibilidadCompleta(tokenConDisp);

    trabajadorSinDispId = await getUserId('sin-disp.sched@test.com');
    trabajadorConDispId = await getUserId('con-disp.sched@test.com');

    // Crear trabajo sin restricción de días del dueño
    const jobRes = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${tokenDueno}`)
      .field('titulo', 'Trabajo para test scheduling')
      .field('descripcion', 'Descripción del trabajo de scheduling usado en tests unitarios');
    trabajoId = jobRes.body.job.id;
  });

  test('retorna null cuando el trabajador no tiene disponibilidad configurada', async () => {
    const slot = await calcularProximoSlot(trabajadorSinDispId, trabajoId);
    expect(slot).toBeNull();
  });

  test('retorna un slot válido cuando hay disponibilidad coincidente entre trabajador y dueño', async () => {
    const slot = await calcularProximoSlot(trabajadorConDispId, trabajoId);

    expect(slot).not.toBeNull();
    expect(slot.fecha_inicio).toBeInstanceOf(Date);
    expect(slot.fecha_inicio.getTime()).toBeGreaterThan(Date.now());
    expect(typeof slot.cuando).toBe('string');
    expect(slot.cuando).toMatch(/\d{2}\/\d{2}\/\d{4} de \d{2}:\d{2} a \d{2}:\d{2}/);
    expect(typeof slot.hora_inicio).toBe('string');
    expect(typeof slot.hora_fin).toBe('string');
    expect(typeof slot.dia_semana).toBe('number');
    expect(slot.dia_semana).toBeGreaterThanOrEqual(0);
    expect(slot.dia_semana).toBeLessThanOrEqual(6);
  });

  test('usa el tiempo de viaje de OSRM (mockeado) para correr el inicio del slot', async () => {
    // Coordenadas de casa del trabajador y del trabajo → se activa el camino OSRM
    await pool.query(
      'UPDATE perfiles SET latitud = $1, longitud = $2 WHERE usuario_id = $3',
      [-34.6037, -58.3816, trabajadorConDispId]
    );
    await pool.query(
      'UPDATE trabajos SET latitud = $1, longitud = $2 WHERE id = $3',
      [-34.6158, -58.4333, trabajoId]
    );

    schedulingSvc.obtenerTiempoViaje.mockClear();
    const slot = await calcularProximoSlot(trabajadorConDispId, trabajoId);

    expect(slot).not.toBeNull();
    // El mock fue consultado con el medio de transporte y las coordenadas reales
    expect(schedulingSvc.obtenerTiempoViaje).toHaveBeenCalledWith(
      'auto', -34.6037, -58.3816, -34.6158, -58.4333
    );
    // Slot 09:00 + 15 min de preparación (default) + 20 min de viaje (mock) = 09:35
    expect(slot.hora_inicio).toBe('09:35');
  });
});

// ─── Test 3: aceptar oferta guarda fecha_inicio automáticamente ───────────

describe('PATCH /api/offers/:id/accept guarda fecha_inicio cuando hay disponibilidad', () => {
  let tokenDueno;
  let tokenTrabajador;
  let jobId;
  let ofertaId;

  beforeAll(async () => {
    tokenDueno      = await registrarYLogin({ email: 'dueno2.sched@test.com',   tipo_perfil: 'dueno' });
    tokenTrabajador = await registrarYLogin({ email: 'worker2.sched@test.com',  tipo_perfil: 'trabajador' });

    // Perfil completo + disponibilidad todos los días
    await configurarPerfil(tokenTrabajador);
    const dispRes = await configurarDisponibilidadCompleta(tokenTrabajador);
    expect(dispRes.status).toBe(200); // sanity check: disponibilidad guardada OK

    // Publicar trabajo
    const jobRes = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${tokenDueno}`)
      .field('titulo', 'Trabajo para test accept+scheduling')
      .field('descripcion', 'Descripción de prueba para verificar que accept guarda fecha_inicio automáticamente');
    jobId = jobRes.body.job.id;

    // Crear oferta
    const ofertaRes = await request(app)
      .post('/api/offers')
      .set('Authorization', `Bearer ${tokenTrabajador}`)
      .send({ trabajo_id: jobId, monto_propuesto: 5000, mensaje: 'Puedo hacerlo mañana' });
    ofertaId = ofertaRes.body.oferta.id;
  });

  test('acepta oferta → 200 y trabajo queda en en_negociacion', async () => {
    const res = await request(app)
      .patch(`/api/offers/${ofertaId}/accept`)
      .set('Authorization', `Bearer ${tokenDueno}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const jobRes = await request(app)
      .get(`/api/jobs/${jobId}`)
      .set('Authorization', `Bearer ${tokenDueno}`);
    expect(jobRes.body.job.estado).toBe('en_negociacion');
  });

  test('fecha_inicio fue guardada automáticamente y es una fecha futura válida', async () => {
    // El agendamiento es fire-and-forget; esperar hasta 3s a que se persista
    let fecha_inicio = null;
    for (let i = 0; i < 15; i++) {
      const jobRes = await request(app)
        .get(`/api/jobs/${jobId}`)
        .set('Authorization', `Bearer ${tokenDueno}`);
      expect(jobRes.status).toBe(200);
      fecha_inicio = jobRes.body.job.fecha_inicio;
      if (fecha_inicio) break;
      await new Promise(r => setTimeout(r, 200));
    }

    expect(fecha_inicio).not.toBeNull();
    expect(fecha_inicio).toBeDefined();

    const fechaInicio = new Date(fecha_inicio);
    expect(fechaInicio.getTime()).toBeGreaterThan(Date.now());
  });
});

// ─── Test 4: sin medio_transporte → ya cubierto en offers.test.js ────────────
//
//  El test "rechaza trabajador sin medio_transporte configurado → 400" existe en
//  offers.test.js describe('POST /api/offers') y se verifica al correr npm test.
//  Se incluye aquí un test de documentación para trazabilidad.

// ─── Test 5: C1 (double-booking) + timezone ART ──────────────────────────────
//
//  Disponibilidad solo de 21:00 a 23:59: un trabajo agendado ahí arranca pasadas
//  las 21:00 ART, es decir en el día UTC SIGUIENTE (UTC-3). Con el bug viejo
//  (comparación de días con toISOString/UTC + reserva confirmada nunca creada),
//  el segundo trabajo se agendaba encima del primero.

describe('C1 + timezone: auto-agendamiento crea reserva confirmada y evita double-booking', () => {
  let tokenDueno;
  let tokenTrabajador;
  let jobId1, jobId2;
  let ofertaId1, ofertaId2;
  let fechaInicio1, fechaInicio2;

  // El agendamiento es fire-and-forget; esperar hasta 3s a que se persista fecha_inicio
  const esperarFechaInicio = async (jobId) => {
    for (let i = 0; i < 15; i++) {
      const res = await request(app)
        .get(`/api/jobs/${jobId}`)
        .set('Authorization', `Bearer ${tokenDueno}`);
      if (res.body.job?.fecha_inicio) return res.body.job.fecha_inicio;
      await new Promise(r => setTimeout(r, 200));
    }
    return null;
  };

  const crearTrabajoYOferta = async (titulo) => {
    const jobRes = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${tokenDueno}`)
      .field('titulo', titulo)
      .field('descripcion', 'Descripción de prueba para verificar el fix de double-booking C1');
    const ofertaRes = await request(app)
      .post('/api/offers')
      .set('Authorization', `Bearer ${tokenTrabajador}`)
      .send({ trabajo_id: jobRes.body.job.id, monto_propuesto: 4000, tiempo_estimado: 1 });
    return { jobId: jobRes.body.job.id, ofertaId: ofertaRes.body.oferta.id };
  };

  beforeAll(async () => {
    tokenDueno      = await registrarYLogin({ email: 'dueno4.sched@test.com',  tipo_perfil: 'dueno' });
    tokenTrabajador = await registrarYLogin({ email: 'worker4.sched@test.com', tipo_perfil: 'trabajador' });

    await configurarPerfil(tokenTrabajador);

    // Disponibilidad nocturna: solo entra UN trabajo de 1h por día en la franja
    const slots = [0, 1, 2, 3, 4, 5, 6].map(d => ({
      dia_semana: d,
      hora_inicio: '21:00',
      hora_fin: '23:59'
    }));
    const dispRes = await request(app)
      .put('/api/disponibilidad')
      .set('Authorization', `Bearer ${tokenTrabajador}`)
      .send({ slots });
    expect(dispRes.status).toBe(200);

    ({ jobId: jobId1, ofertaId: ofertaId1 } = await crearTrabajoYOferta('Trabajo nocturno 1 (test C1)'));
    ({ jobId: jobId2, ofertaId: ofertaId2 } = await crearTrabajoYOferta('Trabajo nocturno 2 (test C1)'));
  });

  test('al auto-agendar se crea la reserva confirmada con la franja real del trabajo', async () => {
    const res = await request(app)
      .patch(`/api/offers/${ofertaId1}/accept`)
      .set('Authorization', `Bearer ${tokenDueno}`);
    expect(res.status).toBe(200);

    fechaInicio1 = await esperarFechaInicio(jobId1);
    expect(fechaInicio1).not.toBeNull();

    // El horario asignado cae dentro de la franja nocturna (en hora argentina)
    const horaART = formatInTimeZone(new Date(fechaInicio1), TZ, 'HH:mm');
    expect(horaART >= '21:00').toBe(true);

    // Existe la reserva confirmada y su hora_inicio coincide con fecha_inicio en ART
    const { rows } = await pool.query(
      `SELECT * FROM reservas_tentativas WHERE oferta_id = $1 AND estado = 'confirmada'`,
      [ofertaId1]
    );
    expect(rows.length).toBe(1);
    expect(String(rows[0].hora_inicio).slice(0, 5)).toBe(horaART);
    // Bloquea la duración real (1h), no toda la ventana de disponibilidad
    expect(String(rows[0].hora_fin).slice(0, 5)).not.toBe('23:59');
  });

  test('un segundo trabajo del mismo trabajador NO se agenda encima del primero (día ART correcto)', async () => {
    const res = await request(app)
      .patch(`/api/offers/${ofertaId2}/accept`)
      .set('Authorization', `Bearer ${tokenDueno}`);
    expect(res.status).toBe(200);

    fechaInicio2 = await esperarFechaInicio(jobId2);
    expect(fechaInicio2).not.toBeNull();

    // Comparar calendario en ART: en la franja 21-24 solo cabe un trabajo por día,
    // así que el segundo debe caer en OTRO día argentino (con el bug viejo caía
    // el mismo día a la misma hora)
    const dia1 = formatInTimeZone(new Date(fechaInicio1), TZ, 'yyyy-MM-dd');
    const dia2 = formatInTimeZone(new Date(fechaInicio2), TZ, 'yyyy-MM-dd');
    expect(dia2).not.toBe(dia1);

    // Y también tiene su propia reserva confirmada
    const { rows } = await pool.query(
      `SELECT * FROM reservas_tentativas WHERE oferta_id = $1 AND estado = 'confirmada'`,
      [ofertaId2]
    );
    expect(rows.length).toBe(1);
  });
});

describe('POST /api/offers rechaza sin medio_transporte (cubre requisito 4)', () => {
  test('trabajador sin perfil/medio_transporte recibe 400 al intentar ofertar', async () => {
    const tokenSinPerfil = await registrarYLogin({
      email: 'sin-transporte.sched@test.com',
      tipo_perfil: 'trabajador'
    });

    // Crear un trabajo desde un dueño existente (reusar el de otro describe es arriesgado, crear uno nuevo)
    const tokenDueno = await registrarYLogin({ email: 'dueno3.sched@test.com', tipo_perfil: 'dueno' });
    const jobRes = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${tokenDueno}`)
      .field('titulo', 'Trabajo para test sin-transporte')
      .field('descripcion', 'Descripción para verificar rechazo por falta de medio de transporte');
    const jobId = jobRes.body.job.id;

    const res = await request(app)
      .post('/api/offers')
      .set('Authorization', `Bearer ${tokenSinPerfil}`)
      .send({ trabajo_id: jobId, monto_propuesto: 3500 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/medio de transporte/i);
  });
});
