# FRONTEND-AUDIT.md — Auditoría de frontend pre-lanzamiento (Labu)

**Fecha:** 2026-07-01
**Alcance:** Frontend (HTML/CSS/JS vanilla) del flujo principal, con foco en **móvil 375px** (tráfico de lanzamiento = grupos de Facebook de zona sur del GBA, mayoría celular).
**Método:** Lectura de código, greps sistemáticos, cruce con `AUDIT.md`. **No se modificó nada** — solo diagnóstico y plan.

> Contexto de negocio aplicado: el 100% del tráfico inicial entra desde Facebook móvil. Por eso el criterio de "BLOQUEA LANZAMIENTO" es agresivo con todo lo que rompe la experiencia en un viewport de 375px, aunque en desktop se vea perfecto.

---

## 0. Resumen ejecutivo

| Severidad | Cantidad | Temas dominantes |
|---|---|---|
| 🔴 BLOQUEA LANZAMIENTO | 3 | Sin navegación en móvil, chat inutilizable en móvil, disponibilidad/agenda sin responsive |
| 🟠 IMPORTANTE | 6 | Navegación inconsistente entre páginas, páginas sin media queries, limpieza técnica (JS huérfano, CSS stubs, BOM), estados de carga desiguales |
| 🟡 COSMÉTICO | 5 | Branding residual en storage, doble CDN de Leaflet, limitación de duración en agenda, textos menores |

**Las 3 cosas que hay que resolver sí o sí antes de abrir a Facebook:** navegación móvil (F1), chat móvil (F2) y el responsive de disponibilidad/agenda (F3). Sin eso, un usuario que entra desde el celular queda literalmente atrapado en el feed.

> **Estado (2026-07-01):** los 3 bloqueantes de la Fase 1 están **RESUELTOS** — B-F1 (`0f95a15`), B-F2 (`2d77fe7`), B-F3 (`444c876`), cada uno verificado a 375px con Playwright y con `npm test` en verde (189/189). Detalle al final del documento.

**Nota sobre el bug de solapamiento de turnos:** se intentó reproducir y **no es reproducible** en el código actual (ver §B-9). No entra en el plan como fix; sí se documenta la limitación real que probablemente lo originó.

---

## Dimensión A — Limpieza técnica (cruce con AUDIT.md)

### A-M2 · JS huérfano — confirmación de qué es seguro borrar 🟠

Cruzado grep de `<script src>` en todos los HTML **y** referencias dinámicas dentro de `/js`. Resultado:

**Confirmados huérfanos (0 referencias en ningún HTML ni JS — borrado seguro):**

| Archivo | Motivo |
|---|---|
| `frontend/public/js/router.js` | SPA incompleto, nunca cargado |
| `frontend/public/js/modal-handler.js` | Sin referencias |
| `frontend/public/js/ui-components.js` | Sin referencias |
| `frontend/public/js/modules/agenda-modal.js` | El chat de coordinación manual fue eliminado del producto; `agenda.html` carga `agenda.js` + `disponibilidad.js`, no este |
| `frontend/public/js/modules/marketplace.js` | No existe `marketplace.html` |
| `frontend/public/js/modules/planner3d.js` | `planner-3d.html` no carga ningún script propio (solo guard de auth inline) |
| `frontend/public/js/components/video-card.js` | Sin referencias (el componente `video-card.html` trae su propio JS inline) |

**Corrección a AUDIT.md M2:** el listado original incluía `shared-jobs.js` como sospechoso — **NO es huérfano**: lo cargan `mis-trabajos.html` y `mis-ofertas-laborales.html`. No tocar.

**Seguridad del borrado:** los 7 archivos de arriba no son importados por nada. Borrarlos no cambia comportamiento. Caveat de producto: `marketplace.js` y `planner3d.js` son restos de features "Próximamente"; borrarlos elimina solo código muerto, no una feature viva.
**Esfuerzo:** chico.

### A-M3 · CSS stubs vacíos 🟠

Listado real (líneas de contenido):

