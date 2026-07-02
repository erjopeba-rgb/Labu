/* Mis Pagos — saldo del trabajador y solicitud de retiros */

const fmtMonto = (n) => '$' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const escHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const RETIRO_BADGES = {
    solicitado: '<span class="retiro-badge retiro-badge-solicitado">Solicitado</span>',
    pagado:     '<span class="retiro-badge retiro-badge-pagado">Pagado</span>',
    rechazado:  '<span class="retiro-badge retiro-badge-rechazado">Rechazado</span>'
};

let saldoActual = null;

const SALDO_IDS = ['saldoRetenido', 'saldoDisponible', 'saldoEnRetiro', 'saldoRetirado'];

function setSaldoTexto(txt) {
    SALDO_IDS.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = txt; });
}

function mostrarSaldoError() {
    const box = document.getElementById('saldoError');
    if (!box) return;
    box.style.display = 'block';
    box.innerHTML = '<span>&#9888;&#65039; No pudimos cargar tu saldo.</span>' +
        '<button type="button" class="btn-reintentar-inline" onclick="cargarSaldo()">Reintentar</button>';
}

function ocultarSaldoError() {
    const box = document.getElementById('saldoError');
    if (box) box.style.display = 'none';
}

async function cargarSaldo() {
    ocultarSaldoError();
    setSaldoTexto('…'); // estado de carga
    const data = await App.apiRequest('/pagos/saldo');
    if (data && data.disponible !== undefined) {
        saldoActual = data;
        document.getElementById('saldoRetenido').textContent   = fmtMonto(data.retenido);
        document.getElementById('saldoDisponible').textContent = fmtMonto(data.disponible);
        document.getElementById('saldoEnRetiro').textContent   = fmtMonto(data.en_retiro);
        document.getElementById('saldoRetirado').textContent   = fmtMonto(data.retirado);
    } else {
        setSaldoTexto('—');
        mostrarSaldoError();
    }
}

async function cargarRetiros() {
    const cont = document.getElementById('listaRetiros');

    // Estado de carga
    cont.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">&#9203;</div>
            <p>Cargando retiros...</p>
        </div>`;

    const data = await App.apiRequest('/pagos/retiros');

    // Estado de error (con reintentar)
    if (!data || data.success === false) {
        cont.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">&#9888;&#65039;</div>
                <p>No pudimos cargar tus retiros.</p>
                <button type="button" class="btn-primary" onclick="cargarRetiros()">Reintentar</button>
            </div>`;
        return;
    }

    const retiros = data.retiros ? data.retiros : [];

    if (!retiros.length) {
        cont.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">&#128181;</div>
                <p>Todav&iacute;a no solicitaste ning&uacute;n retiro.</p>
                <p style="font-size:0.85rem;color:var(--gray);">Cuando un due&ntilde;o confirme un trabajo completado, el dinero aparece como disponible y pod&eacute;s retirarlo.</p>
            </div>`;
        return;
    }

    cont.innerHTML = retiros.map(r => `
        <div class="retiro-item">
            <div>
                <div class="retiro-item-monto">${fmtMonto(r.monto)}</div>
                <div class="retiro-item-datos">${escHtml(r.datos_cobro)}</div>
            </div>
            <div class="retiro-item-fecha">${new Date(r.creado_en).toLocaleDateString('es-AR')}</div>
            ${RETIRO_BADGES[r.estado] || escHtml(r.estado)}
            ${r.estado === 'rechazado' && r.nota_admin ? `<div class="retiro-item-nota">Motivo: ${escHtml(r.nota_admin)}</div>` : ''}
        </div>
    `).join('');
}

function mostrarErrorCampo(id, mensaje) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = mensaje || '';
    el.classList.toggle('visible', !!mensaje);
}

async function solicitarRetiro(e) {
    e.preventDefault();

    const montoInput = document.getElementById('retiroMonto');
    const datosInput = document.getElementById('retiroDatosCobro');
    const btn = document.getElementById('btnSolicitarRetiro');

    mostrarErrorCampo('errorMonto', '');
    mostrarErrorCampo('errorDatosCobro', '');
    mostrarErrorCampo('errorRetiro', '');

    const monto = parseFloat(montoInput.value);
    const datosCobro = datosInput.value.trim();

    let valido = true;
    if (!monto || monto <= 0) {
        mostrarErrorCampo('errorMonto', 'Ingresá un monto mayor a cero');
        valido = false;
    } else if (saldoActual && monto > saldoActual.disponible) {
        mostrarErrorCampo('errorMonto', 'El monto supera tu saldo disponible (' + fmtMonto(saldoActual.disponible) + ')');
        valido = false;
    }
    if (!datosCobro) {
        mostrarErrorCampo('errorDatosCobro', 'Indicá CBU/CVU o alias');
        valido = false;
    }
    if (!valido) return;

    btn.disabled = true;
    btn.textContent = 'Enviando...';
    try {
        const data = await App.apiRequest('/pagos/retiros', {
            method: 'POST',
            body: JSON.stringify({ monto, datos_cobro: datosCobro })
        });
        if (data && data.success) {
            App.showNotification('Retiro solicitado. Te avisamos cuando se transfiera el dinero.', 'success');
            montoInput.value = '';
            datosInput.value = '';
            await Promise.all([cargarSaldo(), cargarRetiros()]);
        } else {
            mostrarErrorCampo('errorRetiro', (data && data.error) || 'No se pudo solicitar el retiro');
        }
    } finally {
        btn.disabled = false;
        btn.textContent = 'Solicitar retiro';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    cargarSaldo();
    cargarRetiros();
    document.getElementById('formRetiro').addEventListener('submit', solicitarRetiro);
});

// Exportar para los botones "Reintentar" de los estados de error.
window.cargarSaldo   = cargarSaldo;
window.cargarRetiros = cargarRetiros;
