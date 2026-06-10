/**
 * mis-trabajos-worker.js
 * Módulo del trabajador: trabajos asignados y flujo completo de ejecución.
 * Cubre pasos 4–9 desde la perspectiva del trabajador.
 * Requiere: shared-jobs.js cargado antes.
 */

var todosLosTrabajos = [];
var filtroActual = 'todos';
var _notificadoSinDisponibilidad = new Set(); // evita notificar más de una vez por sesión

document.addEventListener('DOMContentLoaded', async function () {
    if (!Auth.isAuthenticated()) { window.location.href = '/index.html'; return; }
    await cargarTrabajos();

    // Re-renderiza cada 30s para actualizar el botón de confirmación de asistencia según la ventana temporal
    setInterval(function () {
        var tieneActivosConFecha = todosLosTrabajos.some(function (j) {
            return j.estado === 'en_negociacion' && j.fecha_inicio;
        });
        if (!tieneActivosConFecha) return;
        var filtrados = filtroActual === 'todos'
            ? todosLosTrabajos
            : filtroActual === 'en_curso'
            ? todosLosTrabajos.filter(function (j) { return ['en_curso', 'trabajador_llego', 'pendiente_confirmacion'].includes(j.estado); })
            : filtroActual === 'finalizado'
            ? todosLosTrabajos.filter(function (j) { return j.estado === 'completado'; })
            : todosLosTrabajos.filter(function (j) { return j.estado === filtroActual; });
        renderJobs(filtrados);
    }, 30000);
});

async function cargarTrabajos() {
    var grid = document.getElementById('jobsGrid');
    if (grid) grid.innerHTML = _spinnerHtml('Cargando tus trabajos...');
    try {
        var data = await App.apiRequest('/jobs/asignados');
        if (data.success) {
            todosLosTrabajos = data.jobs || [];
            renderJobs(todosLosTrabajos);
        } else {
            if (grid) grid.innerHTML = _errorHtml(data.error || 'No se pudieron cargar los trabajos.');
        }
    } catch (err) {
        console.error('Error cargando trabajos asignados:', err);
        if (grid) grid.innerHTML = _errorHtml('No pudimos cargar la información. Verificá tu conexión.', 'cargarTrabajos');
    }
}

function filtrar(estado, el) {
    filtroActual = estado;
    _activarFiltroTab(estado);
    var filtrados = estado === 'todos'
        ? todosLosTrabajos
        : estado === 'en_curso'
        ? todosLosTrabajos.filter(function (j) { return ['en_curso','trabajador_llego','pendiente_confirmacion'].includes(j.estado); })
        : estado === 'finalizado'
        ? todosLosTrabajos.filter(function (j) { return j.estado === 'completado'; })
        : todosLosTrabajos.filter(function (j) { return j.estado === estado; });
    renderJobs(filtrados);
}

function renderJobs(jobs) {
    var grid = document.getElementById('jobsGrid');
    if (jobs.length === 0) {
        var esTodos = filtroActual === 'todos';
        grid.innerHTML =
            '<div class="empty-state" style="grid-column:1/-1;">' +
                '<div class="empty-icon">&#128736;</div>' +
                (esTodos
                    ? '<h3>No ten\u00E9s trabajos asignados todav\u00EDa</h3>' +
                      '<p>Ofert\u00E1 en trabajos del feed para que un due\u00F1o te contrate</p>' +
                      '<button class="btn-action btn-action-primary" style="margin-top:1rem;" onclick="window.location.href=\'/pages/feed.html\'">Ver trabajos disponibles</button>'
                    : '<h3>No ten\u00E9s trabajos en esta categor\u00EDa</h3>' +
                      '<p>Prob\u00E1 ver todos los trabajos</p>'
                ) +
            '</div>';
        return;
    }
    grid.innerHTML = jobs.map(function (job) { return renderJobCard(job); }).join('');
}

