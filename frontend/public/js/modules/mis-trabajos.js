let todosLosTrabajos = [];
let filtroActual = 'todos';
let modoDesarrollo = false;

// Estado del formulario MP inline
let mpInstance = null;
let _mpCardField = null;
let _mpExpiryField = null;
let _mpCvvField = null;
let _mpFieldsMounted = false;
let _mpPaymentMethodId = null;
let _mpOfertaYaAceptada = false;
let _montoActual = 0;

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) { window.location.href = '/index.html'; return; }
    try {
        const cfg = await App.apiRequest('/pagos/config');
        modoDesarrollo = cfg && cfg.dev_mode === true;
        if (cfg && cfg.mp_public_key) {
            inicializarMPSdk(cfg.mp_public_key);
        } else {
            _mpSdkFailed();
        }
    } catch (_) {
        _mpSdkFailed();
    }
    await cargarTrabajos();
});

function inicializarMPSdk(publicKey) {
    try {
        mpInstance = new MercadoPago(publicKey, { locale: 'es-AR' });
        montarCamposMP();
    } catch (_) {
        _mpSdkFailed();
    }
}

function montarCamposMP() {
    if (!mpInstance) { _mpSdkFailed(); return; }
    try {
        _mpCardField = mpInstance.fields.create('cardNumber', { placeholder: '1234 5678 9012 3456' });
        _mpExpiryField = mpInstance.fields.create('expirationDate', { placeholder: 'MM/AA' });
        _mpCvvField = mpInstance.fields.create('securityCode', { placeholder: 'CVV' });

        _mpCardField.mount('mp-card-number');
        _mpExpiryField.mount('mp-expiration-date');
        _mpCvvField.mount('mp-security-code');

        _mpCardField.on('binChange', async ({ bin }) => {
            if (!bin) { _mpPaymentMethodId = null; return; }
            try {
                const { results } = await mpInstance.getPaymentMethods({ bin });
                _mpPaymentMethodId = results && results.length > 0 ? results[0].id : null;
            } catch (_) { _mpPaymentMethodId = null; }
        });

        _mpFieldsMounted = true;
        document.getElementById('mpSdkLoading').style.display = 'none';
        document.getElementById('mpCardForm').style.display = 'block';
    } catch (_) {
        _mpSdkFailed();
    }
}

function _mpSdkFailed() {
    const loading = document.getElementById('mpSdkLoading');
    const fallback = document.getElementById('mpFallback');
    const btnConfirm = document.getElementById('btnConfirmPago');
    if (loading) loading.style.display = 'none';
    if (fallback) fallback.style.display = 'block';
    if (btnConfirm) btnConfirm.style.display = '';
}

function _emailFromToken() {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    if (!token) return '';
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.email || '';
    } catch (_) { return ''; }
}

async function cargarTrabajos() {
    const grid = document.getElementById('jobsGrid');
    if (grid) grid.innerHTML = _spinnerHtml('Cargando trabajos...');
    try {
        const data = await App.apiRequest('/jobs/mis-trabajos');
        if (data.success) {
            todosLosTrabajos = data.data;
            renderJobs(todosLosTrabajos);
        } else {
            if (grid) grid.innerHTML = _errorHtml(data.error || 'No se pudieron cargar los trabajos.');
        }
    } catch (err) {
        console.error('Error cargando trabajos:', err);
        if (grid) grid.innerHTML = _errorHtml('No pudimos cargar la información. Verificá tu conexión.', 'cargarTrabajos');
    }
}

function filtrar(estado, el) {
    filtroActual = estado;
    _activarFiltroTab(estado);
    const filtrados = estado === 'todos'
        ? todosLosTrabajos
        : estado === 'finalizado'
        ? todosLosTrabajos.filter(j => j.estado === 'completado')
        : todosLosTrabajos.filter(j => j.estado === estado);
    renderJobs(filtrados);
}

function renderJobs(jobs) {
    const grid = document.getElementById('jobsGrid');
    if (jobs.length === 0) {
        const esTodos = filtroActual === 'todos';
        grid.innerHTML =
            '<div class="empty-state" style="grid-column:1/-1;">' +
                '<div class="empty-icon">&#128188;</div>' +
                (esTodos
                    ? '<h3>No publicaste ning\u00FAn trabajo todav\u00EDa</h3>' +
                      '<p>Public\u00E1 tu primer trabajo y empez\u00E1 a recibir ofertas de trabajadores</p>' +
                      '<button class="btn-action btn-action-primary" style="margin-top:1rem;" onclick="window.location.href=\'/pages/publicar-trabajo.html\'">Publicar trabajo</button>'
                    : '<h3>No hay trabajos en esta categor\u00EDa</h3>' +
                      '<p>Prob\u00E1 ver todos los trabajos</p>'
                ) +
            '</div>';
        return;
    }
    grid.innerHTML = jobs.map(job => renderJobCard(job)).join('');
}

