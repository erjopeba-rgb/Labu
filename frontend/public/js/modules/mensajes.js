/**
 * mensajes.js
 * Modulo de chat y mensajes - Labu
 */

let conversaciones = [];
let conversacionActiva = null;
let usuarioActual = null;
let socket = null;
let typingTimeout = null;

function _spinnerHtml(msg) {
    return '<div style="text-align:center;padding:3rem;color:var(--gray);">' +
        '<style>.rt-spin{animation:rt-spin 0.8s linear infinite}@keyframes rt-spin{to{transform:rotate(360deg)}}</style>' +
        '<div class="rt-spin" style="width:36px;height:36px;border:3px solid #e0e0e0;border-top-color:var(--primary,#3b82f6);border-radius:50%;margin:0 auto 1rem;"></div>' +
        '<p>' + (msg || 'Cargando...') + '</p></div>';
}

function _errorHtml(msg) {
    return '<div style="text-align:center;padding:3rem;color:var(--danger,#ef4444);">' +
        '<div style="font-size:2.5rem;margin-bottom:0.5rem;">&#9888;</div>' +
        '<p style="margin-bottom:1rem;">' + (msg || 'Ocurri&#243; un error inesperado.') + '</p>' +
        '<button onclick="location.reload()" style="padding:0.6rem 1.5rem;background:var(--primary,#3b82f6);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:0.95rem;">Reintentar</button>' +
        '</div>';
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '/index.html';
        return;
    }
    usuarioActual = Auth.getUser();
    mostrarVistaLista(); // en móvil arranca mostrando la lista de conversaciones
    await cargarConversaciones();
    iniciarSocket();
    setupInputListeners();
    await manejarQueryParams();
});

// ─── VISTA MÓVIL (lista ↔ chat) ────────────────────────────────────────────────
// Las clases mobile-show/mobile-hide solo tienen efecto en ≤768px (media query en
// mensajes.css); en desktop son inertes y ambos paneles quedan visibles.

function mostrarVistaLista() {
    const sidebar = document.querySelector('.conversations-sidebar');
    const chat = document.querySelector('.chat-area');
    if (sidebar) sidebar.classList.add('mobile-show');
    if (chat) chat.classList.add('mobile-hide');
}

function mostrarVistaChat() {
    const sidebar = document.querySelector('.conversations-sidebar');
    const chat = document.querySelector('.chat-area');
    if (sidebar) sidebar.classList.remove('mobile-show');
    if (chat) chat.classList.remove('mobile-hide');
}

function volverAListaConversaciones() {
    mostrarVistaLista();
}

// ─── SOCKET ───────────────────────────────────────────────────────────────────

function iniciarSocket() {
    if (typeof io === 'undefined') return;
    socket = io({ auth: { token: Auth.getToken() } });

    socket.on('nuevo_mensaje', function (msg) {
        if (conversacionActiva && msg.conversacion_id === conversacionActiva) {
            agregarMensajeAlChat(msg);
            scrollAlFinal();
        }
        actualizarPreviewConversacion(msg);
    });

    socket.on('usuario_escribiendo', function (data) {
        if (conversacionActiva && data.conversacionId === conversacionActiva) {
            mostrarTyping(true);
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(function () { mostrarTyping(false); }, 3000);
        }
    });

    socket.on('usuario_dejo_escribir', function (data) {
        if (conversacionActiva && data.conversacionId === conversacionActiva) {
            mostrarTyping(false);
        }
    });

    socket.on('connect_error', function (err) {
        console.warn('Socket error:', err.message);
    });
}

function unirseAConversacion(convId) {
    if (socket) socket.emit('join_conversacion', convId);
}

// ─── CONVERSACIONES ──────────────────────────────────────────────────────────

async function cargarConversaciones() {
    const lista = document.getElementById('conversacionesList');
    if (lista) lista.innerHTML = _spinnerHtml('Cargando conversaciones...');
    try {
        const data = await App.apiRequest('/chat');
        conversaciones = Array.isArray(data) ? data : (data.conversaciones || []);
        renderConversaciones();
    } catch (err) {
        console.error('Error cargando conversaciones:', err);
        if (lista) lista.innerHTML = _errorHtml('No se pudieron cargar las conversaciones.');
    }
}