function renderJobCard(job) {
    var estadoLabels = {
        en_negociacion:         '&#128197; Horario confirmado',
        en_curso:               '&#128260; En Curso',
        trabajador_llego:       '&#128663; Trabajador en camino',
        pendiente_confirmacion: '&#9203; Esperando tu confirmaci\u00F3n',
        completado:             '&#9989; Trabajo finalizado',
        cancelado:              '&#10060; Cancelado'
    };

    var dueno = job.dueno_nombre
        ? (job.dueno_nombre + (job.dueno_apellido ? ' ' + job.dueno_apellido : ''))
        : (job.dueno_email || 'Cliente');

    var monto = job.monto_acordado
        ? '$' + Number(job.monto_acordado).toLocaleString('es-AR')
        : (job.presupuesto_min ? '$' + Number(job.presupuesto_min).toLocaleString('es-AR') : 'A convenir');

    // Paso 4→5: Confirmar asistencia — solo dentro de la ventana ±3 min respecto a fecha_inicio
    var btnIniciar = '';
    if (job.estado === 'en_negociacion' && job.fecha_inicio) {
        var _ahora = new Date();
        var _inicio = new Date(job.fecha_inicio);
        var _ventanaAntes = new Date(_inicio.getTime() - 3 * 60 * 1000);
        var _ventanaDespues = new Date(_inicio.getTime() + 3 * 60 * 1000);
        if (_ahora < _ventanaAntes) {
            var _horaHabilitacion = _ventanaAntes.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
            btnIniciar = '<p style="margin:0;font-size:0.85rem;color:#6b7280;">&#128337; Podés confirmar a partir de las ' + _horaHabilitacion + '</p>';
        } else if (_ahora > _ventanaDespues) {
            btnIniciar = '<p style="margin:0;font-size:0.85rem;color:#dc2626;">&#9888;&#65039; Ventana de confirmación cerrada — contactá al soporte</p>';
        } else {
            btnIniciar = '<button class="btn-action btn-action-primary" onclick="abrirModalAsistencia(' + job.id + ')">&#128205; Confirmar asistencia</button>';
        }
    }

    // Paso 6: Marcar trabajo terminado + subir foto (solo cuando el dueño ya confirmó llegada)
    var btnCompletar = job.estado === 'trabajador_llego'
        ? '<button class="btn-action btn-action-primary" onclick="marcarCompletado(' + job.id + ')">&#128247; Marcar trabajo terminado</button>'
        : '';

    // Estado pendiente_confirmacion: información, sin acción del trabajador
    var alertaEspera = job.estado === 'pendiente_confirmacion'
        ? '<div style="background:#fef9c3;border:1px solid #facc15;color:#854d0e;padding:0.75rem;border-radius:var(--radius);margin-bottom:0.75rem;font-size:0.88rem;">&#9203; Esperando confirmaci&#243;n del due&#241;o. Te notificaremos cuando acepte el resultado.</div>'
        : '';

    // Alerta en_negociacion: diferencia según si hay horario asignado o no
    var alertaNegociacion = '';
    if (job.estado === 'en_negociacion') {
        if (job.fecha_inicio) {
            alertaNegociacion = '<div style="background:#eff6ff;border:1px solid #93c5fd;color:#1e40af;padding:0.75rem;border-radius:var(--radius);margin-bottom:0.75rem;font-size:0.88rem;">&#128200; Oferta aceptada. Cuando llegues al lugar, confirm&#225; el inicio del trabajo.</div>';
        } else {
            alertaNegociacion = '<div style="background:#fef9c3;border:1px solid #facc15;color:#854d0e;padding:0.75rem;border-radius:var(--radius);margin-bottom:0.75rem;font-size:0.88rem;">&#9888; No se encontr\u00F3 disponibilidad coincidente. El due\u00F1o ser\u00E1 notificado para coordinar manualmente.</div>';
            // Notificar al dueño una vez por sesión por trabajo
            if (!_notificadoSinDisponibilidad.has(job.id)) {
                _notificadoSinDisponibilidad.add(job.id);
                App.apiRequest('/notifications/sin-disponibilidad', {
                    method: 'POST',
                    body: JSON.stringify({ trabajo_id: job.id })
                }).catch(function () { /* silencioso: la notificación es best-effort */ });
            }
        }
    }

    // Alerta de llegada confirmada
    var alertaLlegada = job.estado === 'trabajador_llego'
        ? '<div style="background:#d1fae5;border:1px solid #34d399;color:#065f46;padding:0.75rem;border-radius:var(--radius);margin-bottom:0.75rem;font-size:0.88rem;">&#9989; Confirm&#225;ste tu llegada al lugar del trabajo. Complet&#225;lo y sub&#237; la foto del resultado.</div>'
        : '';

    // Disputa: disponible en completado o pendiente_confirmacion
    var btnDisputa = (job.estado === 'completado' || job.estado === 'pendiente_confirmacion')
        ? '<button class="btn-action btn-action-danger" style="margin-top:0.25rem;" onclick="abrirModalDisputa(' + job.id + ')">&#9888;&#65039; Abrir disputa</button>'
        : '';

    // Paso 9: Calificar
    var btnCalificar = job.estado === 'completado'
        ? (job.ya_califique
            ? '<span class="btn-action" style="color:var(--success,#10b981);font-weight:600;cursor:default;">&#9989; Calificación enviada</span>'
            : '<button class="btn-action btn-action-primary" onclick="abrirModalCalificacion(' + job.id + ')">&#11088; Calificar al due\u00F1o</button>')
        : '';

    var fechaHoraHtml = '';
    if (job.fecha_inicio) {
        var fi = new Date(job.fecha_inicio);
        var fechaLabel = fi.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        var horaLabel  = fi.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        fechaHoraHtml = '<div class="detail-item" style="grid-column:1/-1;background:#eff6ff;border:1px solid #93c5fd;border-radius:var(--radius);padding:0.6rem 0.8rem;">' +
            '<div class="detail-label">&#128197; Fecha y hora del trabajo</div>' +
            '<div class="detail-value detail-primary" style="color:#1e40af;">' + fechaLabel + ' a las ' + horaLabel + '</div>' +
        '</div>';
    }

    return '<div class="job-card" id="job-' + job.id + '">' +
        '<div class="job-card-header">' +
            '<span class="job-status-badge status-' + job.estado + '">' + (estadoLabels[job.estado] || job.estado) + '</span>' +
            '<div class="job-title">' + job.titulo + '</div>' +
            '<div class="job-meta">&#128100; Cliente: ' + (job.dueno_id ? '<span style="cursor:pointer;color:var(--primary,#3b82f6);" onclick="window.location.href=\'/pages/perfil-publico.html?id=' + job.dueno_id + '\'">' + dueno + '</span>' : dueno) + '</div>' +
            '<div class="job-meta">&#128205; ' + (job.ciudad || 'Sin ubicación') + (job.provincia ? ', ' + job.provincia : '') + '</div>' +
            '<div class="job-meta">&#128336; ' + App.timeAgo(job.creado_en) + '</div>' +
        '</div>' +
        '<div class="job-card-body">' +
            _timelineHtml(job.estado) +
            alertaNegociacion +
            alertaEspera +
            alertaLlegada +
            '<div class="job-details">' +
                fechaHoraHtml +
                '<div class="detail-item"><div class="detail-label">Monto acordado</div><div class="detail-value detail-primary">' + monto + '</div></div>' +
                '<div class="detail-item"><div class="detail-label">Rubro</div><div class="detail-value">' + (job.rubro_nombre || '-') + '</div></div>' +
                '<div class="detail-item"><div class="detail-label">Modalidad</div><div class="detail-value">' + (job.modalidad || '-') + '</div></div>' +
                '<div class="detail-item"><div class="detail-label">Estado</div><div class="detail-value">' + (estadoLabels[job.estado] || job.estado) + '</div></div>' +
            '</div>' +
            '<div class="job-actions">' + btnIniciar + btnCompletar + btnCalificar + btnDisputa + '</div>' +
        '</div>' +
    '</div>';
}

