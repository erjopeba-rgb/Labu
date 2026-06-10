// Carga las variables de entorno de test ANTES de que cualquier módulo crea el pool de DB
process.env.NODE_ENV = 'test';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.test') });
