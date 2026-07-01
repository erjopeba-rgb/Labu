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

---

## V — Vulnerabilidades pendientes (grupo B, post-lanzamiento)

Advisories de `npm audit` que **no se corrigen antes del lanzamiento** por decisión evaluada
(el vector no es alcanzable con el uso actual, o el fix implica un cambio de mayor riesgo que la
vuln). Documentadas para no re-diagnosticarlas. **No correr `npm audit fix --force`.**

| ID  | Paquete / advisory                          | Decisión                    | Estado       |
|-----|---------------------------------------------|-----------------------------|--------------|
| V1  | `nodemailer` v8 → v9 (raw → SSRF/file-read) | Evaluar en rama aislada     | ⬜ Pendiente |
| V2  | `uuid` (vía `bull`/`mercadopago`)           | Esperar parche aguas arriba | ⬜ Bloqueado  |
| V3  | `jest` tree (20 moderate, `js-yaml`)        | Ignorar (dev-only)          | ⬜ Descartado |

### V1 · `nodemailer@9` — cierra la 5ª advisory
**[Post-lanzamiento] Evaluar `nodemailer@9` en rama aislada** — cierra la 5ª advisory
(raw → SSRF/file-read). Major v8→v9, requiere revisar `mail.service.js` y correr sus tests.
**No urgente:** el vector no es alcanzable con el uso actual (el código usa **templates, no raw**).
Subir un major pre-lanzamiento toca el pipeline de email (verificación de identidad +
notificaciones), que es crítico — no vale el riesgo por una vuln que el código no puede gatillar.

### V2 · `uuid` (transitiva de `bull` / `mercadopago`)
Esperar parche aguas arriba. Forzar el fix implicaría **downgrade de `bull`** o **rewrite del SDK
de MercadoPago** — ambos peores que la vuln. **No tocar.**

### V3 · árbol de `jest` (20 moderate, `js-yaml`)
**Dev-only, no llega a producción.** El fix disponible es un downgrade `jest 30 → 25`, que
regresa la suite de tests. **Ignorar.**
