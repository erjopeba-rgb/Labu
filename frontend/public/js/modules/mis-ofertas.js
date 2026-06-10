/**
 * mis-ofertas.js
 * Módulo de gestión de ofertas enviadas por el trabajador - Labu
 * Cubre pasos 2, 3b, 3c del flujo desde la perspectiva del trabajador.
 */

let todasLasOfertas = [];

function _spinnerHtml(msg) {
    return '<div style="text-align:center;padding:3rem;color:var(--gray);">' +
        '<style>.rt-spin{animation:rt-spin 0.8s linear infinite}@keyframes rt-spin{to{transform:rotate(360deg)}}</style>' +
        '<div class="rt-spin" style="width:36px;height:36px;border:3px solid #e0e0e0;border-top-color:var(--primary,#3b82f6);border-radius:50%;margin:0 auto 1rem;"></div>' +
        '<p>' + (msg || 'Cargando...') + '</p></div>';
}

function _errorHtml(msg) {
    return '<div style="text-align:center;padding:3rem;color:var(--danger,#ef4444);">' +
        '<div style="font-size:2.5rem;margin-bottom:0.5rem;">&#9888;</div>' +
        '<p style="margin-bottom:1.5rem;">' + (msg || 'Ocurrió un error inesperado.') + '</p>' +
        '<button onclick="location.reload()" style="padding:0.6rem 1.5rem;background:var(--primary,#3b82f6);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:0.95rem;">Reintentar</button>' +
        '</div>';
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) { window.location.href = '/index.html'; return; }
    await cargarOfertas();
});

async function cargarOfertas() {
    const lista = document.getElementById('offersList');
    if (lista) lista.innerHTML = _spinnerHtml('Cargando ofertas...');
    try {
        const data = await App.apiRequest('/offers/mis-ofertas');
        if (data.success) {
            todasLasOfertas = data.data;
            actualizarStats();
            renderOfertas(todasLasOfertas);
        } else {
            if (lista) lista.innerHTML = _errorHtml(data.error || 'No se pudieron cargar las ofertas.');
        }
    } catch (err) {
        console.error('Error cargando ofertas:', err);
        if (lista) lista.innerHTML = _errorHtml('Error de conexión. Verificá tu internet y recargá la página.');
    }
}

function actualizarStats() {
    document.getElementById('stat-total').textContent     = todasLasOfertas.length;
    document.getElementById('stat-pendiente').textContent = todasLasOfertas.filter(o => o.estado === 'pendiente').length;
    document.getElementById('stat-aceptada').textContent  = todasLasOfertas.filter(o => ['aceptada','pendiente_confirmacion'].includes(o.estado)).length;
    document.getElementById('stat-rechazada').textContent = todasLasOfertas.filter(o => o.estado === 'rechazada').length;
}

function filtrar(estado, el) {
    document.querySelectorAll('.filter-tab, .stat-card').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('[data-filter="' + estado + '"]').forEach(e => e.classList.add('active'));
    const filtradas = estado === 'todas'
        ? todasLasOfertas
        : estado === 'aceptada'
        ? todasLasOfertas.filter(o => ['aceptada','pendiente_confirmacion'].includes(o.estado))
        : todasLasOfertas.filter(o => o.estado === estado);
    renderOfertas(filtradas);
}

function renderOfertas(ofertas) {
    const lista = document.getElementById('offersList');
    if (ofertas.length === 0) {
        lista.innerHTML =
            '<div class="empty-state">' +
                '<div class="empty-icon">&#128203;</div>' +
                '<h3>No hay ofertas en esta categoría</h3>' +
                '<p>Buscá trabajos en el feed y enviá tu primera oferta</p>' +
            '</div>';
        return;
    }
    lista.innerHTML = ofertas.map(o => renderOfertaCard(o)).join('');
}

function _parseUrls(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val); } catch (e) { return []; }
}

