/**
 * busqueda-avanzada.js
 * Búsqueda avanzada de trabajadores con filtros y mapa Leaflet.
 */

let resultados    = [];
let coordsUsuario = null; // { lat, lng } si geolocalización disponible
let mapa          = null;
let marcadores    = [];
let vistaActual   = 'lista'; // 'lista' | 'mapa'

// ─── INICIALIZACIÓN ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    await cargarRubros();
    solicitarUbicacionSilencioso();

    // Pre-aplicar filtro de rubro si viene desde el catálogo
    const params = new URLSearchParams(window.location.search);
    const rubroParam = params.get('rubro_id');
    if (rubroParam) {
        const selectRubro = document.getElementById('selectRubro');
        selectRubro.value = rubroParam;
        buscar();
    }

    document.getElementById('inputBusqueda').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') buscar();
    });
});

// ─── GEOLOCALIZACIÓN ──────────────────────────────────────────────────────────

function solicitarUbicacionSilencioso() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        pos => aplicarUbicacion(pos.coords.latitude, pos.coords.longitude),
        () => { /* silencioso: el usuario puede activar manualmente */ },
        { timeout: 5000 }
    );
}

function solicitarUbicacion() {
    if (!navigator.geolocation) {
        App.showNotification('Tu navegador no soporta geolocalización', 'error');
        return;
    }
    document.getElementById('geoStatusTexto').textContent = '⏳ Detectando...';
    navigator.geolocation.getCurrentPosition(
        pos => {
            aplicarUbicacion(pos.coords.latitude, pos.coords.longitude);
            buscar();
        },
        () => App.showNotification('No se pudo obtener la ubicación. Verificá los permisos del navegador.', 'error'),
        { timeout: 10000 }
    );
}

function aplicarUbicacion(lat, lng) {
    coordsUsuario = { lat, lng };
    const statusEl  = document.getElementById('geoStatus');
    const textoEl   = document.getElementById('geoStatusTexto');
    const btnEl     = document.getElementById('btnUsarUbicacion');
    statusEl.className = 'geo-status geo-con-ubicacion';
    textoEl.textContent = '📍 Usando tu ubicación';
    btnEl.textContent   = 'Actualizar';
}

// ─── RUBROS ───────────────────────────────────────────────────────────────────

