/**
 * Test E2E del flujo completo de un trabajo:
 * 1. Registro dueño + trabajador
 * 2. Dueño publica trabajo
 * 3. Trabajador oferta
 * 4. Dueño acepta oferta → en_negociacion
 * 5. Trabajador confirma llegada (iniciar) → trabajador_llego
 * 6. Trabajador sube foto de resultado (completar) → pendiente_confirmacion
 * 7. Dueño confirma trabajo → completado
 * 8. Ambos se califican mutuamente
 */
const request = require('supertest');
const app = require('./app');
const { limpiarTablas, registrarYLogin, registrar, aprobarPagoTrabajo } = require('./helpers');

let pool;
let tokenDueno;
let tokenTrabajador;
let idDueno;
let idTrabajador;
let jobId;
let ofertaId;

beforeAll(async () => {
  pool = require('../config/db');
  await limpiarTablas();

  // Registrar dueño
  const regDueno = await registrar({ email: 'dueno.flujo@test.com', tipo_perfil: 'dueno' });
  idDueno = regDueno.body.usuario.id;
  tokenDueno = regDueno.body.token;

  // Registrar trabajador
  const regTrabajador = await registrar({ email: 'worker.flujo@test.com', tipo_perfil: 'trabajador' });
  idTrabajador = regTrabajador.body.usuario.id;
  tokenTrabajador = regTrabajador.body.token;

  // Configurar perfil del trabajador con medio_transporte (requerido para ofertar)
  await request(app)
    .post('/api/profile/complete')
    .set('Authorization', `Bearer ${tokenTrabajador}`)
    .send({ nombre: 'Test', medio_transporte: 'auto' });
});

afterAll(async () => {
  await pool.end();
});

// ─── Paso 1: Dueño publica trabajo ────────────────────────────────────────────

test('PASO 1 → dueño publica trabajo', async () => {
  const res = await request(app)
    .post('/api/jobs')
    .set('Authorization', `Bearer ${tokenDueno}`)
    .field('titulo', 'Reparación eléctrica completa')
    .field('descripcion', 'Hay varios enchufes que no funcionan y un cortocircuito en el tablero');

  expect(res.status).toBe(201);
  expect(res.body.job.estado).toBe('publicado');
  jobId = res.body.job.id;
});

// ─── Paso 2: Trabajador ve el trabajo en el feed ──────────────────────────────

test('PASO 2 → trabajador ve el trabajo en el feed', async () => {
  const res = await request(app)
    .get('/api/jobs')
    .set('Authorization', `Bearer ${tokenTrabajador}`);

  expect(res.status).toBe(200);
  const trabajo = res.body.jobs.find(j => j.id === jobId);
  expect(trabajo).toBeDefined();
  expect(trabajo.estado).toBe('publicado');
});

// ─── Paso 3: Trabajador oferta ────────────────────────────────────────────────

test('PASO 3 → trabajador oferta', async () => {
  const res = await request(app)
    .post('/api/offers')
    .set('Authorization', `Bearer ${tokenTrabajador}`)
    .send({
      trabajo_id: jobId,
      monto_propuesto: 8500,
      mensaje: 'Tengo experiencia en electricidad. Puedo ir mañana.',
      tiempo_estimado: 1,
      unidad_tiempo: 'dias'
    });

  expect(res.status).toBe(201);
  expect(res.body.oferta.estado).toBe('pendiente');
  ofertaId = res.body.oferta.id;
});

// ─── Paso 4: Dueño acepta oferta ──────────────────────────────────────────────

test('PASO 4 → dueño acepta la oferta', async () => {
  const res = await request(app)
    .patch(`/api/offers/${ofertaId}/accept`)
    .set('Authorization', `Bearer ${tokenDueno}`);

  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
});

test('PASO 4b → trabajo pasa a en_negociacion', async () => {
  const res = await request(app)
    .get(`/api/jobs/${jobId}`)
    .set('Authorization', `Bearer ${tokenDueno}`);

  expect(res.body.job.estado).toBe('en_negociacion');
});

test('PASO 4c → trabajo aparece en trabajos asignados del trabajador', async () => {
  const res = await request(app)
    .get('/api/jobs/asignados')
    .set('Authorization', `Bearer ${tokenTrabajador}`);

  expect(res.status).toBe(200);
  const asignado = res.body.jobs.find(j => j.id === jobId);
  expect(asignado).toBeDefined();
});

// ─── Paso 4d: Gate de pago — sin pago aprobado no se puede confirmar llegada ──

test('PASO 4d → confirmar llegada SIN pago aprobado devuelve 402', async () => {
  const res = await request(app)
    .patch(`/api/jobs/${jobId}/iniciar`)
    .set('Authorization', `Bearer ${tokenTrabajador}`)
    .send({ latitud: -34.6037, longitud: -58.3816 });

  expect(res.status).toBe(402);
});

test('PASO 4e → dueño paga (pago aprobado simulado, dinero retenido)', async () => {
  const { neto } = await aprobarPagoTrabajo({
    jobId, duenoId: idDueno, trabajadorId: idTrabajador, monto: 8500
  });
  expect(neto).toBe(8500 - 850); // comisión 10%

  // La distribución nace 'pendiente' — el dinero está retenido, no liberado
  const { rows } = await pool.query(
    `SELECT d.estado FROM distribuciones_pago d
     JOIN pagos p ON p.id = d.pago_id
     WHERE p.referencia_id = $1 AND p.tipo = 'trabajo'`,
    [jobId]
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].estado).toBe('pendiente');
});

// ─── Paso 5: Trabajador confirma llegada ──────────────────────────────────────

