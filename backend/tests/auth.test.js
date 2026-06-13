const request = require('supertest');
const app = require('./app');
const { limpiarTablas } = require('./helpers');

let pool;

beforeAll(async () => {
  pool = require('../config/db');
  await limpiarTablas();
});

afterAll(async () => {
  await pool.end();
});

// ─── Registro ─────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  test('registra dueño correctamente → 201', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dueno@test.com', password: 'Password123!', tipo_perfil: 'dueno', fecha_nacimiento: '1990-01-01' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.usuario.email).toBe('dueno@test.com');
    expect(res.body.usuario.tipo_perfil).toBe('dueno');
    expect(res.body.dev_verification_link).toBeDefined();
  });

  test('registra trabajador correctamente → 201', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'trabajador@test.com', password: 'Password123!', tipo_perfil: 'trabajador', fecha_nacimiento: '1985-06-15' });

    expect(res.status).toBe(201);
    expect(res.body.usuario.tipo_perfil).toBe('trabajador');
  });

  test('rechaza email duplicado → 409', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dueno@test.com', password: 'Password123!', tipo_perfil: 'dueno', fecha_nacimiento: '1990-01-01' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBeDefined();
  });

  test('rechaza menor de 18 años → 403', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'joven@test.com', password: 'Password123!', tipo_perfil: 'dueno', fecha_nacimiento: '2015-01-01' });

    expect(res.status).toBe(403);
  });

  test('rechaza tipo_perfil inválido → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'admin@test.com', password: 'Password123!', tipo_perfil: 'admin', fecha_nacimiento: '1990-01-01' });

    expect(res.status).toBe(400);
  });

  test('rechaza password menor a 8 caracteres → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'corto@test.com', password: '123', tipo_perfil: 'dueno', fecha_nacimiento: '1990-01-01' });

    expect(res.status).toBe(400);
  });

  test('rechaza sin fecha_nacimiento → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'sinfecha@test.com', password: 'Password123!', tipo_perfil: 'dueno' });

    expect(res.status).toBe(400);
  });
});

// ─── Login ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  test('login exitoso devuelve token → 200', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dueno@test.com', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.usuario.email).toBe('dueno@test.com');
  });

  test('rechaza password incorrecta → 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dueno@test.com', password: 'WrongPass!' });

    expect(res.status).toBe(401);
  });

  test('rechaza email inexistente → 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'noexiste@test.com', password: 'Password123!' });

    expect(res.status).toBe(401);
  });

  test('rechaza sin body → 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(res.status).toBe(400);
  });
});

// ─── Verificar sesión ─────────────────────────────────────────────────────────

describe('GET /api/auth/verify', () => {
  let token;
  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'dueno@test.com', password: 'Password123!' });
    token = res.body.token;
  });

  test('token válido devuelve usuario → 200', async () => {
    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.valido).toBe(true);
    expect(res.body.usuario.email).toBe('dueno@test.com');
  });

  test('token inválido → 401', async () => {
    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', 'Bearer token_invalido');

    expect(res.status).toBe(401);
  });

  test('sin token → 401', async () => {
    const res = await request(app).get('/api/auth/verify');
    expect(res.status).toBe(401);
  });
});

// ─── Cambio de contraseña ─────────────────────────────────────────────────────

describe('POST /api/auth/change-password', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'trabajador@test.com', password: 'Password123!' });
    token = res.body.token;
  });

  test('cambia contraseña correctamente → 200', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ password_actual: 'Password123!', password_nueva: 'NuevaPass456!' });

    expect(res.status).toBe(200);
    expect(res.body.mensaje).toBeDefined();
  });

  test('rechaza contraseña actual incorrecta → 400', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ password_actual: 'Password123!', password_nueva: 'OtraPass789!' });

    expect(res.status).toBe(400);
  });

  test('rechaza sin autenticación → 401', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ password_actual: 'Password123!', password_nueva: 'OtraPass789!' });

    expect(res.status).toBe(401);
  });
});

// ─── Recuperación de contraseña ───────────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  test('devuelve 200 para email registrado (no revela existencia)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'dueno@test.com' });

    expect(res.status).toBe(200);
    expect(res.body.mensaje).toBeDefined();
    expect(res.body.dev_reset_link).toBeDefined();
  });

  test('devuelve 200 para email inexistente (no revela existencia)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'inexistente@test.com' });

    expect(res.status).toBe(200);
  });

  test('devuelve 400 sin email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({});

    expect(res.status).toBe(400);
  });
});

// ─── Reset de contraseña ──────────────────────────────────────────────────────

describe('POST /api/auth/reset-password', () => {
  test('resetea contraseña con token válido → 200', async () => {
    // Obtener el token de reset via forgot-password
    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'dueno@test.com' });

    const link = forgotRes.body.dev_reset_link;
    const token = new URL('http://x' + link).searchParams.get('token');

    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, nueva_password: 'ResetPass123!' });

    expect(resetRes.status).toBe(200);
  });

  test('rechaza token inválido → 400', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'token_falso_123', nueva_password: 'Password123!' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/inválido|expiró/i);
  });
});

// ─── Verificación de email ────────────────────────────────────────────────────

describe('GET /api/auth/verify-email', () => {
  test('redirige a feed con email_verificado=1 con token válido', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'verificar@test.com', password: 'Password123!', tipo_perfil: 'dueno', fecha_nacimiento: '1990-01-01' });

    const link = regRes.body.dev_verification_link;
    const token = new URL('http://x' + link).searchParams.get('token');

    const verRes = await request(app)
      .get(`/api/auth/verify-email?token=${token}`)
      .redirects(0);

    expect(verRes.status).toBe(302);
    expect(verRes.headers.location).toContain('email_verificado=1');
  });

  test('redirige a error con token inválido', async () => {
    const verRes = await request(app)
      .get('/api/auth/verify-email?token=token_invalido_xyz')
      .redirects(0);

    expect(verRes.status).toBe(302);
    expect(verRes.headers.location).toContain('verif_error=1');
  });
});
