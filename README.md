# Labu

[![CI](https://github.com/TU_USUARIO/rtype1/actions/workflows/ci.yml/badge.svg)](https://github.com/TU_USUARIO/rtype1/actions/workflows/ci.yml)

Plataforma que conecta personas con complejidades técnicas en su hogar con profesionales que conocen la solución. Funciona similar a Uber para servicios del hogar.

## Stack

- **Frontend:** HTML + CSS + JS vanilla
- **Backend:** Node.js + Express
- **Base de datos:** PostgreSQL
- **Tiempo real:** Socket.io
- **Auth:** JWT + bcrypt
- **Pagos:** MercadoPago

## Desarrollo local

```bash
# 1. Configurar variables de entorno
cp backend/.env.example backend/.env
# Completar backend/.env con tus credenciales

# 2. Instalar dependencias
cd backend && npm install

# 3. Crear la base de datos y ejecutar el schema
# Ver database/data/blueprints/ y database/migrations/

# 4. Iniciar el servidor
npm start
# → http://localhost:3000
```

## Tests

```bash
cd backend
npm test
```

Requiere una base de datos `rtype1_test` con el schema aplicado y un archivo `backend/.env.test` configurado.