test('PASO 5 → trabajador confirma llegada (iniciar)', async () => {
  const res = await request(app)
    .patch(`/api/jobs/${jobId}/iniciar`)
    .set('Authorization', `Bearer ${tokenTrabajador}`)
    .send({ latitud: -34.6037, longitud: -58.3816 });

  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
});

test('PASO 5b → trabajo pasa a trabajador_llego', async () => {
  const res = await request(app)
    .get(`/api/jobs/${jobId}`)
    .set('Authorization', `Bearer ${tokenDueno}`);

  expect(res.body.job.estado).toBe('trabajador_llego');
});

// ─── Paso 6: Trabajador sube foto de resultado ───────────────────────────────

test('PASO 6 → trabajador completa el trabajo con foto', async () => {
  const imagenFake = Buffer.from('resultado-fake-image-data');

  const res = await request(app)
    .patch(`/api/jobs/${jobId}/completar`)
    .set('Authorization', `Bearer ${tokenTrabajador}`)
    .field('texto_resultado', 'Reparé todos los enchufes y resolví el cortocircuito del tablero')
    .attach('foto_resultado', imagenFake, { filename: 'resultado.jpg', contentType: 'image/jpeg' });

  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
});

test('PASO 6b → trabajo pasa a pendiente_confirmacion', async () => {
  const res = await request(app)
    .get(`/api/jobs/${jobId}`)
    .set('Authorization', `Bearer ${tokenDueno}`);

  expect(res.body.job.estado).toBe('pendiente_confirmacion');
});

// ─── Paso 7: Dueño confirma trabajo completado ───────────────────────────────

test('PASO 7 → dueño confirma que el trabajo está correcto', async () => {
  const res = await request(app)
    .patch(`/api/jobs/${jobId}/confirmar-completado`)
    .set('Authorization', `Bearer ${tokenDueno}`);

  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
});

test('PASO 7b → trabajo pasa a completado', async () => {
  const res = await request(app)
    .get(`/api/jobs/${jobId}`)
    .set('Authorization', `Bearer ${tokenDueno}`);

  expect(res.body.job.estado).toBe('completado');
});

test('PASO 7c → la confirmación libera el pago: distribución pasa a procesado', async () => {
  const { rows } = await pool.query(
    `SELECT d.estado, d.procesado_en FROM distribuciones_pago d
     JOIN pagos p ON p.id = d.pago_id
     WHERE p.referencia_id = $1 AND p.tipo = 'trabajo'`,
    [jobId]
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].estado).toBe('procesado');
  expect(rows[0].procesado_en).not.toBeNull();
});

test('PASO 7d → el saldo liberado aparece disponible para el trabajador', async () => {
  const res = await request(app)
    .get('/api/pagos/saldo')
    .set('Authorization', `Bearer ${tokenTrabajador}`);

  expect(res.status).toBe(200);
  expect(res.body.retenido).toBe(0);
  expect(res.body.liberado).toBe(7650);   // 8500 - 10% comisión
  expect(res.body.disponible).toBe(7650);
});

test('PASO 7e → retiro por más del saldo disponible → 400', async () => {
  const res = await request(app)
    .post('/api/pagos/retiros')
    .set('Authorization', `Bearer ${tokenTrabajador}`)
    .send({ monto: 99999, datos_cobro: 'mi.alias.mp' });

  expect(res.status).toBe(400);
  expect(res.body.success).toBe(false);
});

test('PASO 7f → solicitar retiro válido → 201 y el saldo disponible baja', async () => {
  const res = await request(app)
    .post('/api/pagos/retiros')
    .set('Authorization', `Bearer ${tokenTrabajador}`)
    .send({ monto: 5000, datos_cobro: 'mi.alias.mp' });

  expect(res.status).toBe(201);
  expect(res.body.retiro.estado).toBe('solicitado');

  const saldo = await request(app)
    .get('/api/pagos/saldo')
    .set('Authorization', `Bearer ${tokenTrabajador}`);
  expect(saldo.body.en_retiro).toBe(5000);
  expect(saldo.body.disponible).toBe(2650);
});

// ─── Paso 8: Calificación mutua ───────────────────────────────────────────────

test('PASO 8a → dueño califica al trabajador → 201', async () => {
  const res = await request(app)
    .post(`/api/calificaciones/trabajo/${jobId}`)
    .set('Authorization', `Bearer ${tokenDueno}`)
    .send({ puntaje: 5, comentario: 'Excelente trabajo, muy prolijo y puntual' });

  expect(res.status).toBe(201);
  expect(res.body.puntaje).toBe(5);
  expect(res.body.tipo).toBe('dueno_a_trabajador');
});

test('PASO 8b → trabajador califica al dueño → 201', async () => {
  const res = await request(app)
    .post(`/api/calificaciones/trabajo/${jobId}`)
    .set('Authorization', `Bearer ${tokenTrabajador}`)
    .send({ puntaje: 4, comentario: 'Buen trato, explicó bien lo que necesitaba' });

  expect(res.status).toBe(201);
  expect(res.body.puntaje).toBe(4);
  expect(res.body.tipo).toBe('trabajador_a_dueno');
});

test('PASO 8c → no permite calificar dos veces → 409', async () => {
  const res = await request(app)
    .post(`/api/calificaciones/trabajo/${jobId}`)
    .set('Authorization', `Bearer ${tokenDueno}`)
    .send({ puntaje: 3, comentario: 'Segunda calificación' });

  expect(res.status).toBe(409);
});

test('PASO 8d → puntaje inválido (fuera de rango) → 400', async () => {
  const res = await request(app)
    .post(`/api/calificaciones/trabajo/${jobId}`)
    .set('Authorization', `Bearer ${tokenDueno}`)
    .send({ puntaje: 10 });

  expect(res.status).toBe(400);
});
