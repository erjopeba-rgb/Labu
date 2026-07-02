/**
 * FloatingChat — Labu
 * Chat flotante multi-ventana estilo Facebook.
 *
 * API pública:
 *   FloatingChat.open(conversacionId, nombre, inicial?)
 *   FloatingChat.openWithUser(userId, nombre, jobId?)
 */
const FloatingChat = (function () {
    'use strict';

    const W   = 320;   // ancho de cada ventana (px)
    const GAP = 8;     // margen entre ventanas y borde
    const MAX = 3;     // máximo de ventanas simultáneas

    var _windows     = {};   // convId(string) → { el, minimized, nombre, inicial, otroUserId }
    var _windowOrder = [];   // convIds en orden de apertura
    var _socket      = null;
    var _renderedIds = {};   // convId → Set de msg.id ya renderizados (evita duplicados)

    /* ── Utilidades ──────────────────────────────────────────── */

    function _token() {
        return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    }

    function _currentUserId() {
        if (typeof Auth === 'undefined') return null;
        var u = Auth.getUser();
        return u ? String(u.id) : null;
    }

    function _esc(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function _timeAgo(dateStr) {
        var diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
        if (diff < 60)    return 'ahora';
        if (diff < 3600)  return Math.floor(diff / 60) + 'm';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h';
        return Math.floor(diff / 86400) + 'd';
    }

    function _api(endpoint, options) {
        if (typeof App !== 'undefined' && App.apiRequest) {
            return App.apiRequest(endpoint, options || {});
        }
        options = options || {};
        var headers = Object.assign({
            'Content-Type':  'application/json',
            'Authorization': 'Bearer ' + _token()
        }, options.headers || {});
        return fetch('/api' + endpoint, Object.assign({}, options, { headers: headers }))
            .then(function (r) { return r.json(); });
    }

    /* ── Socket.io ───────────────────────────────────────────── */

    function _connectSocket() {
        if (_socket && (_socket.connected || _socket.connecting)) return;
        if (typeof io === 'undefined') {
            return;
        }
        var token = _token();
        if (!token) {
            return;
        }

        _socket = io(window.location.origin, {
            auth: { token: token },
            transports: ['websocket', 'polling']
        });

        _socket.on('connect', function () {
            // Unirse a todas las salas de conversaciones abiertas
            _windowOrder.forEach(function (cid) {
                _socket.emit('join_conversacion', parseInt(cid));
            });
        });

        _socket.on('connect_error', function (err) {
            console.error('[FloatingChat] socket connect_error:', err.message);
        });

        _socket.on('disconnect', function () {});

        _socket.on('nuevo_mensaje', function (msg) {
            var cid = String(msg.conversacion_id);
            if (!_windows[cid]) {
                return;
            }
            _appendMessage(cid, msg);
            if (_windows[cid].minimized) {
                _windows[cid].el.querySelector('.fc-header').classList.add('fc-has-new');
            }
        });

        _socket.on('usuario_escribiendo', function (data) {
            var cid = String(data.conversacionId);
            if (_windows[cid] && String(data.usuarioId) !== _currentUserId()) {
                var ti = _windows[cid].el.querySelector('.fc-typing');
                if (ti) ti.style.display = 'block';
            }
        });

        _socket.on('usuario_dejo_escribir', function (data) {
            var cid = String(data.conversacionId);
            if (_windows[cid]) {
                var ti = _windows[cid].el.querySelector('.fc-typing');
                if (ti) ti.style.display = 'none';
            }
        });
    }

    function _joinConversacion(cid) {
        if (_socket && _socket.connected) {
            _socket.emit('join_conversacion', parseInt(cid));
        }
    }

    /* ── Posicionamiento ─────────────────────────────────────── */

    function _reposition() {
        _windowOrder.forEach(function (cid, i) {
            if (_windows[cid]) {
                _windows[cid].el.style.right = (GAP + i * (W + GAP)) + 'px';
            }
        });
    }

    /* ── Mensajes ────────────────────────────────────────────── */

    function _appendMessage(cid, msg) {
        var w = _windows[cid];
        if (!w) return;

        // Deduplicar por ID para evitar que socket y REST muestren el mismo mensaje doble
        if (msg.id) {
            if (!_renderedIds[cid]) _renderedIds[cid] = {};
            if (_renderedIds[cid][msg.id]) {
                return;
            }
            _renderedIds[cid][msg.id] = true;
        }

        var area = w.el.querySelector('.fc-messages');
        if (!area) return;

        var isSent = String(msg.remitente_id) === _currentUserId();
        var div = document.createElement('div');
        div.className = 'fc-bubble ' + (isSent ? 'fc-sent' : 'fc-received');
        div.innerHTML =
            '<span class="fc-bubble-text">' + _esc(msg.contenido) + '</span>' +
            '<span class="fc-bubble-time">' + _timeAgo(msg.creado_en || new Date().toISOString()) + '</span>';
        area.appendChild(div);
        area.scrollTop = area.scrollHeight;
    }

    async function _loadMessages(cid) {
        var w = _windows[cid];
        if (!w) return;

        var area = w.el.querySelector('.fc-messages');
        if (!area) return;

        area.innerHTML = '<div class="fc-status-msg">Cargando mensajes\u2026</div>';
        // Limpiar IDs rendereados al recargar
        _renderedIds[cid] = {};

        var data;
        try {
            data = await _api('/chat/' + cid + '/mensajes?limit=40');
        } catch (e) {
            console.error('[FloatingChat] _loadMessages error de red:', e);
            area.innerHTML = '<div class="fc-status-msg">Error de conexi\u00f3n.</div>';
            return;
        }

        if (!data || data.error) {
            console.error('[FloatingChat] _loadMessages API error:', data && data.error);
            area.innerHTML = '<div class="fc-status-msg">No se pudieron cargar los mensajes.</div>';
            return;
        }

        var msgs = Array.isArray(data) ? data : (data.mensajes || data.items || []);

        area.innerHTML = '';

        if (msgs.length === 0) {
            area.innerHTML = '<div class="fc-status-msg">\u00a1Empez\u00e1 la conversaci\u00f3n!</div>';
            return;
        }

        msgs.forEach(function (msg) { _appendMessage(cid, msg); });
        area.scrollTop = area.scrollHeight;
    }

    /* ── Enviar ──────────────────────────────────────────────── */

    function _sendMessage(cid) {
        var w = _windows[cid];
        if (!w) return;
        var input = w.el.querySelector('.fc-input');
        var texto = input.value.trim();
        if (!texto) return;
        input.value = '';

        if (_socket && _socket.connected) {
            _socket.emit('mensaje', {
                conversacionId: parseInt(cid),
                contenido:      texto,
                tipo:           'texto'
            }, function (res) {
                if (res && res.ok && res.mensaje) {
                    // Mostrar el mensaje inmediatamente desde el ACK
                    // (nuevo_mensaje lo deduplicará si también llega por socket)
                    _appendMessage(cid, res.mensaje);
                } else if (!res || !res.ok) {
                    _sendRest(cid, texto);
                }
            });
        } else {
            _sendRest(cid, texto);
        }
    }

    async function _sendRest(cid, texto) {
        try {
            var data = await _api('/chat/' + cid + '/mensajes', {
                method: 'POST',
                body:   JSON.stringify({ contenido: texto, tipo: 'texto' })
            });
            if (!data || data.error) {
                console.error('[FloatingChat] _sendRest error:', data && data.error);
                return;
            }
            var msg = data.mensaje ? data.mensaje : data;
            if (!msg.remitente_id) msg.remitente_id = _currentUserId();
            if (!msg.creado_en)    msg.creado_en    = new Date().toISOString();
            if (!msg.contenido)    msg.contenido    = texto;
            _appendMessage(cid, msg);
        } catch (e) {
            console.error('[FloatingChat] _sendRest error de red:', e);
        }
    }

    /* ── Minimizar / Cerrar ──────────────────────────────────── */

    function _toggleMinimize(cid) {
        var w = _windows[cid];
        if (!w) return;
        w.minimized = !w.minimized;
        var body   = w.el.querySelector('.fc-body');
        var btnMin = w.el.querySelector('.fc-btn-min');
        if (w.minimized) {
            body.style.display = 'none';
            btnMin.innerHTML   = '&#43;';
        } else {
            body.style.display = '';
            btnMin.innerHTML   = '&#8722;';
            w.el.querySelector('.fc-header').classList.remove('fc-has-new');
            var msgs = w.el.querySelector('.fc-messages');
            if (msgs) msgs.scrollTop = msgs.scrollHeight;
        }
    }

    function _close(cid) {
        var w = _windows[cid];
        if (!w) return;
        if (_socket && _socket.connected) _socket.emit('leave_conversacion', parseInt(cid));
        w.el.remove();
        delete _windows[cid];
        delete _renderedIds[cid];
        var i = _windowOrder.indexOf(cid);
        if (i > -1) _windowOrder.splice(i, 1);
        _reposition();
    }

    /* ── Crear ventana DOM ───────────────────────────────────── */

    function _createWindow(cid, nombre, inicial) {
        var el = document.createElement('div');
        el.className = 'fc-window';
        el.id        = 'fc-' + cid;
        el.setAttribute('data-conv-id', cid);

        el.innerHTML =
            '<div class="fc-header">' +
                '<div class="fc-avatar">' + _esc(inicial) + '</div>' +
                '<div class="fc-name">' + _esc(nombre) + '</div>' +
                '<div class="fc-header-btns">' +
                    '<button class="fc-btn-expand" title="Abrir en Mensajes">&#8599;</button>' +
                    '<button class="fc-btn-min" title="Minimizar">&#8722;</button>' +
                    '<button class="fc-btn-close" title="Cerrar">&#10005;</button>' +
                '</div>' +
            '</div>' +
            '<div class="fc-body">' +
                '<div class="fc-messages"></div>' +
                '<div class="fc-typing" style="display:none">escribiendo&#8230;</div>' +
                '<div class="fc-input-row">' +
                    '<input class="fc-input" type="text" placeholder="Escrib\u00e1 un mensaje\u2026" autocomplete="off">' +
                    '<button class="fc-btn-send" title="Enviar">&#10148;</button>' +
                '</div>' +
            '</div>';

        el.querySelector('.fc-header').addEventListener('click', function () {
            _toggleMinimize(cid);
        });
        el.querySelector('.fc-name').addEventListener('click', function (e) {
            e.stopPropagation();
            var w = _windows[cid];
            console.log('[FloatingChat] fc-name clicked, otroUserId:', w && w.otroUserId);
            if (w && w.otroUserId) {
                window.location.href = '/pages/perfil-publico.html?id=' + w.otroUserId;
            }
        });
        el.querySelector('.fc-btn-expand').addEventListener('click', function (e) {
            e.stopPropagation();
            window.location.href = '/pages/mensajes.html?conversacion=' + cid;
        });
        el.querySelector('.fc-btn-min').addEventListener('click', function (e) {
            e.stopPropagation();
            _toggleMinimize(cid);
        });
        el.querySelector('.fc-btn-close').addEventListener('click', function (e) {
            e.stopPropagation();
            _close(cid);
        });
        el.querySelector('.fc-btn-send').addEventListener('click', function (e) {
            e.stopPropagation();
            _sendMessage(cid);
        });
        el.querySelector('.fc-input').addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                _sendMessage(cid);
            }
            e.stopPropagation();
        });
        el.querySelector('.fc-input-row').addEventListener('click', function (e) {
            e.stopPropagation();
        });

        var typingTimer;
        el.querySelector('.fc-input').addEventListener('input', function () {
            if (_socket && _socket.connected) {
                _socket.emit('typing', { conversacionId: parseInt(cid) });
                clearTimeout(typingTimer);
                typingTimer = setTimeout(function () {
                    if (_socket && _socket.connected)
                        _socket.emit('stop_typing', { conversacionId: parseInt(cid) });
                }, 1500);
            }
        });

        document.body.appendChild(el);
        return el;
    }

    /* ── API Pública ─────────────────────────────────────────── */

    /**
     * Abre (o enfoca si ya está abierto) un chat flotante para una conversación existente.
     * @param {number|string} convId
     * @param {string}        nombre
     * @param {string}        [inicial]
     * @param {number|string} [otroUserId]
     */
    async function open(convId, nombre, inicial, otroUserId) {
        convId  = String(convId);
        nombre  = nombre  || 'Usuario';
        inicial = ((inicial || nombre[0] || '?')).toUpperCase();

        // Si ya está abierto: restaurar y enfocar
        if (_windows[convId]) {
            if (_windows[convId].minimized) _toggleMinimize(convId);
            var _nuevoId = otroUserId != null && otroUserId !== '' && String(otroUserId) !== '0' ? String(otroUserId) : null;
            if (_nuevoId && !_windows[convId].otroUserId) {
                _windows[convId].otroUserId = _nuevoId;
            }
            _windows[convId].el.querySelector('.fc-input').focus();
            return;
        }

        // Cerrar el más antiguo si se llegó al límite
        while (_windowOrder.length >= MAX) {
            _close(_windowOrder[0]);
        }

        // Conectar socket (si no está conectado)
        _connectSocket();

        // Crear ventana y registrar ANTES de hacer join
        var el = _createWindow(convId, nombre, inicial);
        var _idParaGuardar = otroUserId != null && otroUserId !== '' && String(otroUserId) !== '0' ? String(otroUserId) : null;
        console.log('[FloatingChat] open() creando ventana → convId:', convId, 'otroUserId recibido:', otroUserId, '→ guardado:', _idParaGuardar);
        _windows[convId]  = { el: el, minimized: false, nombre: nombre, inicial: inicial, otroUserId: _idParaGuardar };
        _windowOrder.push(convId);
        _reposition();

        // Unirse a la sala de conversación
        _joinConversacion(convId);

        // Cargar mensajes históricos
        await _loadMessages(convId);
        el.querySelector('.fc-input').focus();
    }

    /**
     * Crea o encuentra una conversación con un usuario y luego abre el chat flotante.
     * @param {number|string} userId
     * @param {string}        nombre
     * @param {number|string} [jobId]
     */
    async function openWithUser(userId, nombre, jobId) {
        try {
            var miId = parseInt(_currentUserId());
            var body = jobId
                ? { tipo: 'trabajo',  referencia_id: parseInt(jobId), participantes: [miId, parseInt(userId)] }
                : { tipo: 'directo',  participantes: [miId, parseInt(userId)] };

            var data = await _api('/chat', {
                method: 'POST',
                body:   JSON.stringify(body)
            });

            if (data && data.conversacion_id) {
                await open(data.conversacion_id, nombre, null, userId);
            } else {
                console.error('[FloatingChat] openWithUser: sin conversacion_id en respuesta', data);
            }
        } catch (e) {
            console.error('[FloatingChat] openWithUser error:', e);
        }
    }

    return { open: open, openWithUser: openWithUser };
})();

window.FloatingChat = FloatingChat;
