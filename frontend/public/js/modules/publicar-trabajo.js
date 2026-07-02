/**
 * publicar-trabajo.js
 * Modulo para publicar trabajos - Labu
 */

let rubros = [];
let tipoProyecto = 'single';
let urgencia = 'normal';
let frecuencia = null;
let mediaFiles = [];
const MAX_FOTOS  = 10;
const MAX_VIDEOS = 3;
const MAX_SIZE_MB = 5;

// Mapea rubroKey del clasificador → id de la DB (se resuelve al cargar rubros)
let rubroKeyToId = {};

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '/index.html';
        return;
    }
    await cargarRubros();
    setupEventListeners();
    setupAutoDetect();
    detectarUbicacion();
});

async function cargarRubros() {
    try {
        const data = await App.apiRequest('/rubros');
        rubros = data.rubros || [];
        const select = document.getElementById('select-rubro');
        rubros.forEach(function (r) {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = r.nombre;
            select.appendChild(opt);
            // Mapear nombre normalizado → id para auto-selección
            const normNombre = r.nombre.toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            rubroKeyToId[normNombre] = r.id;
        });
    } catch (err) {
        console.error('Error cargando rubros:', err);
    }
}

function setupEventListeners() {
    document.getElementById('recurrent').addEventListener('change', function () {
        document.getElementById('recurrentOptions').style.display = this.checked ? 'block' : 'none';
    });

    document.querySelectorAll('.urgency-option').forEach(function (option) {
        option.addEventListener('click', function () {
            document.querySelectorAll('.urgency-option').forEach(function (o) { o.classList.remove('selected'); });
            this.classList.add('selected');
            urgencia = this.querySelector('input[type="radio"]').value;
        });
    });

    setupMediaUpload();
}

// ─── UPLOAD FOTOS/VIDEOS ───────────────────────────────────────────────────────

function setupMediaUpload() {
    var uploadArea  = document.getElementById('uploadArea');
    var mediaInput  = document.getElementById('mediaInput');
    if (!uploadArea || !mediaInput) return;

    uploadArea.addEventListener('click', function (e) {
        if (e.target !== mediaInput) mediaInput.click();
    });

    mediaInput.addEventListener('change', function () {
        addMediaFiles(Array.from(this.files));
        this.value = '';
    });

    uploadArea.addEventListener('dragover', function (e) {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', function () {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', function (e) {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        addMediaFiles(Array.from(e.dataTransfer.files));
    });
}

function addMediaFiles(files) {
    var errores = [];

    files.forEach(function (file) {
        var TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
        var isPhoto = TIPOS_PERMITIDOS.includes(file.type);

        if (!isPhoto) {
            errores.push(file.name + ': solo se aceptan imágenes JPEG, PNG o WebP');
            return;
        }
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            errores.push(file.name + ': supera los ' + MAX_SIZE_MB + 'MB');
            return;
        }

        var currentPhotos = mediaFiles.filter(function (f) { return f.type.startsWith('image/'); }).length;

        if (currentPhotos >= MAX_FOTOS) {
            errores.push('M\u00e1ximo ' + MAX_FOTOS + ' fotos permitidas');
            return;
        }

        mediaFiles.push(file);
    });

    if (errores.length > 0) mostrarError(errores[0]);
    renderMediaPreviews();
}

function removeMedia(index) {
    mediaFiles.splice(index, 1);
    renderMediaPreviews();
}

function renderMediaPreviews() {
    var grid    = document.getElementById('mediaPreviewGrid');
    var counter = document.getElementById('mediaCounter');
    if (!grid) return;

    grid.innerHTML = '';

    mediaFiles.forEach(function (file, index) {
        var item    = document.createElement('div');
        item.className = 'media-preview-item';

        var url = URL.createObjectURL(file);

        var img = document.createElement('img');
        img.src = url;
        img.alt = file.name;
        item.appendChild(img);

        var btn = document.createElement('button');
        btn.className = 'media-remove';
        btn.type      = 'button';
        btn.title     = 'Eliminar';
        btn.innerHTML = '&#10005;';
        btn.addEventListener('click', (function (i, u) {
            return function (e) {
                e.stopPropagation();
                URL.revokeObjectURL(u);
                removeMedia(i);
            };
        })(index, url));
        item.appendChild(btn);

        grid.appendChild(item);
    });

    if (counter) {
        var photos = mediaFiles.filter(function (f) { return f.type.startsWith('image/'); }).length;

        if (mediaFiles.length > 0) {
            var parts = [];
            if (photos > 0) parts.push(photos + ' foto' + (photos !== 1 ? 's' : ''));
            counter.textContent  = parts.join(' \u00b7 ') + ' adjuntos';
            counter.style.display = 'block';
        } else {
            counter.style.display = 'none';
        }
    }
}

