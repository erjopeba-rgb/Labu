const request = require('supertest');
const app = require('./app');
const { limpiarTablas, registrarYLogin } = require('./helpers');

let pool;
let tokenAdmin;
let tokenComun;
let usuarioComunId;
let reporteId;
let jobId1;
let jobId2;

beforeAll(async () => {
  pool = require('../config/db');
  await limpiarTablas();

  // Registrar usuarios y obtener tokens
  tokenComun = await registrarYLogin({ email: 'comun.admin@test.com', tipo_perfil: 'dueno', fecha_nacimiento: '1990-01-01' });
  tokenAdmin = await registrarYLogin({ email: 'admin@test.com', tipo_perfil: 'dueno', fecha_nacimiento: '1985-05-10' });

  // Obtener IDs reales desde la DB
  const { rows: [comun] } = await pool.query('SELECT id FROM usuarios WHERE email = $1', ['comun.admin@test.com']);
  usuarioComunId = comun.id;
  const { rows: [adminUser] } = await pool.query('SELECT id FROM usuarios WHERE email = $1', ['admin@test.com']);

  // Promover a admin directamente en DB
  await pool.query('UPDATE usuarios SET es_admin = TRUE WHERE id = $1', [adminUser.id]);

  // Crear dos trabajos reales para usar como referencia_id en los reportes
  const j1 = await request(app)
    .post('/api/jobs')
    .set('Authorization', `Bearer ${tokenComun}`)
    .field('titulo', 'Trabajo test admin 1')
    .field('descripcion', 'Descripción para test de admin 1');
  jobId1 = j1.body.job?.id;

  const j2 = await request(app)
    .post('/api/jobs')
    .set('Authorization', `Bearer ${tokenComun}`)
    .field('titulo', 'Trabajo test admin 2')
    .field('descripcion', 'Descripción para test de admin 2');
  jobId2 = j2.body.job?.id;

  // Crear un reporte de prueba con ID real
  const resReporte = await pool.query(
    `INSERT INTO reportes (tipo, referencia_id, reportado_por, motivo)
     VALUES ('publicacion', $1, $2, 'spam') RETURNING id`,
    [jobId1, usuarioComunId]
  );
  reporteId = resReporte.rows[0].id;
});

afterAll(async () => {
  await pool.end();
});

// ─── Acceso sin permisos ──────────────────────────────────────────────────────

describe('Admin — control de acceso', () => {
  test('sin token → 401', async () => {
    const res = await request(app).get('/api/admin/usuarios');
    expect(res.status).toBe(401);
  });

  test('usuario común → 403', async () => {
    const res = await request(app)
      .get('/api/admin/usuarios')
      .set('Authorization', `Bearer ${tokenComun}`);
    expect(res.status).toBe(403);
  });
});

// ─── GET /api/admin/usuarios ──────────────────────────────────────────────────

describe('GET /api/admin/usuarios', () => {
  test('admin obtiene lista de usuarios → 200', async () => {
    const res = await request(app)
      .get('/api/admin/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.usuarios)).toBe(true);
    expect(res.body.usuarios.length).toBeGreaterThanOrEqual(2);
    expect(res.body.usuarios[0]).toHaveProperty('email');
    expect(res.body.usuarios[0]).toHaveProperty('activo');
  });
});

// ─── PATCH /api/admin/usuarios/:id/suspender ─────────────────────────────────

describe('PATCH /api/admin/usuarios/:id/suspender', () => {
  test('admin suspende usuario → 200 con activo: false', async () => {
    const res = await request(app)
      .patch(`/api/admin/usuarios/${usuarioComunId}/suspender`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ suspendido: true });
    expect(res.status).toBe(200);
    expect(res.body.usuario.activo).toBe(false);
  });

  test('admin activa usuario suspendido → 200 con activo: true', async () => {
    const res = await request(app)
      .patch(`/api/admin/usuarios/${usuarioComunId}/suspender`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ suspendido: false });
    expect(res.status).toBe(200);
    expect(res.body.usuario.activo).toBe(true);
  });

  test('id inválido → 400', async () => {
    const res = await request(app)
      .patch('/api/admin/usuarios/abc/suspender')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ suspendido: true });
    expect(res.status).toBe(400);
  });

  test('usuario inexistente → 404', async () => {
    const res = await request(app)
      .patch('/api/admin/usuarios/99999/suspender')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ suspendido: true });
    expect(res.status).toBe(404);
  });
});

// ─── GET /api/admin/reportes ──────────────────────────────────────────────────

describe('GET /api/admin/reportes', () => {
  test('admin obtiene lista de reportes → 200', async () => {
    const res = await request(app)
      .get('/api/admin/reportes')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.reportes)).toBe(true);
    expect(res.body.reportes.length).toBeGreaterThanOrEqual(1);
    expect(res.body.reportes[0]).toHaveProperty('motivo');
    expect(res.body.reportes[0]).toHaveProperty('estado');
  });
});

// ─── PATCH /api/admin/reportes/:id/resolver ───────────────────────────────────

describe('PATCH /api/admin/reportes/:id/resolver', () => {
  test('accion inválida → 400', async () => {
    const res = await request(app)
      .patch(`/api/admin/reportes/${reporteId}/resolver`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ accion: 'ignorar' });
    expect(res.status).toBe(400);
  });

  test('resolver reporte → 200 con resolucion: resuelto', async () => {
    const res = await request(app)
      .patch(`/api/admin/reportes/${reporteId}/resolver`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ accion: 'resolver' });
    expect(res.status).toBe(200);
    expect(res.body.reporte.estado).toBe('revisado');
    expect(res.body.reporte.resolucion).toBe('resuelto');
  });

  // Crear otro reporte para probar desestimar
  test('desestimar reporte → 200 con resolucion: desestimado', async () => {
    const ins = await pool.query(
      `INSERT INTO reportes (tipo, referencia_id, reportado_por, motivo)
       VALUES ('publicacion', $1, $2, 'otro') RETURNING id`,
      [jobId2, usuarioComunId]
    );
    const nuevoId = ins.rows[0].id;

    const res = await request(app)
      .patch(`/api/admin/reportes/${nuevoId}/resolver`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ accion: 'desestimar' });
    expect(res.status).toBe(200);
    expect(res.body.reporte.resolucion).toBe('desestimado');
  });

  test('reporte inexistente → 404', async () => {
    const res = await request(app)
      .patch('/api/admin/reportes/99999/resolver')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ accion: 'resolver' });
    expect(res.status).toBe(404);
  });
});

// ─── GET /api/admin/config ────────────────────────────────────────────────────

describe('GET /api/admin/config', () => {
  test('admin obtiene configuración → 200', async () => {
    const res = await request(app)
      .get('/api/admin/config')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.config)).toBe(true);
  });
});

// ─── PUT /api/admin/config ────────────────────────────────────────────────────

describe('PUT /api/admin/config', () => {
  test('sin updates → 400', async () => {
    const res = await request(app)
      .put('/api/admin/config')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ updates: [] });
    expect(res.status).toBe(400);
  });

  test('actualiza comision_porcentaje → 200', async () => {
    const res = await request(app)
      .put('/api/admin/config')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ updates: [{ clave: 'comision_porcentaje', valor: '12' }] });
    expect(res.status).toBe(200);
    expect(res.body.config[0].clave).toBe('comision_porcentaje');
    expect(res.body.config[0].valor).toBe('12');
  });
});
