/**
 * notificaciones.js
 * Modulo de notificaciones - Labu
 */

let todasLasNotificaciones = [];
let filtroActual = 'todas';

// Tipos agrupados por categoría para los filtros
const TIPOS_OFERTA = [
    'oferta', 'oferta_recibida', 'oferta_aceptada', 'oferta_rechazada',
    'contraoferta_recibida', 'contraoferta_rechazada', 'contraoferta_aceptada'
];
const TIPOS_TRABAJO = [
    'trabajo', 'horario_elegido', 'agenda_confirmada', 'horario_confirmado',
    'horario_auto_asignado', 'sin_disponibilidad', 'trabajador_llego',
    'llegada_confirmada', 'resultado_subido', 'trabajo_completado_pendiente',
    'trabajo_finalizado', 'pedir_calificacion', 'disputa_abierta', 'disputa_resuelta'
];
const TIPOS_PAGO = ['pago', 'pago_pendiente'];

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '/index.html';
        return;
    }
    await cargarNotificaciones();
});

async function cargarNotificaciones() {
    try {
        const data = await App.apiRequest('/chat/notificaciones');
        todasLasNotificaciones = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        renderFiltros();
        renderNotificaciones(todasLasNotificaciones);
    } catch (err) {
        console.error('Error cargando notificaciones:', err);
    }
}

// Determina si una notificación pertenece a una categoría de filtro
function _esCategoria(notif, categoria) {
    const tipo = notif.tipo || '';
    const esOferta  = TIPOS_OFERTA.includes(tipo) || tipo.includes('oferta') || tipo.includes('contraoferta');
    const esTrabajo = TIPOS_TRABAJO.includes(tipo);
    const esPago    = TIPOS_PAGO.includes(tipo);
    switch (categoria) {
        case 'oferta':  return esOferta;
        case 'trabajo': return esTrabajo;
        case 'pago':    return esPago;
        case 'sistema': return !esOferta && !esTrabajo && !esPago;
        default:        return true;
    }
}

function renderFiltros() {
    const total    = todasLasNotificaciones.length;
    const noLeidas = todasLasNotificaciones.filter(function (n) { return !n.leida; }).length;

    const counts = {
        oferta:  todasLasNotificaciones.filter(function (n) { return _esCategoria(n, 'oferta');  }).length,
        trabajo: todasLasNotificaciones.filter(function (n) { return _esCategoria(n, 'trabajo'); }).length,
        pago:    todasLasNotificaciones.filter(function (n) { return _esCategoria(n, 'pago');    }).length,
        sistema: todasLasNotificaciones.filter(function (n) { return _esCategoria(n, 'sistema'); }).length
    };

    document.getElementById('tab-todas').textContent   = 'Todas (' + total + ')';
    document.getElementById('tab-oferta').textContent  = 'Ofertas (' + counts.oferta + ')';
    document.getElementById('tab-trabajo').textContent = 'Trabajos (' + counts.trabajo + ')';
    document.getElementById('tab-pago').textContent    = 'Pagos (' + counts.pago + ')';
    document.getElementById('tab-sistema').textContent = 'Sistema (' + counts.sistema + ')';

    // Deshabilitar botón cuando no hay notificaciones sin leer
    var btn = document.getElementById('btnMarcarTodas');
    if (btn) btn.disabled = noLeidas === 0;

    // Contador en h1 y en el tab del navegador
    var counter = document.getElementById('contadorNoLeidas');
    if (counter) {
        if (noLeidas > 0) {
            counter.textContent = noLeidas;
            counter.style.display = '';
        } else {
            counter.style.display = 'none';
        }
    }
    document.title = noLeidas > 0
        ? '(' + noLeidas + ') Labu - Notificaciones'
        : 'Labu - Notificaciones';
}

function filtrar(tipo, el) {
    filtroActual = tipo;
    document.querySelectorAll('.filter-tab').forEach(function (t) { t.classList.remove('active'); });
    el.classList.add('active');

    var filtradas;
    if (tipo === 'todas') {
        filtradas = todasLasNotificaciones;
    } else {
        filtradas = todasLasNotificaciones.filter(function (n) { return _esCategoria(n, tipo); });
    }
    renderNotificaciones(filtradas);
}