function renderJobCard(job) {
    const estadoLabels = {
        publicado:               '&#128269; Buscando trabajador',
        en_negociacion:          '&#128197; Horario confirmado',
        en_curso:                '&#128260; En Curso',
        trabajador_llego:        '&#128663; Trabajador en camino',
        pendiente_confirmacion:  '&#9203; Esperando tu confirmaci\u00F3n',
        completado:              '&#9989; Trabajo finalizado',
        cancelado:               '&#10060; Cancelado'
    };

    const presupuesto = job.presupuesto_min
        ? '$' + Number(job.presupuesto_min).toLocaleString('es-AR')
        : 'A convenir';

    const urgente = job.es_urgente
        ? '<span class="urgency-badge">&#9889; Urgente</span>'
        : '';

    const fotos = (() => {
        if (!job.fotos_urls) return [];
        if (Array.isArray(job.fotos_urls)) return job.fotos_urls;
        try { return JSON.parse(job.fotos_urls); } catch (e) { return []; }
    })();
    const thumbHtml = fotos.length
        ? '<div style="width:72px;height:72px;border-radius:var(--radius);overflow:hidden;flex-shrink:0;"><img src="' + fotos[0] + '" alt="foto" style="width:100%;height:100%;object-fit:cover;display:block;"></div>'
        : '';

    // Botones según estado
    const btnOfertas = job.total_ofertas > 0 && ['publicado', 'en_negociacion'].includes(job.estado)
        ? (job.estado === 'en_negociacion'
            ? '<button class="btn-action btn-action-secondary" onclick="verOfertas(' + job.id + ')">&#128203; Ver ofertas recibidas</button>'
            : '<button class="btn-action btn-action-primary" onclick="verOfertas(' + job.id + ')">&#128176; Ver Ofertas (' + job.total_ofertas + ')</button>')
        : '';

    const btnCancelar = job.estado === 'publicado'
        ? '<button class="btn-action btn-action-danger" onclick="cancelarTrabajo(' + job.id + ')">&#10060; Cancelar</button>'
        : '';

    // Paso 5: eliminado — el trabajador confirma su propia llegada
    const btnLlegada = '';

    // Paso 7: Ver foto resultado y confirmar
    const btnConfirmar = job.estado === 'pendiente_confirmacion'
        ? '<button class="btn-action btn-action-primary" onclick="abrirModalConfirmar(' + job.id + ')">&#128247; Ver resultado y confirmar</button>'
        : '';

    // Simulación de pago (solo en modo desarrollo)
    const btnSimularPago = modoDesarrollo && job.estado === 'en_negociacion'
        ? '<button class="btn-action" style="background:#f59e0b;color:#fff;border:none;margin-top:0.25rem;" onclick="simularPagoDev(' + job.id + ', this)">[DEV] Simular pago aprobado</button>'
        : '';

    // Disputa: disponible en completado o pendiente_confirmacion
    const btnDisputa = ['completado', 'pendiente_confirmacion'].includes(job.estado)
        ? '<button class="btn-action btn-action-danger" style="margin-top:0.25rem;" onclick="abrirModalDisputa(' + job.id + ')">&#9888;&#65039; Abrir disputa</button>'
        : '';

    // Paso 9: Calificar
    const btnCalificar = job.estado === 'completado'
        ? (job.ya_califique
            ? '<span class="btn-action" style="color:var(--success,#10b981);font-weight:600;cursor:default;">&#9989; Calificación enviada</span>'
            : '<button class="btn-action btn-action-primary" onclick="abrirModalCalificacion(' + job.id + ')">&#11088; Calificar al trabajador</button>')
        : '';

    // Alerta cuando hay una oferta aceptada (en negociación) — muestra horario auto-asignado
    let alertaOfertaAceptada = '';
    if (job.estado === 'en_negociacion') {
        if (job.fecha_inicio) {
            const fi = new Date(job.fecha_inicio);
            const cuando = fi.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }) +
                ' a las ' + fi.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
            alertaOfertaAceptada = '<div style="background:#dbeafe;border:1px solid #60a5fa;color:#1e40af;padding:0.85rem 1rem;border-radius:var(--radius);margin-bottom:0.75rem;font-size:0.9rem;display:flex;align-items:center;gap:0.5rem;">&#128197; <span>Horario asignado: <strong>' + cuando + '</strong></span></div>';
        } else {
            alertaOfertaAceptada = '<div style="background:#fef9c3;border:1px solid #facc15;color:#854d0e;padding:0.85rem 1rem;border-radius:var(--radius);margin-bottom:0.75rem;font-size:0.9rem;display:flex;align-items:center;gap:0.5rem;">&#9888; <span>No se encontr\u00F3 disponibilidad coincidente. El due\u00F1o ser\u00E1 notificado para coordinar manualmente.</span></div>';
        }
    }

    // Alerta cuando el trabajador ya llegó (en curso) — verde
    const alertaEnCurso = job.estado === 'trabajador_llego'
        ? (function() {
            var hora = '';
            if (job.hora_inicio_real) {
                var d = new Date(job.hora_inicio_real);
                hora = ' a las ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
            }
            return '<div style="background:#d1fae5;border:1px solid #34d399;color:#065f46;padding:0.85rem 1rem;border-radius:var(--radius);margin-bottom:0.75rem;font-size:0.9rem;display:flex;align-items:center;gap:0.5rem;">&#128296; <span>El trabajador lleg\u00F3' + hora + ' y est\u00E1 realizando el trabajo</span></div>';
        })()
        : '';

    // Alerta de foto resultado — amarillo
    const alertaResultado = job.estado === 'pendiente_confirmacion'
        ? '<div style="background:#fef9c3;border:1px solid #facc15;color:#854d0e;padding:0.85rem 1rem;border-radius:var(--radius);margin-bottom:0.75rem;font-size:0.9rem;display:flex;align-items:center;gap:0.5rem;">&#9203; <span>El trabajador termin\u00F3 &mdash; revis\u00E1 la foto y confirm\u00E1 el trabajo</span></div>'
        : '';

    // Alerta trabajo completado — verde oscuro
    const alertaCompletado = job.estado === 'completado'
        ? '<div style="background:#d1fae5;border:1px solid #059669;color:#065f46;padding:0.85rem 1rem;border-radius:var(--radius);margin-bottom:0.75rem;font-size:0.9rem;display:flex;align-items:center;gap:0.5rem;">&#9989; <span>Trabajo completado</span></div>'
        : '';

    return '<div class="job-card" id="job-' + job.id + '">' +
        '<div class="job-card-header">' +
            '<div style="display:flex;gap:0.75rem;align-items:flex-start;">' +
            thumbHtml +
            '<div style="flex:1;min-width:0;">' +
                '<span class="job-status-badge status-' + job.estado + '">' + (estadoLabels[job.estado] || job.estado) + '</span>' +
                urgente +
                '<div class="job-title">' + job.titulo + '</div>' +
                '<div class="job-meta">&#128205; ' + (job.ciudad || 'Sin ubicación') + (job.provincia ? ', ' + job.provincia : '') + '</div>' +
                '<div class="job-meta">&#128336; Publicado ' + App.timeAgo(job.creado_en) + '</div>' +
            '</div>' +
            '</div>' +
        '</div>' +
        '<div class="job-card-body">' +
            _timelineHtml(job.estado) +
            alertaOfertaAceptada +
            alertaEnCurso +
            alertaResultado +
            alertaCompletado +
            '<div class="job-details">' +
                '<div class="detail-item"><div class="detail-label">Presupuesto</div><div class="detail-value detail-primary">' + presupuesto + '</div></div>' +
                '<div class="detail-item"><div class="detail-label">Modalidad</div><div class="detail-value">' + (job.modalidad || '-') + '</div></div>' +
                '<div class="detail-item"><div class="detail-label">Ofertas</div><div class="detail-value">' + (job.total_ofertas || 0) + '</div></div>' +
                '<div class="detail-item"><div class="detail-label">Estado</div><div class="detail-value">' + (estadoLabels[job.estado] || job.estado) + '</div></div>' +
            '</div>' +
            '<div class="job-actions">' + btnOfertas + btnLlegada + btnConfirmar + btnCalificar + btnCancelar + btnDisputa + btnSimularPago + '</div>' +
            '<div class="ofertas-section" id="ofertas-' + job.id + '">' +
                '<div class="ofertas-title">Ofertas recibidas:</div>' +
                '<div id="lista-ofertas-' + job.id + '">Cargando...</div>' +
            '</div>' +
        '</div>' +
    '</div>';
}

