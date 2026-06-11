const request = require('supertest');
const app = require('./app');
const { limpiarTablas, registrar, registrarYLogin, aprobarPagoTrabajo } = require('./helpers');

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

// ─── C3: cancelación con salvaguardas (reembolso / bloqueos por estado) ────────

describe('C3 — PATCH /api/jobs/:id/cancel con pago y estados avanzados', () => {
  let tokenDuenoC3, tokenTrabajadorC3, idDuenoC3, idTrabajadorC3;

  // Crea un trabajo del dueño C3 con oferta aceptada del trabajador C3 → en_negociacion
  const crearTrabajoConOfertaAceptada = async (titulo) => {
    const resJob = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${tokenDuenoC3}`)
      .field('titulo', titulo)
      .field('descripcion', 'Trabajo para tests de cancelación con salvaguardas');
    const trabajoId = resJob.body.job.id;

    const resOferta = await request(app)
      .post('/api/offers')
      .set('Authorization', `Bearer ${tokenTrabajadorC3}`)
      .send({ trabajo_id: trabajoId, monto_propuesto: 6000, mensaje: 'Puedo hacerlo', tiempo_estimado: 1, unidad_tiempo: 'dias' });

    await request(app)
      .patch(`/api/offers/${resOferta.body.oferta.id}/accept`)
      .set('Authorization', `Bearer ${tokenDuenoC3}`);

    return trabajoId;
  };

  // Lleva un trabajo en_negociacion con pago aprobado hasta trabajador_llego
  const iniciarTrabajoC3 = async (trabajoId) => {
    const res = await request(app)
      .patch(`/api/jobs/${trabajoId}/iniciar`)
      .set('Authorization', `Bearer ${tokenTrabajadorC3}`)
      .send({ latitud: -34.6037, longitud: -58.3816 });
    expect(res.status).toBe(200);
  };

  const getEstadoTrabajo = async (trabajoId) => {
    const { rows } = await pool.query('SELECT estado FROM trabajos WHERE id = $1', [trabajoId]);
    return rows[0].estado;
  };

  beforeAll(async () => {
    const regDueno = await registrar({ email: 'dueno.c3@test.com', tipo_perfil: 'dueno' });
    idDuenoC3 = regDueno.body.usuario.id;
    tokenDuenoC3 = regDueno.body.token;

    const regTrabajador = await registrar({ email: 'worker.c3@test.com', tipo_perfil: 'trabajador' });
    idTrabajadorC3 = regTrabajador.body.usuario.id;
    tokenTrabajadorC3 = regTrabajador.body.token;

    // medio_transporte es requerido para ofertar
    await request(app)
      .post('/api/profile/complete')
      .set('Authorization', `Bearer ${tokenTrabajadorC3}`)
      .send({ nombre: 'Worker C3', medio_transporte: 'auto' });
  });

  test('cancelación libre: en_negociacion SIN pago aprobado → 200 y notifica al trabajador', async () => {
    const trabajoId = await crearTrabajoConOfertaAceptada('C3 cancelación libre');

    const res = await request(app)
      .patch(`/api/jobs/${trabajoId}/cancel`)
      .set('Authorization', `Bearer ${tokenDuenoC3}`);

    expect(res.status).toBe(200);
    expect(await getEstadoTrabajo(trabajoId)).toBe('cancelado');

    const { rows: notifs } = await pool.query(
      `SELECT mensaje FROM notificaciones WHERE usuario_id = $1 AND tipo = 'trabajo_cancelado' AND referencia_id = $2`,
      [idTrabajadorC3, trabajoId]
    );
    expect(notifs).toHaveLength(1);
    expect(notifs[0].mensaje).not.toContain('reembolsado');
  });

  test('cancelación con reembolso: pago aprobado, no iniciado → 200, pago reembolsado y distribución anulada', async () => {
    const trabajoId = await crearTrabajoConOfertaAceptada('C3 cancelación con reembolso');
    await aprobarPagoTrabajo({ jobId: trabajoId, duenoId: idDuenoC3, trabajadorId: idTrabajadorC3, monto: 6000 });

    const res = await request(app)
      .patch(`/api/jobs/${trabajoId}/cancel`)
      .set('Authorization', `Bearer ${tokenDuenoC3}`);

    expect(res.status).toBe(200);
    expect(await getEstadoTrabajo(trabajoId)).toBe('cancelado');

    // El pago quedó registrado como reembolsado
    const { rows: pagos } = await pool.query(
      `SELECT estado FROM pagos WHERE referencia_id = $1 AND tipo = 'trabajo'`,
      [trabajoId]
    );
    expect(pagos).toHaveLength(1);
    expect(pagos[0].estado).toBe('reembolsado');

    // La distribución retenida volvió a null (ya no cuenta como retenido ni liberado)
    const { rows: dists } = await pool.query(
      `SELECT d.estado FROM distribuciones_pago d
       JOIN pagos p ON p.id = d.pago_id
       WHERE p.referencia_id = $1 AND p.tipo = 'trabajo'`,
      [trabajoId]
    );
    expect(dists).toHaveLength(1);
    expect(dists[0].estado).toBeNull();

    // El saldo del trabajador no retiene nada de este trabajo
    const saldo = await request(app)
      .get('/api/pagos/saldo')
      .set('Authorization', `Bearer ${tokenTrabajadorC3}`);
    expect(saldo.body.retenido).toBe(0);

    // El trabajador fue notificado con mención del reembolso
    const { rows: notifs } = await pool.query(
      `SELECT mensaje FROM notificaciones WHERE usuario_id = $1 AND tipo = 'trabajo_cancelado' AND referencia_id = $2`,
      [idTrabajadorC3, trabajoId]
    );
    expect(notifs).toHaveLength(1);
    expect(notifs[0].mensaje).toContain('reembolsado');
  });

  test('bloqueo en progreso: dueño NO puede cancelar un trabajo iniciado → 403 y el pago sigue retenido', async () => {
    const trabajoId = await crearTrabajoConOfertaAceptada('C3 bloqueado en progreso');
    await aprobarPagoTrabajo({ jobId: trabajoId, duenoId: idDuenoC3, trabajadorId: idTrabajadorC3, monto: 6000 });
    await iniciarTrabajoC3(trabajoId);

    const res = await request(app)
      .patch(`/api/jobs/${trabajoId}/cancel`)
      .set('Authorization', `Bearer ${tokenDuenoC3}`);

    expect(res.status).toBe(403);
    expect(await getEstadoTrabajo(trabajoId)).toBe('trabajador_llego');

    const { rows: pagos } = await pool.query(
      `SELECT estado FROM pagos WHERE referencia_id = $1 AND tipo = 'trabajo'`,
      [trabajoId]
    );
    expect(pagos[0].estado).toBe('aprobado');
  });

  test('en progreso el trabajador SÍ puede cancelar → 200 sin reembolso automático (queda para disputa)', async () => {
    const trabajoId = await crearTrabajoConOfertaAceptada('C3 trabajador cancela en progreso');
    await aprobarPagoTrabajo({ jobId: trabajoId, duenoId: idDuenoC3, trabajadorId: idTrabajadorC3, monto: 6000 });
    await iniciarTrabajoC3(trabajoId);

    const res = await request(app)
      .patch(`/api/jobs/${trabajoId}/cancel`)
      .set('Authorization', `Bearer ${tokenTrabajadorC3}`);

    expect(res.status).toBe(200);
    expect(await getEstadoTrabajo(trabajoId)).toBe('cancelado');

    // Sin reembolso automático: el pago sigue aprobado y la distribución retenida
    const { rows } = await pool.query(
      `SELECT p.estado AS pago_estado, d.estado AS dist_estado
       FROM pagos p JOIN distribuciones_pago d ON d.pago_id = p.id
       WHERE p.referencia_id = $1 AND p.tipo = 'trabajo'`,
      [trabajoId]
    );
    expect(rows[0].pago_estado).toBe('aprobado');
    expect(rows[0].dist_estado).toBe('pendiente');

    // El dueño fue notificado de la cancelación
    const { rows: notifs } = await pool.query(
      `SELECT id FROM notificaciones WHERE usuario_id = $1 AND tipo = 'trabajo_cancelado' AND referencia_id = $2`,
      [idDuenoC3, trabajoId]
    );
    expect(notifs).toHaveLength(1);
  });

  test('bloqueo completado: ni dueño ni trabajador pueden cancelar → 403', async () => {
    const trabajoId = await crearTrabajoConOfertaAceptada('C3 bloqueado completado');
    await aprobarPagoTrabajo({ jobId: trabajoId, duenoId: idDuenoC3, trabajadorId: idTrabajadorC3, monto: 6000 });
    await iniciarTrabajoC3(trabajoId);

    // trabajador sube resultado → pendiente_confirmacion → dueño confirma → completado
    const resCompletar = await request(app)
      .patch(`/api/jobs/${trabajoId}/completar`)
      .set('Authorization', `Bearer ${tokenTrabajadorC3}`)
      .field('texto_resultado', 'Trabajo terminado correctamente')
      .attach('foto_resultado', Buffer.from('fake-result'), { filename: 'resultado.jpg', contentType: 'image/jpeg' });
    expect(resCompletar.status).toBe(200);

    const resConfirmar = await request(app)
      .patch(`/api/jobs/${trabajoId}/confirmar-completado`)
      .set('Authorization', `Bearer ${tokenDuenoC3}`);
    expect(resConfirmar.status).toBe(200);
    expect(await getEstadoTrabajo(trabajoId)).toBe('completado');

    const resDueno = await request(app)
      .patch(`/api/jobs/${trabajoId}/cancel`)
      .set('Authorization', `Bearer ${tokenDuenoC3}`);
    expect(resDueno.status).toBe(403);

    const resTrabajador = await request(app)
      .patch(`/api/jobs/${trabajoId}/cancel`)
      .set('Authorization', `Bearer ${tokenTrabajadorC3}`);
    expect(resTrabajador.status).toBe(403);

    expect(await getEstadoTrabajo(trabajoId)).toBe('completado');
  });
});

// ─── I7: una disputa activa congela la liberación del pago ────────────────────

describe('I7 — disputa activa congela el pago hasta la resolución del admin', () => {
  let tokenDuenoI7, tokenTrabajadorI7, tokenAdminI7, idDuenoI7, idTrabajadorI7;

  // Lleva un trabajo hasta pendiente_confirmacion con pago aprobado y retenido
  const crearTrabajoEnPendienteConfirmacion = async (titulo) => {
    const resJob = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${tokenDuenoI7}`)
      .field('titulo', titulo)
      .field('descripcion', 'Trabajo para tests de disputas I7');
    const trabajoId = resJob.body.job.id;

    const resOferta = await request(app)
      .post('/api/offers')
      .set('Authorization', `Bearer ${tokenTrabajadorI7}`)
      .send({ trabajo_id: trabajoId, monto_propuesto: 8000, mensaje: 'Puedo hacerlo', tiempo_estimado: 1, unidad_tiempo: 'dias' });

    await request(app)
      .patch(`/api/offers/${resOferta.body.oferta.id}/accept`)
      .set('Authorization', `Bearer ${tokenDuenoI7}`);

    await aprobarPagoTrabajo({ jobId: trabajoId, duenoId: idDuenoI7, trabajadorId: idTrabajadorI7, monto: 8000 });

    const resIniciar = await request(app)
      .patch(`/api/jobs/${trabajoId}/iniciar`)
      .set('Authorization', `Bearer ${tokenTrabajadorI7}`)
      .send({ latitud: -34.6037, longitud: -58.3816 });
    expect(resIniciar.status).toBe(200);

    const resCompletar = await request(app)
      .patch(`/api/jobs/${trabajoId}/completar`)
      .set('Authorization', `Bearer ${tokenTrabajadorI7}`)
      .field('texto_resultado', 'Trabajo terminado')
      .attach('foto_resultado', Buffer.from('fake-result'), { filename: 'resultado.jpg', contentType: 'image/jpeg' });
    expect(resCompletar.status).toBe(200);

    return trabajoId;
  };

  const abrirDisputa = async (trabajoId) => {
    const res = await request(app)
      .post('/api/disputas')
      .set('Authorization', `Bearer ${tokenDuenoI7}`)
      .send({ trabajo_id: trabajoId, motivo: 'trabajo_incompleto', descripcion: 'El trabajo quedó a la mitad' });
    expect(res.status).toBe(201);
    return res.body.disputa.id;
  };

  const getPagoYDistribucion = async (trabajoId) => {
    const { rows } = await pool.query(
      `SELECT p.estado AS pago_estado, d.estado AS dist_estado
       FROM pagos p JOIN distribuciones_pago d ON d.pago_id = p.id
       WHERE p.referencia_id = $1 AND p.tipo = 'trabajo'`,
      [trabajoId]
    );
    return rows[0];
  };

  beforeAll(async () => {
    const regDueno = await registrar({ email: 'dueno.i7@test.com', tipo_perfil: 'dueno' });
    idDuenoI7 = regDueno.body.usuario.id;
    tokenDuenoI7 = regDueno.body.token;

    const regTrabajador = await registrar({ email: 'worker.i7@test.com', tipo_perfil: 'trabajador' });
    idTrabajadorI7 = regTrabajador.body.usuario.id;
    tokenTrabajadorI7 = regTrabajador.body.token;

    await request(app)
      .post('/api/profile/complete')
      .set('Authorization', `Bearer ${tokenTrabajadorI7}`)
      .send({ nombre: 'Worker I7', medio_transporte: 'auto' });

    const regAdmin = await registrar({ email: 'admin.i7@test.com', tipo_perfil: 'dueno' });
    tokenAdminI7 = regAdmin.body.token;
    await pool.query('UPDATE usuarios SET es_admin = TRUE WHERE id = $1', [regAdmin.body.usuario.id]);
  });

  test('confirmar-completado con disputa activa → 403 y el dinero sigue retenido', async () => {
    const trabajoId = await crearTrabajoEnPendienteConfirmacion('I7 confirmación bloqueada por disputa');
    await abrirDisputa(trabajoId);

    const res = await request(app)
      .patch(`/api/jobs/${trabajoId}/confirmar-completado`)
      .set('Authorization', `Bearer ${tokenDuenoI7}`);

    expect(res.status).toBe(403);
    expect(res.body.error || res.body.message).toMatch(/disputa activa/i);

    // El trabajo no avanzó y la distribución sigue retenida
    const { rows: [t] } = await pool.query('SELECT estado FROM trabajos WHERE id = $1', [trabajoId]);
    expect(t.estado).toBe('pendiente_confirmacion');
    const dinero = await getPagoYDistribucion(trabajoId);
    expect(dinero.pago_estado).toBe('aprobado');
    expect(dinero.dist_estado).toBe('pendiente');
  });

  test('resolver sin resultado → 400 (el efecto económico es obligatorio)', async () => {
    const trabajoId = await crearTrabajoEnPendienteConfirmacion('I7 resolución sin resultado');
    const disputaId = await abrirDisputa(trabajoId);

    const res = await request(app)
      .patch(`/api/admin/disputas/${disputaId}/resolver`)
      .set('Authorization', `Bearer ${tokenAdminI7}`)
      .send({ resolucion: 'Resolución sin definir quién tiene razón' });

    expect(res.status).toBe(400);
  });

  test('resolución a favor del dueño → pago reembolsado y distribución anulada', async () => {
    const trabajoId = await crearTrabajoEnPendienteConfirmacion('I7 resolución a favor del dueño');
    const disputaId = await abrirDisputa(trabajoId);

    const saldoAntes = (await request(app)
      .get('/api/pagos/saldo')
      .set('Authorization', `Bearer ${tokenTrabajadorI7}`)).body;

    const res = await request(app)
      .patch(`/api/admin/disputas/${disputaId}/resolver`)
      .set('Authorization', `Bearer ${tokenAdminI7}`)
      .send({ resolucion: 'El trabajo quedó incompleto, corresponde reembolso', resultado: 'dueno' });

    expect(res.status).toBe(200);
    expect(res.body.disputa.estado).toBe('resuelta');
    expect(res.body.disputa.resultado).toBe('dueno');

    const dinero = await getPagoYDistribucion(trabajoId);
    expect(dinero.pago_estado).toBe('reembolsado');
    expect(dinero.dist_estado).toBeNull();

    // El saldo del trabajador deja de retener el neto de este trabajo (8000 - 10% comisión)
    // y no se le acredita nada como liberado
    const saldoDespues = (await request(app)
      .get('/api/pagos/saldo')
      .set('Authorization', `Bearer ${tokenTrabajadorI7}`)).body;
    expect(saldoDespues.retenido).toBe(saldoAntes.retenido - 7200);
    expect(saldoDespues.liberado).toBe(saldoAntes.liberado);
  });

  test('resolución a favor del trabajador → distribución liberada a procesado', async () => {
    const trabajoId = await crearTrabajoEnPendienteConfirmacion('I7 resolución a favor del trabajador');
    const disputaId = await abrirDisputa(trabajoId);

    const res = await request(app)
      .patch(`/api/admin/disputas/${disputaId}/resolver`)
      .set('Authorization', `Bearer ${tokenAdminI7}`)
      .send({ resolucion: 'El trabajo está bien hecho, se libera el pago', resultado: 'trabajador' });

    expect(res.status).toBe(200);
    expect(res.body.disputa.resultado).toBe('trabajador');

    const dinero = await getPagoYDistribucion(trabajoId);
    expect(dinero.pago_estado).toBe('aprobado');
    expect(dinero.dist_estado).toBe('procesado');

    // Con la disputa resuelta, el dueño ya puede confirmar (idempotente sobre el dinero)
    const resConfirmar = await request(app)
      .patch(`/api/jobs/${trabajoId}/confirmar-completado`)
      .set('Authorization', `Bearer ${tokenDuenoI7}`);
    expect(resConfirmar.status).toBe(200);
    expect((await getPagoYDistribucion(trabajoId)).dist_estado).toBe('procesado');
  });
});
