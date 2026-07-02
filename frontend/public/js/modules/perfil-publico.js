/**
 * perfil-publico.js
 * Carga y renderiza el perfil público de un usuario por ID (query param ?id=)
 */

let _perfilUserId = null;  // ID del perfil que se está viendo

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('id');

    if (!userId) {
        mostrarError('No se especificó ningún perfil.');
        return;
    }

    _perfilUserId = userId;
    await cargarPerfil(userId);
});

async function cargarPerfil(userId) {
    const isAuth = Auth.isAuthenticated();
    try {
        const [data, estadoContacto, conteos, nivelData] = await Promise.all([
            App.apiRequest(`/users/${userId}/profile`),
            isAuth
                ? App.apiRequest(`/contactos/estado/${userId}`).catch(() => ({ estado: 'ninguno', id: null, tipo: 'amigo' }))
                : Promise.resolve({ estado: 'ninguno', id: null, tipo: 'amigo' }),
            isAuth
                ? App.apiRequest(`/contactos/conteos/${userId}`).catch(() => ({ amigos: 0, seguidores: 0, siguiendo: 0 }))
                : Promise.resolve({ amigos: 0, seguidores: 0, siguiendo: 0 }),
            App.apiRequest(`/confianza/nivel/${userId}`).catch(() => null)
        ]);

        if (!data || data.error || !data.usuario) {
            mostrarError('Perfil no encontrado.');
            return;
        }

        renderPerfil(data, estadoContacto, conteos, nivelData);

        // Cargar portfolio para trabajadores
        if (data.usuario && data.usuario.tipo_perfil === 'trabajador') {
            await cargarPortfolio(userId);
        }

    } catch (err) {
        console.error('Error cargando perfil público:', err);
        mostrarError('Error al cargar el perfil. Intentá de nuevo.');
    }
}