// ── VER OFERTAS ─────────────────────────────────────────────────────────────

async function verOfertas(jobId) {
    const section = document.getElementById('ofertas-' + jobId);
    if (section.classList.contains('visible')) { section.classList.remove('visible'); return; }
    section.classList.add('visible');
    const lista = document.getElementById('lista-ofertas-' + jobId);
    lista.innerHTML = '<p style="color:var(--gray);font-size:0.85rem;padding:0.35rem 0;">Cargando...</p>';

    try {
        const data = await App.apiRequest('/offers/' + jobId);
        if (data.ofertas && data.ofertas.length > 0) {
            const hayOfertaAceptada = data.ofertas.some(function(o) { return o.estado === 'aceptada'; });
            lista.innerHTML = data.ofertas.map(function(o) {
                return _renderOfertaItem(o, jobId, hayOfertaAceptada);
            }).join('');
        } else {
            lista.innerHTML = '<p style="color:var(--gray); font-size:0.9rem;">Sin ofertas todavía</p>';
        }
    } catch (err) {
        lista.innerHTML = '<p style="color:var(--danger);">Error cargando ofertas</p>';
    }
}

function _renderOfertaItem(o, jobId, hayOfertaAceptada) {
    const tiempo = o.tiempo_estimado
        ? o.tiempo_estimado + '\u00A0' + (o.unidad_tiempo || 'd\u00EDas')
        : null;
    const calif = o.calificacion_promedio
        ? ' <span class="oferta-rating">\u2605\u00A0' + Number(o.calificacion_promedio).toFixed(1) + '</span>'
        : ' <span class="oferta-rating-nuevo">Nuevo</span>';
    const msgHtml = o.mensaje
        ? '<div class="oferta-msg">\u201C' + o.mensaje + '\u201D</div>'
        : '';
    const contraHtml = (o.estado === 'contraoferta' && o.monto_contraoferta)
        ? '<div class="oferta-contra-info">Tu contraoferta: $' + Number(o.monto_contraoferta).toLocaleString('es-AR') + '</div>'
        : '';

    // Action buttons
    let btns = '';
    var _nombreSafe = (o.nombre || 'Trabajador').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    if (o.estado === 'pendiente') {
        if (hayOfertaAceptada) {
            btns = '<span class="oferta-estado-text" style="color:var(--gray);">\u2014 No seleccionada</span>';
        } else {
            btns =
                '<button class="btn-mini btn-mini-success" onclick="aceptarOferta(' + o.id + ',' + jobId + ',' + o.trabajador_id + ',' + "'" + _nombreSafe + "'" + ',' + Number(o.monto_propuesto) + ')">\u2713 Aceptar</button>' +
                '<button class="btn-mini btn-mini-counter" onclick="abrirContraoferta(' + o.id + ',' + jobId + ',' + o.monto_propuesto + ')">\u21A9 Contraofertar</button>' +
                '<button class="btn-mini btn-mini-danger" onclick="rechazarOferta(' + o.id + ',' + jobId + ')">\u2717 Rechazar</button>';
        }
    } else if (o.estado === 'aceptada') {
        btns = '<button class="btn-mini btn-mini-success" onclick="abrirChatTrabajo(' + o.id + ',' + jobId + ',' + o.trabajador_id + ',' + "'" + _nombreSafe + "'" + ')">\uD83D\uDCAC Ver chat</button>';
    } else {
        const estadoMap = { rechazada: '\u274C Rechazada', contraoferta: '\u21A9 Contraoferta enviada', cancelada: '\u2716 Cancelada' };
        btns = '<span class="oferta-estado-text">' + (estadoMap[o.estado] || o.estado) + '</span>';
    }

    return '<div class="oferta-item">' +
        '<div class="oferta-item-top">' +
            '<div class="oferta-item-worker">\uD83D\uDC64\u00A0<a href="/pages/perfil-publico.html?id=' + (o.trabajador_id || '') + '" style="cursor:pointer;color:inherit;text-decoration:none;" onmouseover="this.style.textDecoration=\'underline\'" onmouseout="this.style.textDecoration=\'none\'">' + (o.nombre || 'Trabajador') + '</a>' + calif + '</div>' +
            '<div class="oferta-item-monto">$' + Number(o.monto_propuesto).toLocaleString('es-AR') + '</div>' +
        '</div>' +
        (tiempo ? '<div class="oferta-item-meta">\u23F1\u00A0' + tiempo + '</div>' : '') +
        msgHtml +
        contraHtml +
        '<div class="oferta-actions">' + btns + '</div>' +
    '</div>';
}

