/* Panel de Administración */

const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');

const api = async (method, path, body) => {
  const opts = {
    method,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`/api/admin${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
  return data;
};

// ─── Tabs ────────────────────────────────────────────────────────────────────

const mostrarTab = (nombre) => {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('activo', t.dataset.tab === nombre));
  document.querySelectorAll('.admin-seccion').forEach(s => s.classList.toggle('activa', s.id === `sec-${nombre}`));
};

window.cambiarTab = (nombre) => {
  mostrarTab(nombre);
  if (nombre === 'usuarios')       cargarUsuarios();
  if (nombre === 'reportes')       cargarReportes();
  if (nombre === 'verificaciones') cargarVerificaciones();
  if (nombre === 'disputas')       cargarDisputas();
  if (nombre === 'retiros')        cargarRetiros();
  if (nombre === 'config')         cargarConfig();
  if (nombre === 'errores')        cargarErrores();
  if (nombre === 'backups')        cargarBackups();
};

// ─── Usuarios ────────────────────────────────────────────────────────────────

const cargarUsuarios = async () => {
  const tbody = document.getElementById('tbodyUsuarios');
  tbody.innerHTML = '<tr><td colspan="6" class="admin-loading">Cargando...</td></tr>';
  try {
    const { usuarios } = await api('GET', '/usuarios');
    if (!usuarios.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">Sin usuarios registrados</td></tr>';
      return;
    }
    tbody.innerHTML = usuarios.map(u => `
      <tr id="fila-u-${u.id}">
        <td>${u.id}</td>
        <td>${u.email}</td>
        <td>${u.nombre ? `${u.nombre} ${u.apellido || ''}`.trim() : '—'}</td>
        <td>${u.tipo_perfil}</td>
        <td>
          ${u.activo
            ? '<span class="badge badge-verde">Activo</span>'
            : '<span class="badge badge-rojo">Suspendido</span>'}
          ${u.es_admin ? '<span class="badge badge-azul" style="margin-left:4px;">Admin</span>' : ''}
        </td>
        <td>
          ${u.activo
            ? `<button class="btn-accion btn-suspender" onclick="toggleUsuario(${u.id}, true)">Suspender</button>`
            : `<button class="btn-accion btn-activar"   onclick="toggleUsuario(${u.id}, false)">Activar</button>`}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-empty">Error: ${err.message}</td></tr>`;
  }
};

