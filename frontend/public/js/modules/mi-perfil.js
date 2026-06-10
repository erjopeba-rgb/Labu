/**
 * mi-perfil.js
 * Modulo de perfil de usuario - Labu
 */

let perfilData  = null;
let todosRubros = [];
let zonasActivas = [];  // array de strings

function _avatarColorBg(nombre) {
    var paleta = ['#3b82f6','#8b5cf6','#ec4899','#f97316','#10b981','#f59e0b','#06b6d4','#6366f1'];
    var h = 0, s = nombre || '';
    for (var i = 0; i < s.length; i++) h = (s.charCodeAt(i) + ((h << 5) - h)) | 0;
    return paleta[Math.abs(h) % paleta.length];
}

function _spinnerHtml(msg) {
    return '<div style="text-align:center;padding:2rem;color:var(--gray);">' +
        '<style>.rt-spin{animation:rt-spin 0.8s linear infinite}@keyframes rt-spin{to{transform:rotate(360deg)}}</style>' +
        '<div class="rt-spin" style="width:32px;height:32px;border:3px solid #e0e0e0;border-top-color:var(--primary,#3b82f6);border-radius:50%;margin:0 auto 1rem;"></div>' +
        '<p>' + (msg || 'Cargando...') + '</p></div>';
}

function _errorHtml(msg) {
    return '<div style="text-align:center;padding:2rem;color:var(--danger,#ef4444);">' +
        '<div style="font-size:2rem;margin-bottom:0.5rem;">&#9888;</div>' +
        '<p>' + (msg || 'Ocurri&#243; un error.') + '</p>' +
        '</div>';
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '/index.html';
        return;
    }

    // Logout link
    var logoutLink = document.querySelector('[data-action="logout"]');
    if (logoutLink) logoutLink.addEventListener('click', function () { Auth.logout(); });

    // Validación inline de campos obligatorios
    function _validarNoVacio(inputId, errId) {
        var input = document.getElementById(inputId);
        var err   = document.getElementById(errId);
        if (!input || !err) return true;
        var valido = input.value.trim().length > 0;
        input.classList.toggle('input-error', !valido);
        err.classList.toggle('visible', !valido);
        return valido;
    }
    ['edit-nombre', 'edit-apellido'].forEach(function(id) {
        var input = document.getElementById(id);
        if (!input) return;
        var errId = 'err-' + id.replace('edit-', '');
        input.addEventListener('blur', function() { _validarNoVacio(id, errId); });
        input.addEventListener('input', function() {
            if (!this.classList.contains('input-error')) return;
            _validarNoVacio(id, errId);
        });
    });

    await cargarPerfil();
});

async function cargarVerificacion() {
    const estadoEl = document.getElementById('verificacionEstado');
    const btnEl    = document.getElementById('btnIniciarVerificacion');
    if (!estadoEl) return;
    try {
        const token = Auth.getToken();
        const res   = await fetch('/api/verificacion/estado', {
            headers: { Authorization: 'Bearer ' + token }
        });
        const data = await res.json();
        const estado = (data.estado && data.estado.estado) || 'no_verificado';

        const badges = {
            aprobado:       '<span style="display:inline-flex;align-items:center;gap:0.35rem;background:#dcfce7;color:#166534;padding:0.35rem 0.85rem;border-radius:20px;font-size:0.88rem;font-weight:600;">&#9989; Identidad verificada</span>',
            pendiente:      '<span style="display:inline-flex;align-items:center;gap:0.35rem;background:#fef9c3;color:#854d0e;padding:0.35rem 0.85rem;border-radius:20px;font-size:0.88rem;font-weight:600;">&#8987; Verificación en revisión</span>',
            rechazado:      '<span style="display:inline-flex;align-items:center;gap:0.35rem;background:#fee2e2;color:#991b1b;padding:0.35rem 0.85rem;border-radius:20px;font-size:0.88rem;font-weight:600;">&#10060; Verificación rechazada</span>',
            no_verificado:  '<span style="display:inline-flex;align-items:center;gap:0.35rem;background:#f3f4f6;color:#374151;padding:0.35rem 0.85rem;border-radius:20px;font-size:0.88rem;font-weight:600;">&#128274; No verificado</span>',
        };
        estadoEl.innerHTML = badges[estado] || badges['no_verificado'];

        if (estado === 'rechazado' && data.estado && data.estado.motivo_rechazo) {
            estadoEl.innerHTML += '<p style="font-size:0.83rem;color:#991b1b;margin-top:0.5rem;">Motivo: ' + data.estado.motivo_rechazo + '</p>';
        }

        // Mostrar botón si puede enviar (no verificado o rechazado)
        if (btnEl) {
            btnEl.style.display = (estado === 'no_verificado' || estado === 'rechazado') ? '' : 'none';
        }
    } catch (e) {
        if (estadoEl) estadoEl.textContent = 'No se pudo cargar el estado.';
    }
}

