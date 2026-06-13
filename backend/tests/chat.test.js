const request = require('supertest');
const app = require('./app');
const { limpiarTablas, registrar } = require('./helpers');

let pool;
let tokenUser1, tokenUser2, tokenUser3;
let idUser1, idUser2;
let convId;

beforeAll(async () => {
  pool = require('../config/db');
  await limpiarTablas();

  const reg1 = await registrar({ email: 'chat.user1@test.com', tipo_perfil: 'dueno' });
  idUser1 = reg1.body.usuario.id;
  tokenUser1 = reg1.body.token;

  const reg2 = await registrar({ email: 'chat.user2@test.com', tipo_perfil: 'dueno' });
  idUser2 = reg2.body.usuario.id;
  tokenUser2 = reg2.body.token;

  const reg3 = await registrar({ email: 'chat.user3@test.com', tipo_perfil: 'dueno' });
  tokenUser3 = reg3.body.token;
});

afterAll(async () => {
  await pool.end();
});

// ─── Iniciar conversación ─────────────────────────────────────────────────────

describe('POST /api/chat — iniciar conversación', () => {
  test('inicia conversación directa entre dos usuarios → 201', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${tokenUser1}`)
      .send({ tipo: 'directo', participantes: [idUser2] });

    expect(res.status).toBe(201);
    expect(res.body.conversacion_id).toBeDefined();
    convId = res.body.conversacion_id;
  });

  test('reusar la misma conversación directa devuelve el mismo id → 201', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${tokenUser1}`)
      .send({ tipo: 'directo', participantes: [idUser2] });

    expect(res.status).toBe(201);
    expect(res.body.conversacion_id).toBe(convId);
  });

  test('rechaza sin autenticación → 401', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ tipo: 'directo', participantes: [idUser2] });

    expect(res.status).toBe(401);
  });

  test('rechaza si falta tipo → 400', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${tokenUser1}`)
      .send({ participantes: [idUser2] });

    expect(res.status).toBe(400);
  });
});

// ─── Enviar mensaje ───────────────────────────────────────────────────────────

describe('POST /api/chat/:id/mensajes — enviar mensaje', () => {
  test('envía mensaje a conversación propia → 201', async () => {
    const res = await request(app)
      .post(`/api/chat/${convId}/mensajes`)
      .set('Authorization', `Bearer ${tokenUser1}`)
      .send({ contenido: 'Hola, ¿cómo estás?' });

    expect(res.status).toBe(201);
    expect(res.body.contenido).toBe('Hola, ¿cómo estás?');
    expect(res.body.remitente_id).toBe(idUser1);
  });

  test('el otro participante también puede enviar mensaje → 201', async () => {
    const res = await request(app)
      .post(`/api/chat/${convId}/mensajes`)
      .set('Authorization', `Bearer ${tokenUser2}`)
      .send({ contenido: 'Bien gracias, ¿y vos?' });

    expect(res.status).toBe(201);
    expect(res.body.remitente_id).toBe(idUser2);
  });

  test('rechaza mensaje sin contenido → 400', async () => {
    const res = await request(app)
      .post(`/api/chat/${convId}/mensajes`)
      .set('Authorization', `Bearer ${tokenUser1}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ─── Obtener mensajes ─────────────────────────────────────────────────────────

describe('GET /api/chat/:id/mensajes — obtener mensajes', () => {
  test('devuelve array de mensajes para participante → 200', async () => {
    const res = await request(app)
      .get(`/api/chat/${convId}/mensajes`)
      .set('Authorization', `Bearer ${tokenUser1}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.mensajes)).toBe(true);
    expect(res.body.mensajes.length).toBeGreaterThanOrEqual(1);
  });

  test('acceso denegado a conversación ajena → 403', async () => {
    const res = await request(app)
      .get(`/api/chat/${convId}/mensajes`)
      .set('Authorization', `Bearer ${tokenUser3}`);

    expect(res.status).toBe(403);
  });
});

// ─── Mis conversaciones ───────────────────────────────────────────────────────

describe('GET /api/chat — mis conversaciones', () => {
  test('devuelve lista de conversaciones del usuario → 200', async () => {
    const res = await request(app)
      .get('/api/chat')
      .set('Authorization', `Bearer ${tokenUser1}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.conversaciones)).toBe(true);
    expect(res.body.conversaciones.length).toBeGreaterThanOrEqual(1);
  });

  test('usuario sin conversaciones devuelve array vacío → 200', async () => {
    const res = await request(app)
      .get('/api/chat')
      .set('Authorization', `Bearer ${tokenUser3}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.conversaciones)).toBe(true);
  });

  test('rechaza sin autenticación → 401', async () => {
    const res = await request(app).get('/api/chat');
    expect(res.status).toBe(401);
  });
});