function renderNotificaciones(notificaciones) {
    const lista = document.getElementById('notificationsList');

    if (notificaciones.length === 0) {
        lista.innerHTML =
            '<div class="empty-state">' +
                '<div class="empty-icon">&#128276;</div>' +
                '<h3>No hay notificaciones</h3>' +
                '<p>Cuando recibas actividad aparecer&#225; aqu&#237;</p>' +
            '</div>';
        return;
    }

    const iconMap = {
        oferta:            { clase: 'icon-oferta',   emoji: '&#128176;' },
        mensaje:           { clase: 'icon-mensaje',  emoji: '&#128172;' },
        pago:              { clase: 'icon-pago',     emoji: '&#128181;' },
        resena:            { clase: 'icon-resena',   emoji: '&#11088;'  },
        trabajo:           { clase: 'icon-trabajo',  emoji: '&#128203;' },
        sistema:           { clase: 'icon-sistema',  emoji: '&#128276;' },
        solicitud_amistad: { clase: 'icon-contacto', emoji: '&#128101;' }
    };

    // Agrupar por fecha: Hoy / Esta semana (últimos 7 días) / Anterior
    const grupos = {};
    const ordenGrupos = ['Hoy', 'Esta semana', 'Anterior'];
    notificaciones.forEach(function (n) {
        const fecha    = new Date(n.creado_en);
        const hoy      = new Date();
        const hace7    = new Date(hoy); hace7.setDate(hoy.getDate() - 7);
        let grupo;
        if (fecha.toDateString() === hoy.toDateString()) {
            grupo = 'Hoy';
        } else if (fecha > hace7) {
            grupo = 'Esta semana';
        } else {
            grupo = 'Anterior';
        }
        if (!grupos[grupo]) grupos[grupo] = [];
        grupos[grupo].push(n);
    });

    let html = '';
    ordenGrupos.filter(function (g) { return grupos[g]; }).forEach(function (titulo) {
        const items = grupos[titulo];
        html += '<div class="date-divider">' + titulo + '</div>';
        items.forEach(function (n) {
            // Buscar ícono por tipo específico o por categoría
            let icono = iconMap[n.tipo];
            if (!icono) {
                if (_esCategoria(n, 'oferta'))  icono = iconMap.oferta;
                else if (_esCategoria(n, 'trabajo')) icono = iconMap.trabajo;
                else if (_esCategoria(n, 'pago'))    icono = iconMap.pago;
                else icono = iconMap.sistema;
            }
            const unread = !n.leida ? ' unread' : '';
            const indicator = !n.leida ? '<div class="unread-indicator"></div>' : '';

            // Botones inline para solicitudes de amistad pendientes
            var accionesHtml = '';
            if (n.tipo === 'solicitud_amistad' && n.referencia_id && !n.leida) {
                accionesHtml =
                    '<div class="notif-acciones" style="display:flex;gap:0.5rem;margin-top:0.5rem;" onclick="event.stopPropagation()">' +
                        '<button class="btn btn-primary" style="padding:0.3rem 0.9rem;font-size:0.82rem;" ' +
                                'onclick="responderSolicitud(' + n.id + ',' + n.referencia_id + ',\'aceptar\')">&#10003; Aceptar</button>' +
                        '<button class="btn btn-secondary" style="padding:0.3rem 0.9rem;font-size:0.82rem;" ' +
                                'onclick="responderSolicitud(' + n.id + ',' + n.referencia_id + ',\'rechazar\')">&#10005; Rechazar</button>' +
                    '</div>';
            }

            html +=
                '<div class="notification-item' + unread + '" id="notif-' + n.id + '" onclick="marcarLeida(' + n.id + ')">' +
                    '<div class="notification-icon ' + icono.clase + '">' + icono.emoji + '</div>' +
                    '<div class="notification-content">' +
                        '<div class="notification-header">' +
                            '<div>' +
                                '<div class="notification-title">' + (n.titulo || 'Notificaci&#243;n') + '</div>' +
                                '<div class="notification-time">' + App.timeAgo(n.creado_en) + '</div>' +
                            '</div>' +
                            indicator +
                        '</div>' +
                        '<div class="notification-message">' + (n.mensaje || '') + '</div>' +
                        accionesHtml +
                    '</div>' +
                '</div>';
        });
    });

    lista.innerHTML = html;
}