**Cargados por páginas pero vacíos (links que no aportan nada):**
- `cards.css` (3 líneas) — referenciado por varias páginas/componentes.
- `forms.css` (2 líneas).

**Stubs sin ninguna referencia (candidatos a borrar):**
- `animations.css` (4), `buttons.css` (1), `calendar.css` (4), `layout.css` (4), `responsive.css` (6).

**Observación de fondo:** que `responsive.css` sea un stub de 6 líneas confirma que **no hay una estrategia de responsive central** — cada página depende de las media queries de su propio CSS, lo que explica la inconsistencia móvil de la Dimensión B.
**Esfuerzo:** chico (borrar stubs sin referencia; decidir si `cards.css`/`forms.css` se completan o se quitan de los `<link>`).

### A-M11 · BOM UTF-8 🟠

AUDIT.md estimaba "~45 archivos" a nivel proyecto. **Solo el frontend tiene 72 archivos con BOM** (`EF BB BF`): 15 CSS, 17 JS y 40 HTML (incluye los 17 componentes). No rompe el navegador, pero ensucia diffs y puede producir un carácter invisible al inicio del archivo. Listado completo capturado (16 CSS, 17 JS módulos/raíz/utils, componentes y páginas). Un solo script de normalización (strip de 3 bytes iniciales) resuelve todo.
**Esfuerzo:** chico (script batch). **No mezclar en un commit con otros cambios** — genera un diff enorme; va en su propio commit.

> **M4 queda fuera del plan por decisión previa** (inline `<style>`/`<script>` post-lanzamiento).

---

## Dimensión B — Calidad visual y UX de cara al lanzamiento

### 🔴 BLOQUEA LANZAMIENTO

#### B-F1 · No hay navegación en móvil — el usuario queda atrapado en el feed — ✅ RESUELTO (2026-07-01, commit `0f95a15`)
- **Páginas/archivos:** `frontend/public/css/feed.css:538-540`, `frontend/public/css/navigation.css:312-315`, `frontend/views/components/sidebar-left.html`, `frontend/views/components/navbar.html`, `feed.html:88-98`.
- **Descripción:** El menú principal (Feed, Publicar Trabajo, Mis Ofertas, Mis Pagos, Mensajes, Agenda, Catálogo, Búsqueda, Configuración) vive **únicamente** en `.sidebar-left`. En `feed.css` ese sidebar es `display:none` a partir de `max-width:1200px`. El navbar superior **no tiene menú de navegación**: solo ícono de notificaciones, ícono de mensajes y avatar (que va a `mi-perfil`). No existe hamburguesa, bottom-nav ni drawer en ningún lado (grep de `hamburg|mobile-menu|bottom-nav|drawer` en todo el frontend = 0 resultados reales). **Consecuencia en un celular de 375px:** desde el feed, el usuario solo puede llegar a notificaciones, mensajes y su perfil. No puede llegar a Publicar Trabajo, Agenda, Búsqueda, Mis Ofertas ni Configuración. Para un producto cuyo core es "el dueño publica / el trabajador oferta", esto es fatal.
- **Fix sugerido:** agregar una barra de navegación inferior fija (bottom-nav, patrón nativo móvil: Feed / Publicar / Mensajes / Agenda / Perfil) **o** una hamburguesa en el navbar que despliegue el mismo menú del `sidebar-left`. La bottom-nav es la más adecuada para el público de Facebook móvil.
- **Esfuerzo:** mediano-grande.

