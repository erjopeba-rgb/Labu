/**
 * catalogo.js
 * Catálogo de servicios: muestra rubros con conteo de trabajadores.
 */

// ─── ICONOS POR DEFECTO POR RUBRO (fallback si la DB no tiene icono) ───────
var ICONOS_FALLBACK = {
    'electricidad':   '⚡',
    'plomería':       '🔧',
    'plomeria':       '🔧',
    'pintura':        '🎨',
    'carpintería':    '🪵',
    'carpinteria':    '🪵',
    'albañilería':    '🧱',
    'albanileria':    '🧱',
    'limpieza':       '🧹',
    'jardinería':     '🌿',
    'jardineria':     '🌿',
    'gas':            '🔥',
    'refrigeración':  '❄️',
    'refrigeracion':  '❄️',
    'mudanza':        '📦',
    'cerrajería':     '🔑',
    'cerrajeria':     '🔑',
    'informática':    '💻',
    'informatica':    '💻',
};

function iconoParaRubro(nombre, iconoDb) {
    if (iconoDb) return iconoDb;
    var clave = (nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (var k in ICONOS_FALLBACK) {
        if (clave.indexOf(k.normalize('NFD').replace(/[\u0300-\u036f]/g, '')) !== -1) {
            return ICONOS_FALLBACK[k];
        }
    }
    return '🛠️';
}

// ─── INICIALIZACIÓN ────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
    cargarCatalogo();
});

// ─── CARGA ────────────────────────────────────────────────────────────────

async function cargarCatalogo() {
    mostrarSkeletons();

    try {
        const data = await App.apiRequest('/catalogo/rubros/estadisticas');
        const rubros = Array.isArray(data) ? data : (data.data || []);
        renderRubros(rubros);
    } catch (err) {
        console.error('Error cargando catálogo:', err);
        mostrarError();
    }
}

// ─── RENDER ───────────────────────────────────────────────────────────────

function renderRubros(rubros) {
    var grid = document.getElementById('rubrosGrid');

    if (!rubros || rubros.length === 0) {
        grid.innerHTML =
            '<div class="catalogo-error">' +
                '<div style="font-size:3rem;margin-bottom:1rem;">📂</div>' +
                '<h3>Sin categorías disponibles</h3>' +
                '<p>No hay rubros cargados en la plataforma todavía.</p>' +
            '</div>';
        return;
    }

    grid.innerHTML = rubros.map(function (rubro) {
        return renderTarjetaRubro(rubro);
    }).join('');
}

function renderTarjetaRubro(rubro) {
    var icono = iconoParaRubro(rubro.nombre, rubro.icono);
    var totalTrabajadores = parseInt(rubro.total_trabajadores) || 0;
    var totalTareas = parseInt(rubro.total_tareas) || 0;

    var textoTrabajadores = totalTrabajadores === 1
        ? '<strong>' + totalTrabajadores + '</strong> trabajador disponible'
        : '<strong>' + totalTrabajadores + '</strong> trabajadores disponibles';

    var tareasHtml = '';
    if (rubro.tareas && rubro.tareas.length > 0) {
        var visibles = rubro.tareas.slice(0, 4);
        var extras = rubro.tareas.length - visibles.length;
        tareasHtml = visibles.map(function (t) {
            return '<span class="tarea-chip">' + t.nombre + '</span>';
        }).join('');
        if (extras > 0) {
            tareasHtml += '<span class="tareas-mas">+' + extras + ' más</span>';
        }
    } else if (totalTareas > 0) {
        tareasHtml = '<span class="tarea-chip">' + totalTareas + ' servicios</span>';
    }

    var btnHtml;
    if (totalTrabajadores > 0) {
        btnHtml = '<a href="/pages/busqueda-avanzada.html?rubro_id=' + rubro.id +
            '" class="btn-ver-trabajadores">Ver trabajadores</a>';
    } else {
        btnHtml = '<span class="btn-ver-trabajadores sin-trabajadores">Sin trabajadores aún</span>';
    }

    return '<div class="rubro-card">' +
        '<div class="rubro-card-top">' +
            '<div class="rubro-icono">' + icono + '</div>' +
            '<div class="rubro-info">' +
                '<div class="rubro-nombre">' + rubro.nombre + '</div>' +
                '<div class="rubro-conteo">' + textoTrabajadores + '</div>' +
            '</div>' +
        '</div>' +
        (tareasHtml ? '<div class="rubro-tareas">' + tareasHtml + '</div>' : '') +
        btnHtml +
    '</div>';
}

// ─── ESTADOS ─────────────────────────────────────────────────────────────

function mostrarSkeletons() {
    var grid = document.getElementById('rubrosGrid');
    var html = '';
    for (var i = 0; i < 6; i++) {
        html +=
            '<div class="skeleton-card">' +
                '<div style="display:flex;gap:0.85rem;align-items:center;">' +
                    '<div class="skeleton-line" style="width:48px;height:48px;border-radius:var(--radius);flex-shrink:0;"></div>' +
                    '<div style="flex:1;">' +
                        '<div class="skeleton-line" style="height:16px;width:70%;margin-bottom:8px;"></div>' +
                        '<div class="skeleton-line" style="height:12px;width:45%;"></div>' +
                    '</div>' +
                '</div>' +
                '<div style="display:flex;gap:0.4rem;">' +
                    '<div class="skeleton-line" style="height:24px;width:80px;border-radius:999px;"></div>' +
                    '<div class="skeleton-line" style="height:24px;width:70px;border-radius:999px;"></div>' +
                '</div>' +
                '<div class="skeleton-line" style="height:38px;width:100%;border-radius:var(--radius);"></div>' +
            '</div>';
    }
    grid.innerHTML = html;
}

function mostrarError() {
    var grid = document.getElementById('rubrosGrid');
    grid.innerHTML =
        '<div class="catalogo-error" style="grid-column:1/-1;">' +
            '<div style="font-size:3rem;margin-bottom:1rem;">⚠️</div>' +
            '<h3>Error al cargar el catálogo</h3>' +
            '<p>No se pudieron obtener las categorías. Intentá nuevamente.</p>' +
            '<button class="btn-reintentar" onclick="cargarCatalogo()">Reintentar</button>' +
        '</div>';
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────

window.cargarCatalogo = cargarCatalogo;
