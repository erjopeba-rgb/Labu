# Labu — Roadmap

Estado: **MVP completo y auditado. Listo para deploy.**

---

## B — Backend

| ID  | Descripción                                              | Estado      |
|-----|----------------------------------------------------------|-------------|
| B1  | Nodemailer con Ethereal para desarrollo                  | ✅ Completo |
| B2  | Verificación de firma HMAC-SHA256 en webhook MercadoPago | ✅ Completo |
| B3  | Panel de administración y moderación                     | ✅ Completo |
| B4  | Validación de identidad con UI                           | ✅ Completo |
| B5  | Disputas entre usuarios                                  | ✅ Completo |
| B6  | Redis real integrado (cache + Socket.io adapter)         | ✅ Completo |
| B7  | S3 para uploads en producción                            | ✅ Completo |
| B8  | Backups automáticos de DB                                | ✅ Completo |
| B9  | Repository layer completo para todos los módulos         | ✅ Completo |

---

## T — Testing y QA

| ID  | Descripción                                              | Estado      |
|-----|----------------------------------------------------------|-------------|
| T1  | Suite de tests con Jest + Supertest                      | ✅ Completo |
| T2  | Tests de autenticación (`auth.test.js`)                  | ✅ Completo |
| T3  | Tests para chat y notificaciones                         | ✅ Completo |
| T4  | Tests para geolocalización                               | ✅ Completo |
| T5  | Tests de flujo completo (`flujo-completo.test.js`)       | ✅ Completo |
| T6  | Auditoría de código — 9 hallazgos corregidos (2 críticos, 3 importantes, 4 menores) | ✅ Completo |

> Tests actuales: **127/127 pasando** (auth, jobs, offers, reportes, flujo-completo, scheduling, chat, geolocalizacion, disputas, backups, uploads). Última auditoría: 2026-06-08.

---

## I — Infraestructura

| ID  | Descripción                                              | Estado      |
|-----|----------------------------------------------------------|-------------|
| I1  | CI/CD con GitHub Actions (`ci.yml` + `deploy.yml`)       | ✅ Completo |
| I2  | HTTPS y dominio propio                                   | ⬜ Pendiente |
| I3  | PM2 para deploy en producción                            | ⬜ Pendiente |
| I4  | Variables de entorno seguras en servidor                 | ⬜ Pendiente |
| I5  | CDN para assets estáticos                                | ⬜ Pendiente |
| I6  | Monitoreo y uptime                                       | ⬜ Pendiente |