async function cargarPerfil() {
    const progresoEl = document.getElementById('progresoContent');
    if (progresoEl) progresoEl.innerHTML = _spinnerHtml();
    try {
        const usuario = Auth.getUser();
        const modoActivo   = usuario && (usuario.perfil_activo || usuario.tipo_perfil);
        const esTrabajador = modoActivo === 'trabajador';

        // Mostrar / ocultar sección trabajador
        document.querySelectorAll('.trabajador-field').forEach(function (el) {
            el.style.display = esTrabajador ? '' : 'none';
        });

        const [perfilRes] = await Promise.all([
            App.apiRequest('/profile'),
            esTrabajador ? cargarRubrosDisponibles() : Promise.resolve()
        ]);

        perfilData = perfilRes.perfil;

        const nombre   = perfilData && perfilData.nombre
            ? (perfilData.nombre + ' ' + (perfilData.apellido || '')).trim()
            : usuario.email;
        const iniciales = nombre.substring(0, 2).toUpperCase();

        // Avatar
        const avatarEl = document.getElementById('profileAvatar');
        if (perfilData && perfilData.avatar_url) {
            avatarEl.innerHTML = '<img src="' + perfilData.avatar_url + '" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
        } else {
            avatarEl.textContent = iniciales;
            avatarEl.style.background = _avatarColorBg(nombre);
        }

        // Avatar preview en el form
        const previewEl = document.getElementById('avatarPreviewCircle');
        if (previewEl) {
            if (perfilData && perfilData.avatar_url) {
                previewEl.innerHTML = '<img src="' + perfilData.avatar_url + '" alt="avatar">';
            } else {
                previewEl.textContent = iniciales;
                previewEl.style.background = _avatarColorBg(nombre);
            }
        }

        document.getElementById('profileNombre').textContent = nombre;
        document.getElementById('profileEmail').textContent  = usuario.email;

        const rolLabels = { dueno: 'Due&#241;o', trabajador: 'Trabajador', tienda: 'Tienda' };
        document.getElementById('profileRol').innerHTML = rolLabels[modoActivo] || modoActivo;

        if (perfilData) {
            document.getElementById('edit-nombre').value    = perfilData.nombre    || '';
            document.getElementById('edit-apellido').value  = perfilData.apellido  || '';
            document.getElementById('edit-telefono').value  = perfilData.telefono  || '';
            document.getElementById('edit-ciudad').value    = perfilData.ciudad    || '';
            document.getElementById('edit-provincia').value = perfilData.provincia || '';
            document.getElementById('edit-descripcion').value = perfilData.descripcion || '';

            if (esTrabajador) {
                var aniosEl = document.getElementById('edit-anios-experiencia');
                if (aniosEl) aniosEl.value = perfilData.anios_experiencia != null ? perfilData.anios_experiencia : '';

                var habilEl = document.getElementById('edit-descripcion-habilidades');
                if (habilEl) habilEl.value = perfilData.descripcion_habilidades || '';

                var herrEl = document.getElementById('edit-herramientas');
                if (herrEl) herrEl.value = perfilData.herramientas || '';

                var dispEl = document.getElementById('edit-disponibilidad-general');
                if (dispEl) dispEl.value = perfilData.disponibilidad_general || '';

                var transEl = document.getElementById('edit-medio-transporte');
                if (transEl) transEl.value = perfilData.medio_transporte || '';

                // Zonas
                zonasActivas = Array.isArray(perfilData.zonas) ? perfilData.zonas.slice() : [];
                renderZonasTags();

                // Rubros seleccionados
                if (Array.isArray(perfilData.rubros)) {
                    var selectedIds = perfilData.rubros.map(function (r) { return r.id; });
                    document.querySelectorAll('.rubro-check').forEach(function (cb) {
                        cb.checked = selectedIds.indexOf(parseInt(cb.value)) !== -1;
                    });
                }
            }
        }

        await cargarStats();
        cargarProgreso(esTrabajador);
        actualizarVisibilidadEdicion();
        cargarVerificacion();

    } catch (err) {
        console.error('Error cargando perfil:', err);
        App.showNotification('No se pudo cargar el perfil. Intent&#225; recargar la p&#225;gina.', 'error');
        var progresoEl2 = document.getElementById('progresoContent');
        if (progresoEl2) progresoEl2.innerHTML = _errorHtml('No se pudo cargar el progreso del perfil.');
    }
}