window.toggleUsuario = async (id, suspendido) => {
  try {
    const { usuario } = await api('PATCH', `/usuarios/${id}/suspender`, { suspendido });
    const fila = document.getElementById(`fila-u-${id}`);
    if (fila) {
      fila.cells[4].innerHTML = usuario.activo
        ? '<span class="badge badge-verde">Activo</span>'
        : '<span class="badge badge-rojo">Suspendido</span>';
      fila.cells[5].innerHTML = usuario.activo
        ? `<button class="btn-accion btn-suspender" onclick="toggleUsuario(${id}, true)">Suspender</button>`
        : `<button class="btn-accion btn-activar"   onclick="toggleUsuario(${id}, false)">Activar</button>`;
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

// ─── Reportes ────────────────────────────────────────────────────────────────

const cargarReportes = async () => {
  const tbody = document.getElementById('tbodyReportes');
  tbody.innerHTML = '<tr><td colspan="7" class="admin-loading">Cargando...</td></tr>';
  try {
    const { reportes } = await api('GET', '/reportes');
    if (!reportes.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="admin-empty">Sin reportes</td></tr>';
      return;
    }
    tbody.innerHTML = reportes.map(r => `
      <tr id="fila-r-${r.id}">
        <td>${r.id}</td>
        <td><span class="badge badge-gris">${r.tipo}</span></td>
        <td>${r.referencia_id}</td>
        <td>${r.motivo}</td>
        <td>${r.reportado_por_email}</td>
        <td>${estadoBadge(r.estado, r.resolucion)}</td>
        <td>
          ${r.estado === 'pendiente' ? `
            <button class="btn-accion btn-resolver"   onclick="accionReporte(${r.id}, 'resolver')">Resolver</button>
            <button class="btn-accion btn-desestimar" onclick="accionReporte(${r.id}, 'desestimar')" style="margin-left:4px;">Desestimar</button>
          ` : '—'}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="admin-empty">Error: ${err.message}</td></tr>`;
  }
};

const estadoBadge = (estado, resolucion) => {
  if (estado === 'pendiente') return '<span class="badge badge-naranja">Pendiente</span>';
  if (resolucion === 'resuelto')    return '<span class="badge badge-verde">Resuelto</span>';
  if (resolucion === 'desestimado') return '<span class="badge badge-gris">Desestimado</span>';
  return '<span class="badge badge-azul">Revisado</span>';
};

window.accionReporte = async (id, accion) => {
  try {
    const { reporte } = await api('PATCH', `/reportes/${id}/resolver`, { accion });
    const fila = document.getElementById(`fila-r-${id}`);
    if (fila) {
      fila.cells[5].innerHTML = estadoBadge(reporte.estado, reporte.resolucion);
      fila.cells[6].innerHTML = '—';
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

// ─── Verificaciones ──────────────────────────────────────────────────────────

const cargarVerificaciones = async () => {
  const tbody = document.getElementById('tbodyVerificaciones');
  tbody.innerHTML = '<tr><td colspan="7" class="admin-loading">Cargando...</td></tr>';
  try {
    const { verificaciones } = await api('GET', '/verificaciones?estado=pendiente');
    if (!verificaciones.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="admin-empty">Sin verificaciones pendientes</td></tr>';
      return;
    }
    tbody.innerHTML = verificaciones.map(v => `
      <tr id="fila-v-${v.id}">
        <td>${v.id}</td>
        <td>${v.nombre ? `${v.nombre} ${v.apellido || ''}`.trim() : '—'}</td>
        <td>${v.email}</td>
        <td style="white-space:nowrap;">
          <a href="${v.dni_frente_url}" target="_blank" style="margin-right:6px;">DNI Frente</a>
          <a href="${v.dni_dorso_url}"  target="_blank" style="margin-right:6px;">DNI Dorso</a>
          <a href="${v.selfie_url}"     target="_blank">Selfie</a>
        </td>
        <td><span class="badge badge-naranja">Pendiente</span></td>
        <td>${new Date(v.creado_en).toLocaleDateString('es-AR')}</td>
        <td>
          <button class="btn-accion btn-activar"   onclick="aprobarVerif(${v.id})">Aprobar</button>
          <button class="btn-accion btn-suspender" onclick="abrirModalRechazar(${v.id})" style="margin-left:4px;">Rechazar</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="admin-empty">Error: ${err.message}</td></tr>`;
  }
};

window.aprobarVerif = async (id) => {
  if (!confirm('¿Confirmar aprobación de esta verificación?')) return;
  try {
    await api('PATCH', `/verificaciones/${id}/aprobar`);
    const fila = document.getElementById(`fila-v-${id}`);
    if (fila) {
      fila.cells[4].innerHTML = '<span class="badge badge-verde">Aprobado</span>';
      fila.cells[6].innerHTML = '—';
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

let verifIdPendiente = null;

window.abrirModalRechazar = (id) => {
  verifIdPendiente = id;
  document.getElementById('motivoRechazo').value = '';
  const modal = document.getElementById('modalRechazar');
  modal.style.display = 'flex';
};

window.cerrarModalRechazar = () => {
  document.getElementById('modalRechazar').style.display = 'none';
  verifIdPendiente = null;
};

window.confirmarRechazo = async () => {
  const motivo = document.getElementById('motivoRechazo').value.trim();
  if (!motivo) { alert('El motivo es obligatorio'); return; }
  try {
    await api('PATCH', `/verificaciones/${verifIdPendiente}/rechazar`, { motivo });
    const fila = document.getElementById(`fila-v-${verifIdPendiente}`);
    if (fila) {
      fila.cells[4].innerHTML = '<span class="badge badge-rojo">Rechazado</span>';
      fila.cells[6].innerHTML = '—';
    }
    cerrarModalRechazar();
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

// ─── Disputas ────────────────────────────────────────────────────────────────

const ESTADO_DISPUTA_BADGE = {
  abierta:     '<span class="badge badge-naranja">Abierta</span>',
  en_revision: '<span class="badge badge-azul">En revisión</span>',
  resuelta:    '<span class="badge badge-verde">Resuelta</span>',
  cerrada:     '<span class="badge badge-gris">Cerrada</span>',
};

const cargarDisputas = async () => {
  const tbody = document.getElementById('tbodyDisputas');
  tbody.innerHTML = '<tr><td colspan="8" class="admin-loading">Cargando...</td></tr>';
  try {
    const { disputas } = await api('GET', '/disputas');
    if (!disputas.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="admin-empty">Sin disputas registradas</td></tr>';
      return;
    }
    tbody.innerHTML = disputas.map(d => `
      <tr id="fila-d-${d.id}">
        <td>${d.id}</td>
        <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${d.trabajo_titulo}">${d.trabajo_titulo}</td>
        <td>${d.iniciador_email}</td>
        <td>${d.acusado_email}</td>
        <td><span class="badge badge-gris">${d.motivo}</span></td>
        <td>${ESTADO_DISPUTA_BADGE[d.estado] || d.estado}</td>
        <td>${new Date(d.creado_en).toLocaleDateString('es-AR')}</td>
        <td>
          ${d.estado === 'abierta' ? `<button class="btn-accion" style="background:#3b82f6;color:#fff;" onclick="enRevisionDisputa(${d.id})">En revisión</button>` : ''}
          ${['abierta', 'en_revision'].includes(d.estado) ? `<button class="btn-accion btn-resolver" onclick="abrirModalResolverDisputa(${d.id}, '${(d.trabajo_titulo || '').replace(/'/g, "\\'")}')" style="margin-left:4px;">Resolver</button>` : (d.resolucion ? `<span style="font-size:0.8rem;color:#64748b;max-width:160px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${d.resolucion}">${d.resolucion}</span>` : '—')}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="admin-empty">Error: ${err.message}</td></tr>`;
  }
};

window.enRevisionDisputa = async (id) => {
  try {
    const { disputa } = await api('PATCH', `/disputas/${id}/en-revision`);
    const fila = document.getElementById(`fila-d-${id}`);
    if (fila) {
      fila.cells[5].innerHTML = ESTADO_DISPUTA_BADGE['en_revision'];
      fila.cells[7].innerHTML = `<button class="btn-accion btn-resolver" onclick="abrirModalResolverDisputa(${id}, '')">Resolver</button>`;
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

let _disputaIdPendiente = null;

window.abrirModalResolverDisputa = (id, titulo) => {
  _disputaIdPendiente = id;
  document.getElementById('resolverDisputaTexto').value = '';
  document.getElementById('resolverDisputaResultado').value = '';
  document.getElementById('resolverDisputaInfo').textContent = titulo ? `Trabajo: "${titulo}"` : '';
  const modal = document.getElementById('modalResolverDisputa');
  modal.style.display = 'flex';
};

window.cerrarModalResolverDisputa = () => {
  document.getElementById('modalResolverDisputa').style.display = 'none';
  _disputaIdPendiente = null;
};

window.confirmarResolucionDisputa = async () => {
  const resolucion = document.getElementById('resolverDisputaTexto').value.trim();
  const resultado = document.getElementById('resolverDisputaResultado').value;
  if (!resultado) { alert('Elegí el resultado: a favor del trabajador (liberar pago) o del dueño (reembolso)'); return; }
  if (!resolucion) { alert('La resolución es obligatoria'); return; }
  try {
    const { disputa } = await api('PATCH', `/disputas/${_disputaIdPendiente}/resolver`, { resolucion, resultado });
    const fila = document.getElementById(`fila-d-${_disputaIdPendiente}`);
    if (fila) {
      fila.cells[5].innerHTML = ESTADO_DISPUTA_BADGE['resuelta'];
      fila.cells[7].innerHTML = `<span style="font-size:0.8rem;color:#64748b;max-width:160px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${disputa.resolucion}">${disputa.resolucion}</span>`;
    }
    cerrarModalResolverDisputa();
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

// ─── Retiros ─────────────────────────────────────────────────────────────────

const ESTADO_RETIRO_BADGE = {
  solicitado: '<span class="badge badge-naranja">Solicitado</span>',
  pagado:     '<span class="badge badge-verde">Pagado</span>',
  rechazado:  '<span class="badge badge-rojo">Rechazado</span>',
};

const cargarRetiros = async () => {
  const tbody = document.getElementById('tbodyRetiros');
  tbody.innerHTML = '<tr><td colspan="8" class="admin-loading">Cargando...</td></tr>';
  try {
    const { retiros } = await api('GET', '/retiros');
    if (!retiros.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="admin-empty">Sin retiros solicitados</td></tr>';
      return;
    }
    tbody.innerHTML = retiros.map(r => `
      <tr id="fila-ret-${r.id}">
        <td>${r.id}</td>
        <td>${r.nombre ? escHtml(`${r.nombre} ${r.apellido || ''}`.trim()) : '—'}</td>
        <td>${escHtml(r.email)}</td>
        <td style="white-space:nowrap;">$${Number(r.monto).toLocaleString('es-AR')}</td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(r.datos_cobro)}"><code>${escHtml(r.datos_cobro)}</code></td>
        <td>${ESTADO_RETIRO_BADGE[r.estado] || r.estado}</td>
        <td style="white-space:nowrap;">${new Date(r.creado_en).toLocaleDateString('es-AR')}</td>
        <td>
          ${r.estado === 'solicitado' ? `
            <button class="btn-accion btn-activar"   onclick="marcarRetiroPagado(${r.id})">Marcar pagado</button>
            <button class="btn-accion btn-suspender" onclick="abrirModalRechazarRetiro(${r.id})" style="margin-left:4px;">Rechazar</button>
          ` : (r.nota_admin ? `<span style="font-size:0.8rem;color:#64748b;max-width:160px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(r.nota_admin)}">${escHtml(r.nota_admin)}</span>` : '—')}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="admin-empty">Error: ${escHtml(err.message)}</td></tr>`;
  }
};

window.marcarRetiroPagado = async (id) => {
  if (!confirm('¿Confirmás que ya hiciste la transferencia al trabajador?')) return;
  try {
    const { retiro } = await api('PATCH', `/retiros/${id}/resolver`, { accion: 'pagado' });
    const fila = document.getElementById(`fila-ret-${id}`);
    if (fila) {
      fila.cells[5].innerHTML = ESTADO_RETIRO_BADGE['pagado'];
      fila.cells[7].innerHTML = '—';
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

let _retiroIdPendiente = null;

window.abrirModalRechazarRetiro = (id) => {
  _retiroIdPendiente = id;
  document.getElementById('motivoRechazoRetiro').value = '';
  document.getElementById('modalRechazarRetiro').style.display = 'flex';
};

window.cerrarModalRechazarRetiro = () => {
  document.getElementById('modalRechazarRetiro').style.display = 'none';
  _retiroIdPendiente = null;
};

window.confirmarRechazoRetiro = async () => {
  const nota = document.getElementById('motivoRechazoRetiro').value.trim();
  if (!nota) { alert('El motivo es obligatorio'); return; }
  try {
    const { retiro } = await api('PATCH', `/retiros/${_retiroIdPendiente}/resolver`, { accion: 'rechazado', nota });
    const fila = document.getElementById(`fila-ret-${_retiroIdPendiente}`);
    if (fila) {
      fila.cells[5].innerHTML = ESTADO_RETIRO_BADGE['rechazado'];
      fila.cells[7].innerHTML = `<span style="font-size:0.8rem;color:#64748b;">${escHtml(retiro.nota_admin)}</span>`;
    }
    cerrarModalRechazarRetiro();
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

// ─── Configuración ────────────────────────────────────────────────────────────

let configActual = [];

const cargarConfig = async () => {
  const grid = document.getElementById('configGrid');
  grid.innerHTML = '<div class="admin-loading">Cargando...</div>';
  try {
    const { config } = await api('GET', '/config');
    configActual = config;
    grid.innerHTML = config.map(item => `
      <div class="config-item">
        <label for="cfg-${item.clave}">${item.clave}</label>
        ${item.descripcion ? `<div class="config-desc">${item.descripcion}</div>` : ''}
        <input id="cfg-${item.clave}" type="text" value="${item.valor}" data-clave="${item.clave}">
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<div class="admin-empty">Error: ${err.message}</div>`;
  }
};

window.guardarConfig = async () => {
  const inputs = document.querySelectorAll('#configGrid input[data-clave]');
  const updates = Array.from(inputs).map(input => ({
    clave: input.dataset.clave,
    valor: input.value.trim(),
  }));
  const btn = document.getElementById('btnGuardarConfig');
  const msg = document.getElementById('configMsg');
  btn.disabled = true;
  try {
    await api('PUT', '/config', { updates });
    msg.textContent = 'Configuración guardada';
    msg.classList.add('visible');
    setTimeout(() => msg.classList.remove('visible'), 2500);
  } catch (err) {
    msg.style.color = 'var(--error, #dc2626)';
    msg.textContent = 'Error: ' + err.message;
    msg.classList.add('visible');
  } finally {
    btn.disabled = false;
  }
};

// ─── Errores ─────────────────────────────────────────────────────────────────

const cargarErrores = async () => {
  const tbody = document.getElementById('tbodyErrores');
  tbody.innerHTML = '<tr><td colspan="6" class="admin-loading">Cargando...</td></tr>';
  try {
    const { errores } = await api('GET', '/errores');
    if (!errores.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">Sin errores registrados</td></tr>';
      return;
    }
    tbody.innerHTML = errores.map(e => `
      <tr>
        <td>${e.id}</td>
        <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(e.mensaje)}">${escHtml(e.mensaje)}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(e.url || '')}"><code>${escHtml(e.url || '—')}</code></td>
        <td>${e.metodo ? `<span class="badge badge-gris">${e.metodo}</span>` : '—'}</td>
        <td>${e.usuario_email ? escHtml(e.usuario_email) : '<span style="color:#94a3b8;">anónimo</span>'}</td>
        <td style="white-space:nowrap;">${new Date(e.creado_en).toLocaleString('es-AR')}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-empty">Error: ${err.message}</td></tr>`;
  }
};

const escHtml = (str) => String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ─── Backups ──────────────────────────────────────────────────────────────────

const _formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
};

const cargarBackups = async () => {
  const tbody = document.getElementById('tbodyBackups');
  tbody.innerHTML = '<tr><td colspan="4" class="admin-loading">Cargando...</td></tr>';
  try {
    const { backups } = await api('GET', '/backups');
    if (!backups.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="admin-empty">Sin backups disponibles</td></tr>';
      return;
    }
    tbody.innerHTML = backups.map(b => `
      <tr>
        <td style="font-family:monospace;font-size:0.85rem;">${escHtml(b.nombre)}</td>
        <td style="white-space:nowrap;">${new Date(b.fecha).toLocaleString('es-AR')}</td>
        <td>${_formatBytes(b.tamanio)}</td>
        <td>
          <a class="btn-accion btn-activar" href="/api/admin/backups/${encodeURIComponent(b.nombre)}" target="_blank" style="text-decoration:none;">Descargar</a>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="admin-empty">Error: ${escHtml(err.message)}</td></tr>`;
  }
};

window.ejecutarBackup = async () => {
  const btn = document.getElementById('btnEjecutarBackup');
  const msg = document.getElementById('backupMsg');
  btn.disabled = true;
  btn.textContent = 'Ejecutando...';
  msg.style.display = 'none';
  try {
    const { backup, eliminados } = await api('POST', '/backups/run');
    msg.style.color = 'var(--exito, #16a34a)';
    msg.textContent = `Backup completado: ${backup.filename} (${_formatBytes(backup.size)}) — ${eliminados} archivo(s) eliminado(s)`;
    msg.style.display = 'block';
    await cargarBackups();
  } catch (err) {
    msg.style.color = 'var(--error, #dc2626)';
    msg.textContent = 'Error: ' + err.message;
    msg.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ejecutar backup ahora';
  }
};

// ─── Init ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  mostrarTab('usuarios');
  cargarUsuarios();
});