// ── PASO 4→5: Modal confirmar asistencia ─────────────────────────────────────

function _distanciaMetros(lat1, lng1, lat2, lng2) {
    var R = 6371000;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function _abrirModalAsistenciaDirecto(jobId) {
    document.getElementById('asistencia-job-id').value = jobId;
    var errorEl = document.getElementById('asistenciaError');
    if (errorEl) { errorEl.textContent = ''; errorEl.classList.remove('visible'); }
    var btn = document.getElementById('btnConfirmarAsistencia');
    if (btn) { btn.disabled = false; btn.textContent = 'S\u00ED, llegu\u00E9'; }
    document.getElementById('modalConfirmarAsistencia').style.display = 'flex';
}

function _abrirModalGeoWarning(jobId) {
    document.getElementById('geoWarning-job-id').value = jobId;
    document.getElementById('modalGeoWarning').style.display = 'flex';
}

function cerrarModalGeoWarning() {
    document.getElementById('modalGeoWarning').style.display = 'none';
}

function confirmarIgualGeoWarning() {
    var jobId = document.getElementById('geoWarning-job-id').value;
    cerrarModalGeoWarning();
    _abrirModalAsistenciaDirecto(jobId);
}

function abrirModalAsistencia(jobId) {
    var job = todosLosTrabajos.find(function (j) { return Number(j.id) === Number(jobId); });

    // Sin coordenadas en el trabajo: abrir modal directo sin verificación
    if (!job || !job.latitud || !job.longitud) {
        _abrirModalAsistenciaDirecto(jobId);
        return;
    }

    // Sin soporte de geolocalización: abrir modal directo
    if (!navigator.geolocation) {
        _abrirModalAsistenciaDirecto(jobId);
        return;
    }

    var jobLat = parseFloat(job.latitud);
    var jobLng = parseFloat(job.longitud);

    navigator.geolocation.getCurrentPosition(
        function (pos) {
            var dist = _distanciaMetros(pos.coords.latitude, pos.coords.longitude, jobLat, jobLng);
            if (dist <= 500) {
                _abrirModalAsistenciaDirecto(jobId);
            } else {
                _abrirModalGeoWarning(jobId);
            }
        },
        function () {
            // Permiso denegado o error: no bloquear al trabajador
            _abrirModalAsistenciaDirecto(jobId);
        },
        { timeout: 8000, maximumAge: 60000 }
    );
}

function cerrarModalAsistencia() {
    document.getElementById('modalConfirmarAsistencia').style.display = 'none';
}

async function confirmarAsistenciaModal() {
    var jobId = document.getElementById('asistencia-job-id').value;
    var errorEl = document.getElementById('asistenciaError');
    var btn = document.getElementById('btnConfirmarAsistencia');
    if (errorEl) { errorEl.textContent = ''; errorEl.classList.remove('visible'); }
    btn.disabled = true; btn.textContent = 'Confirmando...';
    try {
        var data = await App.apiRequest('/jobs/' + jobId + '/iniciar', { method: 'PATCH' });
        if (data.success) {
            cerrarModalAsistencia();
            App.showNotification('&#9989; Llegada confirmada. El due\u00F1o fue notificado.', 'success');
            await cargarTrabajos();
        } else {
            if (errorEl) { errorEl.textContent = data.error || 'Error al confirmar'; errorEl.classList.add('visible'); }
            btn.disabled = false; btn.textContent = 'S\u00ED, llegu\u00E9';
        }
    } catch (err) {
        if (errorEl) { errorEl.textContent = 'Error de conexi\u00F3n'; errorEl.classList.add('visible'); }
        btn.disabled = false; btn.textContent = 'S\u00ED, llegu\u00E9';
    }
}

// ── MODAL COMPLETAR (paso 6) ─────────────────────────────────────────────────

var _completarJobId    = null;
var _completarAntesUrls = [];
var _completarFotoFile  = null;
var _COMPLETAR_MAX_FOTOS = 1;

function marcarCompletado(jobId) {
    var job = todosLosTrabajos.find(function (j) { return Number(j.id) === Number(jobId); });
    if (!job) return;

    _completarJobId      = jobId;
    _completarAntesUrls  = _parseUrls(job.fotos_urls);
    _completarFotoFile   = null;

    var tituloEl = document.getElementById('completar-titulo');
    if (tituloEl) tituloEl.value = job.titulo || '';
    var descEl = document.getElementById('completar-descripcion');
    if (descEl) descEl.value = '';
    var errorEl = document.getElementById('completarError');
    if (errorEl) errorEl.classList.remove('visible');

    // Fotos del dueño (antes)
    var antesWrap = document.getElementById('completarAntesWrap');
    var antesGrid = document.getElementById('completarAntesGrid');
    if (_completarAntesUrls.length > 0 && antesGrid) {
        antesGrid.innerHTML = _completarAntesUrls.slice(0, 4).map(function (url) {
            return '<div style="width:72px;height:72px;border-radius:var(--radius);overflow:hidden;border:2px solid var(--border);">' +
                   '<img src="' + url + '" alt="antes" style="width:100%;height:100%;object-fit:cover;pointer-events:none;"></div>';
        }).join('');
        if (antesWrap) antesWrap.style.display = 'block';
    } else {
        if (antesWrap) antesWrap.style.display = 'none';
    }

    _renderFotoResultado();
    var input = document.getElementById('completarDespuesInput');
    if (input) input.value = '';
    document.getElementById('modalCompletar').style.display = 'flex';
}

function cerrarModalCompletar() {
    document.getElementById('modalCompletar').style.display = 'none';
    _completarJobId     = null;
    _completarAntesUrls = [];
    _completarFotoFile  = null;
    _renderFotoResultado();
    var input = document.getElementById('completarDespuesInput');
    if (input) input.value = '';
}

function _parseUrls(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val); } catch (e) { return []; }
}

