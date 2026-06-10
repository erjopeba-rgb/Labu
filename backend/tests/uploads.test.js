const request = require('supertest');
const app     = require('./app');
const { limpiarTablas, registrar } = require('./helpers');

let pool;
let tokenDueno;
let tokenTrabajador;
let idDueno;
let idTrabajador;
let disputaId;

const imagenFake = Buffer.from('fake-image-data-for-test');

beforeAll(async () => {
    pool = require('../config/db');
    await limpiarTablas();

    const regDueno = await registrar({ email: 'dueno.uploads@test.com', tipo_perfil: 'dueno' });
    idDueno    = regDueno.body.usuario.id;
    tokenDueno = regDueno.body.token;

    const regTrabajador = await registrar({ email: 'trabajador.uploads@test.com', tipo_perfil: 'trabajador' });
    idTrabajador    = regTrabajador.body.usuario.id;
    tokenTrabajador = regTrabajador.body.token;

    // Insertar trabajo y disputa directamente para el test de evidencia
    const { rows: [trabajo] } = await pool.query(
        `INSERT INTO trabajos (dueno_id, titulo, descripcion, estado)
         VALUES ($1, 'Trabajo para disputa', 'Descripción', 'completado') RETURNING id`,
        [idDueno]
    );
    const { rows: [disputa] } = await pool.query(
        `INSERT INTO disputas (trabajo_id, iniciador_id, acusado_id, motivo)
         VALUES ($1, $2, $3, 'pago') RETURNING id`,
        [trabajo.id, idDueno, idTrabajador]
    );
    disputaId = disputa.id;
});

afterAll(async () => {
    await pool.end();
});

// ─── 1. Upload de avatar exitoso ─────────────────────────────────────────────

describe('POST /api/profile/avatar', () => {
    test('sube avatar exitosamente → 200 con avatar_url', async () => {
        const res = await request(app)
            .post('/api/profile/avatar')
            .set('Authorization', `Bearer ${tokenDueno}`)
            .attach('avatar', imagenFake, { filename: 'foto.jpg', contentType: 'image/jpeg' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.avatar_url).toBeDefined();
        expect(typeof res.body.avatar_url).toBe('string');
    });

    // ─── 2. Rechazo por tipo MIME inválido ────────────────────────────────────

    test('rechaza archivo con MIME inválido → 400', async () => {
        const res = await request(app)
            .post('/api/profile/avatar')
            .set('Authorization', `Bearer ${tokenDueno}`)
            .attach('avatar', Buffer.from('not an image'), { filename: 'doc.pdf', contentType: 'application/pdf' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/tipo de archivo no permitido/i);
    });

    // ─── 3. Rechazo por archivo demasiado grande ──────────────────────────────

    test('rechaza imagen mayor a 5MB → 400', async () => {
        const archivoGrande = Buffer.alloc(6 * 1024 * 1024, 'x');

        const res = await request(app)
            .post('/api/profile/avatar')
            .set('Authorization', `Bearer ${tokenDueno}`)
            .attach('avatar', archivoGrande, { filename: 'grande.jpg', contentType: 'image/jpeg' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/5MB/i);
    });
});

// ─── 4. Upload de evidencia a disputa ────────────────────────────────────────

describe('POST /api/disputas/:id/evidencia', () => {
    test('sube evidencia a disputa abierta → 200 con evidencia_urls', async () => {
        const res = await request(app)
            .post(`/api/disputas/${disputaId}/evidencia`)
            .set('Authorization', `Bearer ${tokenDueno}`)
            .attach('evidencia', imagenFake, { filename: 'evidencia.jpg', contentType: 'image/jpeg' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.evidencia_urls)).toBe(true);
        expect(res.body.evidencia_urls.length).toBeGreaterThan(0);
    });

    test('rechaza evidencia sin archivos → 400', async () => {
        const res = await request(app)
            .post(`/api/disputas/${disputaId}/evidencia`)
            .set('Authorization', `Bearer ${tokenDueno}`)
            .send({});

        expect(res.status).toBe(400);
    });

    test('rechaza evidencia a disputa inexistente → 404', async () => {
        const res = await request(app)
            .post(`/api/disputas/999999/evidencia`)
            .set('Authorization', `Bearer ${tokenDueno}`)
            .attach('evidencia', imagenFake, { filename: 'evidencia.jpg', contentType: 'image/jpeg' });

        expect(res.status).toBe(404);
    });
});