function renderPerfil(data, estadoContacto = { estado: 'ninguno', id: null, tipo: 'amigo' }, conteos = { amigos: 0, seguidores: 0, siguiendo: 0 }, nivelData = null) {
    const p     = data.perfil   || {};
    const u     = data.usuario  || {};
    const stats = data.stats    || {};

    const nombre    = ((p.nombre || '') + ' ' + (p.apellido || '')).trim() || u.email || 'Profesional';
    const iniciales = nombre.substring(0, 2).toUpperCase();
    const rolMap    = { dueno: 'Dueño', trabajador: 'Trabajador', tienda: 'Tienda' };
    const rol       = rolMap[u.tipo_perfil] || u.tipo_perfil || '';

    const rating    = stats.rating               || null;
    const resenas   = stats.total_resenas        || 0;
    const trabajos  = stats.trabajos_completados || 0;
    const tasaExito = stats.tasa_exito           || null;

    // Badge de nivel de confianza (solo trabajadores con al menos 1 trabajo)
    const _nivelConfig = {
        bronce:  { label: 'Bronce',  color: '#7c4a1e', bg: '#fdf0e0' },
        plata:   { label: 'Plata',   color: '#505060', bg: '#f1f1f5' },
        oro:     { label: 'Oro',     color: '#92600a', bg: '#fef9c3' },
        platino: { label: 'Platino', color: '#7e7e8f', bg: '#f0f0f5' },
    };
    const _nc = nivelData && nivelData.nivel && _nivelConfig[nivelData.nivel];
    const nivelBadgeHtml = _nc
        ? `<span style="display:inline-flex;align-items:center;gap:0.25rem;font-size:0.8rem;font-weight:700;padding:0.2rem 0.6rem;border-radius:999px;background:${_nc.bg};color:${_nc.color};">&#127942; ${_nc.label}</span>`
        : '';

    document.title = nombre + ' | Labu';

    const resenasList  = data.resenas || [];
    const esTrabajador = u.tipo_perfil === 'trabajador';

    const avatarHtml = p.avatar_url
        ? `<div class="profile-avatar" style="padding:0;overflow:hidden;"><img src="${p.avatar_url}" alt="avatar" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;"></div>`
        : `<div class="profile-avatar">${iniciales}</div>`;

    // Rubros chips
    const rubros = Array.isArray(p.rubros) ? p.rubros : [];
    const rubrosHtml = rubros.length
        ? `<div class="card">
                <div class="section-title">&#128295; Rubros</div>
                <div class="skills-grid">
                    ${rubros.map(r => `<span class="skill-tag">${r.icono || ''} ${r.nombre}</span>`).join('')}
                </div>
           </div>`
        : '';

    // Zonas
    const zonas = Array.isArray(p.zonas) ? p.zonas : [];
    const zonasHtml = zonas.length
        ? `<div class="card">
                <div class="section-title">&#128205; Zonas de trabajo</div>
                <div class="skills-grid">
                    ${zonas.map(z => `<span class="skill-tag">${z}</span>`).join('')}
                </div>
           </div>`
        : '';

    // Disponibilidad
    const dispMap = { full_time: 'Full time', part_time: 'Part time', fines_semana: 'Fines de semana' };
    const dispLabel = p.disponibilidad_general ? dispMap[p.disponibilidad_general] || p.disponibilidad_general : null;
    const dispHtml = dispLabel
        ? `<span style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.3rem 0.8rem;background:var(--light-gray);border-radius:var(--radius-full);font-size:0.85rem;font-weight:600;">&#128336; ${dispLabel}</span>`
        : '';

    // ── Botones de acción ──
    const usuarioLogueado = Auth.getUser();
    const esPropioPerfil = usuarioLogueado && (String(u.id) === String(usuarioLogueado.id || usuarioLogueado.user_id));
    const contactoBtnHtml = (!usuarioLogueado || esPropioPerfil) ? '' : _renderContactoBtn(estadoContacto);
    const mensajeBtnHtml = (usuarioLogueado && !esPropioPerfil)
        ? `<button class="btn btn-primary" onclick="contactar(${u.id})">&#128172; Mensaje</button>`
        : '';

    document.getElementById('profileContent').innerHTML = `

        <!-- ─── HERO: PORTADA + AVATAR + INFO ─── -->
        <div class="profile-hero">
            <div class="cover-photo"></div>
            <div class="profile-header-bar">
                <div class="profile-avatar-wrapper">
                    ${avatarHtml}
                </div>
                <div class="profile-header-info">
                    <div class="profile-name">${nombre}</div>
                    <div class="profile-role">${rol}${p.anios_experiencia != null ? ' &bull; ' + p.anios_experiencia + ' año' + (p.anios_experiencia !== 1 ? 's' : '') + ' de experiencia' : ''}</div>
                    <div class="profile-meta">
                        ${p.ciudad ? `<span>&#128205; ${p.ciudad}${p.provincia ? ', ' + p.provincia : ''}</span>` : ''}
                        ${rating   ? `<span>&#11088; ${rating} (${resenas} reseña${resenas !== 1 ? 's' : ''})</span>` : ''}
                        ${u.verificado ? `<span style="color:var(--success);">&#10003; Verificado</span>` : ''}
                        ${nivelBadgeHtml}
                        ${dispHtml}
                    </div>
                </div>
                <div class="profile-header-actions">
                    <button class="btn btn-secondary" onclick="compartir()">&#128228; Compartir</button>
                    ${contactoBtnHtml}
                    ${mensajeBtnHtml}
                </div>
            </div>
        </div>

        <!-- ─── BODY: 35% SIDEBAR / 65% MAIN ─── -->
        <div class="profile-body">

            <!-- ── SIDEBAR 35% ── -->
            <aside class="profile-sidebar">

                <div class="card">
                    <div class="section-title">&#128202; Estadísticas</div>
                    <div class="stats-grid">
                        <div class="stat-box"><div class="stat-number">${trabajos}</div><div class="stat-label">Trabajos</div></div>
                        <div class="stat-box"><div class="stat-number">${rating || '-'}</div><div class="stat-label">Rating</div></div>
                        <div class="stat-box"><div class="stat-number">${resenas}</div><div class="stat-label">Reseñas</div></div>
                        <div class="stat-box"><div class="stat-number">${tasaExito ? tasaExito + '%' : '-'}</div><div class="stat-label">Éxito</div></div>
                        <div class="stat-box"><div class="stat-number">${conteos.amigos}</div><div class="stat-label">Amigos</div></div>
                        <div class="stat-box"><div class="stat-number">${conteos.seguidores}</div><div class="stat-label">Seguidores</div></div>
                    </div>
                </div>

                ${rating ? `
                <div class="card">
                    <div class="section-title">&#11088; Calificación</div>
                    <div class="rating-display">
                        <span class="rating-big">${rating}</span>
                        ${renderEstrellas(rating, '2rem')}
                        <span class="rating-count">${resenas} reseña${resenas !== 1 ? 's' : ''}</span>
                    </div>
                </div>` : ''}

                ${p.descripcion ? `
                <div class="card">
                    <div class="section-title">&#128203; Sobre mí</div>
                    <p class="about-text">${p.descripcion}</p>
                </div>` : ''}

                ${esTrabajador && p.descripcion_habilidades ? `
                <div class="card">
                    <div class="section-title">&#128296; Habilidades y experiencia</div>
                    <p class="about-text">${p.descripcion_habilidades}</p>
                </div>` : ''}

                ${esTrabajador ? rubrosHtml : ''}

                ${esTrabajador ? zonasHtml : ''}

                ${esTrabajador && p.herramientas ? `
                <div class="card">
                    <div class="section-title">&#128295; Herramientas y equipamiento</div>
                    <p class="about-text">${p.herramientas}</p>
                </div>` : ''}

            </aside>

            <!-- ── MAIN 65% ── -->
            <main class="profile-main-content">

                ${resenasList.length ? `
                <div class="card">
                    <div class="section-title">&#11088; Reseñas${resenas ? ' (' + resenas + ')' : ''}</div>
                    ${resenasList.slice(0, 3).map(r => renderResena(r)).join('')}
                    ${resenas > 3 ? `<button class="btn btn-primary" style="width:100%;margin-top:0.75rem;">Ver todas las reseñas</button>` : ''}
                </div>` : ''}

                ${!p.descripcion && !p.descripcion_habilidades && !rubros.length && !resenasList.length ? `
                <div class="card" style="text-align:center; padding:3rem; color:var(--gray);">
                    <div style="font-size:2.5rem;margin-bottom:1rem;">&#128100;</div>
                    <p>Este perfil aún no tiene información detallada.</p>
                </div>` : ''}

            </main>
        </div>
    `;
}

/** Genera el HTML del botón de contacto según el estado y tipo de relacion */
function _renderContactoBtn(estadoContacto) {
    const { estado, id, tipo } = estadoContacto || { estado: 'ninguno', id: null, tipo: 'amigo' };
    const esSeguidor = tipo === 'seguidor';

    switch (estado) {
        case 'ninguno':
            if (esSeguidor) {
                return `<button class="btn btn-secondary" id="btnContacto" onclick="accionContacto()">&#128065; Seguir</button>`;
            }
            return `<button class="btn btn-secondary" id="btnContacto" onclick="accionContacto()">&#128101; Agregar amigo</button>`;
        case 'pendiente_enviada':
            return `<button class="btn btn-secondary" id="btnContacto" disabled style="opacity:0.7;cursor:default;">&#128336; Solicitud enviada</button>`;
        case 'pendiente_recibida':
            return `<button class="btn btn-primary" id="btnContacto" onclick="accionContacto()" style="background:var(--success,#10b981);">&#10003; Aceptar solicitud</button>`;
        case 'aceptado':
            return `<button class="btn btn-secondary" id="btnContacto" onclick="accionContacto()" title="Eliminar amigo">&#128101; Amigos &#10003;</button>`;
        case 'siguiendo':
            return `<button class="btn btn-secondary" id="btnContacto" onclick="accionContacto()" title="Dejar de seguir">&#128065; Siguiendo &#10003;</button>`;
        default:
            return '';
    }
}