// ── ACEPTAR OFERTA (paso 3a→4) ──────────────────────────────────────────────

let _pendingAccept = null; // { ofertaId, jobId, trabajadorId, nombreTrabajador }

function aceptarOferta(ofertaId, jobId, trabajadorId, nombreTrabajador, monto) {
    _pendingAccept = { ofertaId, jobId, trabajadorId, nombreTrabajador };
    _montoActual = Number(monto);
    _mpOfertaYaAceptada = false;

    const infoEl = document.getElementById('confirmPagoInfo');
    const desgEl = document.getElementById('confirmPagoDesglose');
    const errorEl = document.getElementById('confirmPagoError');
    const montoSpan = document.getElementById('mpMontoPago');
    const emailInput = document.getElementById('mp-payer-email');

    if (infoEl) infoEl.textContent = 'Ingresá los datos de tu tarjeta para pagar y confirmar la oferta de ' + nombreTrabajador + '. El dinero quedará retenido hasta que finalice el trabajo.';
    if (desgEl) desgEl.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
        '<span style="color:var(--gray);font-size:0.9rem;">Monto de la oferta</span>' +
        '<strong style="font-size:1.1rem;">$' + _montoActual.toLocaleString('es-AR') + '</strong>' +
        '</div>';
    if (errorEl) { errorEl.textContent = ''; errorEl.classList.remove('visible'); }
    if (montoSpan) montoSpan.textContent = _montoActual.toLocaleString('es-AR');
    if (emailInput && !emailInput.value) emailInput.value = _emailFromToken();

    // Reset result panel if visible
    const resultPanel = document.getElementById('mpPagoResultado');
    const cardForm = document.getElementById('mpCardForm');
    if (resultPanel) resultPanel.style.display = 'none';
    if (cardForm && _mpFieldsMounted) cardForm.style.display = 'block';

    document.getElementById('modalConfirmPago').style.display = 'flex';
}

function cerrarModalConfirmPago() {
    document.getElementById('modalConfirmPago').style.display = 'none';
    _pendingAccept = null;
    _mpOfertaYaAceptada = false;
    _montoActual = 0;
    const errorEl = document.getElementById('confirmPagoError');
    if (errorEl) { errorEl.textContent = ''; errorEl.classList.remove('visible'); }
    const resultPanel = document.getElementById('mpPagoResultado');
    if (resultPanel) resultPanel.style.display = 'none';
    if (_mpFieldsMounted) {
        const cardForm = document.getElementById('mpCardForm');
        if (cardForm) cardForm.style.display = 'block';
    }
    const btnPagar = document.getElementById('btnPagarDirecto');
    if (btnPagar) { btnPagar.disabled = false; btnPagar.innerHTML = '&#128179; Pagar $<span id="mpMontoPago">0</span>'; }
}

async function confirmarPagoYAceptar() {
    if (!_pendingAccept) return;
    const { ofertaId, jobId } = _pendingAccept;

    const btn = document.getElementById('btnFallbackPro');
    const errorEl = document.getElementById('confirmPagoError');
    const successEl = document.getElementById('confirmPagoSuccess');
    if (errorEl) { errorEl.textContent = ''; errorEl.classList.remove('visible'); }
    if (successEl) successEl.style.display = 'none';
    if (btn) { btn.disabled = true; btn.textContent = 'Procesando...'; }

    let data;
    try {
        data = await App.apiRequest('/offers/' + ofertaId + '/accept', { method: 'PATCH' });
    } catch (err) {
        if (errorEl) { errorEl.textContent = 'Error de conexión al aceptar la oferta'; errorEl.classList.add('visible'); }
        if (btn) { btn.disabled = false; btn.textContent = 'Pagar con MercadoPago Checkout Pro'; }
        return;
    }

    if (!data.success) {
        const msg = data.error || 'Error al aceptar la oferta';
        if (errorEl) { errorEl.textContent = msg; errorEl.classList.add('visible'); }
        if (btn) { btn.disabled = false; btn.textContent = 'Pagar con MercadoPago Checkout Pro'; }
        return;
    }

    const initPoint = data.init_point;
    const cuando = data.cuando;

    if (initPoint) {
        if (successEl) successEl.style.display = 'block';
        if (btn) btn.style.display = 'none';
        setTimeout(() => { window.location.href = initPoint; }, 1200);
        return;
    }

    // Sin init_point: MP no pudo crear la preferencia (config faltante o error)
    App.showNotification(
        '\u26A0\uFE0F Oferta aceptada pero el pago no pudo iniciarse. Por favor completá el pago desde la tarjeta que aparece en el trabajo.',
        'error'
    );
    await cargarTrabajos();
}