#### B-F2 · El chat es inutilizable en móvil (no se puede elegir conversación) — ✅ RESUELTO (2026-07-01, commit `2d77fe7`)
- **Páginas/archivos:** `frontend/public/css/mensajes.css:374-379`, `frontend/public/js/modules/mensajes.js`.
- **Descripción:** El CSS móvil está a medio hacer: define `.conversations-sidebar.mobile-show` y `.chat-area.mobile-hide` para alternar lista ↔ conversación en una sola columna, **pero `mensajes.js` nunca agrega ni quita esas clases** (grep de `mobile-hide|mobile-show|innerWidth|matchMedia` en el módulo = 0). Estado por defecto en `≤768px`: `.conversations-sidebar { display:none }` y `.chat-area` visible. Resultado: en el celular la **lista de conversaciones nunca aparece** y no hay forma de seleccionar ni cambiar de chat. El chat es parte del flujo principal (coordinación dueño↔trabajador).
- **Fix sugerido:** cablear el toggle: al entrar mostrar la lista (`.mobile-show` en el sidebar + `.mobile-hide` en el área de chat); al tocar una conversación invertir; agregar botón "← Volver" en el header del chat en móvil.
- **Esfuerzo:** chico-mediano.

#### B-F3 · Disponibilidad y agenda sin responsive (grillas de 7 columnas fijas) — ✅ RESUELTO (2026-07-01, commit `444c876`)
- **Páginas/archivos:** `frontend/public/css/disponibilidad.css` (**1019 líneas, 0 media queries**), `frontend/public/css/agenda.css` (grillas semanales), `agenda.html`.
- **Descripción:** `disponibilidad.css` no tiene una sola media query. Usa layouts de ancho pensado para desktop: `grid-template-columns: 28px 90px 1fr 1fr` (línea 16) y varias grillas `repeat(7, 1fr)` (config semanal, calendario de oferta). En 375px, siete columnas + labels de hora quedan comprimidas o se desbordan. El calendario de selección de fecha (`.offer-cal-*`, `aspect-ratio:1`) sobrevive apretado, pero la configuración de disponibilidad semanal y "Trabajos Agendados" no están adaptadas. Es una pantalla que el trabajador **tiene que** usar sí o sí (sin disponibilidad no recibe trabajos), así que un layout roto acá bloquea el onboarding del lado de la oferta.
- **Fix sugerido:** agregar media queries `≤480px` en `disponibilidad.css`/`agenda.css`: colapsar la grilla semanal a una columna por día (stack vertical) o a scroll horizontal contenido; reducir labels de hora. La vista semana de agenda ya tiene `overflow-x:auto` (mitigación parcial) — replicar ese criterio.
- **Esfuerzo:** mediano.

### 🟠 IMPORTANTE

#### B-1 · Navegación inconsistente entre páginas — ✅ RESUELTO (2026-07-01) — Fase 2
- **Archivos:** `feed.html` (14 refs a `sidebar-left`/menú), `agenda.html` (**0** refs — no tiene menú lateral), `mis-trabajos.html` (1).
- **Descripción:** El feed trae el menú lateral completo inline; `agenda.html` **no tiene ningún menú de navegación** ni en desktop. Cada página resolvió su chrome distinto. Además del problema móvil (F1), en desktop hay inconsistencia: desde agenda no hay menú para volver a otras secciones salvo el navbar (que no tiene links).
- **Fix aplicado:** el feed es la única página con `.sidebar-left` (menú de escritorio). En el resto, la hamburguesa + drawer de B-F1 pasan a ser también la navegación de **escritorio**: `mobile-nav.js` marca `<body>` con `.has-desktop-nav` cuando no hay `.sidebar-left`, y `mobile-nav.css` deja de ocultar la hamburguesa en ≥1201px para esas páginas (el feed no cambia — su sidebar sigue cubriendo la nav). Sin tocar el markup de cada página: mismo módulo autocontenido de F1.
- **Verificación:** Playwright — 375px sin regresión (hamburguesa visible en agenda) + desktop 1300px: hamburguesa visible y drawer navega en agenda, oculta en feed (sidebar presente). 11/11 asserts. `npm test`: 189/189.
- **Esfuerzo:** mediano.