/** Maneja el click del botón de contacto */
async function accionContacto() {
    if (!_perfilUserId) return;

    const btn = document.getElementById('btnContacto');
    if (btn) { btn.disabled = true; }

    try {
        const estadoActual = await App.apiRequest(`/contactos/estado/${_perfilUserId}`);
        const { estado, id } = estadoActual;

        if (estado === 'ninguno') {
            const res = await App.apiRequest(`/contactos/solicitar/${_perfilUserId}`, { method: 'POST' });
            if (res.tipo === 'seguidor') {
                App.showNotification('Ahora estas siguiendo a este usuario', 'success');
                if (btn) { btn.innerHTML = '&#128065; Siguiendo &#10003;'; btn.disabled = false; btn.title = 'Dejar de seguir'; }
            } else {
                App.showNotification('Solicitud de amistad enviada', 'success');
                if (btn) { btn.innerHTML = '&#128336; Solicitud enviada'; btn.disabled = true; btn.style.opacity = '0.7'; }
            }

        } else if (estado === 'pendiente_recibida') {
            await App.apiRequest(`/contactos/${id}/aceptar`, { method: 'PATCH' });
            App.showNotification('¡Solicitud aceptada! Ahora son amigos', 'success');
            if (btn) {
                btn.innerHTML = '&#128101; Amigos &#10003;';
                btn.disabled = false;
                btn.className = 'btn btn-secondary';
                btn.style = '';
                btn.title = 'Eliminar amigo';
            }

        } else if (estado === 'aceptado') {
            if (!confirm('¿Queres eliminar a este amigo?')) {
                if (btn) btn.disabled = false;
                return;
            }
            await App.apiRequest(`/contactos/${id}`, { method: 'DELETE' });
            App.showNotification('Amigo eliminado', 'success');
            if (btn) {
                btn.innerHTML = '&#128101; Agregar amigo';
                btn.disabled = false;
                btn.className = 'btn btn-secondary';
                btn.style = '';
                btn.title = '';
            }

        } else if (estado === 'siguiendo') {
            if (!confirm('¿Queres dejar de seguir a este usuario?')) {
                if (btn) btn.disabled = false;
                return;
            }
            await App.apiRequest(`/contactos/${id}`, { method: 'DELETE' });
            App.showNotification('Dejaste de seguir a este usuario', 'success');
            if (btn) {
                btn.innerHTML = '&#128065; Seguir';
                btn.disabled = false;
                btn.className = 'btn btn-secondary';
                btn.style = '';
                btn.title = '';
            }

        } else {
            if (btn) btn.disabled = false;
        }

    } catch (err) {
        console.error('Error en acción de contacto:', err);
        App.showNotification('Ocurrió un error. Intentá de nuevo.', 'error');
        if (btn) btn.disabled = false;
    }
}