function renderConversaciones() {
    const lista = document.getElementById('conversacionesList');

    if (conversaciones.length === 0) {
        lista.innerHTML = '<div class="empty-state">Sin conversaciones a&#250;n</div>';
        return;
    }

    lista.innerHTML = conversaciones.map(function (c) {
        const otros = c.otros_participantes || [];
        const nombre = otros.length > 0 && otros[0].nombre
            ? otros[0].nombre
            : 'Usuario';
        const iniciales = nombre.substring(0, 2).toUpperCase();
        const noLeidos = parseInt(c.no_leidos) || 0;
        const preview = c.ultimo_mensaje || 'Sin mensajes';
        const tiempo = c.ultimo_mensaje_en ? App.timeAgo(c.ultimo_mensaje_en) : '';

        return '<div class="conversation-item" data-id="' + c.id + '" onclick="abrirConversacion(' + c.id + ')">' +
            '<div class="conversation-avatar">' + iniciales + '</div>' +
            '<div class="conversation-info">' +
                '<div class="conversation-header">' +
                    '<div class="conversation-name">' + nombre + '</div>' +
                    '<div class="conversation-time">' + tiempo + '</div>' +
                '</div>' +
                '<div class="conversation-preview">' +
                    '<span class="preview-text' + (noLeidos > 0 ? ' unread' : '') + '">' + preview + '</span>' +
                    (noLeidos > 0 ? '<span class="unread-badge">' + noLeidos + '</span>' : '') +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('');
}

async function abrirConversacion(convId) {
    conversacionActiva = convId;

    document.querySelectorAll('.conversation-item').forEach(function (el) {
        el.classList.toggle('active', parseInt(el.dataset.id) === convId);
    });

    const conv = conversaciones.find(function (c) { return c.id === convId; });
    if (conv) {
        const otros = conv.otros_participantes || [];
        const nombre = otros.length > 0 && otros[0].nombre ? otros[0].nombre : 'Usuario';
        const iniciales = nombre.substring(0, 2).toUpperCase();
        renderChatHeader(nombre, iniciales);
    }

    unirseAConversacion(convId);
    mostrarVistaChat(); // en móvil, pasar de la lista al panel de chat
    await cargarMensajes(convId);
    document.getElementById('chatInput').focus();
}

// ─── MENSAJES ─────────────────────────────────────────────────────────────────

async function cargarMensajes(convId) {
    const area = document.getElementById('messagesArea');
    area.innerHTML = _spinnerHtml('Cargando mensajes...');
    try {
        const data = await App.apiRequest('/chat/' + convId + '/mensajes');
        if (!data || data.error || data.success === false) {
            area.innerHTML = _errorHtml(data && data.error || 'No se pudieron cargar los mensajes.');
            return;
        }
        const mensajes = Array.isArray(data) ? data : (data.mensajes || []);
        renderMensajes(mensajes);
        scrollAlFinal();
    } catch (err) {
        console.error(err);
        area.innerHTML = _errorHtml('No se pudieron cargar los mensajes. Intent&#225; de nuevo.');
    }
}

function renderMensajes(mensajes) {
    const area = document.getElementById('messagesArea');

    if (mensajes.length === 0) {
        area.innerHTML = '<div class="empty-state">Inicien la conversaci&#243;n</div>';
        return;
    }

    area.innerHTML = mensajes.map(function (m) {
        const esMio = m.remitente_id === usuarioActual.id;
        const iniciales = m.remitente_nombre
            ? m.remitente_nombre.substring(0, 2).toUpperCase()
            : '??';
        const hora = new Date(m.creado_en).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

        return '<div class="message' + (esMio ? ' sent' : '') + '">' +
            '<div class="message-avatar">' + iniciales + '</div>' +
            '<div class="message-content">' +
                '<div class="message-bubble">' + escapeHtml(m.contenido) + '</div>' +
                '<span class="message-time">' + hora + '</span>' +
            '</div>' +
        '</div>';
    }).join('');
}

function agregarMensajeAlChat(msg) {
    const area = document.getElementById('messagesArea');
    const esMio = msg.remitente_id === usuarioActual.id;
    const iniciales = msg.remitente_nombre
        ? msg.remitente_nombre.substring(0, 2).toUpperCase()
        : '??';
    const hora = new Date(msg.creado_en).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    const div = document.createElement('div');
    div.className = 'message' + (esMio ? ' sent' : '');
    div.innerHTML =
        '<div class="message-avatar">' + iniciales + '</div>' +
        '<div class="message-content">' +
            '<div class="message-bubble">' + escapeHtml(msg.contenido) + '</div>' +
            '<span class="message-time">' + hora + '</span>' +
        '</div>';

    const typing = document.getElementById('typingIndicator');
    if (typing) {
        area.insertBefore(div, typing);
    } else {
        area.appendChild(div);
    }
}

async function enviarMensaje() {
    if (!conversacionActiva) return;

    const input = document.getElementById('chatInput');
    const contenido = input.value.trim();
    if (!contenido) return;

    const btn = document.getElementById('btnEnviar');
    btn.disabled = true;

    try {
        const msg = await App.apiRequest('/chat/' + conversacionActiva + '/mensajes', {
            method: 'POST',
            body: JSON.stringify({ contenido, tipo: 'texto' })
        });

        if (msg && msg.id) {
            agregarMensajeAlChat({ ...msg, remitente_nombre: usuarioActual.nombre || 'Yo' });
            scrollAlFinal();
            actualizarPreviewConversacion(msg);
            input.value = '';
            input.style.height = 'auto';
        } else {
            const errMsg = (msg && msg.error) || 'No se pudo enviar el mensaje';
            console.error('Error enviando mensaje:', errMsg, msg);
            App.showNotification(errMsg, 'error');
        }

    } catch (err) {
        console.error('Error enviando mensaje:', err);
        App.showNotification('Error al enviar mensaje', 'error');
    } finally {
        btn.disabled = false;
        input.focus();
    }
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────────

function renderChatHeader(nombre, iniciales) {
    document.getElementById('chatHeader').style.display = 'flex';
    document.getElementById('emptyChatPlaceholder').style.display = 'none';
    document.getElementById('chatHeaderAvatar').textContent = iniciales;
    document.getElementById('chatHeaderNombre').textContent = nombre;
}

function actualizarPreviewConversacion(msg) {
    const item = document.querySelector('.conversation-item[data-id="' + msg.conversacion_id + '"]');
    if (!item) return;
    const preview = item.querySelector('.preview-text');
    if (preview) preview.textContent = msg.contenido;
}

function mostrarTyping(show) {
    const el = document.getElementById('typingIndicator');
    if (el) el.style.display = show ? 'flex' : 'none';
}

function scrollAlFinal() {
    const area = document.getElementById('messagesArea');
    area.scrollTop = area.scrollHeight;
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function setupInputListeners() {
    const input = document.getElementById('chatInput');
    if (!input) return;

    input.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';

        if (socket && conversacionActiva) {
            socket.emit('typing', { conversacionId: conversacionActiva });
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(function () {
                if (socket) socket.emit('stop_typing', { conversacionId: conversacionActiva });
            }, 2000);
        }
    });

    input.addEventListener('keypress', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            enviarMensaje();
        }
    });
}