function _renderFotoResultado() {
    var grid  = document.getElementById('completarDespuesGrid');
    var count = document.getElementById('completarDespuesCount');
    if (!grid) return;
    grid.innerHTML = '';
    if (_completarFotoFile) {
        var item = document.createElement('div');
        item.style.cssText = 'position:relative;width:90px;height:90px;border-radius:var(--radius);overflow:hidden;border:2px solid var(--border);';
        var url = URL.createObjectURL(_completarFotoFile);
        var media = document.createElement('img');
        media.src = url;
        media.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        item.appendChild(media);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.innerHTML = '&#10005;';
        btn.style.cssText = 'position:absolute;top:2px;right:2px;width:18px;height:18px;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:50%;cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center;padding:0;';
        btn.addEventListener('click', function () {
            URL.revokeObjectURL(url);
            _completarFotoFile = null;
            _renderFotoResultado();
        });
        item.appendChild(btn);
        grid.appendChild(item);
    }
    if (count) count.textContent = _completarFotoFile ? '1 foto' : '';
}

document.addEventListener('DOMContentLoaded', function () {
    var input = document.getElementById('completarDespuesInput');
    if (!input) return;
    input.addEventListener('change', function () {
        var file = this.files[0];
        var TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
        if (!file || !TIPOS_PERMITIDOS.includes(file.type)) return;
        _completarFotoFile = file;
        _renderFotoResultado();
        input.value = '';
    });
});