async function completarPago(jobId, btnEl) {
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Redirigiendo...'; }
    try {
        const data = await App.apiRequest('/pagos/trabajo/' + jobId, { method: 'POST', body: JSON.stringify({}) });
        const initPoint = data.init_point || (data.data && data.data.init_point);
        if (initPoint) {
            window.location.href = initPoint;
        } else {
            App.showNotification(data.error || 'Error al generar el link de pago', 'error');
            if (btnEl) { btnEl.disabled = false; btnEl.textContent = '\u{1F4B3} Completar pago'; }
        }
    } catch (err) {
        App.showNotification('Error de conexi\u00F3n', 'error');
        if (btnEl) { btnEl.disabled = false; btnEl.textContent = '\u{1F4B3} Completar pago'; }
    }
}

// ── ABRIR CHAT EXISTENTE DE TRABAJO ─────────────────────────────────────────
// Para oferta ya aceptada: busca la conversación existente y la abre sin crear nada nuevo.

async function abrirChatTrabajo(ofertaId, jobId, trabajadorId, nombreTrabajador) {
    try {
        const convs = await App.apiRequest('/chat');
        // Buscar la conversación directa con este trabajador (única permanente entre este par)
        const conv = Array.isArray(convs)
            ? convs.find(function(c) {
                return c.tipo === 'directo' &&
                       Array.isArray(c.otros_participantes) &&
                       c.otros_participantes.some(function(p) { return String(p.id) === String(trabajadorId); });
              })
            : null;
        if (conv) {
            if (typeof FloatingChat !== 'undefined') {
                FloatingChat.open(conv.id, nombreTrabajador || 'Trabajador', null, trabajadorId);
            } else {
                window.location.href = '/pages/mensajes.html?conversacion=' + conv.id;
            }
        } else {
            // Conversación aún no existe — crearla como directo
            if (typeof FloatingChat !== 'undefined') {
                FloatingChat.openWithUser(trabajadorId, nombreTrabajador || 'Trabajador');
            } else {
                window.location.href = '/pages/mensajes.html';
            }
        }
    } catch (err) {
        console.error('[abrirChatTrabajo] error:', err);
        App.showNotification('No se pudo abrir el chat', 'error');
    }
}

// ── RECHAZAR OFERTA (paso 3b) ────────────────────────────────────────────────

async function rechazarOferta(ofertaId, jobId) {
    if (!confirm('¿Rechazar esta oferta?')) return;
    try {
        const data = await App.apiRequest('/offers/' + ofertaId + '/reject', { method: 'PATCH' });
        if (data.success) {
            App.showNotification('Oferta rechazada', 'success');
            await verOfertas(jobId);
        } else {
            App.showNotification(data.error || 'Error al rechazar', 'error');
        }
    } catch (err) {
        App.showNotification('Error de conexión', 'error');
    }
}

// ── CONTRAOFERTAR (paso 3c) ──────────────────────────────────────────────────

function abrirContraoferta(ofertaId, jobId, montoActual) {
    document.getElementById('counter-oferta-id').value = ofertaId;
    document.getElementById('counter-job-id').value    = jobId;
    document.getElementById('counter-monto-actual').textContent = '$' + Number(montoActual).toLocaleString('es-AR');
    document.getElementById('counter-monto').value   = '';
    document.getElementById('counter-mensaje').value = '';
    document.getElementById('counterError').classList.remove('visible');
    document.getElementById('modalContraoferta').style.display = 'flex';
}

function cerrarModalContraoferta() {
    document.getElementById('modalContraoferta').style.display = 'none';
}

async function enviarContraoferta() {
    const ofertaId = document.getElementById('counter-oferta-id').value;
    const jobId    = document.getElementById('counter-job-id').value;
    const monto    = document.getElementById('counter-monto').value;
    const errorEl  = document.getElementById('counterError');

    if (!monto) { errorEl.textContent = 'El monto es obligatorio'; errorEl.classList.add('visible'); return; }

    const btn = document.getElementById('btnEnviarContra');
    btn.disabled = true; btn.textContent = 'Enviando...';

    try {
        const data = await App.apiRequest('/offers/' + ofertaId + '/counter', {
            method: 'PATCH',
            body: JSON.stringify({
                monto_contraoferta:   Number(monto),
                mensaje_contraoferta: document.getElementById('counter-mensaje').value || null
            })
        });
        if (data.success) {
            cerrarModalContraoferta();
            App.showNotification('Contraoferta enviada al trabajador', 'success');
            await cargarTrabajos();
        } else {
            errorEl.textContent = data.error || 'Error al contraofertar';
            errorEl.classList.add('visible');
        }
    } catch (err) {
        errorEl.textContent = 'Error de conexión';
        errorEl.classList.add('visible');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Enviar Contraoferta';
    }
}

// ── CANCELAR TRABAJO ─────────────────────────────────────────────────────────

