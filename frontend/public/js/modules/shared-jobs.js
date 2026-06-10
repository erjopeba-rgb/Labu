/**
 * shared-jobs.js
 * Funciones compartidas entre mis-trabajos.js (dueño) y mis-trabajos-worker.js (trabajador).
 * Debe cargarse ANTES del módulo específico de cada página.
 */

// ── SPINNER Y ERROR ───────────────────────────────────────────────────────────

function _spinnerHtml(msg) {
    return '<div style="text-align:center;padding:3rem;color:var(--gray);grid-column:1/-1;">' +
        '<style>.rt-spin{animation:rt-spin 0.8s linear infinite}@keyframes rt-spin{to{transform:rotate(360deg)}}</style>' +
        '<div class="rt-spin" style="width:36px;height:36px;border:3px solid #e0e0e0;border-top-color:var(--primary,#3b82f6);border-radius:50%;margin:0 auto 1rem;"></div>' +
        '<p>' + (msg || 'Cargando...') + '</p></div>';
}

function _errorHtml(msg, retryFn) {
    var onclick = retryFn ? retryFn + '()' : 'location.reload()';
    return '<div style="text-align:center;padding:3rem;color:var(--danger,#ef4444);grid-column:1/-1;">' +
        '<div style="font-size:2.5rem;margin-bottom:0.5rem;">&#9888;</div>' +
        '<p style="margin-bottom:1.5rem;">' + (msg || 'No pudimos cargar la información. Verificá tu conexión.') + '</p>' +
        '<button onclick="' + onclick + '" style="padding:0.6rem 1.5rem;background:var(--primary,#3b82f6);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:0.95rem;">Reintentar</button>' +
        '</div>';
}

// ── FILTRO (tabs) ─────────────────────────────────────────────────────────────

function _activarFiltroTab(estado) {
    document.querySelectorAll('.filter-tab, .stat-card').forEach(function (e) { e.classList.remove('active'); });
    document.querySelectorAll('[data-filter="' + estado + '"]').forEach(function (e) { e.classList.add('active'); });
}

// ── CALIFICACIÓN ──────────────────────────────────────────────────────────────

var _calificacionJobId   = null;
var _calificacionPuntaje = 0;

function abrirModalCalificacion(jobId) {
    _calificacionJobId   = jobId;
    _calificacionPuntaje = 0;
    document.getElementById('calificacionComentario').value = '';
    document.getElementById('calificacionError').textContent = '';
    _renderEstrellas(0);
    document.getElementById('modalCalificacion').style.display = 'flex';
}

function cerrarModalCalificacion() {
    document.getElementById('modalCalificacion').style.display = 'none';
    _calificacionJobId   = null;
    _calificacionPuntaje = 0;
}

function elegirEstrella(n) {
    _calificacionPuntaje = n;
    _renderEstrellas(n);
}

function _renderEstrellas(activo) {
    var cont = document.getElementById('calificacionEstrellas');
    if (!cont) return;
    cont.innerHTML = [1,2,3,4,5].map(function (n) {
        return '<span onclick="elegirEstrella(' + n + ')" style="font-size:2rem;cursor:pointer;color:' + (n <= activo ? '#f59e0b' : '#d1d5db') + ';">&#11088;</span>';
    }).join('');
}

async function enviarCalificacion() {
    var errorEl = document.getElementById('calificacionError');
    errorEl.textContent = '';
    errorEl.classList.remove('visible');
    if (!_calificacionPuntaje) { errorEl.textContent = 'Elegí una puntuación'; errorEl.classList.add('visible'); return; }

    var btn = document.getElementById('btnEnviarCalificacion');
    btn.disabled = true; btn.textContent = 'Enviando...';

    try {
        var resp = await fetch('/api/calificaciones/trabajo/' + _calificacionJobId, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + Auth.getToken()
            },
            body: JSON.stringify({
                puntaje:    _calificacionPuntaje,
                comentario: document.getElementById('calificacionComentario').value.trim() || null
            })
        });
        var data = await resp.json();

        if (data.error) {
            errorEl.textContent = data.error;
            errorEl.classList.add('visible');
        } else {
            cerrarModalCalificacion();
            App.showNotification('&#11088; ¡Calificación enviada!', 'success');
            await cargarTrabajos();
        }
    } catch (err) {
        errorEl.textContent = 'Error de conexión';
        errorEl.classList.add('visible');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Enviar calificación';
    }
}

// ── AVATAR COLOR ─────────────────────────────────────────────────────────────

function _avatarColorBg(nombre) {
    var paleta = ['#3b82f6','#8b5cf6','#ec4899','#f97316','#10b981','#f59e0b','#06b6d4','#6366f1'];
    var h = 0;
    var s = nombre || '';
    for (var i = 0; i < s.length; i++) h = (s.charCodeAt(i) + ((h << 5) - h)) | 0;
    return paleta[Math.abs(h) % paleta.length];
}

// ── TIMELINE DE PROGRESO ─────────────────────────────────────────────────────

function _timelineHtml(estado) {
    if (estado === 'cancelado') return '';
    var pasos = ['Publicado', 'Horario\u00A0confirmado', 'En\u00A0ejecuci\u00F3n', 'Completado'];
    var estadoAPaso = {
        publicado: 0,
        en_negociacion: 1,
        en_curso: 2,
        trabajador_llego: 2,
        pendiente_confirmacion: 2,
        completado: 3
    };
    var pasoActual = estadoAPaso[estado] !== undefined ? estadoAPaso[estado] : 0;

    var html = '<div class="job-timeline">';
    for (var i = 0; i < pasos.length; i++) {
        var done   = i < pasoActual;
        var active = i === pasoActual;
        var cls    = done ? ' tl-done' : active ? ' tl-active' : '';
        html += '<div class="tl-step' + cls + '">' +
            '<div class="tl-dot">' + (done ? '&#10003;' : (i + 1)) + '</div>' +
            '<div class="tl-label">' + pasos[i] + '</div>' +
        '</div>';
        if (i < pasos.length - 1) {
            html += '<div class="tl-line' + (done ? ' tl-done' : '') + '"></div>';
        }
    }
    html += '</div>';
    return html;
}

// ── EXPORTS ───────────────────────────────────────────────────────────────────

window._spinnerHtml            = _spinnerHtml;
window._errorHtml              = _errorHtml;
window._activarFiltroTab       = _activarFiltroTab;
window._renderEstrellas        = _renderEstrellas;
window._avatarColorBg          = _avatarColorBg;
window._timelineHtml           = _timelineHtml;
window.abrirModalCalificacion  = abrirModalCalificacion;
window.cerrarModalCalificacion = cerrarModalCalificacion;
window.elegirEstrella          = elegirEstrella;
window.enviarCalificacion      = enviarCalificacion;
