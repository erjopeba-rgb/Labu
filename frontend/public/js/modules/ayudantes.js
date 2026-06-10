/**
 * ayudantes.js — Módulo para la página de Mis Ayudantes
 * Permite al trabajador ver/gestionar sus ayudantes y solicitudes
 */

// ── Helpers ───────────────────────────────────────────────────
function token() {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

async function api(path, options = {}) {
  const res = await fetch('/api' + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token(),
      ...(options.headers || {})
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error inesperado');
  return data;
}

function colorAvatar(nombre) {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

function iniciales(nombre) {
  if (!nombre) return '?';
  return nombre.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

let toastTimer;
function showToast(msg, tipo = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (tipo ? ' ' + tipo : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3200);
}

// ── Tabs ──────────────────────────────────────────────────────
function cambiarTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tab));
}
window.cambiarTab = cambiarTab;

// ── Tab: Mis Ayudantes (aceptados) ───────────────────────────
async function cargarMisAyudantes() {
  const cont = document.getElementById('lista-mis-ayudantes');
  cont.innerHTML = '<p style="color:var(--gray)">Cargando...</p>';
  try {
    const data = await api('/ayudantes/mis-ayudantes');
    if (!data.length) {
      cont.innerHTML = `<div class="empty-state"><div class="empty-icon">&#129309;</div>
        <p>Todav&iacute;a no tienes ayudantes aceptados.</p></div>`;
      return;
    }
    cont.innerHTML = data.map(a => `
      <div class="ayudante-card">
        <div class="ayudante-avatar" style="background:${colorAvatar(a.ayudante_nombre)}">${iniciales(a.ayudante_nombre)}</div>
        <div class="ayudante-info">
          <h4>${escHtml(a.ayudante_nombre)}</h4>
          <div class="meta">Trabajo: <strong>${escHtml(a.trabajo_titulo)}</strong> &bull;
            Pago: <strong>$${parseFloat(a.pago_por_ayudante).toLocaleString('es-AR')}</strong></div>
        </div>
        <div class="rating"><span class="star">&#9733;</span> ${parseFloat(a.promedio_calificacion || 0).toFixed(1)}</div>
      </div>`).join('');
  } catch (e) {
    cont.innerHTML = `<div class="empty-state"><p>Error al cargar. <button class="btn btn-outline btn-sm" onclick="cargarMisAyudantes()">Reintentar</button></p></div>`;
  }
}

// ── Tab: Solicitudes recibidas (mis aplicaciones pendientes) ──
async function cargarMisSolicitudes() {
  const cont = document.getElementById('lista-mis-solicitudes');
  cont.innerHTML = '<p style="color:var(--gray)">Cargando...</p>';
  try {
    const data = await api('/ayudantes/mis-solicitudes');

    // Agrupar por solicitud_id
    const mapa = {};
    data.forEach(row => {
      if (!mapa[row.solicitud_id]) {
        mapa[row.solicitud_id] = {
          solicitud_id: row.solicitud_id,
          solicitud_estado: row.solicitud_estado,
          cantidad_necesaria: row.cantidad_necesaria,
          pago_por_ayudante: row.pago_por_ayudante,
          descripcion: row.descripcion,
          trabajo_id: row.trabajo_id,
          trabajo_titulo: row.trabajo_titulo,
          aplicaciones: []
        };
      }
      if (row.aplicacion_id) {
        mapa[row.solicitud_id].aplicaciones.push({
          aplicacion_id: row.aplicacion_id,
          ayudante_id: row.ayudante_id,
          ayudante_nombre: row.ayudante_nombre,
          promedio_calificacion: row.promedio_calificacion,
          aplicacion_fecha: row.aplicacion_fecha
        });
      }
    });

    const solicitudes = Object.values(mapa);
    if (!solicitudes.length) {
      cont.innerHTML = `<div class="empty-state"><div class="empty-icon">&#128196;</div>
        <p>No creaste ninguna solicitud de ayudantes a&uacute;n.<br>
        Usa la pesta&ntilde;a <strong>Solicitar Ayudantes</strong> para crear una.</p></div>`;
      return;
    }

    cont.innerHTML = solicitudes.map(s => `
      <div class="solicitud-card">
        <div class="solicitud-header">
          <div>
            <h4>${escHtml(s.trabajo_titulo)}</h4>
            <div class="meta">Necesita ${s.cantidad_necesaria} ayudante${s.cantidad_necesaria > 1 ? 's' : ''} &bull;
              Pago: $${parseFloat(s.pago_por_ayudante).toLocaleString('es-AR')}</div>
          </div>
          <span class="badge badge-${s.solicitud_estado}">${s.solicitud_estado}</span>
        </div>
        ${s.descripcion ? `<p class="solicitud-desc">${escHtml(s.descripcion)}</p>` : ''}
        <div class="aplicaciones-list">
          ${s.aplicaciones.length
            ? s.aplicaciones.map(ap => `
              <div class="aplicacion-row">
                <div class="ayudante-avatar" style="background:${colorAvatar(ap.ayudante_nombre || '?')};width:36px;height:36px;min-width:36px;font-size:1rem;">${iniciales(ap.ayudante_nombre)}</div>
                <div class="ayudante-info">
                  <strong>${escHtml(ap.ayudante_nombre)}</strong>
                  <div class="rating" style="font-size:0.8rem;"><span class="star">&#9733;</span> ${parseFloat(ap.promedio_calificacion || 0).toFixed(1)}</div>
                </div>
                <div class="card-actions">
                  <button class="btn btn-success btn-sm" onclick="responderAplicacion(${ap.aplicacion_id},'aceptado')">Aceptar</button>
                  <button class="btn btn-danger btn-sm" onclick="responderAplicacion(${ap.aplicacion_id},'rechazado')">Rechazar</button>
                </div>
              </div>`).join('')
            : '<p style="color:var(--gray);font-size:0.88rem;">Sin aplicaciones pendientes.</p>'
          }
        </div>
      </div>`).join('');
  } catch (e) {
    cont.innerHTML = `<div class="empty-state"><p>Error al cargar. <button class="btn btn-outline btn-sm" onclick="cargarMisSolicitudes()">Reintentar</button></p></div>`;
  }
}

async function responderAplicacion(aplicacionId, estado) {
  try {
    await api(`/ayudantes/aplicaciones/${aplicacionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ estado })
    });
    showToast(estado === 'aceptado' ? 'Ayudante aceptado.' : 'Solicitud rechazada.', estado === 'aceptado' ? 'success' : '');
    cargarMisSolicitudes();
    if (estado === 'aceptado') cargarMisAyudantes();
  } catch (e) {
    showToast(e.message, 'error');
  }
}
window.responderAplicacion = responderAplicacion;

// ── Tab: Solicitar Ayudantes (crear solicitud) ────────────────
async function cargarMisTrabajos() {
  const sel = document.getElementById('select-trabajo');
  if (!sel) return;
  try {
    const data = await api('/jobs/asignados');
    const trabajos = Array.isArray(data) ? data : (data.data || []);
    if (!trabajos.length) {
      sel.innerHTML = '<option value="">Sin trabajos en curso</option>';
      return;
    }
    sel.innerHTML = '<option value="">Elegir trabajo...</option>' +
      trabajos.map(t => `<option value="${t.id}">${escHtml(t.titulo)}</option>`).join('');
  } catch {
    sel.innerHTML = '<option value="">Error al cargar trabajos</option>';
  }
}

async function crearSolicitud(e) {
  e.preventDefault();
  const trabajoId   = document.getElementById('select-trabajo').value;
  const cantidad    = parseInt(document.getElementById('input-cantidad').value);
  const pago        = parseFloat(document.getElementById('input-pago').value);
  const descripcion = document.getElementById('input-descripcion').value.trim();

  const errTrabajo = document.getElementById('err-trabajo');
  const errCantidad = document.getElementById('err-cantidad');
  const errPago = document.getElementById('err-pago');

  let valido = true;
  if (!trabajoId) { errTrabajo.classList.add('visible'); valido = false; } else errTrabajo.classList.remove('visible');
  if (!cantidad || cantidad < 1) { errCantidad.classList.add('visible'); valido = false; } else errCantidad.classList.remove('visible');
  if (!pago || pago <= 0) { errPago.classList.add('visible'); valido = false; } else errPago.classList.remove('visible');
  if (!valido) return;

  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Creando...';
  try {
    await api(`/ayudantes/trabajos/${trabajoId}`, {
      method: 'POST',
      body: JSON.stringify({ cantidad_necesaria: cantidad, pago_por_ayudante: pago, descripcion: descripcion || null })
    });
    showToast('Solicitud creada. Los trabajadores podr&aacute;n aplicar.', 'success');
    e.target.reset();
    cargarMisSolicitudes();
    cambiarTab('mis-solicitudes');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Crear Solicitud';
  }
}
window.crearSolicitud = crearSolicitud;

// ── Tab: Buscar Solicitudes (aplicar como ayudante) ───────────
async function cargarSolicitudesAbiertas() {
  const cont = document.getElementById('lista-solicitudes-abiertas');
  cont.innerHTML = '<p style="color:var(--gray)">Cargando...</p>';
  try {
    const data = await api('/ayudantes/solicitudes');
    if (!data.length) {
      cont.innerHTML = `<div class="empty-state"><div class="empty-icon">&#128269;</div>
        <p>No hay solicitudes abiertas en este momento.</p></div>`;
      return;
    }
    cont.innerHTML = data.map(s => `
      <div class="solicitud-card">
        <div class="solicitud-header">
          <div>
            <h4>${escHtml(s.trabajo_titulo)}</h4>
            <div class="meta">L&iacute;der: <strong>${escHtml(s.lider_nombre)}</strong> &bull;
              Rubro: ${escHtml(s.rubro_nombre || '')} &bull; ${s.ciudad || ''}</div>
          </div>
          <span class="badge badge-abierta">Abierta</span>
        </div>
        ${s.descripcion ? `<p class="solicitud-desc">${escHtml(s.descripcion)}</p>` : ''}
        <div class="solicitud-footer">
          <div>
            <span style="font-weight:600;">$${parseFloat(s.pago_por_ayudante).toLocaleString('es-AR')}</span>
            <span style="color:var(--gray);font-size:0.85rem;"> pago / ${s.ayudantes_aceptados}/${s.cantidad_necesaria} cubiertos</span>
          </div>
          <button class="btn btn-primary btn-sm" onclick="aplicarSolicitud(${s.id})">Aplicar</button>
        </div>
      </div>`).join('');
  } catch (e) {
    cont.innerHTML = `<div class="empty-state"><p>Error al cargar. <button class="btn btn-outline btn-sm" onclick="cargarSolicitudesAbiertas()">Reintentar</button></p></div>`;
  }
}

async function aplicarSolicitud(solicitudId) {
  try {
    await api(`/ayudantes/solicitudes/${solicitudId}/aplicar`, { method: 'POST' });
    showToast('Aplicaci&oacute;n enviada. El l&iacute;der revisar&aacute; tu solicitud.', 'success');
    cargarSolicitudesAbiertas();
  } catch (e) {
    showToast(e.message, 'error');
  }
}
window.aplicarSolicitud = aplicarSolicitud;

// ── Escape HTML ───────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  cargarMisAyudantes();
  cargarMisSolicitudes();
  cargarMisTrabajos();
  cargarSolicitudesAbiertas();

  const form = document.getElementById('form-solicitud');
  if (form) form.addEventListener('submit', crearSolicitud);
});