async function cargarRubros() {
    try {
        const data = await App.apiRequest('/rubros');
        const rubros = data.rubros || data || [];
        const select = document.getElementById('selectRubro');
        rubros.forEach(function (r) {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = r.nombre;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error('Error cargando rubros:', err);
    }
}

// ─── BÚSQUEDA ─────────────────────────────────────────────────────────────────

async function buscar() {
    const params = new URLSearchParams();

    const q = document.getElementById('inputBusqueda').value.trim();
    if (q) params.set('q', q);

    const rubro = document.getElementById('selectRubro').value;
    if (rubro) params.set('rubro_id', rubro);

    const calMin = document.getElementById('selectCalificacion').value;
    if (calMin) params.set('calificacion_min', calMin);

    const pmax = document.getElementById('inputPMax').value;
    if (pmax) params.set('tarifa_max', pmax);

    const dia = document.getElementById('selectDia').value;
    if (dia !== '') params.set('dia_semana', dia);

    const orden = document.getElementById('selectOrden').value;
    if (orden) params.set('orden', orden);

    if (coordsUsuario) {
        params.set('lat', coordsUsuario.lat);
        params.set('lng', coordsUsuario.lng);
        params.set('radio', document.getElementById('selectRadio').value);
    }

    mostrarCargando();
    actualizarChips({ q, rubro, calMin, pmax, dia });

    try {
        const data = await App.apiRequest('/geo/trabajadores?' + params.toString());
        resultados = Array.isArray(data) ? data : (data.trabajadores || []);
        renderResultados(resultados);
        if (vistaActual === 'mapa') actualizarMapa(resultados);
    } catch (err) {
        console.error('Error buscando:', err);
        mostrarError();
    }
}

// ─── RENDER LISTA ─────────────────────────────────────────────────────────────

function renderResultados(items) {
    const grid  = document.getElementById('resultsGrid');
    const count = document.getElementById('resultsCount');

    count.innerHTML = 'Mostrando <strong>' + items.length + '</strong> resultado' + (items.length !== 1 ? 's' : '');

    if (items.length === 0) {
        grid.innerHTML =
            '<div class="no-results">' +
                '<div class="no-results-icon">🔍</div>' +
                '<h3>Sin resultados</h3>' +
                '<p>Probá con otros filtros o una búsqueda diferente</p>' +
            '</div>';
        return;
    }

    grid.innerHTML = items.map(function (item) { return UserCard.render(item); }).join('');
}

// ─── MAPA LEAFLET ─────────────────────────────────────────────────────────────

function inicializarMapa() {
    if (mapa) return;

    const centroDefault = [-34.6037, -58.3816]; // Buenos Aires
    const centro = coordsUsuario ? [coordsUsuario.lat, coordsUsuario.lng] : centroDefault;

    mapa = L.map('mapa').setView(centro, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(mapa);

    // Marcador de ubicación propia
    if (coordsUsuario) {
        L.circleMarker([coordsUsuario.lat, coordsUsuario.lng], {
            radius: 10,
            color: '#0084ff',
            fillColor: '#0084ff',
            fillOpacity: 0.8
        }).addTo(mapa).bindPopup('<strong>Tu ubicación</strong>');
    }
}

function actualizarMapa(items) {
    inicializarMapa();

    // Limpiar marcadores anteriores
    marcadores.forEach(m => mapa.removeLayer(m));
    marcadores = [];

    if (items.length === 0) return;

    const bounds = [];

    items.forEach(function (t) {
        if (!t.latitud || !t.longitud) return;

        const nombre   = t.nombre || 'Profesional';
        const rating   = t.calificacion_promedio ? '⭐ ' + Number(t.calificacion_promedio).toFixed(1) : 'Nuevo';
        const distancia = t.distancia_km ? Number(t.distancia_km).toFixed(1) + ' km' : '';

        const popup = '<div class="mapa-popup">' +
            '<strong>' + nombre + '</strong>' +
            '<div class="mapa-popup-rating">' + rating + (distancia ? ' · ' + distancia : '') + '</div>' +
            '<button class="mapa-popup-btn" onclick="verPerfil(' + t.id + ')">Ver perfil</button>' +
        '</div>';

        const marker = L.marker([parseFloat(t.latitud), parseFloat(t.longitud)])
            .addTo(mapa)
            .bindPopup(popup);

        marcadores.push(marker);
        bounds.push([parseFloat(t.latitud), parseFloat(t.longitud)]);
    });

    if (bounds.length > 0) {
        mapa.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
}

// ─── TOGGLE LISTA / MAPA ──────────────────────────────────────────────────────

function toggleVista() {
    const btn       = document.getElementById('btnToggleVista');
    const mapaDiv   = document.getElementById('mapaContainer');
    const listaDiv  = document.getElementById('resultsGrid');

    if (vistaActual === 'lista') {
        vistaActual = 'mapa';
        mapaDiv.style.display = 'block';
        listaDiv.style.display = 'none';
        btn.textContent = '☰ Lista';
        actualizarMapa(resultados);
        // Leaflet necesita invalidar el tamaño cuando el contenedor se vuelve visible
        setTimeout(() => mapa && mapa.invalidateSize(), 100);
    } else {
        vistaActual = 'lista';
        mapaDiv.style.display = 'none';
        listaDiv.style.display = 'grid';
        btn.textContent = '📍 Mapa';
    }
}

// ─── CHIPS DE FILTROS ACTIVOS ────────────────────────────────────────────────

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function actualizarChips({ q, rubro, calMin, pmax, dia }) {
    const container = document.getElementById('activeFilters');
    let html = '';
    if (q)      html += chip(q,                              'q');
    if (rubro)  html += chip('Rubro #' + rubro,              'rubro');
    if (calMin) html += chip(calMin + '+ estrellas',         'cal');
    if (pmax)   html += chip('Hasta $' + Number(pmax).toLocaleString('es-AR') + '/h', 'pmax');
    if (dia !== '' && dia != null) html += chip(DIAS[parseInt(dia)], 'dia');
    if (coordsUsuario) html += chip('📍 ' + document.getElementById('selectRadio').value + ' km', 'radio');
    container.innerHTML = html;
}

function chip(label, key) {
    return '<div class="filter-chip">' + label +
        '<button onclick="quitarFiltro(\'' + key + '\')">&#215;</button>' +
    '</div>';
}

function quitarFiltro(key) {
    if (key === 'q')     document.getElementById('inputBusqueda').value      = '';
    if (key === 'rubro') document.getElementById('selectRubro').value        = '';
    if (key === 'cal')   document.getElementById('selectCalificacion').value = '';
    if (key === 'pmax')  document.getElementById('inputPMax').value          = '';
    if (key === 'dia')   document.getElementById('selectDia').value          = '';
    if (key === 'radio') { coordsUsuario = null; document.getElementById('geoStatus').className = 'geo-status geo-sin-ubicacion'; document.getElementById('geoStatusTexto').textContent = '📌 Sin ubicación'; document.getElementById('btnUsarUbicacion').textContent = 'Activar'; }
    buscar();
}

function limpiarFiltros() {
    document.getElementById('inputBusqueda').value      = '';
    document.getElementById('selectRubro').value        = '';
    document.getElementById('selectRadio').value        = '20';
    document.getElementById('selectCalificacion').value = '';
    document.getElementById('inputPMax').value          = '';
    document.getElementById('selectDia').value          = '';
    document.getElementById('activeFilters').innerHTML  = '';
    buscar();
}

// ─── ESTADOS ─────────────────────────────────────────────────────────────────

function mostrarCargando() {
    document.getElementById('resultsGrid').innerHTML =
        '<div class="no-results"><div class="no-results-icon">⏳</div><p>Buscando...</p></div>';
    document.getElementById('resultsCount').textContent = 'Buscando...';
}

function mostrarError() {
    document.getElementById('resultsGrid').innerHTML =
        '<div class="no-results">' +
            '<div class="no-results-icon">⚠️</div>' +
            '<h3>Error al buscar</h3>' +
            '<p>Intentá nuevamente</p>' +
            '<button class="btn-filter" style="margin-top:1rem;width:auto;padding:0.75rem 2rem;" onclick="buscar()">Reintentar</button>' +
        '</div>';
    document.getElementById('resultsCount').textContent = '';
}

// ─── ACCIONES DE TARJETA ──────────────────────────────────────────────────────

function verPerfil(id) {
    window.location.href = '/pages/perfil-publico.html?id=' + id;
}

async function contactar(id) {
    if (!Auth.isAuthenticated()) {
        window.location.href = '/index.html';
        return;
    }
    try {
        const data = await App.apiRequest('/chat', {
            method: 'POST',
            body: JSON.stringify({ tipo: 'directo', participantes: [id] })
        });
        if (data.conversacion_id) {
            window.location.href = '/pages/mensajes.html';
        }
    } catch (err) {
        App.showNotification('Error al iniciar conversación', 'error');
    }
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

window.buscar           = buscar;
window.limpiarFiltros   = limpiarFiltros;
window.quitarFiltro     = quitarFiltro;
window.verPerfil        = verPerfil;
window.contactar        = contactar;
window.toggleVista      = toggleVista;
window.solicitarUbicacion = solicitarUbicacion;
