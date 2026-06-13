---
name: nueva-pagina-frontend
description: Checklist completo para crear una página nueva en el frontend de Labu (HTML + CSS externo + JS por módulo, pageMap, navbar.js, socket.io local, exports a window).
---

# Nueva página de frontend — Labu

El frontend es HTML + CSS + JS vanilla, sin frameworks ni build step. Express sirve `frontend/public` y `frontend/views` en la raíz `/` (por eso `/css/X.css` resuelve a `frontend/public/css/X.css`).

## Checklist (en orden)

### 1. HTML — `frontend/views/pages/<pagina>.html`
- Links CSS obligatorios en el `<head>`: `/css/variables.css` + `/css/global.css`, y después el CSS propio de la página.
- Nada de CSS inline ni `<style>` embebido.
- Scripts al final del `<body>`, en este orden: `/js/main.js` (define `App` y `Auth`) → módulos compartidos → el JS propio de la página.

### 2. CSS — `frontend/public/css/<pagina>.css`
- Un archivo por página. Usar las variables de `variables.css`.

### 3. JS — `frontend/public/js/modules/<pagina>.js`
- Un módulo por página, cargado con `<script src="/js/modules/<pagina>.js">` en el HTML. **Olvidar este paso es el error #1 del proyecto.**
- Toda función llamada desde HTML (`onclick`, etc.) debe exportarse: `window.nombreFuncion = nombreFuncion`.
- Llamadas API: `App.apiRequest('/endpoint')` — agrega el prefijo `/api` y el Bearer token solo; maneja 401 (logout) y 403 TYCS_PENDIENTES.
- Errores de formulario: agregar la clase `visible` a `.form-error` al mostrar (sin la clase no se ve).
- Validación inline en blur (patrón existente en los formularios del proyecto).

### 4. Navegación — `frontend/public/js/main.js`
- Agregar la entrada al `pageMap` de `App.navigateTo` (≈ línea 74): `'<pagina>': '/pages/<pagina>.html'`.
- La navegación es por `window.location.href` (no es SPA).

### 5. Navbar (si la página lo tiene)
- Cargar `/js/modules/navbar.js` en el HTML (maneja badges, avatar con inicial, panel de notificaciones).
- Páginas con navbar completo de referencia: `feed.html`, `notificaciones.html`, `mensajes.html`, `mis-ofertas.html`, `mis-pagos.html`.

### 6. Socket.io (solo si la página usa tiempo real)
- ÚNICA fuente permitida: `<script src="/socket.io/socket.io.js"></script>` (servido por el server, siempre matchea la versión del backend).
- **Prohibido** el CDN — ya causó doble carga y mismatch de versiones (I10 del AUDIT.md).

### 7. Enlaces de entrada
- Agregar el link desde donde corresponda: `components/sidebar-left.html` / `sidebar-right.html` (ojo: los componentes no se inyectan en runtime — las páginas tienen su propio markup copiado) o navbar.
- No agregar botones sin página destino (anti-patrón I11).

### 8. Validar
- Abrir la página en http://localhost:3000/pages/<pagina>.html: consola sin errores, CSS aplicado, navegación funciona.
- `npm test` (por si el cambio tocó algo del backend).

## Patrones de UI existentes para reutilizar
- Skeleton loading (ver feed), estados vacíos con CTA contextual, estados de error con botón retry, avatares con inicial y color HSL determinístico, nombres amigables de estados de trabajo, paginación contra `{ data, total, page, limit }`.
