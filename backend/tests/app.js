// App Express para tests — mismas rutas que server.js pero sin socket.io ni listen()
const express = require('express');
const cors = require('cors');
const app = express();

// Mock de io para que contactos.controller no falle al llamar req.app.get("io")
app.set('io', { to: () => ({ emit: () => {} }) });

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(require('../middlewares/apiVersion.middleware'));

const v1Router = require('../routes/v1.router');
app.use('/api/v1', v1Router);
app.use('/api',    v1Router);

const errorHandler = require('../middlewares/errorHandler.middleware');
app.use(errorHandler);

module.exports = app;