// ─── FIN UPLOAD ───────────────────────────────────────────────────────────────

// ─── AUTO-DETECT ──────────────────────────────────────────────────────────────

let _detectTimer = null;

function setupAutoDetect() {
    if (typeof TextClassifier === 'undefined') return;

    // Inyectar chip en el DOM, debajo del select-rubro
    const selectRubro = document.getElementById('select-rubro');
    if (!selectRubro) return;

    const chip = document.createElement('div');
    chip.id = 'rubro-chip';
    chip.className = 'rubro-chip';
    chip.innerHTML =
        '<span class="chip-icon"></span>' +
        '<span class="chip-label"></span>' +
        '<button class="chip-accept">&#10003; Usar</button>' +
        '<button class="chip-dismiss">&#10005;</button>';
    selectRubro.parentNode.insertBefore(chip, selectRubro.nextSibling);

    chip.querySelector('.chip-accept').addEventListener('click', function () {
        applyChipSuggestion(chip);
    });
    chip.querySelector('.chip-dismiss').addEventListener('click', function () {
        chip.classList.remove('visible');
    });

    // Escuchar título y descripción
    ['input-titulo', 'input-descripcion'].forEach(function (id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', function () {
            clearTimeout(_detectTimer);
            _detectTimer = setTimeout(runDetect, 350);
        });
    });
}

function runDetect() {
    const titulo = (document.getElementById('input-titulo') || {}).value || '';
    const desc   = (document.getElementById('input-descripcion') || {}).value || '';
    const text   = (titulo + ' ' + desc).trim();

    const chip = document.getElementById('rubro-chip');
    if (!chip) return;

    // No sugerir si el usuario ya eligió manualmente
    const selectRubro = document.getElementById('select-rubro');
    if (selectRubro && selectRubro.value) {
        chip.classList.remove('visible');
        return;
    }

    const result = TextClassifier.detect(text);

    if (!result || result.score < 2) {
        chip.classList.remove('visible');
        return;
    }

    chip.dataset.rubroKey = result.rubroKey;
    chip.dataset.rubroNombre = result.nombre;

    chip.querySelector('.chip-icon').textContent = result.icon + ' ';

    let labelHtml = 'Rubro detectado: <strong>' + result.nombre + '</strong>';
    if (result.task) {
        labelHtml += ' <span class="chip-task">· ' + result.task + '</span>';
    }
    chip.querySelector('.chip-label').innerHTML = labelHtml;
    chip.classList.add('visible');
}

function applyChipSuggestion(chip) {
    const nombre = chip.dataset.rubroNombre || '';
    const normNombre = nombre.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const id = rubroKeyToId[normNombre];

    const select = document.getElementById('select-rubro');
    if (select && id) {
        select.value = id;
    } else if (select) {
        // Fallback: buscar por nombre parcial entre las opciones
        const opts = Array.from(select.options);
        const match = opts.find(function (o) {
            return o.textContent.toLowerCase().normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '').includes(normNombre);
        });
        if (match) select.value = match.value;
    }
    chip.classList.remove('visible');
}

// ─── FIN AUTO-DETECT ──────────────────────────────────────────────────────────

// ─── GEOLOCALIZACIÓN ──────────────────────────────────────────────────────────

async function detectarUbicacion() {
    var btn = document.getElementById('btnGeo');
    var msg = document.getElementById('geoMsg');

    if (!navigator.geolocation) {
        if (msg) { msg.textContent = 'Tu navegador no soporta geolocalización.'; msg.className = 'geo-msg error'; }
        return;
    }

    if (btn) { btn.disabled = true; btn.textContent = '⌛ Detectando ubicación...'; }
    if (msg) { msg.textContent = ''; msg.className = 'geo-msg'; }

    navigator.geolocation.getCurrentPosition(
        async function (pos) {
            var lat = pos.coords.latitude;
            var lng = pos.coords.longitude;

            var latInput = document.getElementById('input-lat');
            var lngInput = document.getElementById('input-lng');
            if (latInput) latInput.value = lat;
            if (lngInput) lngInput.value = lng;

            try {
                var resp = await fetch(
                    'https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lng + '&format=json&accept-language=es',
                    { headers: { 'Accept-Language': 'es' } }
                );
                var geo = await resp.json();
                var addr = geo.address || {};
                var ciudad = addr.city || addr.town || addr.village || addr.county || '';
                var provincia = addr.state || '';

                var ciudadInput = document.getElementById('input-ciudad');
                var provinciaInput = document.getElementById('input-provincia');
                if (ciudadInput && ciudad) ciudadInput.value = ciudad;
                if (provinciaInput && provincia) provinciaInput.value = provincia;

                if (btn) { btn.textContent = '✓ Ubicación detectada'; btn.className = 'btn-geo success'; btn.disabled = false; }
                if (msg) {
                    msg.textContent = '📍 ' + (ciudad || '') + (provincia ? ', ' + provincia : '') +
                        ' (' + lat.toFixed(4) + ', ' + lng.toFixed(4) + ')';
                    msg.className = 'geo-msg success';
                }
            } catch (e) {
                // Tenemos coordenadas pero no pudimos hacer reverse geocoding
                if (btn) { btn.textContent = '📍 Detectar mi ubicación'; btn.disabled = false; }
                if (msg) { msg.textContent = 'Coordenadas obtenidas. Ingresá la ciudad manualmente.'; msg.className = 'geo-msg'; }
            }
        },
        function () {
            if (btn) { btn.disabled = false; btn.textContent = '📍 Detectar mi ubicación'; }
            if (msg) { msg.textContent = 'No se pudo obtener la ubicación. Ingresala manualmente.'; msg.className = 'geo-msg error'; }
        },
        { timeout: 10000 }
    );
}