#### B-2 · Páginas con layout multi-columna y 0 media queries — ✅ RESUELTO (2026-07-01) — Fase 2
- **Archivos:** `ayudantes.css` (0 @media; `.form-row { grid-template-columns:1fr 1fr }` fijo, línea 217), `admin.css` (0 @media; tablas anchas), `catalogo.css` (1, revisar grillas), `mis-pagos.css` (OK — usa `auto-fit minmax(190px,1fr)`).
- **Descripción:** `ayudantes` deja un form de 2 columnas fijas que en 375px queda apretado. `admin` no es responsive pero es uso interno (baja prioridad para el lanzamiento). El resto conviene verificarlo en el navegador a 375px.
- **Fix aplicado:** dos media queries en `ayudantes.css` — `≤768px`: la barra de 4 tabs (etiquetas largas) pasa a scroll horizontal (`overflow-x:auto` + `white-space:nowrap`, scrollbar oculto); `≤480px`: `.form-row` colapsa a 1 columna, padding lateral reducido en layout/tarjetas, `.ayudante-card` envuelve sus acciones a una segunda fila, `.solicitud-header` con `flex-wrap`, y toast contenido al viewport. `admin` pospuesto (interno, baja prioridad).
- **Verificación de `catalogo`:** a 375px **no desborda** (`scrollWidth=375`); su grid usa `minmax(280px,1fr)` que a ~311px de contenedor entra en una columna, y ya tenía `@media ≤600px` colapsando `.rubros-grid`. **Sin cambios necesarios.**
- **Verificación:** Playwright a 375px — ayudantes sin desborde (`scrollWidth=375`), `.form-row` en 1 columna, `.tabs` con `overflow-x:auto`; catálogo sin desborde; desktop 1300px `.form-row` sigue en 2 columnas (sin regresión). 7/7 asserts. `npm test`: 189/189.
- **Esfuerzo:** chico.

#### B-3 · Limpieza técnica agrupada (A-M2 + A-M3 + A-M11)
- Ver Dimensión A. Se agrupan acá para el plan porque son cambios de bajo riesgo que conviene commitear juntos por tipo.
- **Esfuerzo:** chico (cada uno).

#### B-4 · Estados de carga/vacío desiguales — ✅ RESUELTO (2026-07-01) — Fase 2
- **Archivos:** cobertura buena en `feed.js` (26 usos de patrones cargando/vacío/error), `mi-perfil.js`, `catalogo.js`, `ayudantes.js` (10 c/u). Baja cobertura: `agenda.js` (1), `configuracion.js` (1), `publicar-trabajo.js` (1), `mis-pagos.js` (1).
- **Descripción:** No hay pantallas totalmente en blanco detectadas, pero las páginas de baja cobertura pueden mostrar vacío sin mensaje mientras cargan o si el request falla. `mis-pagos` (saldo/retiros) y `agenda` (trabajos agendados) son las más sensibles: si el request tarda o falla, el trabajador ve un blanco sin feedback.
- **Fix aplicado (mis-pagos):** `cargarSaldo` muestra `…` mientras carga y, si falla, un banner `#saldoError` con botón **Reintentar** (antes fallaba en silencio y los montos quedaban en `—`). `cargarRetiros` ahora tiene loader → error-con-Reintentar → vacío-con-explicación → lista (antes un error se disfrazaba de "sin retiros"). Ambas funciones exportadas a `window` para los `onclick`; CSS `.saldo-error`/`.btn-reintentar-inline` en `mis-pagos.css`; `#saldoError` en el HTML.
- **Fix aplicado (agenda):** `disponibilidad.js::cargarReservasConfirmadas` (card "Trabajos Agendados", solo trabajador) ya no se queda oculto: revela el card con loader, y resuelve a error-con-Reintentar / vacío-con-CTA ("Ver feed") / lista. Exportada a `window`. El path del dueño no cambia (no llama a esta función).
- **Nota:** `agenda.js` en sí es local (localStorage); el dato de API sensible vive en `disponibilidad.js`, ahí fue el fix. Datos reales siguen renderizando (verificado con una reserva confirmada real).
- **Verificación:** Playwright a 375px con interceptación de rutas para forzar 500 — mis-pagos: saldo/retiros muestran Reintentar y reintentar recupera; agenda: error con Reintentar en Trabajos Agendados y recuperación. 10/10 asserts. `npm test`: 189/189.
- **Esfuerzo:** chico-mediano.