function renderEstrellas(promedio, tamano) {
    const pct = Math.min(Math.max((parseFloat(promedio) / 5) * 100, 0), 100).toFixed(1);
    const fs  = tamano ? `font-size:${tamano};` : '';
    return `<div class="stars-visual" style="${fs}" aria-label="${promedio} de 5 estrellas">
        <div class="stars-empty">★★★★★</div>
        <div class="stars-filled" style="width:${pct}%">★★★★★</div>
    </div>`;
}

function renderResena(r) {
    const nombre    = r.autor_nombre || 'Usuario';
    const iniciales = nombre.substring(0, 2).toUpperCase();
    const rating    = parseFloat(r.rating) || 5;

    return `
        <div class="review-item">
            <div class="review-header">
                <div class="review-author">
                    <div class="review-avatar">${iniciales}</div>
                    <div class="review-info">
                        <h4>${nombre}</h4>
                        <div class="review-date">${r.created_at ? App.timeAgo(r.created_at) : ''}</div>
                    </div>
                </div>
                <div class="review-rating">${renderEstrellas(rating, '1.1rem')}</div>
            </div>
            ${r.comentario ? `<div class="review-text">${r.comentario}</div>` : ''}
        </div>
    `;
}

async function cargarPortfolio(userId) {
    try {
        const resp = await App.apiRequest(`/portfolio/trabajador/${userId}`);
        const items = Array.isArray(resp) ? resp : (resp.items || []);
        if (items.length === 0) return;

        const mainContent = document.querySelector('.profile-main-content');
        if (!mainContent) return;

        const portfolioHtml = `
            <div class="card" id="portfolio-section">
                <div class="section-title">&#128248; Portfolio (${items.length} trabajo${items.length !== 1 ? 's' : ''})</div>
                <div class="portfolio-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1.25rem;margin-top:1rem;">
                    ${items.map(item => renderPortfolioItem(item)).join('')}
                </div>
            </div>
        `;

        // Insertar al inicio del área principal
        mainContent.insertAdjacentHTML('afterbegin', portfolioHtml);

    } catch (err) {
        console.error('Error cargando portfolio:', err);
    }
}