async function cargarRubrosDisponibles() {
    try {
        const token = Auth.getToken();
        const res   = await fetch('/api/rubros', { headers: { Authorization: 'Bearer ' + token } });
        const data  = await res.json();
        todosRubros = Array.isArray(data) ? data : (data.rubros || []);
        renderRubrosGrid();
    } catch (e) {
        console.error('Error cargando rubros:', e);
    }
}

function renderRubrosGrid() {
    var grid = document.getElementById('rubrosGrid');
    if (!grid) return;
    if (!todosRubros.length) {
        grid.innerHTML = '<span style="color:var(--gray);font-size:0.85rem;">No hay rubros disponibles.</span>';
        return;
    }
    grid.innerHTML = todosRubros.map(function (r) {
        return '<label class="rubro-check-item">' +
            '<input type="checkbox" class="rubro-check" value="' + r.id + '">' +
            '<span>' + (r.icono || '') + ' ' + r.nombre + '</span>' +
        '</label>';
    }).join('');
}

// ─── ZONAS ───────────────────────────────────────────────────────────────────

function renderZonasTags() {
    var container = document.getElementById('zonasTags');
    if (!container) return;
    container.innerHTML = zonasActivas.map(function (z, i) {
        return '<span class="zona-tag">' + z +
            '<button type="button" onclick="quitarZona(' + i + ')" title="Quitar">&#10005;</button>' +
        '</span>';
    }).join('');
}

function agregarZona() {
    var input = document.getElementById('edit-zona-input');
    if (!input) return;
    var val = input.value.trim();
    if (!val) return;
    if (zonasActivas.indexOf(val) === -1) {
        zonasActivas.push(val);
        renderZonasTags();
    }
    input.value = '';
    input.focus();
}

function quitarZona(idx) {
    zonasActivas.splice(idx, 1);
    renderZonasTags();
}

// ─── AVATAR PREVIEW ──────────────────────────────────────────────────────────

function previewAvatar(input) {
    if (!input.files || !input.files[0]) return;
    var reader = new FileReader();
    reader.onload = function (e) {
        var previewEl = document.getElementById('avatarPreviewCircle');
        if (previewEl) previewEl.innerHTML = '<img src="' + e.target.result + '" alt="avatar">';
    };
    reader.readAsDataURL(input.files[0]);
}

// ─── ESTRELLAS ───────────────────────────────────────────────────────────────

