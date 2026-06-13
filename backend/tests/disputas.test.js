// I13 — CRUD de disputas: creación (válida / inválida / duplicada), permisos
// (solo las partes del trabajo pueden abrir y ver) y evidencia.
// Nota: no existe endpoint de "mensajes de disputa" en el backend — la
// comunicación adjunta es la evidencia (POST /api/disputas/:id/evidencia).

const request = require('supertest');
const app = require('./app');
const { limpiarTablas, registrar } = require('./helpers');
const disputasSvc = require('../services/disputas.service');

let pool;
let tokenDueno, tokenTrabajador, tokenTercero;
let idDueno, idTrabajador;

// Trabajo del dueño con oferta aceptada del trabajador, llevado al estado pedido
const crearTrabajoDisputable = async (titulo, estado = 'pendiente_confirmacion') => {
  const resJob = await request(app)
    .post('/api/jobs')
    .set('Authorization', `Bearer ${tokenDueno}`)
    .field('titulo', titulo)
    .field('descripcion', 'Trabajo para tests del CRUD de disputas (I13)');
  const trabajoId = resJob.body.job.id;

  const resOferta = await request(app)
    .post('/api/offers')
    .set('Authorization', `Bearer ${tokenTrabajador}`)
    .send({ trabajo_id: trabajoId, monto_propuesto: 5000, mensaje: 'Oferta para disputa' });

  await request(app)
    .patch(`/api/offers/${resOferta.body.oferta.id}/accept`)
    .set('Authorization', `Bearer ${tokenDueno}`);

  await pool.query('UPDATE trabajos SET estado = $1 WHERE id = $2', [estado, trabajoId]);
  return trabajoId;
};

const abrirDisputa = (token, body) =>
  request(app)
    .post('/api/disputas')
    .set('Authorization', `Bearer ${token}`)
    .send(body);

beforeAll(async () => {
  pool = require('../config/db');
  await limpiarTablas();

  const regDueno = await registrar({ email: 'dueno.disputas@test.com', tipo_perfil: 'dueno' });
  idDueno = regDueno.body.usuario.id;
  tokenDueno = regDueno.body.token;

  const regTrabajador = await registrar({ email: 'worker.disputas@test.com', tipo_perfil: 'trabajador' });
  idTrabajador = regTrabajador.body.usuario.id;
  tokenTrabajador = regTrabajador.body.token;

  const regTercero = await registrar({ email: 'tercero.disputas@test.com', tipo_perfil: 'dueno' });
  tokenTercero = regTercero.body.token;

  // medio_transporte es requerido para ofertar
  await request(app)
    .post('/api/profile/complete')
    .set('Authorization', `Bearer ${tokenTrabajador}`)
    .send({ nombre: 'Worker Disputas', medio_transporte: 'auto' });
});

afterAll(async () => {
  await pool.end();
});

// ─── Crear disputa ────────────────────────────────────────────────────────────