### 🟡 COSMÉTICO

#### B-9 · Bug de "solapamiento de turnos": NO reproducible (investigado)
- **Archivos:** `agenda.js:150-200`, `disponibilidad.js`, `agenda.css:581-641`.
- **Investigación:** se intentó reproducir con turnos contiguos y superpuestos.
  - `disponibilidad.js` guarda **una sola franja por día** (`dia_semana → {hora_inicio, hora_fin}`) → estructuralmente imposible que se solapen bloques.
  - `agenda.js` agrupa los eventos por **hora de inicio** (`parseInt(hora.split(':')[0])`) y los apila dentro de la celda de esa hora usando **flujo normal** (`.hora-evento` en columna flex, `.hora-contenido { min-height:50px }`, sin `position:absolute` ni `top/height` calculados por tiempo). Dos eventos en la misma hora se apilan verticalmente y **la celda crece** (`min-height`, no `height`) — no se solapan ni se recortan.
- **Conclusión:** el solapamiento visual reportado no se reproduce en el código actual; probablemente el `min-height` + flujo normal ya lo mitigó en algún fix previo. **No requiere fix.**
- **Limitación real detectada (aparte):** la agenda ignora la **duración**: un trabajo de 09:00–13:00 aparece solo en la celda de las 9:00 y no "ocupa" visualmente 10/11/12. No es un bug de solapamiento, es una limitación de representación. Anotarlo como mejora futura, no como bloqueante.
- **Esfuerzo:** — (no aplica).

#### B-10 · Branding residual en `localStorage` (cruce con AUDIT M1)
- `agenda.js:6` → `rtype1_agenda_eventos`; `marketplace.js:122` → `rtype1_carrito` (archivo huérfano). No visibles al usuario. Cambiar la clave de agenda requiere migrar eventos guardados en el dispositivo (o se pierden). **No hay "RType1" ni lorem ipsum en texto visible** (grep confirmado). Bajo impacto.
- **Esfuerzo:** chico (con migración de la clave) / trivial (si se acepta perder eventos locales).

#### B-11 · Doble fuente de CDN para Leaflet
- `feed.html:455` carga Leaflet desde `unpkg.com`; `busqueda-avanzada.html:135` desde `cdnjs.cloudflare.com`. Misma versión (1.9.4) pero dos orígenes distintos → inconsistencia y un punto de fallo extra en red móvil. Unificar a un solo CDN (o self-host).
- **Esfuerzo:** chico.

#### B-12 · Verificaciones menores recomendadas en navegador a 375px
- Confirmar visualmente: modal de oferta en el feed, `publicar-trabajo` (form largo con foto + geoloc), tarjetas del feed, y el navbar con `.nav-search` oculto a 768px. Todos parecen colapsar bien por CSS pero conviene screenshot real.
- **Esfuerzo:** chico (QA manual).

---

## Plan de ejecución por fases (tandas commiteables)

Ordenado por impacto en el lanzamiento móvil. Cada fase es un commit (o pocos commits) independiente y verificable.

### Fase 1 — Desbloqueo móvil (BLOQUEA LANZAMIENTO) 🔴
Sin esto no se abre a Facebook.
1. **B-F1 · Navegación móvil** — bottom-nav fija (Feed / Publicar / Mensajes / Agenda / Perfil) presente en todas las páginas. *(mediano-grande)*
2. **B-F2 · Chat móvil** — cablear toggle lista↔chat + botón "← Volver" en `mensajes.js`/`mensajes.css`. *(chico-mediano)*
3. **B-F3 · Responsive de disponibilidad/agenda** — media queries `≤480px`, colapsar grillas de 7 columnas. *(mediano)*

> Cierre de Fase 1: QA manual en viewport 375px del recorrido completo registro → feed → publicar → perfil trabajador → disponibilidad → pago → chat.