function renderEstrellas(promedio, tamano) {
    var pct = Math.min(Math.max((parseFloat(promedio) / 5) * 100, 0), 100).toFixed(1);
    var fs  = tamano ? 'font-size:' + tamano + ';' : '';
    return '<div class="stars-visual" style="' + fs + '" aria-label="' + promedio + ' de 5 estrellas">' +
        '<div class="stars-empty">★★★★★</div>' +
        '<div class="stars-filled" style="width:' + pct + '%">★★★★★</div>' +
    '</div>';
}

// ─── STATS ───────────────────────────────────────────────────────────────────

async function cargarStats() {
    try {
        const [trabajosData, ofertasData] = await Promise.all([
            App.apiRequest('/jobs/mis-trabajos'),
            App.apiRequest('/offers/mis-ofertas')
        ]);

        document.getElementById('statTrabajos').textContent = trabajosData.data ? trabajosData.data.length : (trabajosData.total ?? 0);
        document.getElementById('statOfertas').textContent  = ofertasData.data  ? ofertasData.data.length  : (ofertasData.total ?? 0);

        const rating  = perfilData && parseFloat(perfilData.promedio_calificacion);
        const resenas = perfilData && parseInt(perfilData.total_calificaciones) || 0;
        document.getElementById('statRating').textContent = rating > 0 ? Number(rating).toFixed(1) : '-';

        const ratingCard    = document.getElementById('ratingCard');
        const ratingDisplay = document.getElementById('ratingDisplay');
        if (rating > 0 && ratingCard && ratingDisplay) {
            ratingDisplay.innerHTML =
                '<span class="rating-big">' + Number(rating).toFixed(1) + '</span>' +
                renderEstrellas(rating, '2rem') +
                '<span class="rating-count">' + resenas + ' reseña' + (resenas !== 1 ? 's' : '') + '</span>';
            ratingCard.style.display = '';
        }

    } catch (err) {
        console.error('Error cargando stats:', err);
    }
    await cargarPublicaciones();
}

async function cargarPublicaciones() {
    const lista = document.getElementById('actividadList');
    if (lista) lista.innerHTML = _spinnerHtml('Cargando publicaciones...');
    try {
        const usuario  = Auth.getUser();
        const esDueno  = usuario && (usuario.perfil_activo || usuario.tipo_perfil) === 'dueno';

        const requests = [App.apiRequest('/portfolio')];
        if (esDueno) requests.push(App.apiRequest('/jobs/mis-trabajos'));

        const results = await Promise.allSettled(requests);

        const portfolioArr = results[0].status === 'fulfilled'
            ? (Array.isArray(results[0].value) ? results[0].value : (results[0].value.items || []))
            : [];
        const jobsArr = (esDueno && results[1] && results[1].status === 'fulfilled')
            ? (results[1].value.data || [])
            : [];

        const todos = portfolioArr.map(function (i) { return { _tipo: 'portfolio', _data: i }; })
            .concat(jobsArr.map(function (j) { return { _tipo: 'job', _data: j }; }))
            .sort(function (a, b) { return new Date(b._data.creado_en) - new Date(a._data.creado_en); });

        if (todos.length === 0) {
            var emptyMsg = esDueno
                ? '<p>A&#250;n no publicaste ning&#250;n trabajo en el feed.</p>' +
                  '<small style="color:var(--gray);">Pub&#x6C;ic&#225; un trabajo desde el feed para verlo aqu&#237;.</small>'
                : '<p>A&#250;n no ten&#233;s publicaciones.</p>' +
                  '<small style="color:var(--gray);">Complet&#225; un trabajo para publicar el antes/despu&#233;s.</small>';
            lista.innerHTML = '<div class="empty-state"><div style="font-size:2rem;margin-bottom:0.5rem;">&#128247;</div>' + emptyMsg + '</div>';
            return;
        }

        lista.innerHTML = todos.map(function (entry) {
            return entry._tipo === 'job' ? renderJob(entry._data) : renderPublicacion(entry._data);
        }).join('');
    } catch (err) {
        console.error('Error cargando publicaciones:', err);
        if (lista) lista.innerHTML = _errorHtml('No se pudieron cargar las publicaciones.');
    }
}