describe('POST /api/disputas', () => {
  let trabajoId;

  beforeAll(async () => {
    trabajoId = await crearTrabajoDisputable('Disputa: caso base');
  });

  test('el dueño abre una disputa válida → 201 con estado abierta y acusado correcto', async () => {
    const res = await abrirDisputa(tokenDueno, {
      trabajo_id: trabajoId,
      motivo: 'trabajo_incompleto',
      descripcion: 'El trabajo quedó por la mitad'
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.disputa.estado).toBe('abierta');
    expect(res.body.disputa.iniciador_id).toBe(idDueno);
    expect(res.body.disputa.acusado_id).toBe(idTrabajador);
    expect(res.body.disputa.trabajo_id).toBe(trabajoId);
  });

  test('segunda disputa sobre el mismo trabajo con una activa → 409', async () => {
    const res = await abrirDisputa(tokenTrabajador, {
      trabajo_id: trabajoId,
      motivo: 'pago_retenido'
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/ya existe una disputa activa/i);
  });

  test('un tercero ajeno al trabajo no puede abrir disputa → 403', async () => {
    const otroTrabajo = await crearTrabajoDisputable('Disputa: permisos tercero');
    const res = await abrirDisputa(tokenTercero, {
      trabajo_id: otroTrabajo,
      motivo: 'no_soy_parte'
    });

    expect(res.status).toBe(403);
  });

  test('el trabajador también puede abrir disputa (acusado = dueño) → 201', async () => {
    const otroTrabajo = await crearTrabajoDisputable('Disputa: iniciada por trabajador');
    const res = await abrirDisputa(tokenTrabajador, {
      trabajo_id: otroTrabajo,
      motivo: 'pago_no_liberado'
    });

    expect(res.status).toBe(201);
    expect(res.body.disputa.iniciador_id).toBe(idTrabajador);
    expect(res.body.disputa.acusado_id).toBe(idDueno);
  });

  test('trabajo en estado no disputable (en_negociacion) → 400', async () => {
    const trabajoEnCurso = await crearTrabajoDisputable('Disputa: estado inválido', 'en_negociacion');
    const res = await abrirDisputa(tokenDueno, {
      trabajo_id: trabajoEnCurso,
      motivo: 'demasiado_pronto'
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/estado/i);
  });

  test('sin motivo → 400 (validación declarativa)', async () => {
    const res = await abrirDisputa(tokenDueno, { trabajo_id: trabajoId });

    expect(res.status).toBe(400);
    expect(res.body.errores).toEqual(
      expect.arrayContaining([expect.stringMatching(/motivo/i)])
    );
  });

  test('trabajo_id no numérico → 400 (validación declarativa)', async () => {
    const res = await abrirDisputa(tokenDueno, { trabajo_id: 'abc', motivo: 'x' });

    expect(res.status).toBe(400);
    expect(res.body.errores).toBeDefined();
  });

  test('sin autenticación → 401', async () => {
    const res = await request(app)
      .post('/api/disputas')
      .send({ trabajo_id: trabajoId, motivo: 'sin_token' });

    expect(res.status).toBe(401);
  });
});

// ─── Listar mis disputas (permisos de lectura) ───────────────────────────────

describe('GET /api/disputas/mis-disputas', () => {
  test('iniciador y acusado ven la disputa; un tercero no', async () => {
    const verDisputas = (token) =>
      request(app)
        .get('/api/disputas/mis-disputas')
        .set('Authorization', `Bearer ${token}`);

    const resDueno = await verDisputas(tokenDueno);
    expect(resDueno.status).toBe(200);
    expect(resDueno.body.disputas.length).toBeGreaterThanOrEqual(1);

    const resTrabajador = await verDisputas(tokenTrabajador);
    expect(resTrabajador.status).toBe(200);
    expect(resTrabajador.body.disputas.length).toBeGreaterThanOrEqual(1);

    // El tercero no es parte de ningún trabajo disputado
    const resTercero = await verDisputas(tokenTercero);
    expect(resTercero.status).toBe(200);
    expect(resTercero.body.disputas).toHaveLength(0);
  });
});

// ─── Evidencia ────────────────────────────────────────────────────────────────

describe('Evidencia de disputas', () => {
  let disputaId;

  beforeAll(async () => {
    const trabajoId = await crearTrabajoDisputable('Disputa: evidencia');
    const res = await abrirDisputa(tokenDueno, { trabajo_id: trabajoId, motivo: 'evidencia_test' });
    disputaId = res.body.disputa.id;
  });

  test('una parte de la disputa agrega evidencia (service) → URLs acumuladas', async () => {
    const urls = await disputasSvc.agregarEvidencia(disputaId, idTrabajador, ['/uploads/evidencia-1.jpg']);
    expect(urls).toEqual(expect.arrayContaining(['/uploads/evidencia-1.jpg']));

    const masUrls = await disputasSvc.agregarEvidencia(disputaId, idDueno, ['/uploads/evidencia-2.jpg']);
    expect(masUrls).toEqual(
      expect.arrayContaining(['/uploads/evidencia-1.jpg', '/uploads/evidencia-2.jpg'])
    );
  });

  test('un usuario ajeno a la disputa no puede agregar evidencia → 404', async () => {
    const { rows: [tercero] } = await pool.query(
      `SELECT id FROM usuarios WHERE email = 'tercero.disputas@test.com'`
    );
    await expect(
      disputasSvc.agregarEvidencia(disputaId, tercero.id, ['/uploads/intruso.jpg'])
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('disputa resuelta no admite más evidencia → 400', async () => {
    await pool.query(`UPDATE disputas SET estado = 'resuelta' WHERE id = $1`, [disputaId]);
    await expect(
      disputasSvc.agregarEvidencia(disputaId, idDueno, ['/uploads/tarde.jpg'])
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('id de disputa no numérico en el endpoint de evidencia → 400 (validación declarativa)', async () => {
    const res = await request(app)
      .post('/api/disputas/abc/evidencia')
      .set('Authorization', `Bearer ${tokenDueno}`);

    expect(res.status).toBe(400);
    expect(res.body.errores).toBeDefined();
  });
});