// ─── QUERY PARAMS ─────────────────────────────────────────────────────────────

async function manejarQueryParams() {
    const params = new URLSearchParams(window.location.search);

    // ?conversacion=<id> → abrir conversacion directamente
    const convId = parseInt(params.get('conversacion'));
    if (convId) {
        await abrirConversacion(convId);
        return;
    }

    // ?trabajo=<jobId> → crear/obtener conversacion de tipo trabajo (igual que "Preguntar" en feed)
    const trabajoId = parseInt(params.get('trabajo'));
    if (trabajoId) {
        try {
            const jobData = await App.apiRequest('/jobs/' + trabajoId);
            const job = jobData && (jobData.job || jobData);
            const duenioId = job && job.dueno_id;
            if (!duenioId) {
                console.error('No se pudo obtener dueno_id del trabajo', trabajoId);
                return;
            }
            const data = await App.apiRequest('/chat', {
                method: 'POST',
                body: JSON.stringify({ tipo: 'trabajo', referencia_id: trabajoId, participantes: [duenioId] })
            });
            if (data && data.conversacion_id) {
                await cargarConversaciones();
                await abrirConversacion(data.conversacion_id);
            }
        } catch (err) {
            console.error('Error abriendo chat de trabajo:', err);
        }
        return;
    }

    // ?contacto=<userId> → crear/obtener conversacion directa con ese usuario
    const contactoId = parseInt(params.get('contacto'));
    if (contactoId) {
        try {
            const data = await App.apiRequest('/chat', {
                method: 'POST',
                body: JSON.stringify({ tipo: 'directo', participantes: [contactoId] })
            });
            if (data && data.conversacion_id) {
                await cargarConversaciones();
                await abrirConversacion(data.conversacion_id);
            }
        } catch (err) {
            console.error('Error creando conversacion:', err);
        }
    }
}

function filtrarConversaciones(query) {
    const items = document.querySelectorAll('.conversation-item');
    items.forEach(function (item) {
        const nombre = item.querySelector('.conversation-name').textContent.toLowerCase();
        item.style.display = nombre.includes(query.toLowerCase()) ? '' : 'none';
    });
}

window.abrirConversacion             = abrirConversacion;
window.enviarMensaje                 = enviarMensaje;
window.filtrarConversaciones         = filtrarConversaciones;
window.volverAListaConversaciones    = volverAListaConversaciones;