async function cancelarTrabajo(jobId) {
    if (!confirm('¿Cancelar este trabajo? Esta acción no se puede deshacer.')) return;
    try {
        const data = await App.apiRequest('/jobs/' + jobId + '/cancel', { method: 'PATCH' });
        if (data.success) {
            await cargarTrabajos();
        } else {
            App.showNotification(data.error || 'Error al cancelar', 'error');
        }
    } catch (err) {
        App.showNotification('Error de conexión', 'error');
    }
}

// ── PASO 7: Dueño ve foto resultado y confirma ───────────────────────────────

let _confirmarJobId = null;

async function abrirModalConfirmar(jobId) {
    const job = todosLosTrabajos.find(j => Number(j.id) === Number(jobId));
    if (!job) return;
    _confirmarJobId = jobId;

    const fotoResultado = document.getElementById('confirmarFotoResultado');
    const fotoAntes     = document.getElementById('confirmarFotoAntes');
    const textoEl       = document.getElementById('confirmarTexto');
    const errorEl       = document.getElementById('confirmarError');

    if (errorEl) errorEl.textContent = '';

    // Foto del resultado (después)
    if (fotoResultado) {
        if (job.foto_resultado_url) {
            fotoResultado.src = job.foto_resultado_url;
            fotoResultado.style.display = 'block';
        } else {
            fotoResultado.style.display = 'none';
        }
    }

    // Foto original (antes)
    const fotosAntes = (() => {
        if (!job.fotos_urls) return [];
        if (Array.isArray(job.fotos_urls)) return job.fotos_urls;
        try { return JSON.parse(job.fotos_urls); } catch (_) { return []; }
    })();
    if (fotoAntes) {
        if (fotosAntes.length > 0) {
            fotoAntes.src = fotosAntes[0];
            fotoAntes.style.display = 'block';
        } else {
            fotoAntes.style.display = 'none';
        }
    }

    // Texto del resultado
    if (textoEl) textoEl.textContent = job.texto_resultado || '';

    document.getElementById('modalConfirmar').style.display = 'flex';
}

function cerrarModalConfirmar() {
    document.getElementById('modalConfirmar').style.display = 'none';
    _confirmarJobId = null;
}

async function confirmarTrabajoCorrecto() {
    if (!_confirmarJobId) return;
    const btn = document.getElementById('btnConfirmarCorrecto');
    const errorEl = document.getElementById('confirmarError');
    if (errorEl) { errorEl.textContent = ''; errorEl.classList.remove('visible'); }
    btn.disabled = true; btn.textContent = 'Confirmando...';

    try {
        const data = await App.apiRequest('/jobs/' + _confirmarJobId + '/confirmar-completado', { method: 'PATCH' });
        if (data.success) {
            cerrarModalConfirmar();
            App.showNotification('&#127881; ¡Trabajo confirmado! Se publicó el portfolio automáticamente.', 'success');
            setTimeout(() => abrirModalCalificacion(_confirmarJobId), 1500);
            await cargarTrabajos();
        } else {
            if (errorEl) { errorEl.textContent = data.error || 'Error al confirmar'; errorEl.classList.add('visible'); }
        }
    } catch (err) {
        if (errorEl) { errorEl.textContent = 'Error de conexión'; errorEl.classList.add('visible'); }
    } finally {
        btn.disabled = false;
        btn.textContent = 'Confirmar — trabajo correcto';
    }
}

// ── ABRIR DISPUTA ────────────────────────────────────────────────────────────

let _disputaJobId = null;

function abrirModalDisputa(jobId) {
    _disputaJobId = jobId;
    const job = todosLosTrabajos.find(j => Number(j.id) === Number(jobId));
    const tituloEl = document.getElementById('disputaTitulo');
    if (tituloEl) tituloEl.textContent = job ? job.titulo : '';
    document.getElementById('disputaMotivo').value = '';
    document.getElementById('disputaDescripcion').value = '';
    const errorEl = document.getElementById('disputaError');
    if (errorEl) { errorEl.textContent = ''; errorEl.classList.remove('visible'); }
    document.getElementById('modalDisputa').style.display = 'flex';
}

function cerrarModalDisputa() {
    document.getElementById('modalDisputa').style.display = 'none';
    _disputaJobId = null;
}

async function enviarDisputa() {
    const motivo = document.getElementById('disputaMotivo').value;
    const descripcion = document.getElementById('disputaDescripcion').value.trim();
    const errorEl = document.getElementById('disputaError');
    errorEl.textContent = ''; errorEl.classList.remove('visible');

    if (!motivo) {
        errorEl.textContent = 'Seleccioná el motivo de la disputa';
        errorEl.classList.add('visible');
        return;
    }

    const btn = document.getElementById('btnEnviarDisputa');
    btn.disabled = true; btn.textContent = 'Enviando...';

    try {
        const data = await App.apiRequest('/disputas', {
            method: 'POST',
            body: JSON.stringify({ trabajo_id: _disputaJobId, motivo, descripcion })
        });
        if (data.success) {
            cerrarModalDisputa();
            App.showNotification('&#9888;&#65039; Disputa abierta. Un moderador la revisará pronto.', 'info');
            await cargarTrabajos();
        } else {
            errorEl.textContent = data.error || 'Error al abrir la disputa';
            errorEl.classList.add('visible');
        }
    } catch (err) {
        errorEl.textContent = 'Error de conexión';
        errorEl.classList.add('visible');
    } finally {
        btn.disabled = false; btn.textContent = 'Abrir disputa';
    }
}