function renderPublicacion(item) {
    var fotosHtml = '';
    if (item.foto_antes_url || item.foto_despues_url) {
        var antes   = item.foto_antes_url
            ? '<div style="flex:1;min-width:0;"><div style="font-size:0.7rem;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:0.35rem;">Antes</div><div style="border-radius:var(--radius);overflow:hidden;aspect-ratio:4/3;"><img src="' + item.foto_antes_url + '" alt="antes" style="width:100%;height:100%;object-fit:cover;display:block;"></div></div>'
            : '';
        var despues = item.foto_despues_url
            ? '<div style="flex:1;min-width:0;"><div style="font-size:0.7rem;font-weight:700;color:var(--primary);text-transform:uppercase;margin-bottom:0.35rem;">Despu&#233;s</div><div style="border-radius:var(--radius);overflow:hidden;aspect-ratio:4/3;"><img src="' + item.foto_despues_url + '" alt="despues" style="width:100%;height:100%;object-fit:cover;display:block;"></div></div>'
            : '';
        var arrow   = (antes && despues)
            ? '<div style="display:flex;align-items:center;color:var(--primary);font-size:1.25rem;flex-shrink:0;padding-top:1.2rem;">&#10132;</div>'
            : '';
        fotosHtml = '<div style="display:flex;gap:0.75rem;align-items:flex-start;margin-bottom:0.75rem;">' + antes + arrow + despues + '</div>';
    }
    var desc = item.descripcion
        ? '<div style="font-size:0.875rem;color:var(--gray);margin-top:0.5rem;">' + item.descripcion + '</div>'
        : '';
    return '<div style="border:1px solid var(--border);border-radius:var(--radius-lg,10px);padding:1rem;margin-bottom:1rem;">' +
        '<div style="font-weight:600;font-size:0.95rem;margin-bottom:0.75rem;">&#128247; ' + (item.titulo || 'Trabajo realizado') + '</div>' +
        fotosHtml + desc +
        '<div style="font-size:0.75rem;color:var(--gray);margin-top:0.5rem;">' + App.timeAgo(item.creado_en) + '</div>' +
    '</div>';
}

