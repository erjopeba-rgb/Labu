/**
 * mobile-nav.js — Labu
 * Navegación móvil: botón hamburguesa + drawer lateral con el menú completo.
 *
 * Autocontenido: construye su propio markup y navega por window.location,
 * así funciona en cualquier página (tenga o no el sidebar-left inline) sin
 * depender de main.js. Solo se activa si el usuario está autenticado y solo
 * es visible en viewport ≤1200px (donde el sidebar-left se oculta por CSS).
 *
 * El filtrado por rol replica el de feed.js: un ítem con `role` se muestra
 * solo si coincide con el perfil activo (perfil_activo || tipo_perfil).
 */
(function () {

    // Menú principal — espejo de components/sidebar-left.html + "Mi Perfil".
    // role: undefined = visible para ambos perfiles.
    var MENU = [
        { icon: '&#127968;', label: 'Feed',                  url: '/pages/feed.html' },
        { icon: '&#128736;', label: 'Publicar Trabajo',      url: '/pages/publicar-trabajo.html',      role: 'dueno' },
        { icon: '&#128188;', label: 'Mis Ofertas Laborales', url: '/pages/mis-ofertas-laborales.html', role: 'dueno' },
        { icon: '&#128736;', label: 'Mis Trabajos',          url: '/pages/mis-trabajos.html',          role: 'trabajador' },
        { icon: '&#128203;', label: 'Mis Ofertas',           url: '/pages/mis-ofertas.html',           role: 'trabajador' },
        { icon: '&#129309;', label: 'Mis Ayudantes',         url: '/pages/ayudantes.html',             role: 'trabajador' },
        { icon: '&#128176;', label: 'Mis Pagos',             url: '/pages/mis-pagos.html',             role: 'trabajador' },
        { icon: '&#128172;', label: 'Mensajes',              url: '/pages/mensajes.html' },
        { icon: '&#128197;', label: 'Agenda',                url: '/pages/agenda.html' },
        { icon: '&#128218;', label: 'Catálogo',         url: '/pages/catalogo.html' },
        { icon: '&#128269;', label: 'Búsqueda',         url: '/pages/busqueda-avanzada.html' },
        { icon: '&#128100;', label: 'Mi Perfil',             url: '/pages/mi-perfil.html' },
        { icon: '&#9881;&#65039;', label: 'Configuración', url: '/pages/configuracion.html' },
        { icon: '&#128682;', label: 'Cerrar Sesión',    action: 'logout' }
    ];

    function rolActivo() {
        if (typeof Auth === 'undefined' || !Auth.getUser) return null;
        var user = Auth.getUser();
        if (!user) return null;
        return user.perfil_activo || user.tipo_perfil || null;
    }

    // Marca la página actual para resaltar el ítem activo.
    function esActual(url) {
        if (!url) return false;
        return window.location.pathname.indexOf(url) !== -1;
    }

    function construirMenu() {
        var rol = rolActivo();
        return MENU.filter(function (item) {
            return !item.role || item.role === rol;
        }).map(function (item) {
            var attrs = item.action
                ? ' data-action="' + item.action + '"'
                : ' data-url="' + item.url + '"';
            var activa = esActual(item.url) ? ' active' : '';
            var logout = item.action === 'logout' ? ' mobile-drawer-logout' : '';
            return '<button type="button" class="mobile-drawer-item' + activa + logout + '"' + attrs + '>' +
                '<span class="mobile-drawer-icon">' + item.icon + '</span>' +
                '<span class="mobile-drawer-label">' + item.label + '</span>' +
            '</button>';
        }).join('');
    }

    function abrir() {
        var overlay = document.getElementById('mobileNavOverlay');
        var drawer  = document.getElementById('mobileNavDrawer');
        if (!overlay || !drawer) return;
        // Reconstruir por si cambió el perfil activo sin recargar.
        var list = drawer.querySelector('.mobile-drawer-list');
        if (list) list.innerHTML = construirMenu();
        overlay.classList.add('open');
        drawer.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function cerrar() {
        var overlay = document.getElementById('mobileNavOverlay');
        var drawer  = document.getElementById('mobileNavDrawer');
        if (overlay) overlay.classList.remove('open');
        if (drawer)  drawer.classList.remove('open');
        document.body.style.overflow = '';
    }

    function onItemClick(e) {
        var item = e.target.closest('.mobile-drawer-item');
        if (!item) return;
        if (item.getAttribute('data-action') === 'logout') {
            cerrar();
            if (typeof Auth !== 'undefined' && Auth.logout) {
                Auth.logout();
            } else {
                window.location.href = '/index.html';
            }
            return;
        }
        var url = item.getAttribute('data-url');
        if (url) {
            cerrar();
            window.location.href = url;
        }
    }

    function inyectarBoton() {
        // El botón vive dentro del navbar si existe; si no, flota arriba a la izquierda.
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'mobileNavToggle';
        btn.className = 'mobile-nav-toggle';
        btn.setAttribute('aria-label', 'Abrir menú');
        btn.innerHTML = '&#9776;'; // ☰
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            abrir();
        });

        var navContent = document.querySelector('.navbar-content');
        if (navContent) {
            btn.classList.add('in-navbar');
            navContent.insertBefore(btn, navContent.firstChild);
        } else {
            btn.classList.add('floating');
            document.body.appendChild(btn);
        }
    }

    function inyectarDrawer() {
        var overlay = document.createElement('div');
        overlay.id = 'mobileNavOverlay';
        overlay.className = 'mobile-nav-overlay';
        overlay.addEventListener('click', cerrar);

        var drawer = document.createElement('aside');
        drawer.id = 'mobileNavDrawer';
        drawer.className = 'mobile-nav-drawer';
        drawer.innerHTML =
            '<div class="mobile-drawer-header">' +
                '<span class="mobile-drawer-brand">Labu</span>' +
                '<button type="button" class="mobile-drawer-close" aria-label="Cerrar menú">&#10005;</button>' +
            '</div>' +
            '<nav class="mobile-drawer-list">' + construirMenu() + '</nav>';

        drawer.querySelector('.mobile-drawer-close').addEventListener('click', cerrar);
        drawer.querySelector('.mobile-drawer-list').addEventListener('click', onItemClick);

        document.body.appendChild(overlay);
        document.body.appendChild(drawer);
    }

    function inyectarEstilos() {
        if (document.querySelector('link[href="/css/mobile-nav.css"]')) return;
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/css/mobile-nav.css';
        document.head.appendChild(link);
    }

    function init() {
        // Solo para usuarios autenticados.
        if (typeof Auth === 'undefined' || !Auth.isAuthenticated || !Auth.isAuthenticated()) return;
        // Evitar doble init si el script se carga dos veces.
        if (document.getElementById('mobileNavToggle')) return;

        inyectarEstilos();
        inyectarBoton();
        inyectarDrawer();

        // Unificación de navegación (B-1): el feed es la única página con
        // .sidebar-left (menú de escritorio). El resto no tiene menú en desktop,
        // así que ahí el drawer pasa a ser también la navegación de escritorio
        // (la hamburguesa deja de ocultarse en ≥1201px). Ver mobile-nav.css.
        if (!document.querySelector('.sidebar-left')) {
            document.body.classList.add('has-desktop-nav');
        }

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') cerrar();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