// ── PAGO INLINE CON TARJETA (MercadoPago SDK v2) ────────────────────────────

async function procesarPagoDirecto() {
    if (!_pendingAccept) return;
    const { ofertaId, jobId } = _pendingAccept;

    const cardholderName = (document.getElementById('mp-cardholder-name').value || '').trim();
    const identificationType = document.getElementById('mp-id-type').value;
    const identificationNumber = (document.getElementById('mp-id-number').value || '').trim();
    const payerEmail = (document.getElementById('mp-payer-email').value || '').trim();
    const errorEl = document.getElementById('confirmPagoError');

    if (errorEl) { errorEl.textContent = ''; errorEl.classList.remove('visible'); }

    if (!cardholderName) { if (errorEl) { errorEl.textContent = 'Ingresá el nombre del titular'; errorEl.classList.add('visible'); } return; }
    if (!identificationNumber) { if (errorEl) { errorEl.textContent = 'Ingresá el número de documento'; errorEl.classList.add('visible'); } return; }
    if (!payerEmail || !payerEmail.includes('@')) { if (errorEl) { errorEl.textContent = 'Ingresá un email válido'; errorEl.classList.add('visible'); } return; }

    const btnPagar = document.getElementById('btnPagarDirecto');
    const btnFallback = document.getElementById('btnFallbackPro');
    if (btnPagar) { btnPagar.disabled = true; btnPagar.textContent = 'Procesando...'; }
    if (btnFallback) btnFallback.disabled = true;

    try {
        // Paso 1: aceptar oferta (solo si no se hizo antes por retry)
        if (!_mpOfertaYaAceptada) {
            let acceptData;
            try {
                acceptData = await App.apiRequest('/offers/' + ofertaId + '/accept', { method: 'PATCH' });
            } catch (_) {
                if (errorEl) { errorEl.textContent = 'Error de conexión al aceptar la oferta'; errorEl.classList.add('visible'); }
                if (btnPagar) { btnPagar.disabled = false; btnPagar.innerHTML = '&#128179; Pagar $<span id="mpMontoPago">' + _montoActual.toLocaleString('es-AR') + '</span>'; }
                if (btnFallback) btnFallback.disabled = false;
                return;
            }
            if (!acceptData.success) {
                if (errorEl) { errorEl.textContent = acceptData.error || 'Error al aceptar la oferta'; errorEl.classList.add('visible'); }
                if (btnPagar) { btnPagar.disabled = false; btnPagar.innerHTML = '&#128179; Pagar $<span id="mpMontoPago">' + _montoActual.toLocaleString('es-AR') + '</span>'; }
                if (btnFallback) btnFallback.disabled = false;
                return;
            }
            _mpOfertaYaAceptada = true;
        }

        // Paso 2: tokenizar tarjeta — createCardToken retorna { id, ... } o lanza excepción
        let tokenResult;
        try {
            tokenResult = await mpInstance.fields.createCardToken({
                cardholderName,
                identificationType,
                identificationNumber
            });
        } catch (tokenErr) {
            console.error('[MP] createCardToken error:', tokenErr);
            const msg = tokenErr?.cause?.message || tokenErr?.message || 'Error al procesar los datos de la tarjeta. Verificá los campos.';
            if (errorEl) { errorEl.textContent = msg; errorEl.classList.add('visible'); }
            if (btnPagar) { btnPagar.disabled = false; btnPagar.innerHTML = '&#128179; Pagar $<span id="mpMontoPago">' + _montoActual.toLocaleString('es-AR') + '</span>'; }
            if (btnFallback) btnFallback.disabled = false;
            return;
        }
        const cardToken = tokenResult && tokenResult.id;
        if (!cardToken) {
            console.error('[MP] createCardToken resultado sin id:', tokenResult);
            if (errorEl) { errorEl.textContent = 'Error al procesar los datos de la tarjeta. Verificá los campos.'; errorEl.classList.add('visible'); }
            if (btnPagar) { btnPagar.disabled = false; btnPagar.innerHTML = '&#128179; Pagar $<span id="mpMontoPago">' + _montoActual.toLocaleString('es-AR') + '</span>'; }
            if (btnFallback) btnFallback.disabled = false;
            return;
        }

        // Paso 3: cobrar
        let pagoData;
        try {
            pagoData = await App.apiRequest('/pagos/trabajo/' + jobId + '/pagar-directo', {
                method: 'POST',
                body: JSON.stringify({
                    card_token: cardToken,
                    payment_method_id: _mpPaymentMethodId || undefined,
                    payer_email: payerEmail,
                    installments: 1
                })
            });
        } catch (_) {
            if (errorEl) { errorEl.textContent = 'Error de conexión al procesar el pago'; errorEl.classList.add('visible'); }
            if (btnPagar) { btnPagar.disabled = false; btnPagar.innerHTML = '&#128179; Pagar $<span id="mpMontoPago">' + _montoActual.toLocaleString('es-AR') + '</span>'; }
            if (btnFallback) btnFallback.disabled = false;
            return;
        }

        _mostrarResultadoPago(pagoData);
    } catch (err) {
        if (errorEl) { errorEl.textContent = 'Ocurrió un error inesperado. Intentá con Checkout Pro.'; errorEl.classList.add('visible'); }
        if (btnPagar) { btnPagar.disabled = false; btnPagar.innerHTML = '&#128179; Pagar $<span id="mpMontoPago">' + _montoActual.toLocaleString('es-AR') + '</span>'; }
        if (btnFallback) btnFallback.disabled = false;
    }
}

