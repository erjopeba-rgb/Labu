/**
 * marketplace.js
 * Modulo de marketplace - Labu
 */

let todosLosProductos = [];
let carrito = [];
let categoriaActiva = '';

document.addEventListener('DOMContentLoaded', async () => {
    cargarCarrito();
    await cargarProductos();
    setupBusqueda();
});

async function cargarProductos(params) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    try {
        const data = await App.apiRequest('/tienda/productos' + query);
        todosLosProductos = Array.isArray(data) ? data : (data.productos || []);
        actualizarConteo(todosLosProductos.length);
        renderProductos(todosLosProductos);
    } catch (err) {
        console.error('Error cargando productos:', err);
        renderProductos([]);
    }
}

function renderProductos(productos) {
    const grid = document.getElementById('productsGrid');
    if (productos.length === 0) {
        grid.innerHTML =
            '<div class="empty-state" style="grid-column:1/-1;">' +
                '<div class="empty-icon">&#128722;</div>' +
                '<h3>Sin productos</h3>' +
                '<p>Intent&#225; con otros filtros</p>' +
            '</div>';
        return;
    }

    grid.innerHTML = productos.map(function (p) {
        const precio = '$' + Number(p.precio).toLocaleString('es-AR');
        const precioOld = p.precio_original
            ? '<span class="price-old">$' + Number(p.precio_original).toLocaleString('es-AR') + '</span>'
            : '';
        const descuento = p.precio_original
            ? '<span class="product-badge badge-sale">-' + Math.round((1 - p.precio / p.precio_original) * 100) + '%</span>'
            : '';
        const esNuevo = p.es_nuevo
            ? '<span class="product-badge badge-new">Nuevo</span>'
            : '';
        const stock = p.stock > 10
            ? '<span class="stock-available">&#10003; En stock</span> &bull; ' + p.stock + ' disponibles'
            : p.stock > 0
                ? '<span class="stock-low">&#9888; Poco stock</span> &bull; ' + p.stock + ' disponibles'
                : '<span class="stock-out">Sin stock</span>';

        return '<div class="product-card">' +
            '<div class="product-image">' +
                (descuento || esNuevo) +
                '<button class="wishlist-btn" onclick="toggleWishlist(event, ' + p.id + ')">&#9825;</button>' +
                (p.emoji || '&#128722;') +
            '</div>' +
            '<div class="product-info">' +
                '<div class="product-seller">&#127962; ' + (p.vendedor_nombre || 'Vendedor') + '</div>' +
                '<div class="product-name">' + p.nombre + '</div>' +
                '<div class="product-price">' +
                    '<span class="price-current">' + precio + '</span>' +
                    precioOld +
                '</div>' +
                '<div class="product-stock">' + stock + '</div>' +
                '<div class="product-actions">' +
                    '<button class="btn-primary" onclick="agregarAlCarrito(' + p.id + ')">&#128722; Agregar</button>' +
                    '<button class="btn-secondary" onclick="verProducto(' + p.id + ')">&#128065;</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('');
}

function filtrarCategoria(categoria, el) {
    categoriaActiva = categoria;
    document.querySelectorAll('.category-card').forEach(function (c) { c.classList.remove('active'); });
    if (el) el.classList.add('active');
    cargarProductos(categoria ? { categoria: categoria } : null);
}

function aplicarFiltros() {
    const params = {};
    const pmin = document.getElementById('inputPMin').value;
    const pmax = document.getElementById('inputPMax').value;
    if (pmin) params.precio_min = pmin;
    if (pmax) params.precio_max = pmax;
    if (categoriaActiva) params.categoria = categoriaActiva;
    const orden = document.getElementById('sortSelect').value;
    if (orden) params.orden = orden;
    cargarProductos(Object.keys(params).length ? params : null);
}

function setupBusqueda() {
    const input = document.getElementById('navSearch');
    if (!input) return;
    let timer;
    input.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
            const q = input.value.trim();
            cargarProductos(q ? { q: q } : null);
        }, 400);
    });
}

function actualizarConteo(n) {
    const el = document.getElementById('resultsCount');
    if (el) el.textContent = 'Mostrando ' + n + ' producto' + (n !== 1 ? 's' : '');
}

// ─── CARRITO ─────────────────────────────────────────────────────────────────

function cargarCarrito() {
    try {
        carrito = JSON.parse(localStorage.getItem('rtype1_carrito') || '[]');
    } catch (e) { carrito = []; }
    actualizarBadgeCarrito();
}

function guardarCarrito() {
    localStorage.setItem('rtype1_carrito', JSON.stringify(carrito));
    actualizarBadgeCarrito();
}

function agregarAlCarrito(productoId) {
    const producto = todosLosProductos.find(function (p) { return p.id === productoId; });
    if (!producto) return;
    const existe = carrito.find(function (c) { return c.id === productoId; });
    if (existe) {
        existe.cantidad = (existe.cantidad || 1) + 1;
    } else {
        carrito.push({ id: productoId, nombre: producto.nombre, precio: producto.precio, cantidad: 1 });
    }
    guardarCarrito();
    App.showNotification(producto.nombre + ' agregado al carrito', 'success');
}

function actualizarBadgeCarrito() {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    const total = carrito.reduce(function (acc, c) { return acc + (c.cantidad || 1); }, 0);
    badge.textContent = total;
    badge.style.display = total > 0 ? 'block' : 'none';
}

function toggleWishlist(e, id) {
    e.stopPropagation();
    const btn = e.currentTarget;
    const activo = btn.classList.toggle('active');
    btn.innerHTML = activo ? '&#9829;' : '&#9825;';
    btn.style.color = activo ? 'var(--danger)' : '';
}

function verProducto(id) {
    App.showNotification('Vista de producto pr&#243;ximamente', 'info');
}

window.filtrarCategoria = filtrarCategoria;
window.aplicarFiltros   = aplicarFiltros;
window.agregarAlCarrito = agregarAlCarrito;
window.toggleWishlist   = toggleWishlist;
window.verProducto      = verProducto;