function renderPortfolioItem(item) {
    const titulo      = item.titulo || 'Trabajo sin título';
    const descripcion = item.descripcion || '';
    const rubro       = item.rubro_nombre ? `<span style="font-size:0.8rem;background:var(--light-gray);padding:0.2rem 0.6rem;border-radius:var(--radius-full);">${item.rubro_nombre}</span>` : '';
    const destacado   = item.destacado
        ? '<span style="font-size:0.75rem;color:var(--warning,#f59e0b);font-weight:700;">&#11088; Destacado</span>'
        : '';

    const tieneAntes  = item.foto_antes_url;
    const tieneDespues = item.foto_despues_url;

    let fotosHtml = '';
    if (tieneAntes && tieneDespues) {
        fotosHtml = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.75rem;">
                <div>
                    <div style="font-size:0.72rem;color:var(--gray);font-weight:600;text-align:center;margin-bottom:0.25rem;">ANTES</div>
                    <img src="${tieneAntes}" alt="Antes" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--radius);border:1px solid var(--border);">
                </div>
                <div>
                    <div style="font-size:0.72rem;color:var(--success,#10b981);font-weight:600;text-align:center;margin-bottom:0.25rem;">DESPUÉS</div>
                    <img src="${tieneDespues}" alt="Después" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--radius);border:2px solid var(--success,#10b981);">
                </div>
            </div>`;
    } else if (tieneDespues) {
        fotosHtml = `<img src="${tieneDespues}" alt="${titulo}" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:var(--radius);margin-bottom:0.75rem;">`;
    } else if (tieneAntes) {
        fotosHtml = `<img src="${tieneAntes}" alt="${titulo}" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:var(--radius);margin-bottom:0.75rem;">`;
    }

    return `
        <div style="border:1px solid var(--border);border-radius:var(--radius);padding:1rem;background:var(--white);">
            ${fotosHtml}
            <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.4rem;">
                ${rubro}
                ${destacado}
            </div>
            <div style="font-weight:700;font-size:0.95rem;margin-bottom:0.3rem;">${titulo}</div>
            ${descripcion ? `<p style="font-size:0.85rem;color:var(--gray);line-height:1.4;margin:0;">${descripcion}</p>` : ''}
        </div>
    `;
}

function contactar(userId) {
    if (userId) {
        window.location.href = `/pages/mensajes.html?contacto=${userId}`;
    } else {
        window.location.href = '/pages/mensajes.html';
    }
}

function compartir() {
    if (navigator.share) {
        navigator.share({
            title: document.title,
            url: window.location.href
        });
    } else {
        navigator.clipboard.writeText(window.location.href).then(() => {
            App.showNotification('Enlace copiado al portapapeles', 'success');
        });
    }
}

function mostrarError(msg) {
    document.getElementById('profileContent').innerHTML = `
        <div style="max-width:600px; margin:3rem auto; padding:0 2rem;">
            <div class="card" style="text-align:center; padding:3rem;">
                <div style="font-size:3rem; margin-bottom:1rem;">&#128533;</div>
                <h2 style="margin-bottom:1rem;">${msg}</h2>
                <button class="btn btn-primary" onclick="history.back()">Volver</button>
            </div>
        </div>
    `;
}