function renderOfertaCard(o) {
    const estadoLabels = {
        pendiente:               '&#9203; Pendiente',
        aceptada:                '&#9989; Aceptada',
        rechazada:               '&#10060; Rechazada',
        contraoferta:            '&#8617; Contraoferta del dueño',
        cancelada:               '&#10006; Cancelada',
        pendiente_confirmacion:  '&#9203; Esperando confirmación del dueño'
    };

    const tiempo = o.tiempo_estimado
        ? o.tiempo_estimado + ' ' + (o.unidad_tiempo || 'días')
        : 'No especificado';

    const fotos = _parseUrls(o.trabajo_fotos_urls || o.fotos_urls);
    const thumbHtml = fotos.length
        ? '<div style="width:64px;height:64px;border-radius:var(--radius);overflow:hidden;flex-shrink:0;">' +
          '<img src="' + fotos[0] + '" alt="foto" style="width:100%;height:100%;object-fit:cover;display:block;"></div>'
        : '';

    // Alertas contextuales
    let alertaHtml = '';
    if (o.estado === 'pendiente_confirmacion') {
        alertaHtml = '<div class="alert-box" style="background:#fef9c3;border-color:#facc15;color:#854d0e;">&#9203; Foto enviada. El dueño debe confirmar para cerrar el trabajo.</div>';
    } else if (o.estado === 'aceptada') {
        alertaHtml = '<div class="alert-box alert-success">&#127881; ¡Tu oferta fue aceptada! Recibirás una notificación con el horario asignado.</div>';
    } else if (o.estado === 'rechazada') {
        alertaHtml = '<div class="alert-box alert-danger">&#10060; Esta oferta fue rechazada por el cliente.</div>';
    } else if (o.estado === 'contraoferta') {
        const msgContra = o.mensaje_contraoferta
            ? '<div class="contraoferta-msg">"' + o.mensaje_contraoferta + '"</div>'
            : '';
        alertaHtml =
            '<div class="contraoferta-box">' +
                '<strong>&#8617; El dueño hizo una contraoferta:</strong> $' + Number(o.monto_contraoferta).toLocaleString('es-AR') +
                msgContra +
            '</div>';
    }

    // Botones según estado
    const btnCancelar = o.estado === 'pendiente'
        ? '<button class="btn btn-danger" onclick="cancelarOferta(' + o.id + ')">&#128465; Cancelar Oferta</button>'
        : '';

    // Paso 3c: Trabajador responde a contraoferta
    const btnContraoferta = o.estado === 'contraoferta'
        ? '<button class="btn btn-primary" onclick="aceptarContraoferta(' + o.id + ')">&#10003; Aceptar Contraoferta</button>' +
          '<button class="btn btn-danger" onclick="rechazarContraoferta(' + o.id + ')">&#10007; Rechazar Contraoferta</button>'
        : '';

    const msgHtml = o.mensaje
        ? '<div class="offer-message">"' + o.mensaje + '"</div>'
        : '';

    const duenoCombinado = o.dueno_nombre
        ? (o.dueno_nombre + (o.dueno_apellido ? ' ' + o.dueno_apellido : '')).trim()
        : 'Dueño';
    const duenoCursivo = o.dueno_id
        ? '<span style="cursor:pointer;color:var(--primary,#3b82f6);" onclick="window.location.href=\'/pages/perfil-publico.html?id=' + o.dueno_id + '\'">' + duenoCombinado + '</span>'
        : duenoCombinado;

    return '<div class="offer-card ' + o.estado + '">' +
        '<div class="offer-header">' +
            '<div style="display:flex;gap:0.75rem;align-items:flex-start;flex:1;min-width:0;">' +
            thumbHtml +
            '<div style="flex:1;min-width:0;">' +
                '<div class="offer-job-title">' + (o.trabajo_titulo || 'Trabajo') + '</div>' +
                '<div class="offer-meta">&#128100; ' + duenoCursivo + '</div>' +
                '<div class="offer-meta">&#128205; ' + (o.trabajo_ciudad || 'Sin ubicación') + '</div>' +
                '<div class="offer-meta">&#128336; Enviada ' + App.timeAgo(o.creado_en) + '</div>' +
            '</div>' +
            '</div>' +
            '<div class="offer-status status-' + o.estado + '">' + (estadoLabels[o.estado] || o.estado) + '</div>' +
        '</div>' +
        '<div class="offer-body">' +
            alertaHtml +
            '<div class="offer-details-grid">' +
                '<div class="detail-item">' +
                    '<span class="detail-icon">&#128176;</span>' +
                    '<div><div class="detail-label">Tu oferta</div>' +
                    '<div class="detail-value amount">$' + Number(o.monto_propuesto).toLocaleString('es-AR') + '</div></div>' +
                '</div>' +
                '<div class="detail-item">' +
                    '<span class="detail-icon">&#9203;</span>' +
                    '<div><div class="detail-label">Tiempo estimado</div>' +
                    '<div class="detail-value">' + tiempo + '</div></div>' +
                '</div>' +
            '</div>' +
            msgHtml +
            '<div class="offer-actions">' +
                '<button class="btn btn-secondary" onclick="window.location.href=\'/pages/feed.html\'">&#128203; Ver Feed</button>' +
                btnCancelar +
                btnContraoferta +
            '</div>' +
        '</div>' +
    '</div>';
}

// ── ACCIONES ──────────────────────────────────────────────────────────────────

async function cancelarOferta(ofertaId) {
    if (!confirm('¿Cancelar esta oferta?')) return;
    try {
        const data = await App.apiRequest('/offers/' + ofertaId + '/cancel', { method: 'PATCH' });
        if (data.success) {
            await cargarOfertas();
        } else {
            App.showNotification(data.error || 'Error al cancelar', 'error');
        }
    } catch (err) {
        App.showNotification('Error de conexión', 'error');
    }
}

// Paso 3c: Trabajador acepta contraoferta del dueño → sistema asigna horario automáticamente
async function aceptarContraoferta(ofertaId) {
    if (!confirm('¿Aceptás la contraoferta?')) return;
    try {
        const data = await App.apiRequest('/offers/' + ofertaId + '/accept-counter', { method: 'PATCH' });
        if (data.success) {
            const cuando = data.data && data.data.cuando;
            if (cuando) {
                App.showNotification('&#9989; Contraoferta aceptada. Horario asignado: ' + cuando, 'success');
            } else {
                App.showNotification('&#9989; Contraoferta aceptada. El horario se asignará automáticamente — recibirás una notificación.', 'success');
            }
            await cargarOfertas();
        } else {
            App.showNotification(data.error || 'Error', 'error');
        }
    } catch (err) {
        App.showNotification('Error de conexión', 'error');
    }
}

// Paso 3c: Trabajador rechaza contraoferta del dueño → dueño recibe notif
async function rechazarContraoferta(ofertaId) {
    if (!confirm('¿Rechazás la contraoferta? La negociación terminará.')) return;
    try {
        const data = await App.apiRequest('/offers/' + ofertaId + '/reject-counter', { method: 'PATCH' });
        if (data.success) {
            App.showNotification('Contraoferta rechazada', 'success');
            await cargarOfertas();
        } else {
            App.showNotification(data.error || 'Error', 'error');
        }
    } catch (err) {
        App.showNotification('Error de conexión', 'error');
    }
}

window.filtrar              = filtrar;
window.cancelarOferta       = cancelarOferta;
window.aceptarContraoferta  = aceptarContraoferta;
window.rechazarContraoferta = rechazarContraoferta;
