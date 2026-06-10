const request = require('supertest');
const app = require('./app');

/**
 * Trunca todas las tablas de test en orden correcto (FK inverse).
 * Requiere que la DB rtype1_test tenga el schema completo.
 */
const limpiarTablas = async () => {
  const pool = require('../config/db');
  // Truncate all user-data tables; CASCADE handles FK dependencies automatically.
  // Tables are ordered leaf-first so partial failures don't leave orphan data.
  const tablas = [
    'solicitudes_ayudante', 'aplicaciones_ayudante',
    'mensajes_disputa', 'evidencias_disputa', 'disputas',
    'verificaciones_identidad', 'trabajadores_confianza',
    'mantenimientos_recurrentes', 'aceptaciones_tyc',
    'reportes', 'calificaciones', 'portfolio_items',
    'distribuciones_pago', 'seguros_trabajo', 'pagos_ayudante', 'pagos',
    'mensajes', 'participantes_conversacion', 'conversaciones',
    'notificaciones', 'reservas_tentativas', 'disponibilidad_trabajador',
    'ofertas', 'trabajos', 'email_verifications', 'password_resets',
    'perfiles', 'usuarios'
  ];
  try {
    await pool.query(`TRUNCATE TABLE ${tablas.join(', ')} RESTART IDENTITY CASCADE`);
  } catch (_) {
    for (const tabla of tablas) {
      try { await pool.query(`TRUNCATE TABLE ${tabla} RESTART IDENTITY CASCADE`); } catch (_) {}
    }
  }
};

/** Registra un usuario y devuelve la respuesta completa */
const registrar = async ({ email, password = 'Password123!', tipo_perfil, fecha_nacimiento = '1990-01-01' }) => {
  return request(app)
    .post('/api/auth/register')
    .send({ email, password, tipo_perfil, fecha_nacimiento });
};

/** Hace login y devuelve solo el token JWT */
const login = async ({ email, password = 'Password123!' }) => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.token;
};

/** Registra un usuario y devuelve su token directamente */
const registrarYLogin = async (opts) => {
  await registrar(opts);
  return login({ email: opts.email, password: opts.password });
};

module.exports = { limpiarTablas, registrar, login, registrarYLogin };