function renderJob(job) {
    var _parseUrls = function (val) {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch (e) { return []; }
    };
    var fotos = _parseUrls(job.fotos_urls);
    var fotosHtml = '';
    // Para trabajos completados con foto de resultado: mostrar antes/después
    if (job.estado === 'completado' && job.foto_resultado_url) {
        var fotoAntes = fotos.length > 0
            ? '<div style="flex:1;min-width:0;"><div style="font-size:0.7rem;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:0.35rem;">Antes</div><div style="border-radius:var(--radius);overflow:hidden;aspect-ratio:4/3;"><img src="' + fotos[0] + '" alt="antes" style="width:100%;height:100%;object-fit:cover;display:block;"></div></div>'
            : '';
        var fotaDespues = '<div style="flex:1;min-width:0;"><div style="font-size:0.7rem;font-weight:700;color:var(--primary);text-transform:uppercase;margin-bottom:0.35rem;">Despu&#233;s</div><div style="border-radius:var(--radius);overflow:hidden;aspect-ratio:4/3;"><img src="' + job.foto_resultado_url + '" alt="despu&#233;s" style="width:100%;height:100%;object-fit:cover;display:block;"></div></div>';
        var arrow = fotoAntes ? '<div style="display:flex;align-items:center;color:var(--primary);font-size:1.25rem;flex-shrink:0;padding-top:1.2rem;">&#10132;</div>' : '';
        fotosHtml = '<div style="display:flex;gap:0.75rem;align-items:flex-start;margin-bottom:0.75rem;">' + fotoAntes + arrow + fotaDespues + '</div>';
    } else if (fotos.length === 1) {
        fotosHtml = '<div style="border-radius:var(--radius);overflow:hidden;margin-bottom:0.75rem;"><img src="' + fotos[0] + '" alt="foto" style="width:100%;max-height:300px;object-fit:cover;display:block;"></div>';
    } else if (fotos.length > 1) {
        fotosHtml = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px;border-radius:var(--radius);overflow:hidden;margin-bottom:0.75rem;">' +
            fotos.slice(0, 4).map(function (u) { return '<img src="' + u + '" alt="foto" style="width:100%;aspect-ratio:4/3;object-fit:cover;display:block;">'; }).join('') +
        '</div>';
    }
    var presupuesto = job.presupuesto_max
        ? '$' + Number(job.presupuesto_min).toLocaleString('es-AR') + ' - $' + Number(job.presupuesto_max).toLocaleString('es-AR')
        : (job.presupuesto_min ? '$' + Number(job.presupuesto_min).toLocaleString('es-AR') : 'A convenir');
    var estadoBadge = {
        publicado:      '<span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:12px;font-size:0.75rem;font-weight:600;">&#9679; Publicado</span>',
        en_negociacion: '<span style="background:#fef9c3;color:#ca8a04;padding:2px 8px;border-radius:12px;font-size:0.75rem;font-weight:600;">&#9679; En negociaci&#243;n</span>',
        en_curso:       '<span style="background:#dbeafe;color:#2563eb;padding:2px 8px;border-radius:12px;font-size:0.75rem;font-weight:600;">&#9679; En curso</span>',
        completado:     '<span style="background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:12px;font-size:0.75rem;font-weight:600;">&#9679; Completado</span>',
    }[job.estado] || '<span style="background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:12px;font-size:0.75rem;font-weight:600;">' + job.estado + '</span>';

    var desc = job.descripcion && job.descripcion !== job.titulo
        ? '<div style="font-size:0.875rem;color:var(--gray);margin-top:0.4rem;">' + job.descripcion + '</div>'
        : '';

    return '<div style="border:1px solid var(--border);border-radius:var(--radius-lg,10px);padding:1rem;margin-bottom:1rem;">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.75rem;gap:0.5rem;">' +
            '<div style="font-weight:600;font-size:0.95rem;">&#128188; ' + (job.titulo || 'Trabajo') + '</div>' +
            estadoBadge +
        '</div>' +
        fotosHtml + desc +
        '<div style="display:flex;gap:1rem;margin-top:0.75rem;font-size:0.8rem;color:var(--gray);">' +
            '<span>&#128176; ' + presupuesto + '</span>' +
            '<span>&#128172; ' + (job.total_ofertas || 0) + ' oferta(s)</span>' +
        '</div>' +
        '<div style="font-size:0.75rem;color:var(--gray);margin-top:0.5rem;">' + App.timeAgo(job.creado_en) + '</div>' +
    '</div>';
}

// ─── PROGRESO ────────────────────────────────────────────────────────────────