// ─── FIN GEOLOCALIZACIÓN ──────────────────────────────────────────────────────

function selectProjectType(element, tipo) {
    document.querySelectorAll('.project-type').forEach(function (t) { t.classList.remove('selected'); });
    element.classList.add('selected');
    tipoProyecto = tipo;
    if (tipo === 'complete') {
        var modal = document.getElementById('modalProyectoCompleto');
        if (modal) modal.classList.add('active');
    }
}

function selectFrequency(element) {
    document.querySelectorAll('.recurrent-btn').forEach(function (btn) { btn.classList.remove('selected'); });
    element.classList.add('selected');
    frecuencia = element.textContent.trim();
}

function mostrarError(msg) {
    const el = document.getElementById('formError');
    el.textContent = msg;
    el.classList.add('visible');
    setTimeout(function () { el.classList.remove('visible'); }, 4000);
}

async function publishJob() {
    const titulo      = document.getElementById('input-titulo').value.trim();
    const descripcion = document.getElementById('input-descripcion').value.trim();
    const rubro_id    = document.getElementById('select-rubro').value || null;
    const modalidad   = document.getElementById('select-modalidad').value || 'presencial';
    const ciudad      = document.getElementById('input-ciudad').value.trim() || null;
    const provincia   = document.getElementById('input-provincia').value.trim() || null;
    const lat         = document.getElementById('input-lat').value || null;
    const lng         = document.getElementById('input-lng').value || null;
    const pmin        = document.getElementById('input-presupuesto-min').value || null;
    const pmax        = document.getElementById('input-presupuesto-max').value || null;
    const es_urgente  = urgencia === 'very-urgent' || urgencia === 'urgent';

    if (!titulo) { mostrarError('El t&#237;tulo es obligatorio'); return; }
    if (!descripcion) { mostrarError('La descripci&#243;n es obligatoria'); return; }
    if (descripcion.length < 20) { mostrarError('La descripci&#243;n debe tener al menos 20 caracteres'); return; }

    const btn = document.getElementById('btnPublicar');
    btn.disabled    = true;
    btn.textContent = 'Publicando...';

    try {
        const jobData = {
            titulo,
            descripcion,
            rubro_id,
            modalidad,
            ciudad,
            provincia,
            latitud: lat ? Number(lat) : null,
            longitud: lng ? Number(lng) : null,
            presupuesto_min: pmin ? Number(pmin) : null,
            presupuesto_max: pmax ? Number(pmax) : null,
            es_urgente
        };

        let data;
        if (mediaFiles.length > 0) {
            const formData = new FormData();
            formData.append('data', JSON.stringify(jobData));
            mediaFiles.forEach(function (file) {
                formData.append('media', file, file.name);
            });
            const response = await fetch('/api/jobs', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + Auth.getToken() },
                body: formData
            });
            data = await response.json();
        } else {
            data = await App.apiRequest('/jobs', {
                method: 'POST',
                body: JSON.stringify(jobData)
            });
        }

        if (data.success) {
            App.showNotification('&#161;Trabajo publicado exitosamente!', 'success');
            setTimeout(function () {
                window.location.href = '/pages/feed.html';
            }, 1500);
        } else {
            mostrarError(data.error || 'Error al publicar');
        }

    } catch (err) {
        console.error('Error publicando trabajo:', err);
        mostrarError('Error de conexi&#243;n');
    } finally {
        btn.disabled    = false;
        btn.textContent = '&#128640; Publicar Trabajo';
    }
}

async function saveDraft() {
    App.showNotification('Funci&#243;n de borrador pr&#243;ximamente', 'info');
}

window.selectProjectType  = selectProjectType;
window.selectFrequency    = selectFrequency;
window.publishJob         = publishJob;
window.saveDraft          = saveDraft;
window.detectarUbicacion  = detectarUbicacion;