const tipoRedireccion = {
    // Categorías genéricas (fallback)
    oferta:  'mis-ofertas-laborales',
    mensaje: 'mensajes',
    trabajo: 'mis-trabajos',
    // Tipos específicos de oferta (el dueño ve en mis-ofertas-laborales; el trabajador en mis-trabajos)
    oferta_recibida:         'mis-ofertas-laborales',
    oferta_aceptada:         'mis-trabajos',
    oferta_rechazada:        'mis-ofertas-laborales',
    contraoferta_recibida:   'mis-ofertas-laborales',
    contraoferta_rechazada:  'mis-ofertas-laborales',
    contraoferta_aceptada:   'mis-trabajos',
    // Agendamiento
    horario_elegido:         'mis-trabajos',
    agenda_confirmada:       'mis-trabajos',
    horario_confirmado:      'mis-trabajos',
    horario_auto_asignado:   'mis-trabajos',
    sin_disponibilidad:      'mis-trabajos',
    // Flujo del trabajo
    trabajador_llego:        'mis-trabajos',
    llegada_confirmada:      'mis-trabajos',
    resultado_subido:        'mis-trabajos',
    trabajo_completado_pendiente: 'mis-trabajos',
    trabajo_finalizado:      'mis-trabajos',
    pedir_calificacion:      'mis-trabajos',
    // Pagos
    pago_pendiente:          'mis-trabajos',
    // Disputas
    disputa_abierta:         'mis-trabajos',
    disputa_resuelta:        'mis-trabajos',
    // Mensajes
    mensaje_nuevo:           'mensajes'
};

async function marcarLeida(id) {
    const notif = todasLasNotificaciones.find(function (n) { return n.id === id; });
    const item = document.getElementById('notif-' + id);

    try {
        if (item && item.classList.contains('unread')) {
            await App.apiRequest('/chat/notificaciones/' + id + '/leer', { method: 'PATCH' });
            // Animación de transición a leída
            item.classList.add('marking-read');
            setTimeout(function () {
                item.classList.remove('unread', 'marking-read');
                const indicator = item.querySelector('.unread-indicator');
                if (indicator) indicator.remove();
            }, 350);
            if (notif) notif.leida = true;
            renderFiltros();
        }
    } catch (err) {
        console.error('Error marcando leida:', err);
    }

    if (!notif) return;

    // Abrir modal contextual si está disponible; si no, navegar al contexto correcto
    if (window.NotifModal) {
        NotifModal.open(notif);
    } else if (tipoRedireccion[notif.tipo]) {
        App.navigateTo(tipoRedireccion[notif.tipo]);
    }
}

async function marcarTodasLeidas() {
    var btn = document.getElementById('btnMarcarTodas');
    var textoOriginal = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Marcando...';
    }
    try {
        await App.apiRequest('/chat/notificaciones/leer-todas', { method: 'PATCH' });
        todasLasNotificaciones.forEach(function (n) { n.leida = true; });
        renderFiltros();
        // Re-renderizar respetando el filtro activo
        var filtradas = filtroActual === 'todas'
            ? todasLasNotificaciones
            : todasLasNotificaciones.filter(function (n) { return _esCategoria(n, filtroActual); });
        renderNotificaciones(filtradas);
        App.showNotification('Todas las notificaciones marcadas como le&#237;das', 'success');
    } catch (err) {
        console.error('Error:', err);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = textoOriginal;
        }
    }
}

async function responderSolicitud(notifId, relacionId, accion) {
    const contenedor = document.querySelector('#notif-' + notifId + ' .notif-acciones');
    if (contenedor) contenedor.innerHTML = '<span style="font-size:0.82rem;color:var(--gray);">Procesando...</span>';

    try {
        const endpoint = accion === 'aceptar'
            ? '/contactos/' + relacionId + '/aceptar'
            : '/contactos/' + relacionId + '/rechazar';

        await App.apiRequest(endpoint, { method: 'PATCH' });

        const msg = accion === 'aceptar' ? '&#128101; Solicitud aceptada' : '&#10005; Solicitud rechazada';
        if (contenedor) contenedor.innerHTML = '<span style="font-size:0.82rem;color:var(--gray);">' + msg + '</span>';

        // Marcar la notificacion como leida en la UI
        const item = document.getElementById('notif-' + notifId);
        if (item) item.classList.remove('unread');
        const notif = todasLasNotificaciones.find(function (n) { return n.id === notifId; });
        if (notif) notif.leida = true;
        renderFiltros();

        App.showNotification(
            accion === 'aceptar' ? 'Solicitud aceptada. Ahora son amigos.' : 'Solicitud rechazada.',
            'success'
        );
    } catch (err) {
        console.error('Error respondiendo solicitud:', err);
        if (contenedor) contenedor.innerHTML = '<span style="color:var(--danger,#ef4444);font-size:0.82rem;">Error. Intent&#225; de nuevo.</span>';
        App.showNotification('Ocurrio un error. Intenta de nuevo.', 'error');
    }
}

window.filtrar             = filtrar;
window.marcarLeida         = marcarLeida;
window.marcarTodasLeidas   = marcarTodasLeidas;
window.responderSolicitud  = responderSolicitud;