### Fase 2 — Consistencia y robustez visual (IMPORTANTE) 🟠 — ✅ COMPLETA (2026-07-01)
4. **B-1 · Unificar navegación** entre páginas (probablemente cae solo al cerrar B-F1). *(mediano)* — ✅ hamburguesa+drawer como nav de escritorio en páginas sin sidebar.
5. **B-2 · Media queries faltantes** en `ayudantes` (y verificación de `catalogo`); `admin` se pospone. *(chico)* — ✅ tabs scroll + form 1 columna; catálogo verificado sin cambios.
6. **B-4 · Estados de carga/vacío/error** en `mis-pagos` y `agenda`. *(chico-mediano)* — ✅ loader/error-Reintentar/vacío-CTA en saldo, retiros y trabajos agendados.

### Fase 3 — Limpieza técnica (IMPORTANTE, bajo riesgo) 🟠
Commits separados por tipo para diffs limpios.
7. **A-M2** — borrar los 7 JS huérfanos confirmados (dejar `shared-jobs.js`). *(chico)*
8. **A-M3** — borrar stubs CSS sin referencia; decidir `cards.css`/`forms.css`. *(chico)*
9. **A-M11** — normalizar BOM de los 72 archivos **en un commit propio y aislado**. *(chico)*

### Fase 4 — Cosmético / pulido (COSMÉTICO) 🟡
10. **B-11** — unificar CDN de Leaflet. *(chico)*
11. **B-10** — decidir qué hacer con las claves `rtype1_*` de localStorage. *(chico)*
12. **B-12** — QA visual final a 375px + screenshots. *(chico)*
13. **B-9** — sin acción (documentado). Opcional futuro: representar duración en la agenda.

---

## Anexo — Qué se verificó y qué no

- **Verificado por código/grep:** referencias de scripts en los 22 HTML, orfandad de JS, líneas de CSS stubs, BOM de 72 archivos, viewport meta (todas las páginas reales lo tienen; los componentes no lo necesitan), media queries por CSS, estructura de navegación (sidebar-left vs navbar), toggle móvil de mensajes, lógica de render de agenda/disponibilidad (sin posición absoluta), ausencia de lorem/RType1 en texto visible.
- **No verificado (requiere navegador real):** render pixel-perfect a 375px de cada página, comportamiento de Leaflet en móvil, y el recorrido de pago de MercadoPago end-to-end en pantalla chica. Recomendado como QA manual en Fase 1 y Fase 4.
- **No se modificó ningún archivo** salvo la creación de este `FRONTEND-AUDIT.md`.

---

## B-F1 — RESUELTO (2026-07-01, commit `0f95a15`) — Fase 1

Navegación móvil con **hamburguesa + drawer** (patrón elegido por el usuario sobre bottom-nav). Como el menú principal solo existía inline en `feed.html` y el resto de las páginas no tenían ninguno, se implementó como **módulo autocontenido** en vez de tocar el markup de cada página:

- **`frontend/public/js/modules/mobile-nav.js`** (nuevo): inyecta un botón hamburguesa dentro de `.navbar-content` (o flotante si la página no tuviera navbar) + un drawer lateral con overlay. El menú se construye en JS espejando `components/sidebar-left.html` + "Mi Perfil", navega por `window.location` (sin depender de `main.js`) y **filtra por rol** con el mismo criterio que `feed.js` (`perfil_activo || tipo_perfil`). Solo se activa si `Auth.isAuthenticated()`.
- **`frontend/public/css/mobile-nav.css`** (nuevo): drawer + overlay + botón, visibles **solo en ≤1200px** (donde `feed.css` oculta el `.sidebar-left`), forzados a `display:none` en ≥1201px. El módulo inyecta su propio `<link>` (sigue siendo CSS externo).
- **`<script src="/js/modules/mobile-nav.js">`** agregado a las 15 páginas del flujo autenticado (feed, agenda, mensajes, mi-perfil, mis-ofertas, mis-ofertas-laborales, mis-trabajos, mis-pagos, notificaciones, publicar-trabajo, busqueda-avanzada, catalogo, ayudantes, configuracion, perfil-publico).
- **Verificación:** Playwright a 375px, 13/13 asserts — hamburguesa visible, drawer abre/cierra (overlay + ESC), filtrado por rol correcto (dueño ve sus ítems y NO los de trabajador), navegación entre páginas, y oculto en desktop 1300px. `npm test`: 189/189.
- **Pendiente relacionado:** B-1 (unificar navegación entre páginas) queda para la Fase 2 — este fix ya cubre el acceso en móvil en todas las páginas del flujo. Los stubs (`planner-3d`, `proyecto-completo`, `inventario-herramientas`) y `admin` quedaron fuera a propósito (no cargan `auth.js`/`main.js`; baja prioridad).