async function confirmarCompletar() {
    var errorEl = document.getElementById('completarError');
    errorEl.classList.remove('visible');

    if (!_completarFotoFile) {
        errorEl.textContent = 'Tenés que subir una foto del resultado (obligatorio)';
        errorEl.classList.add('visible');
        return;
    }

    var btn = document.getElementById('btnConfirmarCompletar');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
        // Enviar foto y texto al endpoint /completar (multipart)
        var formData = new FormData();
        formData.append('foto_resultado', _completarFotoFile, _completarFotoFile.name);
        var descripcion = (document.getElementById('completar-descripcion').value || '').trim();
        if (descripcion) formData.append('texto_resultado', descripcion);

        var resp = await fetch('/api/jobs/' + _completarJobId + '/completar', {
            method: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + Auth.getToken() },
            body: formData
        });
        var data = await resp.json();

        if (!data.success) {
            errorEl.textContent = data.error || 'Error al marcar como completado';
            errorEl.classList.add('visible');
            return;
        }

        cerrarModalCompletar();
        App.showNotification('&#9989; Foto enviada. El dueño recibirá una notificación para confirmar.', 'success');
        await cargarTrabajos();

    } catch (err) {
        console.error('Error en confirmarCompletar:', err);
        errorEl.textContent = 'Error de conexión. Reintentá en un momento.';
        errorEl.classList.add('visible');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Enviar y esperar confirmaci\u00F3n del due\u00F1o';
    }
}

