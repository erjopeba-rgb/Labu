(function () {

    /* ── Estado en memoria ─────────────────────────────────── */
    var _notifs = [];
    var _msgs   = [];

    /* ── Avatar inicial ────────────────────────────────────── */
    function updateNavAvatar() {
        if (typeof Auth === 'undefined' || !Auth.isAuthenticated()) return;
        const user = Auth.getUser();
        if (!user) return;
        const avatarEl = document.getElementById('navAvatar');
        if (avatarEl) avatarEl.textContent = (user.nombre || user.email || '?')[0].toUpperCase();
    }

    /* ── Helpers de tiempo ─────────────────────────────────── */
    function timeAgo(dateStr) {
        const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
        if (diff < 60)    return 'ahora';
        if (diff < 3600)  return Math.floor(diff / 60) + ' min';
        if (diff < 86400) return Math.floor(diff / 3600) + ' h';
        return Math.floor(diff / 86400) + 'd';
    }

    /* ── Ícono según tipo de notificación ──────────────────── */
    var NOTIF_ICONS = {
        oferta:      '&#128184;',
        mensaje:     '&#128172;',
        trabajo:     '&#128736;',
        calificacion:'&#11088;',
        sistema:     '&#128276;',
        pago:        '&#128181;',
    };
    function notifIcon(tipo) {
        return NOTIF_ICONS[tipo] || NOTIF_ICONS.sistema;
    }

    /* ── Badge ─────────────────────────────────────────────── */
    function updateBadge(id, count) {
        const badge = document.getElementById(id);
        if (!badge) return;
        if (count > 0) {
            badge.textContent = count > 9 ? '9+' : count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    /* ── Marcar notificación como leída ────────────────────── */
    function markNotifRead(idx) {
        if (!_notifs[idx] || _notifs[idx].leida) return;
        _notifs[idx].leida = true;
        const item = document.querySelector('#dropdownNotifList .nav-dd-item[data-idx="' + idx + '"]');
        if (item) item.classList.remove('unread');
        const dot = item && item.querySelector('.nav-dd-dot');
        if (dot) dot.style.display = 'none';
        updateBadge('notification-badge', _notifs.filter(function(n) { return !n.leida; }).length);
        if (typeof App !== 'undefined' && App.apiRequest && _notifs[idx].id) {
            App.apiRequest('/notifications/' + _notifs[idx].id + '/leer', { method: 'PATCH' }).catch(function() {});
        }
    }

    /* ── Marcar mensaje como leído ─────────────────────────── */
    function markMsgRead(idx) {
        if (!_msgs[idx] || _msgs[idx].no_leidos === 0) return;
        _msgs[idx].no_leidos = 0;
        const item = document.querySelector('#dropdownMsgList .nav-dd-item[data-idx="' + idx + '"]');
        if (item) item.classList.remove('unread');
        const dot = item && item.querySelector('.nav-dd-dot');
        if (dot) dot.style.display = 'none';
        updateBadge('message-badge', _msgs.filter(function(m) { return m.no_leidos > 0; }).length);
        // No se requiere llamada extra — mensajes.js marca como leído al abrir la conversación
    }

    /* ── Render notificaciones ─────────────────────────────── */
    function renderNotifications(items) {
        _notifs = items;
        const list = document.getElementById('dropdownNotifList');
        if (!list) return;
        if (!items || items.length === 0) {
            list.innerHTML = '<div class="nav-dropdown-empty">No tenés notificaciones nuevas</div>';
            return;
        }
        list.innerHTML = items.slice(0, 5).map(function(n, i) {
            const unread = !n.leida ? 'unread' : '';
            const icon   = notifIcon(n.tipo);
            const texto  = n.mensaje || n.titulo || 'Notificación';
            return '<div class="nav-dd-item ' + unread + '" data-idx="' + i + '">' +
                '<div class="nav-dd-icon">' + icon + '</div>' +
                '<div class="nav-dd-body">' +
                    '<div class="nav-dd-text">' + texto + '</div>' +
                    '<div class="nav-dd-time">' + timeAgo(n.creado_en || n.created_at || new Date()) + '</div>' +
                '</div>' +
                '<div class="nav-dd-dot"></div>' +
            '</div>';
        }).join('');

        list.onclick = function(e) {
            const item = e.target.closest('.nav-dd-item');
            if (!item) return;
            const idx = parseInt(item.getAttribute('data-idx'), 10);
            const notif = _notifs[idx];
            if (!notif) return;
            closeAllDropdowns();
            if (window.NotifModal) {
                markNotifRead(idx);
                NotifModal.open(notif);
            } else {
                markNotifRead(idx);
                window.location.href = '/pages/notificaciones.html';
            }
        };

        updateBadge('notification-badge', items.filter(function(n) { return !n.leida; }).length);
    }

    /* ── Render mensajes ───────────────────────────────────── */
    function renderMessages(items) {
        _msgs = items;
        const list = document.getElementById('dropdownMsgList');
        if (!list) return;
        if (!items || items.length === 0) {
            list.innerHTML = '<div class="nav-dropdown-empty">Sin mensajes nuevos</div>';
            return;
        }
        list.innerHTML = items.slice(0, 5).map(function(m, i) {
            const unread  = (m.no_leidos > 0) ? 'unread' : '';
            // Soporta tanto items de API real como demo data
            const otros   = m.otros_participantes;
            const nombre  = (otros && otros[0] && otros[0].nombre)
                ? otros[0].nombre
                : (m.nombre || 'Usuario');
            const inicial = nombre[0].toUpperCase();
            const texto   = m.ultimo_mensaje || m.texto || 'Nuevo mensaje';
            return '<div class="nav-dd-item ' + unread + '" data-idx="' + i + '">' +
                '<div class="nav-dd-avatar">' + inicial + '</div>' +
                '<div class="nav-dd-body">' +
                    '<div class="nav-dd-text"><strong>' + nombre + ':</strong> ' + texto + '</div>' +
                    '<div class="nav-dd-time">' + timeAgo(m.ultimo_mensaje_en || m.creado_en || m.fecha || new Date()) + '</div>' +
                '</div>' +
                '<div class="nav-dd-dot"></div>' +
            '</div>';
        }).join('');

        list.onclick = function(e) {
            const item = e.target.closest('.nav-dd-item');
            if (!item) return;
            const idx    = parseInt(item.getAttribute('data-idx'), 10);
            markMsgRead(idx);
            const conv        = _msgs[idx];
            const convId      = conv.id || conv.conversacion_id;
            const otros       = conv.otros_participantes;
            const nombre      = (otros && otros[0] && otros[0].nombre) ? otros[0].nombre : (conv.nombre || 'Usuario');
            const otroUserId  = (otros && otros[0] && otros[0].id) ? otros[0].id : null;

            closeAllDropdowns();

            if (typeof FloatingChat !== 'undefined' && convId) {
                FloatingChat.open(convId, nombre, null, otroUserId);
            } else {
                window.location.href = convId
                    ? '/pages/mensajes.html?conversacion=' + convId
                    : '/pages/mensajes.html';
            }
        };

        updateBadge('message-badge', items.filter(function(m) { return m.no_leidos > 0; }).length);
    }

    /* ── Toggle dropdown ───────────────────────────────────── */
    function toggleDropdown(btnId, dropId, loadFn) {
        const btn  = document.getElementById(btnId);
        const drop = document.getElementById(dropId);
        console.log('toggleDropdown:', btnId, '→ btn:', btn, 'drop:', drop);
        if (!btn || !drop) return;
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            console.log('click en', btnId);
            const isOpen = drop.classList.contains('open');
            closeAllDropdowns();
            if (!isOpen) {
                drop.classList.add('open');
                loadFn();
            }
        });
    }

    function closeAllDropdowns() {
        document.querySelectorAll('.nav-dropdown.open').forEach(function(d) {
            d.classList.remove('open');
        });
    }

    /* ── Cargar datos (API con fallback a demo) ────────────── */
    function loadNotifications() {
        if (typeof App === 'undefined' || !App.apiRequest) {
            renderNotifications([]);
            return;
        }
        App.apiRequest('/notifications').then(function(data) {
            console.log('NOTIF RAW:', JSON.stringify(data));
            const items = Array.isArray(data) ? data : (data.data || data.notificaciones || data.items || []);
            console.log('NOTIF ITEMS:', items, 'length:', items ? items.length : 'null');
            renderNotifications(items);
        }).catch(function(err) {
            console.log('NOTIF ERROR:', err);
            renderNotifications([]);
        });
    }

    function loadMessages() {
        if (typeof App === 'undefined' || !App.apiRequest) {
            renderMessages([]);
            return;
        }
        App.apiRequest('/messages').then(function(data) {
            const items = Array.isArray(data) ? data : (data.conversaciones || data.items || []);
            renderMessages(items);
        }).catch(function() {
            renderMessages([]);
        });
    }

    /* ── Toggle de perfil activo ───────────────────────────── */
    var MODOS = {
        dueno:     { label: 'Dueño',      icon: '&#127968;' },
        trabajador:{ label: 'Trabajador', icon: '&#128736;' }
    };

    function initPerfilToggle() {
        if (typeof Auth === 'undefined' || !Auth.isAuthenticated()) return;
        var user = Auth.getUser();
        if (!user) return;

        var modoActivo = user.perfil_activo || user.tipo_perfil;
        var toggleEl   = document.getElementById('navPerfilToggle');
        var labelEl    = document.getElementById('navModoLabel');
        var iconEl     = document.getElementById('navModoIcon');
        if (!toggleEl) return;

        // Mostrar el toggle solo si aplica
        var infoActivo = MODOS[modoActivo];
        if (!infoActivo) return;
        if (iconEl)  iconEl.innerHTML  = infoActivo.icon;
        if (labelEl) labelEl.textContent = infoActivo.label;
        toggleEl.style.display = 'flex';
        toggleEl.title = 'Modo actual: ' + infoActivo.label + '. Click para cambiar.';

        toggleEl.addEventListener('click', function () {
            if (toggleEl.classList.contains('loading')) return;
            var nuevoModo = modoActivo === 'dueno' ? 'trabajador' : 'dueno';
            cambiarPerfilActivo(nuevoModo);
        });
    }

    function cambiarPerfilActivo(nuevoPerfil) {
        var toggleEl = document.getElementById('navPerfilToggle');
        if (toggleEl) toggleEl.classList.add('loading');

        var token = typeof Auth !== 'undefined' ? Auth.getToken() : null;
        if (!token) return;

        fetch('/api/auth/cambiar-perfil', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ nuevo_perfil: nuevoPerfil })
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            if (data.error) {
                if (toggleEl) toggleEl.classList.remove('loading');
                alert('No se pudo cambiar el perfil: ' + data.error);
                return;
            }

            // Actualizar token y datos en localStorage
            if (typeof Auth !== 'undefined') {
                Auth.updateToken(data.token, data.usuario);
            }

            // Mensaje de primera vez
            if (data.primer_vez) {
                var labelNuevo = MODOS[nuevoPerfil] ? MODOS[nuevoPerfil].label : nuevoPerfil;
                var msg = 'Activando modo ' + labelNuevo + ' por primera vez.\n' +
                    'Completá tu perfil para poder ' +
                    (nuevoPerfil === 'trabajador' ? 'ofertar en trabajos.' : 'publicar trabajos.');
                // Guardar mensaje en sessionStorage para mostrarlo al cargar la página
                sessionStorage.setItem('perfil_primer_vez_msg', msg);
            }

            window.location.reload();
        })
        .catch(function () {
            if (toggleEl) toggleEl.classList.remove('loading');
            alert('Error de conexión al cambiar el perfil.');
        });
    }

    /* ── Init ──────────────────────────────────────────────── */
    function init() {
        updateNavAvatar();
        initPerfilToggle();
        toggleDropdown('navNotifBtn', 'dropdownNotif', loadNotifications);
        toggleDropdown('navMsgBtn',   'dropdownMsg',   loadMessages);

        // Mostrar mensaje de primera vez si corresponde
        var primerVezMsg = sessionStorage.getItem('perfil_primer_vez_msg');
        if (primerVezMsg) {
            sessionStorage.removeItem('perfil_primer_vez_msg');
            // Mostrar como toast no bloqueante
            setTimeout(function () { mostrarToastPrimerVez(primerVezMsg); }, 500);
        }

        document.addEventListener('click', function(e) {
            if (!e.target.closest('.nav-icon-dropdown')) closeAllDropdowns();
        });
    }

    function mostrarToastPrimerVez(mensaje) {
        var toast = document.createElement('div');
        toast.style.cssText = [
            'position:fixed', 'bottom:1.5rem', 'left:50%', 'transform:translateX(-50%)',
            'background:#1e293b', 'color:#fff', 'padding:0.85rem 1.25rem',
            'border-radius:10px', 'font-size:0.875rem', 'max-width:360px',
            'box-shadow:0 4px 20px rgba(0,0,0,0.25)', 'z-index:99999',
            'line-height:1.4', 'text-align:center', 'animation:dropdownIn 0.2s ease'
        ].join(';');
        toast.textContent = mensaje;
        document.body.appendChild(toast);
        setTimeout(function () {
            toast.style.transition = 'opacity 0.3s';
            toast.style.opacity = '0';
            setTimeout(function () { toast.remove(); }, 350);
        }, 5000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