function _mostrarResultadoPago(data) {
    const cardForm = document.getElementById('mpCardForm');
    const resultPanel = document.getElementById('mpPagoResultado');
    const iconEl = document.getElementById('mpResultIcon');
    const titleEl = document.getElementById('mpResultTitulo');
    const detailEl = document.getElementById('mpResultDetalle');
    const resultBtn = document.getElementById('mpResultBtn');
    const errorEl = document.getElementById('confirmPagoError');

    const status = data.status || (data.data && data.data.status);

    if (status === 'approved') {
        if (cardForm) cardForm.style.display = 'none';
        if (resultPanel) resultPanel.style.display = 'block';
        if (iconEl) iconEl.textContent = '✅';
        if (titleEl) titleEl.textContent = '¡Pago aprobado!';
        if (detailEl) detailEl.textContent = 'Tu pago fue procesado correctamente. El trabajo comenzará cuando el trabajador confirme llegada.';
        if (resultBtn) resultBtn.style.display = '';
        setTimeout(() => cargarTrabajos(), 1500);
    } else if (status === 'pending' || status === 'in_process') {
        if (cardForm) cardForm.style.display = 'none';
        if (resultPanel) resultPanel.style.display = 'block';
        if (iconEl) iconEl.textContent = '⏳';
        if (titleEl) titleEl.textContent = 'Pago en proceso';
        if (detailEl) detailEl.textContent = 'Tu pago está siendo procesado. Recibirás una notificación cuando se confirme.';
        if (resultBtn) resultBtn.style.display = '';
        setTimeout(() => cargarTrabajos(), 1500);
    } else {
        // Rechazado: mostrar error y dejar que reintente
        const codigoRazon = data.status_detail || (data.data && data.data.status_detail);
        const mensajesRechazo = {
            cc_rejected_insufficient_amount: 'Fondos insuficientes en la tarjeta.',
            cc_rejected_bad_filled_card_number: 'Número de tarjeta incorrecto.',
            cc_rejected_bad_filled_date: 'Fecha de vencimiento incorrecta.',
            cc_rejected_bad_filled_security_code: 'CVV incorrecto.',
            cc_rejected_call_for_authorize: 'Llamá a tu banco para autorizar el pago.',
            cc_rejected_card_disabled: 'Tarjeta deshabilitada.',
            cc_rejected_duplicated_payment: 'Pago duplicado detectado.'
        };
        const detalle = mensajesRechazo[codigoRazon] || (data.error || 'El pago fue rechazado. Verificá los datos o usá otra tarjeta.');
        const btnPagar = document.getElementById('btnPagarDirecto');
        const btnFallback = document.getElementById('btnFallbackPro');
        if (errorEl) { errorEl.textContent = detalle; errorEl.classList.add('visible'); }
        if (btnPagar) { btnPagar.disabled = false; btnPagar.innerHTML = '&#128179; Pagar $<span id="mpMontoPago">' + _montoActual.toLocaleString('es-AR') + '</span>'; }
        if (btnFallback) btnFallback.disabled = false;
    }
}

// ── SIMULACIÓN DE PAGO (solo dev) ────────────────────────────────────────────

async function simularPagoDev(jobId, btnEl) {
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = '[DEV] Simulando...'; }
    try {
        const data = await App.apiRequest('/pagos/dev/aprobar/' + jobId, { method: 'POST', body: JSON.stringify({}) });
        if (data.success) {
            if (data.ya_aprobado) {
                App.showNotification('El pago ya estaba aprobado anteriormente', 'info');
            } else {
                App.showNotification('[DEV] Pago simulado correctamente — el trabajo avanzó de estado', 'success');
            }
            await cargarTrabajos();
        } else {
            App.showNotification('[DEV] Error: ' + (data.error || 'No se pudo simular el pago'), 'error');
            if (btnEl) { btnEl.disabled = false; btnEl.textContent = '[DEV] Simular pago aprobado'; }
        }
    } catch (err) {
        App.showNotification('[DEV] Error de conexión', 'error');
        if (btnEl) { btnEl.disabled = false; btnEl.textContent = '[DEV] Simular pago aprobado'; }
    }
}

// ── EXPORTS ──────────────────────────────────────────────────────────────────

window.procesarPagoDirecto        = procesarPagoDirecto;
window.filtrar                    = filtrar;
window.verOfertas                 = verOfertas;
window.aceptarOferta              = aceptarOferta;
window.cerrarModalConfirmPago     = cerrarModalConfirmPago;
window.confirmarPagoYAceptar      = confirmarPagoYAceptar;
window.completarPago              = completarPago;
window.abrirChatTrabajo           = abrirChatTrabajo;
window.rechazarOferta             = rechazarOferta;
window.cancelarTrabajo            = cancelarTrabajo;
window.abrirContraoferta          = abrirContraoferta;
window.cerrarModalContraoferta    = cerrarModalContraoferta;
window.enviarContraoferta         = enviarContraoferta;
window.abrirModalConfirmar        = abrirModalConfirmar;
window.cerrarModalConfirmar       = cerrarModalConfirmar;
window.confirmarTrabajoCorrecto   = confirmarTrabajoCorrecto;
window.abrirModalDisputa          = abrirModalDisputa;
window.cerrarModalDisputa         = cerrarModalDisputa;
window.enviarDisputa              = enviarDisputa;
window.simularPagoDev             = simularPagoDev;
// abrirModalCalificacion, cerrarModalCalificacion, elegirEstrella, enviarCalificacion → shared-jobs.js