// ── ABRIR DISPUTA ────────────────────────────────────────────────────────────

var _disputaJobId = null;

function abrirModalDisputa(jobId) {
    _disputaJobId = jobId;
    var job = todosLosTrabajos.find(function (j) { return Number(j.id) === Number(jobId); });
    var tituloEl = document.getElementById('disputaTitulo');
    if (tituloEl) tituloEl.textContent = job ? job.titulo : '';
    document.getElementById('disputaMotivo').value = '';
    document.getElementById('disputaDescripcion').value = '';
    var errorEl = document.getElementById('disputaError');
    if (errorEl) { errorEl.textContent = ''; errorEl.classList.remove('visible'); }
    document.getElementById('modalDisputa').style.display = 'flex';
}

function cerrarModalDisputa() {
    document.getElementById('modalDisputa').style.display = 'none';
    _disputaJobId = null;
}

async function enviarDisputa() {
    var motivo = document.getElementById('disputaMotivo').value;
    var descripcion = document.getElementById('disputaDescripcion').value.trim();
    var errorEl = document.getElementById('disputaError');
    errorEl.textContent = ''; errorEl.classList.remove('visible');

    if (!motivo) {
        errorEl.textContent = 'Seleccioná el motivo de la disputa';
        errorEl.classList.add('visible');
        return;
    }

    var btn = document.getElementById('btnEnviarDisputa');
    btn.disabled = true; btn.textContent = 'Enviando...';

    try {
        var data = await App.apiRequest('/disputas', {
            method: 'POST',
            body: JSON.stringify({ trabajo_id: _disputaJobId, motivo: motivo, descripcion: descripcion })
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

// ── EXPORTS ──────────────────────────────────────────────────────────────────

window.filtrar                  = filtrar;
window.abrirModalAsistencia     = abrirModalAsistencia;
window.cerrarModalAsistencia    = cerrarModalAsistencia;
window.confirmarAsistenciaModal = confirmarAsistenciaModal;
window.cerrarModalGeoWarning    = cerrarModalGeoWarning;
window.confirmarIgualGeoWarning = confirmarIgualGeoWarning;
window.marcarCompletado         = marcarCompletado;
window.cerrarModalCompletar     = cerrarModalCompletar;
window.confirmarCompletar       = confirmarCompletar;
window.abrirModalDisputa        = abrirModalDisputa;
window.cerrarModalDisputa       = cerrarModalDisputa;
window.enviarDisputa            = enviarDisputa;
// abrirModalCalificacion, cerrarModalCalificacion, elegirEstrella, enviarCalificacion → shared-jobs.js