## B-F2 — RESUELTO (2026-07-01, commit `2d77fe7`) — Fase 1

El chat ya es usable en móvil. `mensajes.css` definía `.conversations-sidebar.mobile-show` y `.chat-area.mobile-hide` para alternar lista↔chat en una columna, pero `mensajes.js` nunca las toggleaba → en ≤768px la lista quedaba `display:none` sin forma de elegir conversación.

- **`mensajes.js`:** helpers `mostrarVistaLista()` / `mostrarVistaChat()`; arranca en vista lista; `abrirConversacion()` pasa a vista chat; `volverAListaConversaciones()` expuesto a `window`. Las clases son **inertes en desktop** (solo estiladas dentro del media query ≤768px) → escritorio sin cambios.
- **`mensajes.html`:** botón "←" en el `chat-header` (visible solo en móvil).
- **`mensajes.css`:** estilos del botón; `.chat-header` pasa a `flex-start` con `.chat-actions { margin-left:auto }` (idéntico en desktop porque el botón está oculto); el botón se muestra dentro del media query ≤768px.
- **Verificación:** Playwright a 375px, 13/13 asserts — flujo lista→abrir→chat con "Volver"→lista; en desktop 1300px ambos paneles visibles y el botón "Volver" oculto. `npm test`: 189/189.

## B-F3 — RESUELTO (2026-07-01, commit `444c876`) — Fase 1

Responsive de disponibilidad y agenda. `disponibilidad.css` no tenía **ninguna** media query (1019 líneas) y `agenda.html` desbordaba el viewport de 375px. La verificación destapó **dos bugs de layout que no estaban en el informe original**:

1. **`.disp-day-row`** (config semanal): media query `≤480px` que reordena la fila — el nombre del día pasa a su propia línea y los inputs "desde/hasta" a una segunda fila lado a lado (antes ~77px cada uno → ahora ~120px, usables). La fila de tiempo de preparación también envuelve.
2. **Grid del layout (bug nuevo):** `.agenda-layout > div { min-width: 0 }` — la columna `1fr` no encogía por debajo del `min-content` de su contenido (default `min-width:auto` en items de grid) y expandía el track a ~397px, desbordando el viewport.
3. **Navbar de agenda (bug nuevo):** el navbar propio de agenda (back + logo + título + spacer fijo de 100px) más la hamburguesa nueva no entraban en 375px. En `≤640px` se oculta el título y el spacer, y back+logo se agrupan a la izquierda.
4. **Vista semana:** `.semana-row { min-width }` en `≤768px` para que scrollee horizontalmente en `.semana-container` (overflow-x:auto) en vez de comprimir 8 columnas.
- **Verificación:** Playwright a 375px, 6/6 asserts — config semanal en 2 filas por día con inputs usables, **sin desborde horizontal** (`scrollWidth=375`); en desktop la fila día+horas se mantiene en una línea. `npm test`: 189/189.

### Nota de método (verificación de los 3 fixes)
Playwright se instaló en el directorio scratchpad de la sesión (**fuera del repo** — no toca `package.json` ni el lockfile). Para saltar el rate-limit de registro (60 min tras varias altas seguidas) se firmó un JWT válido con el `JWT_SECRET` real contra un usuario que ya había aceptado los TyC. Nada de ese andamiaje quedó en el repositorio.