function actualizarVisibilidadEdicion() {
    var section = document.getElementById('editPerfilSection');
    if (!section) return;

    var usuario      = Auth.getUser();
    var esTrabajador = usuario && (usuario.perfil_activo || usuario.tipo_perfil) === 'trabajador';

    var faltantes = [];

    // Campos base (todos los perfiles)
    ['nombre', 'apellido', 'telefono', 'ciudad', 'provincia'].forEach(function (k) {
        if (!(perfilData && perfilData[k])) faltantes.push(k);
    });

    // Campos adicionales para trabajadores
    if (esTrabajador) {
        if (!(perfilData && perfilData.avatar_url))                              faltantes.push('foto');
        if (!(perfilData && perfilData.rubros && perfilData.rubros.length > 0))  faltantes.push('rubros');
        if (!(perfilData && perfilData.anios_experiencia != null))               faltantes.push('anios_experiencia');
        if (!(perfilData && perfilData.zonas && perfilData.zonas.length > 0))    faltantes.push('zonas');
        if (!(perfilData && perfilData.medio_transporte))                         faltantes.push('medio_transporte');
    }

    if (faltantes.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = '';

    var badge = document.getElementById('editPerfilBadge');
    if (badge) {
        badge.textContent = faltantes.length + ' campo' + (faltantes.length > 1 ? 's' : '') + ' pendiente' + (faltantes.length > 1 ? 's' : '');
    }

    document.querySelectorAll('#editPerfilContent [data-field]').forEach(function (fg) {
        if (faltantes.indexOf(fg.dataset.field) !== -1) {
            fg.classList.add('field-pending');
        } else {
            fg.classList.remove('field-pending');
        }
    });
}

function cargarProgreso(esTrabajador) {
    const checks = {
        'Nombre completo':   !!(perfilData && perfilData.nombre && perfilData.apellido),
        'Tel&#233;fono':     !!(perfilData && perfilData.telefono),
        'Ciudad':            !!(perfilData && perfilData.ciudad),
        'Descripci&#243;n':  !!(perfilData && perfilData.descripcion)
    };

    if (esTrabajador) {
        checks['Rubros']           = !!(perfilData && perfilData.rubros && perfilData.rubros.length > 0);
        checks['Experiencia']      = !!(perfilData && perfilData.anios_experiencia != null);
        checks['Zonas']            = !!(perfilData && perfilData.zonas && perfilData.zonas.length > 0);
        checks['Foto de perfil']      = !!(perfilData && perfilData.avatar_url);
        checks['Medio de transporte'] = !!(perfilData && perfilData.medio_transporte);
    }

    const completados = Object.values(checks).filter(Boolean).length;
    const total       = Object.keys(checks).length;
    const porcentaje  = Math.round((completados / total) * 100);

    let html = '<div class="progress-item">' +
        '<div class="progress-header">' +
            '<span class="progress-label">Completitud del perfil</span>' +
            '<span class="progress-value">' + porcentaje + '%</span>' +
        '</div>' +
        '<div class="progress-bar"><div class="progress-fill" style="width:' + porcentaje + '%"></div></div>' +
    '</div><div style="margin-top:1.5rem;">';

    Object.entries(checks).forEach(function (entry) {
        html += '<div class="progress-check-item">' +
            '<span class="progress-check-icon">' + (entry[1] ? '&#9989;' : '&#11036;') + '</span>' +
            '<span class="progress-check-label' + (entry[1] ? '' : ' pending') + '">' + entry[0] + '</span>' +
        '</div>';
    });

    html += '</div>';
    document.getElementById('progresoContent').innerHTML = html;
}

// ─── GUARDAR ─────────────────────────────────────────────────────────────────

async function guardarPerfil() {
    const btn = document.getElementById('btnGuardar');
    btn.disabled    = true;
    btn.textContent = 'Guardando...';

    try {
        const usuario      = Auth.getUser();
        const esTrabajador = usuario && (usuario.perfil_activo || usuario.tipo_perfil) === 'trabajador';

        // Rubros seleccionados
        var rubrosSeleccionados = [];
        if (esTrabajador) {
            document.querySelectorAll('.rubro-check:checked').forEach(function (cb) {
                rubrosSeleccionados.push(parseInt(cb.value));
            });
        }

        const body = {
            nombre:      document.getElementById('edit-nombre').value.trim(),
            apellido:    document.getElementById('edit-apellido').value.trim()    || null,
            telefono:    document.getElementById('edit-telefono').value.trim()    || null,
            ciudad:      document.getElementById('edit-ciudad').value.trim()      || null,
            provincia:   document.getElementById('edit-provincia').value.trim()   || null,
            descripcion: document.getElementById('edit-descripcion').value.trim() || null
        };

        if (esTrabajador) {
            var aniosEl = document.getElementById('edit-anios-experiencia');
            var habilEl = document.getElementById('edit-descripcion-habilidades');
            var herrEl  = document.getElementById('edit-herramientas');
            var dispEl  = document.getElementById('edit-disponibilidad-general');
            body.anios_experiencia       = aniosEl && aniosEl.value !== '' ? parseInt(aniosEl.value) : null;
            body.descripcion_habilidades = habilEl ? (habilEl.value.trim() || null) : null;
            body.herramientas            = herrEl  ? (herrEl.value.trim() || null)  : null;
            body.disponibilidad_general  = dispEl  ? (dispEl.value || null)         : null;
            var transEl = document.getElementById('edit-medio-transporte');
            body.medio_transporte = transEl ? (transEl.value || null) : null;
            body.rubros = rubrosSeleccionados;
            body.zonas  = zonasActivas.slice();
        }

        const data = await App.apiRequest('/profile/complete', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        if (!data.success) {
            App.showNotification(data.error || 'Error al guardar', 'error');
            return;
        }

        // Subir foto si hay una seleccionada
        const avatarInput = document.getElementById('edit-avatar');
        if (avatarInput && avatarInput.files && avatarInput.files[0]) {
            const formData = new FormData();
            formData.append('avatar', avatarInput.files[0]);
            const token = Auth.getToken();
            const avatarRes = await fetch('/api/profile/avatar', {
                method: 'POST',
                headers: { Authorization: 'Bearer ' + token },
                body: formData
            });
            const avatarData = await avatarRes.json();
            if (!avatarData.success) {
                App.showNotification('Perfil guardado, pero hubo un error al subir la foto', 'warning');
            }
        }

        // Actualizar datos en localStorage
        const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
        userData.nombre   = body.nombre;
        userData.apellido = body.apellido;
        localStorage.setItem('user_data', JSON.stringify(userData));

        const msg = document.getElementById('editSuccess');
        msg.classList.add('visible');
        setTimeout(function () { msg.classList.remove('visible'); }, 3000);

        await cargarPerfil();

    } catch (err) {
        console.error('Error guardando perfil:', err);
        App.showNotification('Error de conexi&#243;n', 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Guardar Cambios';
    }
}

// ─── VERIFICACIÓN DE IDENTIDAD ───────────────────────────────────────────────

window.abrirModalVerificacion = function () {
    document.getElementById('inputDniFrente').value = '';
    document.getElementById('inputDniDorso').value  = '';
    document.getElementById('inputSelfie').value    = '';
    const errEl = document.getElementById('verifError');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    document.getElementById('modalVerificacion').style.display = 'flex';
};

window.cerrarModalVerificacion = function () {
    document.getElementById('modalVerificacion').style.display = 'none';
};

window.enviarVerificacion = async function () {
    const dniFrente = document.getElementById('inputDniFrente').files[0];
    const dniDorso  = document.getElementById('inputDniDorso').files[0];
    const selfie    = document.getElementById('inputSelfie').files[0];
    const errEl     = document.getElementById('verifError');
    const btnEl     = document.getElementById('btnEnviarVerificacion');

    if (!dniFrente || !dniDorso || !selfie) {
        errEl.textContent  = 'Debes subir las 3 fotos para continuar.';
        errEl.style.display = '';
        return;
    }

    const formData = new FormData();
    formData.append('dni_frente', dniFrente);
    formData.append('dni_dorso',  dniDorso);
    formData.append('selfie',     selfie);

    btnEl.disabled    = true;
    btnEl.textContent = 'Enviando...';
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }

    try {
        const token = Auth.getToken();
        const res   = await fetch('/api/verificacion/solicitar', {
            method:  'POST',
            headers: { Authorization: 'Bearer ' + token },
            body:    formData
        });
        const data = await res.json();
        if (!res.ok) {
            errEl.textContent  = data.error || 'Error al enviar la solicitud';
            errEl.style.display = '';
            return;
        }
        cerrarModalVerificacion();
        App.showNotification('Solicitud enviada. Te avisaremos cuando sea revisada.', 'success');
        cargarVerificacion();
    } catch (e) {
        errEl.textContent  = 'Error de conexión. Intentá de nuevo.';
        errEl.style.display = '';
    } finally {
        btnEl.disabled    = false;
        btnEl.textContent = 'Enviar';
    }
};

window.guardarPerfil  = guardarPerfil;
window.agregarZona    = agregarZona;
window.quitarZona     = quitarZona;
window.previewAvatar  = previewAvatar;
