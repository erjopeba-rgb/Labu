/**
 * Labu - feed.js
 */

const Feed = {
    posts: [],
    offset: 0,
    limit: 20,
    loading: false,
    modo: null,          // 'dueno' | 'trabajador'
    currentUserId: null,
    _jobToDelete: null,
    _feedMedia: [],
    _portfolioMedia: [],
    _portfolioAntes: [],
    _portfolioDespues: [],
    _jobContext: null,
    _FEED_MAX_PHOTOS: 10,
    _FEED_MAX_VIDEOS: 3,
    _FEED_MAX_MB: 20,
    _PORTFOLIO_MAX_PHOTOS: 5,
    _disponibilidad: [],
    _duenoDispo: {},       // dia_semana → true (disponible) | false (no disponible)
    _pendingCell: null,    // calendar cell awaiting time confirmation
    _tpDateStr: null,
    _tpDow: null,
    _rubros: [],
    _rubroDetectadoId: null,
    _reporteTipo: null,
    _reporteReferenciaId: null,
    _reporteMotivoSeleccionado: null,

    _spinnerHtml(msg) {
        return '<div style="text-align:center;padding:3rem;color:var(--gray);">' +
            '<style>.rt-spin{animation:rt-spin 0.8s linear infinite}@keyframes rt-spin{to{transform:rotate(360deg)}}</style>' +
            '<div class="rt-spin" style="width:36px;height:36px;border:3px solid #e0e0e0;border-top-color:var(--primary,#3b82f6);border-radius:50%;margin:0 auto 1rem;"></div>' +
            '<p>' + (msg || 'Cargando...') + '</p></div>';
    },

    _avatarColorBg(nombre) {
        const paleta = ['#3b82f6','#8b5cf6','#ec4899','#f97316','#10b981','#f59e0b','#06b6d4','#6366f1'];
        let h = 0, s = nombre || '';
        for (let i = 0; i < s.length; i++) h = (s.charCodeAt(i) + ((h << 5) - h)) | 0;
        return paleta[Math.abs(h) % paleta.length];
    },

    _nivelBadge(totalTrabajos) {
        const n = parseInt(totalTrabajos) || 0;
        let nivel, color, bg;
        if (n >= 100) { nivel = 'Platino'; color = '#7e7e8f'; bg = '#f0f0f5'; }
        else if (n >= 50) { nivel = 'Oro';    color = '#92600a'; bg = '#fef9c3'; }
        else if (n >= 10) { nivel = 'Plata';  color = '#505060'; bg = '#f1f1f5'; }
        else if (n >= 1)  { nivel = 'Bronce'; color = '#7c4a1e'; bg = '#fdf0e0'; }
        else return '';
        return `<span style="display:inline-flex;align-items:center;gap:0.25rem;font-size:0.72rem;font-weight:700;padding:0.15rem 0.5rem;border-radius:999px;background:${bg};color:${color};vertical-align:middle;">&#127942; ${nivel}</span>`;
    },

    _skeletonHtml() {
        const card =
            '<div class="skeleton-card">' +
                '<div class="skeleton-header">' +
                    '<div class="skeleton-avatar skeleton-pulse"></div>' +
                    '<div class="skeleton-header-text">' +
                        '<div class="skeleton-line skeleton-pulse" style="width:55%;height:14px;"></div>' +
                        '<div class="skeleton-line skeleton-pulse" style="width:35%;height:11px;margin-top:6px;"></div>' +
                    '</div>' +
                '</div>' +
                '<div class="skeleton-image skeleton-pulse"></div>' +
                '<div class="skeleton-line skeleton-pulse" style="width:80%;height:13px;margin-top:12px;"></div>' +
                '<div class="skeleton-line skeleton-pulse" style="width:60%;height:13px;margin-top:8px;"></div>' +
                '<div class="skeleton-actions">' +
                    '<div class="skeleton-btn skeleton-pulse"></div>' +
                    '<div class="skeleton-btn skeleton-pulse" style="width:80px;"></div>' +
                '</div>' +
            '</div>';
        return card + card + card;
    },

    _errorHtml(msg) {
        return '<div style="text-align:center;padding:3rem;color:var(--danger,#ef4444);">' +
            '<div style="font-size:2.5rem;margin-bottom:0.5rem;">&#9888;</div>' +
            '<p style="margin-bottom:1.5rem;">' + (msg || 'No pudimos cargar la información. Verificá tu conexión.') + '</p>' +
            '<button onclick="Feed.loadPosts()" style="padding:0.6rem 1.5rem;background:var(--primary,#3b82f6);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:0.95rem;">Reintentar</button>' +
            '</div>';
    },

    async init() {
        const usuario = Auth.getUser();
        this.modo = usuario ? (usuario.perfil_activo || usuario.tipo_perfil) : 'trabajador';
        this.currentUserId = usuario ? (usuario.id || usuario.user_id || null) : null;

        // Adaptar publish bar según rol
        const barText = document.getElementById('publishBarText');
        if (barText) {
            barText.textContent = this.modo === 'dueno'
                ? '¿Qué necesitás hacer hoy?'
                : 'Compartí tu trabajo realizado...';
        }

        // Mostrar/ocultar items del sidebar según rol
        document.querySelectorAll('#feedSidebarNav .menu-item[data-role]').forEach(item => {
            item.style.display = item.dataset.role === this.modo ? '' : 'none';
        });

        // Trabajadores no publican manualmente: sus posts son automáticos del sistema
        if (this.modo === 'trabajador') {
            const bar = document.getElementById('publishBarTrigger');
            if (bar) bar.style.display = 'none';
        }

        // Poblar selector de minutos del modal de oferta con todos los valores 00-59
        const selMinutos = document.getElementById('offer-minutos');
        if (selMinutos && selMinutos.options.length === 0) {
            for (let m = 0; m < 60; m++) {
                const mv = String(m).padStart(2, '0');
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = mv + ' min';
                selMinutos.appendChild(opt);
            }
        }

        await this.cargarRubros();
        if (this.modo === 'trabajador') await this._cargarDisponibilidadTrabajador();
        await this.loadPosts();
        this.setupEventListeners();
        this._initBannerVerificacion();
        _cargarWidgetTrabajo();
    },

    _initBannerVerificacion() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('email_verificado') === '1') {
            // Limpiar param de la URL sin recargar
            history.replaceState(null, '', window.location.pathname);
            // Actualizar email_verificado en datos locales
            const user = Auth.getUser();
            if (user) {
                user.email_verificado = true;
                localStorage.setItem('user_data', JSON.stringify(user));
            }
            return; // Ya verificado, no mostrar banner
        }

        const usuario = Auth.getUser();
        if (!usuario || usuario.email_verificado === true) return;

        const banner = document.getElementById('bannerVerifEmail');
        if (!banner) return;
        banner.style.display = 'flex';

        const btnReenviar = document.getElementById('btnReenviarVerif');
        const msgEl = document.getElementById('bannerVerifMsg');
        if (!btnReenviar) return;

        btnReenviar.addEventListener('click', async () => {
            btnReenviar.disabled = true;
            btnReenviar.textContent = 'Enviando...';
            msgEl.style.display = 'none';

            try {
                const res = await fetch('/api/auth/resend-verification', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
                });
                const data = await res.json();

                if (res.ok) {
                    msgEl.textContent = data.mensaje || 'Link enviado.';
                    msgEl.style.color = '#155724';
                    if (data.dev_verification_link) {
                        msgEl.innerHTML = `Link enviado. <a href="${data.dev_verification_link}" style="color:#0d6efd; text-decoration:underline; font-weight:600;">[dev: verificar ahora]</a>`;
                    }
                } else {
                    msgEl.textContent = data.error || 'Error al reenviar.';
                    msgEl.style.color = '#721c24';
                }
                msgEl.style.display = 'inline';
            } catch {
                msgEl.textContent = 'Error de conexión.';
                msgEl.style.color = '#721c24';
                msgEl.style.display = 'inline';
            }

            btnReenviar.disabled = false;
            btnReenviar.textContent = 'Reenviar verificación';
        });
    },

    async _cargarDisponibilidadTrabajador() {
        try {
            const res = await fetch('/api/disponibilidad', {
                headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
            });
            const data = await res.json();
            this._disponibilidad = data.disponibilidad || data || [];
        } catch (err) {
            console.error('Error cargando disponibilidad del trabajador:', err);
            this._disponibilidad = [];
        }
    },

    async cargarRubros() {
        try {
            const response = await fetch('/api/rubros', {
                headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
            });
            const data = await response.json();
            if (data.rubros) this._rubros = data.rubros;
        } catch (err) {
            console.error('Error cargando rubros:', err);
        }
    },

    _RUBROS_KEYWORDS: {
        1:  ['electr', 'luz', 'enchufe', 'cable', 'tablero', 'lampara', 'foco', 'tomacorriente', 'interruptor', 'voltaje', 'cortocircuito'],
        2:  ['plomero', 'plomeria', 'caño', 'cano', 'caneria', 'tuberia', 'inodoro', 'ducha', 'cisterna', 'perdida de agua', 'fuga de agua'],
        3:  ['albanil', 'ladrillo', 'cemento', 'revocar', 'grieta', 'azulejo', 'ceramica', 'construccion', 'mamposteria'],
        4:  ['pintar', 'pintura', 'esmalte', 'barniz', 'empapelar', 'repintar'],
        5:  ['carpinteria', 'carpintero', 'madera', 'placard', 'cajon', 'estante', 'mueble de madera'],
        6:  ['herreria', 'herrero', 'reja', 'porton', 'soldar', 'soldadura', 'hierro forjado'],
        7:  ['planta', 'jardin', 'poda', 'podar', 'cesped', 'pasto', 'arbol', 'flor', 'jardinero', 'jardineria'],
        8:  ['limpiar', 'limpieza', 'lavar', 'desinfectar', 'barrer', 'ordenar', 'cocina sucia'],
        9:  ['mudanza', 'mudar', 'traslado', 'empacar', 'mover muebles'],
        10: ['aire acondicionado', 'split', 'calefaccion', 'caldera', 'estufa', 'calefon', 'termotanque', 'refrigeracion'],
        11: ['alarma', 'camara de seguridad', 'vigilancia', 'sensor'],
        12: ['computadora', 'pc', 'notebook', 'laptop', 'impresora', 'wifi', 'virus', 'formatear', 'informatica'],
        13: ['logo', 'flyer', 'banner', 'diseño grafico', 'ilustracion', 'grafico'],
        14: ['pagina web', 'sitio web', 'wordpress', 'ecommerce', 'landing'],
        15: ['programar', 'app', 'software', 'codigo', 'programacion', 'aplicacion'],
        16: ['editar video', 'edicion video', 'montaje', 'youtube', 'reels'],
        17: ['musica', 'podcast', 'grabacion de audio', 'sonido', 'mezcla'],
        18: ['fotografia', 'sesion de fotos', 'fotografo', 'retrato fotografico'],
        19: ['marketing', 'redes sociales', 'instagram', 'facebook', 'publicidad digital'],
        20: ['redactar', 'articulo', 'traducir', 'blog', 'traduccion', 'redaccion'],
        21: ['contabilidad', 'contador', 'impuestos', 'facturacion', 'balance'],
        22: ['clases particulares', 'clase particular', 'tutor', 'matematicas', 'fisica', 'quimica'],
        23: ['ingles', 'idioma', 'frances', 'portugues', 'aleman', 'traduc'],
        24: ['gaming', 'videojuego', 'gamer', 'consola'],
        25: ['decorar interior', 'interiores', 'ambientacion', 'remodelacion', 'diseño de interiores'],
        26: ['cerradura', 'cerrajero', 'cerrajeria', 'candado', 'llave perdida', 'cambiar cerradura'],
        27: ['gas', 'gasfitero', 'gasfiteria', 'cocina a gas', 'escape de gas', 'calefon a gas'],
        28: ['flete', 'camion', 'transporte de carga', 'carga pesada'],
        29: ['niñera', 'cuidar niños', 'cuidar bebe', 'acompañante terapeutico', 'enfermeria'],
        30: ['mascota', 'perro', 'gato', 'veterinario', 'veterinaria', 'animal']
    },

    _detectarRubroPorTitulo(titulo) {
        const norm = function (s) {
            return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        };
        const texto = norm(titulo);
        let mejorId = null;
        let mejorScore = 0;
        const self = this;

        Object.keys(this._RUBROS_KEYWORDS).forEach(function (idStr) {
            const id = parseInt(idStr, 10);
            const keywords = self._RUBROS_KEYWORDS[id];
            let score = 0;
            keywords.forEach(function (kw) {
                if (texto.includes(norm(kw))) score += kw.length;
            });
            if (score > mejorScore) { mejorScore = score; mejorId = id; }
        });

        // También intentar match por nombre de rubro
        self._rubros.forEach(function (r) {
            const nombre = norm(r.nombre);
            if (texto.includes(nombre) && nombre.length > mejorScore) {
                mejorScore = nombre.length;
                mejorId = r.id;
            }
        });

        return mejorScore > 0 ? mejorId : null;
    },

    _mostrarRubroDetectado(rubroId) {
        const chip = document.getElementById('jobRubroChip');
        if (!chip) return;
        if (!rubroId) { chip.style.display = 'none'; chip.innerHTML = ''; return; }
        const rubro = this._rubros.find(function (r) { return r.id === rubroId; });
        if (!rubro) { chip.style.display = 'none'; return; }
        chip.innerHTML = (rubro.icono || '') + ' ' + rubro.nombre;
        chip.style.display = 'inline-flex';
    },

    async loadPosts(append = false) {
        if (this.loading) return;
        this.loading = true;
        const container = document.getElementById('postsContainer');

        const esDueno = this.modo === 'dueno';
        if (container && !append) container.innerHTML = this._skeletonHtml();

        let shouldRender = false;
        try {
            const url = `/api/jobs?limit=${this.limit}&offset=${this.offset}`;

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
            });
            const data = await response.json();

            const items = data.jobs || data.items || data.trabajos || [];

            if (data.success === false || data.error) {
                if (container) container.innerHTML = this._errorHtml(data.error || 'No se pudo cargar el feed.');
            } else {
                this.posts = append ? [...this.posts, ...items] : items;
                shouldRender = true;
            }
        } catch (error) {
            console.error('Error cargando feed:', error);
            if (container) container.innerHTML = this._errorHtml('No pudimos cargar la información. Verificá tu conexión.');
        } finally {
            this.loading = false;
        }

        if (shouldRender) this.render();
    },

    render() {
        const container = document.getElementById('postsContainer');
        if (!container) return;
        if (this.posts.length === 0) {
            const esDueno = this.modo === 'dueno';
            const emptyBtn = esDueno
                ? `<a href="/pages/publicar-trabajo.html" class="btn-action btn-action-primary" style="display:inline-block;margin-top:1.25rem;text-decoration:none;">+ Publicar el primero</a>`
                : `<a href="/pages/agenda.html" class="btn-action btn-action-primary" style="display:inline-block;margin-top:1.25rem;text-decoration:none;">Actualiz\u00e1 tu disponibilidad</a>`;
            container.innerHTML = `<div style="text-align:center;padding:3rem 1.5rem;color:var(--gray);"><div style="font-size:3.5rem;margin-bottom:1rem;">&#128203;</div><h3 style="color:var(--text);margin-bottom:0.5rem;">Todav\u00eda no hay trabajos publicados</h3><p style="font-size:0.95rem;">${esDueno ? 'S\u00e9 el primero en publicar un trabajo y recib\u00ed ofertas de profesionales.' : 'Cuando haya trabajos disponibles en tu zona los ver\u00e1s aqu\u00ed.'}</p>${emptyBtn}</div>`;
            return;
        }
        const esDueno = this.modo === 'dueno';
        const jobsVisibles = this.posts.filter(j => !j.estado || j.estado === 'publicado');
        container.innerHTML = jobsVisibles.map(job => {
            try { return this.renderPost(job, esDueno); }
            catch (e) { console.error('Error renderizando job', job?.id, e); return ''; }
        }).join('');
    },

    _parseUrls(val) {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch(e) { return []; }
    },

    _baCellHtml(urls, label) {
        if (!urls || !urls.length) return '';
        const first = urls[0];
        const extra = urls.length > 1 ? `<span class="ba-extra">+${urls.length - 1}</span>` : '';
        const cls   = label === 'Antes' ? 'antes' : 'despues';
        return `<div class="post-ba-cell ${cls}">
            <span class="ba-label">${label}</span>
            <img src="${first}" alt="${label}">
            ${extra}
        </div>`;
    },

    renderPortfolioPost(item) {
        const nombre = (item.trabajador_nombre
            ? `${item.trabajador_nombre} ${item.trabajador_apellido || ''}`.trim()
            : (item.trabajador_email ? item.trabajador_email.split('@')[0] : null)) || 'Usuario';
        const iniciales   = nombre.substring(0, 2).toUpperCase();
        const avatarColor = this._avatarColorBg(nombre);
        const tiempoAtras = App.timeAgo(item.creado_en);
        const rubroBadge  = item.rubro_nombre
            ? `<span class="urgency-badge urgency-normal">&#128295; ${item.rubro_nombre}</span>`
            : '';

        // Resolve before/after arrays (new format) → single fields (legacy) → generic photos
        let antesUrls   = this._parseUrls(item.fotos_antes_urls);
        let despuesUrls = this._parseUrls(item.fotos_despues_urls);
        if (!antesUrls.length   && item.foto_antes_url)   antesUrls   = [item.foto_antes_url];
        if (!despuesUrls.length && item.foto_despues_url) despuesUrls = [item.foto_despues_url];

        let fotosHtml = '';
        if (antesUrls.length || despuesUrls.length) {
            fotosHtml = `<div class="post-ba-grid">
                ${this._baCellHtml(antesUrls,   'Antes')}
                ${this._baCellHtml(despuesUrls, 'Despu\u00e9s')}
            </div>`;
        } else {
            const fotos = this._parseUrls(item.fotos_urls);
            if (fotos.length) {
                fotosHtml = `<div class="post-photos-grid">${fotos.slice(0, 4).map(u => `<img src="${u}" alt="foto">`).join('')}</div>`;
            }
        }

        return `
            <div class="card post-card" data-portfolio-id="${item.id}">
                <div class="post-header">
                    <div class="post-user">
                        <div class="avatar" style="cursor:pointer;background:${avatarColor};" onclick="window.location.href='/pages/perfil-publico.html?id=${item.trabajador_id}'">${iniciales}</div>
                        <div class="post-meta">
                            <h4 style="cursor:pointer;" onclick="window.location.href='/pages/perfil-publico.html?id=${item.trabajador_id}'">${nombre}</h4>
                            <div class="meta-info">&#128736; Trabajador &bull; ${tiempoAtras}</div>
                        </div>
                    </div>
                    ${rubroBadge}
                </div>
                <div class="post-content">
                    <div class="post-title">${item.titulo}</div>
                    ${item.descripcion ? `<div class="post-description">${item.descripcion}</div>` : ''}
                    ${fotosHtml}
                </div>
                <div class="post-actions">
                    <button class="post-action primary" onclick="window.location.href='/pages/perfil-publico.html?id=${item.trabajador_id}'">Ver Perfil</button>
                    <button class="post-action" onclick="Feed.contactarTrabajador(${item.trabajador_id}, ${JSON.stringify(nombre).replace(/"/g, '&quot;')})">&#128172; Contactar</button>
                </div>
            </div>`;
    },

    renderPost(job, soloLectura = false) {
        const nombre = (job.dueno_nombre
            ? `${job.dueno_nombre} ${job.dueno_apellido || ''}`.trim()
            : (job.dueno_email ? job.dueno_email.split('@')[0] : null)) || 'Usuario';
        const iniciales = nombre.substring(0, 2).toUpperCase();
        const avatarColor = this._avatarColorBg(nombre);
        const presupuesto = job.presupuesto_max
            ? `$${Number(job.presupuesto_min).toLocaleString('es-AR')} - $${Number(job.presupuesto_max).toLocaleString('es-AR')}`
            : job.presupuesto_min
                ? `$${Number(job.presupuesto_min).toLocaleString('es-AR')}`
                : 'A convenir';
        const tiempoAtras = App.timeAgo(job.creado_en);
        const urgenciaBadge = job.es_urgente
            ? '<span class="urgency-badge urgency-urgent">&#9889; Urgente</span>'
            : '<span class="urgency-badge urgency-normal">Normal</span>';

        const fotos = this._parseUrls(job.fotos_urls);
        let jobFotosHtml = '';
        if (fotos.length === 1) {
            jobFotosHtml = `<div class="post-job-photos single"><img src="${fotos[0]}" alt="foto del trabajo"></div>`;
        } else if (fotos.length === 2) {
            jobFotosHtml = `<div class="post-job-photos multi"><div class="pjp-cell"><img src="${fotos[0]}" alt="foto"></div><div class="pjp-cell"><img src="${fotos[1]}" alt="foto"></div></div>`;
        } else if (fotos.length >= 3) {
            const extra = fotos.length - 3;
            jobFotosHtml = `<div class="post-job-photos multi"><div class="pjp-cell span-full"><img src="${fotos[0]}" alt="foto"></div><div class="pjp-cell"><img src="${fotos[1]}" alt="foto"></div><div class="pjp-cell"><img src="${fotos[2]}" alt="foto">${extra > 0 ? `<div class="pjp-more-overlay">+${extra}</div>` : ''}</div></div>`;
        }

        const ciudadHtml = job.ciudad ? `
            <div class="detail-item">
                <span class="detail-icon">&#128205;</span>
                <div class="detail-text">
                    <div class="detail-label">Ubicacion</div>
                    <div class="detail-value">${job.ciudad}${job.provincia ? ', ' + job.provincia : ''}</div>
                </div>
            </div>` : '';

        const rubroHtml = job.rubro_nombre ? `
            <div class="detail-item">
                <span class="detail-icon">&#128295;</span>
                <div class="detail-text">
                    <div class="detail-label">Rubro</div>
                    <div class="detail-value">${job.rubro_nombre}</div>
                </div>
            </div>` : '';

        const esPropioPost = soloLectura && this.currentUserId != null && job.dueno_id != null &&
            String(job.dueno_id) === String(this.currentUserId);
        const tieneOfertaAceptada = !!(job.trabajador_id || job.trabajador_asignado_id);
        const esPostAjeno = this.currentUserId != null && job.dueno_id != null &&
            String(job.dueno_id) !== String(this.currentUserId);
        const optionsMenuHtml = esPropioPost ? `
            <div class="post-options-wrap" style="position:relative;">
                <button class="post-options-btn" onclick="Feed.togglePostMenu(${job.id},event)" title="Opciones"
                    style="background:none;border:none;cursor:pointer;font-size:1.3rem;color:var(--gray);padding:0.2rem 0.4rem;border-radius:6px;line-height:1;"
                    >&#8942;</button>
                <div class="post-options-drop" id="post-options-drop-${job.id}"
                    style="display:none;position:absolute;right:0;top:calc(100% + 4px);background:#fff;border:1px solid var(--border,#e5e7eb);border-radius:var(--radius,8px);box-shadow:0 4px 16px rgba(0,0,0,.12);min-width:150px;z-index:100;overflow:hidden;">
                    <button onclick="Feed.compartirPublicacion(${job.id})"
                        style="display:flex;align-items:center;gap:0.5rem;width:100%;background:none;border:none;padding:0.65rem 1rem;cursor:pointer;font-size:0.9rem;color:var(--text,#111);text-align:left;"
                        onmouseover="this.style.background='var(--bg-secondary,#f3f4f6)'" onmouseout="this.style.background='none'"
                        >&#128279; Compartir</button>
                    ${!tieneOfertaAceptada ? `<button onclick="Feed.confirmarEliminarPublicacion(${job.id})"
                        style="display:flex;align-items:center;gap:0.5rem;width:100%;background:none;border:none;padding:0.65rem 1rem;cursor:pointer;font-size:0.9rem;color:var(--danger,#ef4444);text-align:left;"
                        onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='none'"
                        >&#128465; Eliminar</button>` : ''}
                </div>
            </div>` : esPostAjeno ? `
            <div class="post-options-wrap" style="position:relative;">
                <button class="post-options-btn" onclick="Feed.togglePostMenu(${job.id},event)" title="Opciones"
                    style="background:none;border:none;cursor:pointer;font-size:1.3rem;color:var(--gray);padding:0.2rem 0.4rem;border-radius:6px;line-height:1;"
                    >&#8942;</button>
                <div class="post-options-drop" id="post-options-drop-${job.id}"
                    style="display:none;position:absolute;right:0;top:calc(100% + 4px);background:#fff;border:1px solid var(--border,#e5e7eb);border-radius:var(--radius,8px);box-shadow:0 4px 16px rgba(0,0,0,.12);min-width:150px;z-index:100;overflow:hidden;">
                    <button onclick="Feed.abrirModalReportar('publicacion',${job.id})"
                        style="display:flex;align-items:center;gap:0.5rem;width:100%;background:none;border:none;padding:0.65rem 1rem;cursor:pointer;font-size:0.9rem;color:var(--text,#111);text-align:left;"
                        onmouseover="this.style.background='var(--bg-secondary,#f3f4f6)'" onmouseout="this.style.background='none'"
                        >&#9888;&#65039; Reportar</button>
                </div>
            </div>` : '';

        return `
            <div class="card post-card" data-job-id="${job.id}">
                <div class="post-header">
                    <div class="post-user">
                        <div class="avatar" style="cursor:pointer;background:${avatarColor};" onclick="window.location.href='/pages/perfil-publico.html?id=${job.dueno_id}'">${iniciales}</div>
                        <div class="post-meta">
                            <h4><a href="/pages/perfil-publico.html?id=${job.dueno_id}" style="cursor:pointer;color:inherit;text-decoration:none;">${nombre}</a> ${this._nivelBadge(job.dueno_total_trabajos)}</h4>
                            <div class="meta-info">&#127968; Dueno &bull; Publicado ${tiempoAtras}</div>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        ${urgenciaBadge}
                        ${optionsMenuHtml}
                    </div>
                </div>
                <div class="post-content">
                    <div class="post-title">${job.titulo}</div>
                    <div class="post-description">${job.descripcion}</div>
                    ${jobFotosHtml}
                    ${this._renderDisponibilidadDuenoBadge(job.disponibilidad_dueno)}
                    ${this._renderCoincidenciaDispo(job.disponibilidad_dueno)}
                    <div class="post-details">
                        ${ciudadHtml}
                        <div class="detail-item">
                            <span class="detail-icon">&#128176;</span>
                            <div class="detail-text">
                                <div class="detail-label">Presupuesto</div>
                                <div class="detail-value">${presupuesto}</div>
                            </div>
                        </div>
                        ${rubroHtml}
                        <div class="detail-item">
                            <span class="detail-icon">&#128172;</span>
                            <div class="detail-text">
                                <div class="detail-label">Ofertas</div>
                                <div class="detail-value">${job.total_ofertas || 0}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="post-actions">
                    ${soloLectura
                        ? `<button class="post-action" onclick="Feed.preguntarTrabajo(${job.id})">Preguntar</button>`
                        : job.ya_oferte
                            ? `<button class="post-action" disabled title="Ya tenés una oferta activa en este trabajo" style="opacity:0.5;cursor:not-allowed;">Oferta enviada</button>
                    <button class="post-action" onclick="Feed.preguntarTrabajo(${job.id})">Preguntar</button>`
                            : `<button class="post-action primary" onclick="Feed.openOfferModal(${job.id})">Ofertar</button>
                    <button class="post-action" onclick="Feed.preguntarTrabajo(${job.id})">Preguntar</button>`}
                    <button class="post-comments-btn" id="btn-comments-${job.id}" onclick="Feed.toggleComments(${job.id})">
                        &#128172; <span id="comments-count-${job.id}">${job.total_comentarios || 0}</span> comentario${Number(job.total_comentarios) === 1 ? '' : 's'}
                    </button>
                </div>
                <div id="comments-section-${job.id}" class="post-comments-section" style="display:none;"></div>
            </div>`;
    },

    // ── DISPONIBILIDAD DEL DUEÑO — badge en tarjeta ─────────────────────────

    _renderDisponibilidadDuenoBadge(disponibilidad_dueno) {
        if (!disponibilidad_dueno || !disponibilidad_dueno.length) return '';
        const DIAS_SHORT = ['Lun', 'Mar', 'Mi\u00E9', 'Jue', 'Vie', 'S\u00E1b', 'Dom'];
        const diasHtml = DIAS_SHORT.map(function (d, i) {
            const item = disponibilidad_dueno.find(function (x) { return x.dia_semana === i; });
            if (!item) return '';   // no info → don't show
            const cls = item.disponible ? 'dispo-badge-avail' : 'dispo-badge-unavail';
            return '<span class="dispo-badge-day ' + cls + '">' + d + '</span>';
        }).join('');
        if (!diasHtml.trim()) return '';
        return '<div class="post-dispo-row">&#128197; ' + diasHtml + '</div>';
    },

    // ── COINCIDENCIA DE DISPONIBILIDAD — indicador en tarjeta para trabajador ─

    _renderCoincidenciaDispo(disponibilidad_dueno) {
        if (this.modo !== 'trabajador') return '';
        if (!disponibilidad_dueno || !disponibilidad_dueno.length) return '';

        // Dias marcados como disponibles por el dueño
        const diasDueno = new Set(
            disponibilidad_dueno.filter(function (x) { return x.disponible; })
                                .map(function (x) { return x.dia_semana; })
        );
        if (diasDueno.size === 0) return '';

        // Dias configurados por el trabajador
        const diasTrabajador = new Set(
            this._disponibilidad.map(function (s) { return s.dia_semana; })
        );

        const hayCoincidencia = [...diasDueno].some(function (d) { return diasTrabajador.has(d); });

        if (hayCoincidencia) {
            return '<div class="post-dispo-coincidencia dispo-match">\u2705 Ten\u00e9s disponibilidad para este trabajo</div>';
        } else {
            return '<div class="post-dispo-coincidencia dispo-no-match">\uD83D\uDCC5 Sin coincidencia de horarios</div>';
        }
    },

    // ── DISPONIBILIDAD DEL DUEÑO EN MODAL PUBLICAR ──────────────────────────

    toggleDisponibilidadSection() {
        const section = document.getElementById('duenoDispoSection');
        const btn     = document.getElementById('btnToggleDuenoDispo');
        if (!section || !btn) return;
        const open = section.style.display !== 'none';
        section.style.display = open ? 'none' : 'block';
        btn.querySelector('.dispo-toggle-arrow').textContent = open ? '\u25BC' : '\u25B2';
        if (!open) this._renderDuenoDispoGrid();
    },

    _renderDuenoDispoGrid() {
        const container = document.getElementById('duenoDispoGrid');
        if (!container) return;
        const DIAS_SHORT = ['Lun', 'Mar', 'Mi\u00E9', 'Jue', 'Vie', 'S\u00E1b', 'Dom'];
        const self = this;
        container.innerHTML = DIAS_SHORT.map(function (d, i) {
            const estado = self._duenoDispo[i];
            const cls = estado === true ? 'avail' : estado === false ? 'unavail' : 'neutral';
            const title = estado === true ? 'Disponible \u2014 clic para marcar como no disponible'
                        : estado === false ? 'No disponible \u2014 clic para quitar marca'
                        : 'Sin marcar \u2014 clic para marcar como disponible';
            return '<div class="dispo-day-cell ' + cls + '" data-dia="' + i + '" title="' + title + '"' +
                ' onclick="Feed._toggleDispoDay(' + i + ')">' + d + '</div>';
        }).join('');
    },

    _toggleDispoDay(dia) {
        const current = this._duenoDispo[dia];
        if (current === undefined)   this._duenoDispo[dia] = true;
        else if (current === true)   this._duenoDispo[dia] = false;
        else                         delete this._duenoDispo[dia];
        this._renderDuenoDispoGrid();
    },

    async publicarTrabajo() {
        const titulo      = document.getElementById('job-titulo').value.trim();
        const descripcion = document.getElementById('job-descripcion').value.trim();
        const errorEl     = document.getElementById('jobError');
        errorEl.classList.remove('visible');

        if (!titulo) {
            errorEl.textContent = 'Ingres\u00E1 un t\u00EDtulo para el trabajo';
            errorEl.classList.add('visible');
            document.getElementById('job-titulo').focus();
            return;
        }
        if (!descripcion) {
            errorEl.textContent = 'Agreg\u00E1 una descripci\u00F3n detallada';
            errorEl.classList.add('visible');
            document.getElementById('job-descripcion').focus();
            return;
        }
        if (this._feedMedia.length === 0) {
            errorEl.textContent = 'Necesit\u00E1s agregar al menos una foto del estado actual del trabajo';
            errorEl.classList.add('visible');
            return;
        }

        // Build disponibilidad_dueno payload (only explicitly set days)
        const diasDispo = Object.keys(this._duenoDispo).map((k) => ({
            dia_semana: parseInt(k, 10),
            disponible: this._duenoDispo[k]
        }));
        const disponibilidadDueno = diasDispo.length > 0 ? diasDispo : null;

        const btn = document.getElementById('btnPublicarTrabajo');
        btn.disabled = true;
        btn.textContent = 'Publicando...';

        try {
            let data;
            const payload = { titulo, descripcion, disponibilidad_dueno: disponibilidadDueno };
            if (this._rubroDetectadoId) payload.rubro_id = this._rubroDetectadoId;

            const formData = new FormData();
            formData.append('data', JSON.stringify(payload));
            this._feedMedia.forEach(function (file) {
                formData.append('media', file, file.name);
            });
            const resp = await fetch('/api/jobs', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${Auth.getToken()}` },
                body: formData
            });
            data = await resp.json();
            if (data.success) {
                document.getElementById('job-titulo').value = '';
                document.getElementById('job-descripcion').value = '';
                this.closePublishModal();
                App.showNotification('¡Trabajo publicado! Los trabajadores ya pueden verlo.', 'success');
                setTimeout(() => { window.location.href = '/pages/mis-ofertas-laborales.html'; }, 1500);
            } else {
                errorEl.textContent = data.error || 'Error al publicar';
                errorEl.classList.add('visible');
            }
        } catch (err) {
            errorEl.textContent = 'Error de conexion';
            errorEl.classList.add('visible');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Publicar';
        }
    },

    openPublishModal() {
        if (this.modo === 'trabajador') {
            document.getElementById('modalPortfolio').style.display = 'flex';
        } else {
            document.getElementById('modalPublicar').style.display = 'flex';
        }
    },

    closePublishModal() {
        document.getElementById('modalPublicar').style.display = 'none';
        this._feedMedia        = [];
        this._duenoDispo       = {};
        this._rubroDetectadoId = null;
        const chip = document.getElementById('jobRubroChip');
        if (chip) { chip.style.display = 'none'; chip.innerHTML = ''; }
        const tituloInput = document.getElementById('job-titulo');
        if (tituloInput) tituloInput.value = '';
        this._renderFeedMediaPreviews();
        const input = document.getElementById('feedMediaInput');
        if (input) input.value = '';
        // Collapse the availability section
        const sec = document.getElementById('duenoDispoSection');
        if (sec) sec.style.display = 'none';
        const arrow = document.querySelector('#btnToggleDuenoDispo .dispo-toggle-arrow');
        if (arrow) arrow.textContent = '\u25BC';
    },

    openPortfolioModal() {
        this._jobContext = null;
        const titleEl = document.getElementById('portfolioModalTitle');
        if (titleEl) titleEl.innerHTML = '&#128247; Compartir Trabajo Realizado';
        const ownerSection = document.getElementById('portfolioOwnerFotos');
        const antesSection = document.getElementById('portfolioAntesSection');
        if (ownerSection) ownerSection.style.display = 'none';
        if (antesSection) antesSection.style.display = 'block';
        document.getElementById('modalPortfolio').style.display = 'flex';
    },

    marcarRealizado(jobId) {
        const job = this.posts.find(function (p) { return p.id === jobId; });
        if (!job) return;

        this._jobContext = { jobId: jobId, fotosUrls: this._parseUrls(job.fotos_urls) };

        // Pre-llenar título
        const tituloEl = document.getElementById('portfolio-titulo');
        if (tituloEl) tituloEl.value = job.titulo || '';

        // Actualizar título del modal
        const titleEl = document.getElementById('portfolioModalTitle');
        if (titleEl) titleEl.innerHTML = '&#10003; Marcar Trabajo Realizado';

        // Mostrar fotos del dueño como referencia, ocultar upload de Antes
        const ownerSection = document.getElementById('portfolioOwnerFotos');
        const antesSection = document.getElementById('portfolioAntesSection');

        if (ownerSection && this._jobContext.fotosUrls.length > 0) {
            const grid = document.getElementById('portfolioOwnerGrid');
            if (grid) {
                grid.innerHTML = this._jobContext.fotosUrls.slice(0, 4).map(function (url) {
                    return '<div class="media-preview-item"><img src="' + url + '" alt="foto del cliente" style="pointer-events:none;"></div>';
                }).join('');
            }
            ownerSection.style.display = 'block';
        } else if (ownerSection) {
            ownerSection.style.display = 'none';
        }

        if (antesSection) antesSection.style.display = 'none';

        document.getElementById('modalPortfolio').style.display = 'flex';
    },

    closePortfolioModal() {
        document.getElementById('modalPortfolio').style.display = 'none';
        this._portfolioMedia = [];
        this._portfolioAntes = [];
        this._portfolioDespues = [];
        this._jobContext = null;
        this._renderPortfolioAntesGrid();
        this._renderPortfolioDespuesGrid();
        ['portfolio-titulo', 'portfolio-descripcion', 'portfolio-job-id'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        ['portfolioAntesInput', 'portfolioDespuesInput'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const ownerSection = document.getElementById('portfolioOwnerFotos');
        const antesSection = document.getElementById('portfolioAntesSection');
        if (ownerSection) ownerSection.style.display = 'none';
        if (antesSection) antesSection.style.display = 'block';
    },

    async publicarPortfolio() {
        const titulo = document.getElementById('portfolio-titulo').value.trim();
        const errorEl = document.getElementById('portfolioError');
        errorEl.classList.remove('visible');

        if (!titulo) {
            errorEl.textContent = 'El título del trabajo es obligatorio';
            errorEl.classList.add('visible');
            return;
        }

        const btn = document.getElementById('btnPublicarPortfolio');
        btn.disabled = true;
        btn.textContent = 'Publicando...';

        try {
            const body = {
                titulo,
                descripcion: document.getElementById('portfolio-descripcion').value.trim() || null
            };

            // Si viene de un job: incluir job_id y fotos_antes_urls del dueño
            if (this._jobContext) {
                body.job_id = this._jobContext.jobId;
                if (this._jobContext.fotosUrls && this._jobContext.fotosUrls.length > 0) {
                    body.fotos_antes_urls = this._jobContext.fotosUrls;
                }
            }

            const formData = new FormData();
            formData.append('data', JSON.stringify(body));
            this._portfolioAntes.forEach(file => formData.append('fotos_antes', file, file.name));
            this._portfolioDespues.forEach(file => formData.append('fotos_despues', file, file.name));

            let data;
            if (this._portfolioAntes.length > 0 || this._portfolioDespues.length > 0) {
                const resp = await fetch('/api/portfolio', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${Auth.getToken()}` },
                    body: formData
                });
                data = await resp.json();
            } else {
                const resp = await fetch('/api/portfolio', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${Auth.getToken()}`
                    },
                    body: JSON.stringify(body)
                });
                data = await resp.json();
            }

            if (!data.error) {
                this.closePortfolioModal();
                await this.loadPosts();
            } else {
                errorEl.textContent = data.error || 'Error al publicar';
                errorEl.classList.add('visible');
            }
        } catch (err) {
            errorEl.textContent = 'Error de conexión';
            errorEl.classList.add('visible');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Publicar';
        }
    },

    _addPortfolioMedia(files) { /* legacy — no-op */ },
    _renderPortfolioMediaPreviews() { /* legacy — no-op */ },

    _addToPhotoArray(arr, files, max) {
        const self = this;
        Array.from(files).forEach(function (file) {
            if (!file.type.startsWith('image/')) return;
            if (file.size > self._FEED_MAX_MB * 1024 * 1024) {
                App.showNotification(file.name + ': supera los ' + self._FEED_MAX_MB + 'MB', 'error');
                return;
            }
            if (arr.length >= max) {
                App.showNotification('M\u00e1ximo ' + max + ' fotos', 'error');
                return;
            }
            arr.push(file);
        });
    },

    _renderPhotoGrid(arr, gridId, countId, onRemove) {
        const grid  = document.getElementById(gridId);
        const count = document.getElementById(countId);
        if (!grid) return;
        grid.innerHTML = '';
        arr.forEach(function (file, index) {
            const item = document.createElement('div');
            item.className = 'media-preview-item';
            const img = document.createElement('img');
            const url = URL.createObjectURL(file);
            img.src = url;
            img.alt = file.name;
            item.appendChild(img);
            const btn = document.createElement('button');
            btn.className = 'media-remove';
            btn.type      = 'button';
            btn.innerHTML = '&#10005;';
            btn.addEventListener('click', (function (i, u) {
                return function (e) {
                    e.stopPropagation();
                    URL.revokeObjectURL(u);
                    onRemove(i);
                };
            })(index, url));
            item.appendChild(btn);
            grid.appendChild(item);
        });
        if (count) {
            const n = arr.length;
            count.textContent = n > 0 ? n + ' foto' + (n !== 1 ? 's' : '') : '';
        }
    },

    _addPortfolioAntes(files) {
        this._addToPhotoArray(this._portfolioAntes, files, this._PORTFOLIO_MAX_PHOTOS);
        this._renderPortfolioAntesGrid();
    },

    _renderPortfolioAntesGrid() {
        const self = this;
        this._renderPhotoGrid(
            this._portfolioAntes,
            'portfolioAntesGrid',
            'portfolioAntesCount',
            function (i) { self._portfolioAntes.splice(i, 1); self._renderPortfolioAntesGrid(); }
        );
    },

    _addPortfolioDespues(files) {
        this._addToPhotoArray(this._portfolioDespues, files, this._PORTFOLIO_MAX_PHOTOS);
        this._renderPortfolioDespuesGrid();
    },

    _renderPortfolioDespuesGrid() {
        const self = this;
        this._renderPhotoGrid(
            this._portfolioDespues,
            'portfolioDespuesGrid',
            'portfolioDespuesCount',
            function (i) { self._portfolioDespues.splice(i, 1); self._renderPortfolioDespuesGrid(); }
        );
    },

    contactarTrabajador(userId, nombre) {
        if (typeof FloatingChat !== 'undefined') {
            FloatingChat.openWithUser(userId, nombre || 'Usuario');
        } else {
            window.location.href = `/pages/mensajes.html?contacto=${userId}`;
        }
    },

    _addFeedMedia(files) {
        const self = this;
        Array.from(files).forEach(function (file) {
            const isPhoto = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');
            if (!isPhoto && !isVideo) return;
            if (file.size > self._FEED_MAX_MB * 1024 * 1024) {
                App.showNotification(file.name + ': supera los ' + self._FEED_MAX_MB + 'MB', 'error');
                return;
            }
            const photos = self._feedMedia.filter(function (f) { return f.type.startsWith('image/'); }).length;
            const videos = self._feedMedia.filter(function (f) { return f.type.startsWith('video/'); }).length;
            if (isPhoto && photos >= self._FEED_MAX_PHOTOS) {
                App.showNotification('M\u00e1ximo ' + self._FEED_MAX_PHOTOS + ' fotos', 'error');
                return;
            }
            if (isVideo && videos >= self._FEED_MAX_VIDEOS) {
                App.showNotification('M\u00e1ximo ' + self._FEED_MAX_VIDEOS + ' videos', 'error');
                return;
            }
            self._feedMedia.push(file);
        });
        this._renderFeedMediaPreviews();
    },

    _removeFeedMedia(index) {
        this._feedMedia.splice(index, 1);
        this._renderFeedMediaPreviews();
    },

    _renderFeedMediaPreviews() {
        const grid  = document.getElementById('feedMediaGrid');
        const count = document.getElementById('feedMediaCount');
        if (!grid) return;

        grid.innerHTML = '';
        const self = this;

        this._feedMedia.forEach(function (file, index) {
            const item    = document.createElement('div');
            item.className = 'media-preview-item';

            const isVideo = file.type.startsWith('video/');
            const url     = URL.createObjectURL(file);

            if (isVideo) {
                const video = document.createElement('video');
                video.src   = url;
                video.muted = true;
                item.appendChild(video);
                const badge = document.createElement('div');
                badge.className   = 'media-type-badge';
                badge.textContent = '\u25b6 VIDEO';
                item.appendChild(badge);
            } else {
                const img = document.createElement('img');
                img.src = url;
                img.alt = file.name;
                item.appendChild(img);
            }

            const btn = document.createElement('button');
            btn.className = 'media-remove';
            btn.type      = 'button';
            btn.innerHTML = '&#10005;';
            btn.addEventListener('click', (function (i, u) {
                return function (e) {
                    e.stopPropagation();
                    URL.revokeObjectURL(u);
                    self._removeFeedMedia(i);
                };
            })(index, url));
            item.appendChild(btn);

            grid.appendChild(item);
        });

        if (count) {
            const photos = this._feedMedia.filter(function (f) { return f.type.startsWith('image/'); }).length;
            const videos = this._feedMedia.filter(function (f) { return f.type.startsWith('video/'); }).length;
            if (this._feedMedia.length > 0) {
                const parts = [];
                if (photos > 0) parts.push(photos + ' foto' + (photos !== 1 ? 's' : ''));
                if (videos > 0) parts.push(videos + ' video' + (videos !== 1 ? 's' : ''));
                count.textContent = parts.join(' \u00b7 ');
            } else {
                count.textContent = '';
            }
        }
    },

    openOfferModal(jobId) {
        document.getElementById('offer-job-id').value = jobId;
        document.getElementById('offer-monto').value = '';
        document.getElementById('offer-horas').value = '';
        document.getElementById('offer-minutos').value = '0';
        document.getElementById('offer-mensaje').value = '';
        document.getElementById('offerError').classList.remove('visible');
        document.getElementById('offerHintJornadas').textContent = '';

        // Verificar coincidencia de disponibilidad
        const job = this.posts.find(j => String(j.id) === String(jobId));
        const dispDueno = job?.disponibilidad_dueno || [];
        const diasDueno = new Set(
            dispDueno.filter(x => x.disponible).map(x => x.dia_semana)
        );
        const diasTrabajador = new Set(
            this._disponibilidad.map(s => s.dia_semana)
        );
        // Si el dueño no configuró días, no hay restricción → mostrar formulario
        const hayCoincidencia = diasDueno.size === 0 ||
            [...diasDueno].some(d => diasTrabajador.has(d));

        const noDispo = document.getElementById('offerNoDispo');
        const formContent = document.getElementById('offerFormContent');
        if (noDispo) noDispo.style.display = hayCoincidencia ? 'none' : 'block';
        if (formContent) formContent.style.display = hayCoincidencia ? 'block' : 'none';

        document.getElementById('modalOfertar').style.display = 'flex';
    },

    closeOfferModal() {
        document.getElementById('modalOfertar').style.display = 'none';
    },

    _actualizarHintJornadas() {
        const hintEl = document.getElementById('offerHintJornadas');
        if (!hintEl) return;
        const horas = parseInt(document.getElementById('offer-horas').value) || 0;
        const minutos = parseInt(document.getElementById('offer-minutos').value) || 0;
        const totalMin = horas * 60 + minutos;
        if (totalMin <= 0) { hintEl.textContent = ''; return; }
        const jornadas = totalMin / 480; // 8hs = 480 min
        if (jornadas >= 1 && totalMin % 480 === 0) {
            const j = Math.round(jornadas);
            hintEl.textContent = '= ' + j + ' jornada' + (j !== 1 ? 's' : '') + ' de 8hs';
        } else if (totalMin >= 480) {
            hintEl.textContent = '= ' + jornadas.toFixed(1).replace('.0', '') + ' jornadas de 8hs';
        } else {
            hintEl.textContent = '';
        }
    },

    async enviarOferta() {
        const jobId   = document.getElementById('offer-job-id').value;
        const monto   = document.getElementById('offer-monto').value;
        const errorEl = document.getElementById('offerError');
        errorEl.classList.remove('visible');

        if (!monto) {
            errorEl.textContent = 'El monto de la oferta es obligatorio';
            errorEl.classList.add('visible');
            return;
        }

        const btn = document.getElementById('btnEnviarOferta');
        btn.disabled    = true;
        btn.textContent = 'Enviando...';

        // Calcular tiempo en minutos y convertir a horas para el backend
        const horas   = parseInt(document.getElementById('offer-horas').value) || 0;
        const minutos = parseInt(document.getElementById('offer-minutos').value) || 0;
        const totalMin = horas * 60 + minutos;
        const tiempoEstimado = totalMin > 0 ? (totalMin % 60 === 0 ? horas : +(totalMin / 60).toFixed(2)) : null;
        const unidadTiempo   = totalMin > 0 ? 'horas' : null;

        try {
            const response = await fetch('/api/offers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.getToken()}`
                },
                body: JSON.stringify({
                    trabajo_id:      jobId,
                    monto_propuesto: monto,
                    tiempo_estimado: tiempoEstimado,
                    unidad_tiempo:   unidadTiempo,
                    mensaje:         document.getElementById('offer-mensaje').value || null
                })
            });
            const data = await response.json();
            if (!data.success) {
                errorEl.textContent = data.error || 'Error al enviar oferta';
                errorEl.classList.add('visible');
                return;
            }

            this.closeOfferModal();
            App.showNotification('\u2713 Oferta enviada correctamente', 'success');
            await this.loadPosts();
        } catch (err) {
            errorEl.textContent = 'Error de conexi\u00F3n';
            errorEl.classList.add('visible');
        } finally {
            btn.disabled    = false;
            btn.textContent = 'Enviar Oferta';
        }
    },

    async preguntarTrabajo(jobId) {
        try {
            // Buscar en caché primero (comparación flexible int/string)
            let duenioId = null;
            let duenioNombre = 'Usuario';
            const cached = this.posts.find(function (p) {
                return String(p.id) === String(jobId);
            });
            if (cached && cached.dueno_id) {
                duenioId = cached.dueno_id;
                if (cached.dueno_nombre) {
                    duenioNombre = `${cached.dueno_nombre} ${cached.dueno_apellido || ''}`.trim();
                }
            } else {
                // Fallback: obtener el trabajo por ID para asegurar tener dueno_id
                const jobData = await App.apiRequest('/jobs/' + jobId);
                const job = jobData && (jobData.job || jobData);
                if (job && job.dueno_id) {
                    duenioId = job.dueno_id;
                    if (job.dueno_nombre) {
                        duenioNombre = `${job.dueno_nombre} ${job.dueno_apellido || ''}`.trim();
                    }
                }
            }

            if (!duenioId) {
                App.showNotification('No se pudo identificar al dueño del trabajo', 'error');
                return;
            }

            const data = await App.apiRequest('/chat', {
                method: 'POST',
                body: JSON.stringify({ tipo: 'trabajo', referencia_id: jobId, participantes: [duenioId] })
            });

            if (data && data.conversacion_id) {
                if (typeof FloatingChat !== 'undefined') {
                    await FloatingChat.open(data.conversacion_id, duenioNombre, null, duenioId);
                    // Pre-fill input with job link so the worker can send it as first message
                    const convId = String(data.conversacion_id);
                    setTimeout(function () {
                        const win = document.getElementById('fc-' + convId);
                        if (win) {
                            const input = win.querySelector('.fc-input');
                            if (input && !input.value.trim()) {
                                const jobTitle = cached ? cached.titulo : ('trabajo #' + jobId);
                                input.value = 'Hola! Te escribo por el trabajo: "' + jobTitle + '" \uD83D\uDD17 ' + window.location.origin + '/pages/feed.html';
                                input.focus();
                            }
                        }
                    }, 350);
                } else {
                    window.location.href = '/pages/mensajes.html?conversacion=' + data.conversacion_id;
                }
            } else {
                App.showNotification('No se pudo abrir el chat: ' + (data && data.error || 'error desconocido'), 'error');
            }
        } catch (err) {
            console.error('Error abriendo chat:', err);
            App.showNotification('Error al abrir el chat', 'error');
        }
    },

    togglePostMenu(jobId, event) {
        event.stopPropagation();
        const drop = document.getElementById('post-options-drop-' + jobId);
        if (!drop) return;
        const isOpen = drop.style.display !== 'none';
        // Close all open dropdowns first
        document.querySelectorAll('.post-options-drop').forEach(function (d) {
            d.style.display = 'none';
        });
        if (!isOpen) drop.style.display = 'block';
    },

    _compartirJobId: null,
    _contactosCache: null,

    compartirPublicacion(jobId) {
        document.querySelectorAll('.post-options-drop').forEach(function (d) { d.style.display = 'none'; });
        this._compartirJobId = jobId;
        const url = window.location.origin + '/pages/feed.html?job=' + jobId;

        const input = document.getElementById('compartirLinkInput');
        if (input) input.value = url;

        const modal = document.getElementById('modalCompartir');
        if (modal) modal.style.display = 'flex';

        const buscar = document.getElementById('compartirBuscarContacto');
        if (buscar) buscar.value = '';

        this._cargarContactosCompartir();
    },

    async _cargarContactosCompartir() {
        const lista = document.getElementById('compartirContactosList');
        if (!lista) return;
        try {
            if (!this._contactosCache) {
                lista.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--gray);">Cargando contactos...</div>';
                const data = await App.apiRequest('/contactos/mis-contactos');
                this._contactosCache = data.data || data.contactos || [];
            }
            this._renderContactosCompartir(this._contactosCache);
        } catch (e) {
            lista.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--gray);">No se pudieron cargar los contactos.</div>';
        }
    },

    _renderContactosCompartir(contactos) {
        const lista = document.getElementById('compartirContactosList');
        if (!lista) return;
        if (!contactos || contactos.length === 0) {
            lista.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--gray);">No tenés contactos todavía.<br><small>Visitá perfiles y añadí contactos.</small></div>';
            return;
        }
        lista.innerHTML = contactos.map(function (c) {
            const nombre   = (c.nombre || 'Usuario').trim();
            const iniciales = nombre.substring(0, 2).toUpperCase();
            return '<div style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0.25rem;border-bottom:1px solid var(--border,#e5e7eb);">' +
                '<div style="width:36px;height:36px;border-radius:50%;background:var(--primary,#3b82f6);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;flex-shrink:0;">' + iniciales + '</div>' +
                '<div style="flex:1;font-size:0.9rem;font-weight:500;">' + nombre + '</div>' +
                '<button onclick="Feed.enviarPublicacionAContacto(' + c.otro_id + ', ' + JSON.stringify(nombre).replace(/"/g, '&quot;') + ')"' +
                    ' style="padding:0.35rem 0.8rem;background:var(--primary,#3b82f6);color:#fff;border:none;border-radius:var(--radius,8px);cursor:pointer;font-size:0.8rem;white-space:nowrap;">' +
                    '&#128172; Enviar' +
                '</button>' +
            '</div>';
        }).join('');
    },

    filtrarContactosCompartir(query) {
        if (!this._contactosCache) return;
        const q = query.toLowerCase().trim();
        const filtrados = q
            ? this._contactosCache.filter(function (c) { return (c.nombre || '').toLowerCase().includes(q); })
            : this._contactosCache;
        this._renderContactosCompartir(filtrados);
    },

    async enviarPublicacionAContacto(receptorId, nombreContacto) {
        if (!this._compartirJobId) return;
        const url = window.location.origin + '/pages/feed.html?job=' + this._compartirJobId;
        const mensaje = '📌 Te comparto esta publicación: ' + url;
        try {
            await App.apiRequest('/messages', {
                method: 'POST',
                body: JSON.stringify({ receptor_id: receptorId, texto: mensaje })
            });
            App.showNotification('Publicación enviada a ' + nombreContacto, 'success');
            this.cerrarModalCompartir();
        } catch (e) {
            App.showNotification('Error al enviar el mensaje', 'error');
        }
    },

    copiarLinkCompartir() {
        const input = document.getElementById('compartirLinkInput');
        const url = input ? input.value : (window.location.origin + '/pages/feed.html?job=' + this._compartirJobId);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function () {
                App.showNotification('&#128279; Link copiado', 'success');
            }).catch(function () { Feed._copiarFallback(url); });
        } else {
            this._copiarFallback(url);
        }
    },

    cerrarModalCompartir() {
        const modal = document.getElementById('modalCompartir');
        if (modal) modal.style.display = 'none';
        this._compartirJobId = null;
    },

    _copiarFallback(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            App.showNotification('&#128279; Link copiado', 'success');
        } catch (e) {
            App.showNotification('No se pudo copiar el link', 'error');
        }
        document.body.removeChild(ta);
    },

    confirmarEliminarPublicacion(jobId) {
        document.querySelectorAll('.post-options-drop').forEach(function (d) { d.style.display = 'none'; });
        this._jobToDelete = jobId;
        const modal = document.getElementById('modalConfirmarEliminar');
        if (modal) modal.style.display = 'flex';
    },

    cerrarModalEliminar() {
        this._jobToDelete = null;
        const modal = document.getElementById('modalConfirmarEliminar');
        if (modal) modal.style.display = 'none';
    },

    async eliminarPublicacion() {
        if (!this._jobToDelete) return;
        const jobId = this._jobToDelete;
        const btn = document.getElementById('btnConfirmarEliminar');
        if (btn) { btn.disabled = true; btn.textContent = 'Eliminando...'; }

        try {
            const resp = await fetch('/api/jobs/' + jobId, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + Auth.getToken() }
            });
            const data = await resp.json();
            if (data.success || resp.ok) {
                this.cerrarModalEliminar();
                App.showNotification('Publicación eliminada', 'success');
                this.posts = this.posts.filter(function (p) { return String(p.id) !== String(jobId); });
                this.render();
            } else {
                App.showNotification(data.error || 'No se pudo eliminar la publicación', 'error');
            }
        } catch (e) {
            App.showNotification('Error de conexión', 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Eliminar'; }
        }
    },

    setupEventListeners() {
        document.getElementById('publishBarTrigger')?.addEventListener('click', () => this.openPublishModal());

        // Modal trabajo (dueño)
        document.getElementById('btnPublicarTrabajo')?.addEventListener('click', () => this.publicarTrabajo());
        document.getElementById('modalPublicar')?.addEventListener('click', (e) => {
            if (e.target.id === 'modalPublicar') this.closePublishModal();
        });
        document.getElementById('feedMediaInput')?.addEventListener('change', (e) => {
            this._addFeedMedia(e.target.files);
            e.target.value = '';
        });
        document.getElementById('job-titulo')?.addEventListener('input', (e) => {
            const titulo = e.target.value;
            this._rubroDetectadoId = titulo.length >= 3 ? this._detectarRubroPorTitulo(titulo) : null;
            this._mostrarRubroDetectado(this._rubroDetectadoId);
        });

        // Modal portfolio (trabajador)
        document.getElementById('btnPublicarPortfolio')?.addEventListener('click', () => this.publicarPortfolio());
        document.getElementById('modalPortfolio')?.addEventListener('click', (e) => {
            if (e.target.id === 'modalPortfolio') this.closePortfolioModal();
        });
        document.getElementById('portfolioAntesInput')?.addEventListener('change', (e) => {
            this._addPortfolioAntes(e.target.files);
            e.target.value = '';
        });
        document.getElementById('portfolioDespuesInput')?.addEventListener('change', (e) => {
            this._addPortfolioDespues(e.target.files);
            e.target.value = '';
        });

        // Modal oferta
        document.getElementById('btnEnviarOferta')?.addEventListener('click', () => this.enviarOferta());
        document.getElementById('modalOfertar')?.addEventListener('click', (e) => {
            if (e.target.id === 'modalOfertar') this.closeOfferModal();
        });

        // Modal compartir
        document.getElementById('modalCompartir')?.addEventListener('click', (e) => {
            if (e.target.id === 'modalCompartir') this.cerrarModalCompartir();
        });

        // Modal confirmar eliminar
        document.getElementById('btnConfirmarEliminar')?.addEventListener('click', () => this.eliminarPublicacion());
        document.getElementById('modalConfirmarEliminar')?.addEventListener('click', (e) => {
            if (e.target.id === 'modalConfirmarEliminar') this.cerrarModalEliminar();
        });

        // Cerrar dropdowns de opciones al hacer click fuera
        document.addEventListener('click', function () {
            document.querySelectorAll('.post-options-drop').forEach(function (d) {
                d.style.display = 'none';
            });
        });

        // Exponer helpers necesarios desde HTML inline
        window.Feed = Feed;
    },

    // ── COMENTARIOS ──────────────────────────────────────────────────────────

    async toggleComments(jobId) {
        const seccion = document.getElementById(`comments-section-${jobId}`);
        if (!seccion) return;

        const visible = seccion.style.display !== 'none';
        if (visible) {
            seccion.style.display = 'none';
            return;
        }

        seccion.style.display = 'block';
        // Solo carga si está vacía (evita re-fetch innecesario)
        if (seccion.dataset.loaded === 'true') return;

        seccion.innerHTML = '<div class="comments-empty">Cargando...</div>';
        try {
            const token = Auth.getToken();
            const resp = await fetch(`/api/jobs/${jobId}/comentarios`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Error al cargar comentarios');
            seccion.dataset.loaded = 'true';
            this._renderComentarios(seccion, jobId, data.comentarios || []);
        } catch (err) {
            seccion.innerHTML = `<div class="comments-empty" style="color:var(--danger);">Error: ${err.message}</div>`;
        }
    },

    _renderComentarios(seccion, jobId, comentarios) {
        const listHtml = comentarios.length === 0
            ? '<div class="comments-empty">Sé el primero en comentar.</div>'
            : comentarios.map(c => {
                const nombre = c.usuario_nombre
                    ? `${c.usuario_nombre} ${c.usuario_apellido || ''}`.trim()
                    : (c.usuario_email ? c.usuario_email.split('@')[0] : 'Usuario');
                const iniciales = nombre.substring(0, 2).toUpperCase();
                const commentAvatarColor = this._avatarColorBg(nombre);
                const tiempo = App.timeAgo(c.creado_en);
                const esComentarioAjeno = this.currentUserId != null &&
                    String(c.usuario_id) !== String(this.currentUserId);
                const reportBtnHtml = esComentarioAjeno
                    ? `<button class="comment-report-btn" title="Reportar comentario"
                          onclick="Feed.abrirModalReportar('comentario',${c.id})">&#8942;</button>`
                    : '';
                return `
                <div class="comment-item" data-comment-id="${c.id}">
                    <div class="comment-avatar" style="background:${commentAvatarColor};">${iniciales}</div>
                    <div class="comment-body">
                        <div class="comment-author">${nombre}</div>
                        <div class="comment-text">${this._escapeHtml(c.contenido)}</div>
                        <div class="comment-time">${tiempo}</div>
                    </div>
                    ${reportBtnHtml}
                </div>`;
            }).join('');

        seccion.innerHTML = `
            <div class="post-comments-list" id="comments-list-${jobId}">${listHtml}</div>
            <div class="post-comment-form">
                <input type="text" class="post-comment-input" id="comment-input-${jobId}"
                    placeholder="Escribí un comentario..." maxlength="1000"
                    onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();Feed.enviarComentario(${jobId});}">
                <button class="post-comment-submit" onclick="Feed.enviarComentario(${jobId})">Comentar</button>
            </div>`;
    },

    async enviarComentario(jobId) {
        const input = document.getElementById(`comment-input-${jobId}`);
        if (!input) return;
        const contenido = input.value.trim();
        if (!contenido) return;

        const btn = input.nextElementSibling;
        btn.disabled = true;
        input.disabled = true;

        try {
            const token = Auth.getToken();
            const resp = await fetch(`/api/jobs/${jobId}/comentarios`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ contenido })
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || data.errores?.[0] || 'Error al comentar');

            input.value = '';
            this._prependComentario(jobId, data.comentario);
            this._incrementarContadorComentarios(jobId);
        } catch (err) {
            alert(err.message);
        } finally {
            btn.disabled = false;
            input.disabled = false;
            input.focus();
        }
    },

    _prependComentario(jobId, c) {
        const lista = document.getElementById(`comments-list-${jobId}`);
        if (!lista) return;

        // Eliminar el mensaje "Sé el primero en comentar." si existe
        const vacio = lista.querySelector('.comments-empty');
        if (vacio) vacio.remove();

        const nombre = c.nombre
            ? `${c.nombre} ${c.apellido || ''}`.trim()
            : (c.email ? c.email.split('@')[0] : 'Usuario');
        const iniciales = nombre.substring(0, 2).toUpperCase();
        const commentAvatarColor = this._avatarColorBg(nombre);

        const div = document.createElement('div');
        div.className = 'comment-item';
        div.dataset.commentId = c.id;
        div.innerHTML = `
            <div class="comment-avatar" style="background:${commentAvatarColor};">${iniciales}</div>
            <div class="comment-body">
                <div class="comment-author">${nombre}</div>
                <div class="comment-text">${this._escapeHtml(c.contenido)}</div>
                <div class="comment-time">Ahora</div>
            </div>`;
        lista.insertBefore(div, lista.firstChild);
    },

    _incrementarContadorComentarios(jobId) {
        const span = document.getElementById(`comments-count-${jobId}`);
        if (!span) return;
        const actual = parseInt(span.textContent) || 0;
        const nuevo = actual + 1;
        span.textContent = nuevo;
        // Actualizar el texto "comentario/comentarios" del botón
        const btn = document.getElementById(`btn-comments-${jobId}`);
        if (btn) {
            btn.innerHTML = `&#128172; <span id="comments-count-${jobId}">${nuevo}</span> comentario${nuevo === 1 ? '' : 's'}`;
        }
    },

    // ── REPORTAR CONTENIDO ───────────────────────────────────────────────────

    abrirModalReportar(tipo, referenciaId) {
        // Cerrar menú desplegable si estaba abierto
        document.querySelectorAll('.post-options-drop').forEach(d => d.style.display = 'none');

        this._reporteTipo = tipo;
        this._reporteReferenciaId = referenciaId;
        this._reporteMotivoSeleccionado = null;

        // Resetear UI
        document.querySelectorAll('.report-motivo-btn').forEach(b => b.classList.remove('selected'));
        const btnEnviar = document.getElementById('btnEnviarReporte');
        if (btnEnviar) btnEnviar.disabled = true;
        const errEl = document.getElementById('reportarError');
        if (errEl) { errEl.textContent = ''; errEl.classList.remove('visible'); }

        const modal = document.getElementById('modalReportar');
        if (modal) modal.style.display = 'flex';
    },

    cerrarModalReportar() {
        const modal = document.getElementById('modalReportar');
        if (modal) modal.style.display = 'none';
        this._reporteTipo = null;
        this._reporteReferenciaId = null;
        this._reporteMotivoSeleccionado = null;
    },

    _seleccionarMotivoReporte(btn) {
        document.querySelectorAll('.report-motivo-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this._reporteMotivoSeleccionado = btn.dataset.motivo;
        const btnEnviar = document.getElementById('btnEnviarReporte');
        if (btnEnviar) btnEnviar.disabled = false;
    },

    async enviarReporte() {
        if (!this._reporteMotivoSeleccionado) return;
        const btnEnviar = document.getElementById('btnEnviarReporte');
        const errEl = document.getElementById('reportarError');
        if (btnEnviar) { btnEnviar.disabled = true; btnEnviar.textContent = 'Enviando...'; }

        try {
            const token = Auth.getToken();
            const resp = await fetch('/api/reportes', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo: this._reporteTipo,
                    referencia_id: this._reporteReferenciaId,
                    motivo: this._reporteMotivoSeleccionado
                })
            });
            const data = await resp.json();
            if (!resp.ok) {
                const msg = data.error || data.errores?.[0] || 'Error al enviar el reporte';
                if (errEl) { errEl.textContent = msg; errEl.classList.add('visible'); }
                return;
            }
            this.cerrarModalReportar();
            App.showToast?.(data.mensaje || 'Reporte enviado');
        } catch (_) {
            if (errEl) { errEl.textContent = 'Error de conexión. Intentá de nuevo.'; errEl.classList.add('visible'); }
        } finally {
            if (btnEnviar) { btnEnviar.disabled = false; btnEnviar.textContent = 'Enviar reporte'; }
        }
    },

    _escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
};

// ── WIDGET TRABAJO EN PROCESO (perfil trabajador) ───────────────────────────

var _completarJobId     = null;
var _completarAntesUrls = [];
var _completarFotoFile  = null;

function _parseUrlsFeed(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val); } catch (e) { return []; }
}

function _etiquetaEstado(estado) {
    var mapa = {
        'en_negociacion':        'Acordado, pend. de inicio',
        'trabajador_llego':      'En curso \u2014 lleg\u00e1s al lugar',
        'pendiente_confirmacion':'Esperando confirmaci\u00f3n del due\u00f1o'
    };
    return mapa[estado] || estado;
}

async function _cargarWidgetTrabajo() {
    var widget = document.getElementById('widgetTrabajo');
    if (!widget) return;
    if (Feed.modo !== 'trabajador') { widget.style.display = 'none'; return; }
    widget.style.display = '';

    var contenido = document.getElementById('widgetTrabajoContenido');
    if (!contenido) return;

    try {
        var res = await fetch('/api/jobs/asignados', {
            headers: { 'Authorization': 'Bearer ' + Auth.getToken() }
        });
        if (!res.ok) throw new Error('Error ' + res.status);
        var data = await res.json();
        var jobs = Array.isArray(data) ? data : (data.data || []);
        var activo = jobs.find(function(j) {
            return j.estado === 'trabajador_llego' || j.estado === 'en_negociacion';
        });

        if (!activo) {
            contenido.innerHTML = '<div class="nearby-empty">No ten\u00e9s trabajos en proceso</div>';
            return;
        }

        var fecha = activo.fecha_inicio
            ? new Date(activo.fecha_inicio).toLocaleString('es-AR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })
            : 'Sin fecha definida';

        var btnCompletar = activo.estado === 'trabajador_llego'
            ? '<button class="btn-action btn-action-primary" style="width:100%;margin-top:0.75rem;font-size:0.85rem;" onclick="abrirModalCompletarFeed(' + activo.id + ')">&#128247; Marcar como terminado</button>'
            : '';

        contenido.innerHTML =
            '<div style="font-size:0.9rem;font-weight:700;color:var(--dark);margin-bottom:0.25rem;">' + Feed._escapeHtml(activo.titulo) + '</div>' +
            '<div style="font-size:0.78rem;color:var(--primary);font-weight:600;margin-bottom:0.2rem;">' + _etiquetaEstado(activo.estado) + '</div>' +
            '<div style="font-size:0.75rem;color:var(--gray);">&#128197; ' + fecha + '</div>' +
            btnCompletar;
    } catch (_) {
        contenido.innerHTML = '<div class="nearby-empty">Error al cargar</div>';
    }
}

function abrirModalCompletarFeed(jobId) {
    fetch('/api/jobs/asignados', {
        headers: { 'Authorization': 'Bearer ' + Auth.getToken() }
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        var jobs = Array.isArray(data) ? data : (data.data || []);
        var job  = jobs.find(function(j) { return Number(j.id) === Number(jobId); });
        if (!job) return;

        _completarJobId     = job.id;
        _completarAntesUrls = _parseUrlsFeed(job.fotos_urls);
        _completarFotoFile  = null;

        var tituloEl = document.getElementById('completar-titulo');
        if (tituloEl) tituloEl.value = job.titulo || '';
        var descEl = document.getElementById('completar-descripcion');
        if (descEl) descEl.value = '';
        var idEl = document.getElementById('completar-job-id');
        if (idEl) idEl.value = job.id;

        var antesWrap = document.getElementById('completarAntesWrap');
        var antesGrid = document.getElementById('completarAntesGrid');
        if (antesWrap && antesGrid) {
            if (_completarAntesUrls.length > 0) {
                antesGrid.innerHTML = _completarAntesUrls.map(function(url) {
                    return '<img src="' + Feed._escapeHtml(url) + '" style="width:80px;height:80px;object-fit:cover;border-radius:var(--radius);" alt="">';
                }).join('');
                antesWrap.style.display = '';
            } else {
                antesWrap.style.display = 'none';
            }
        }

        _renderFotoResultadoFeed();
        var input = document.getElementById('completarDespuesInput');
        if (input) input.value = '';
        document.getElementById('modalCompletar').style.display = 'flex';
    })
    .catch(function(e) { console.error('Error abriendo modal completar:', e); });
}

function cerrarModalCompletar() {
    document.getElementById('modalCompletar').style.display = 'none';
    _completarJobId     = null;
    _completarAntesUrls = [];
    _completarFotoFile  = null;
    _renderFotoResultadoFeed();
    var input = document.getElementById('completarDespuesInput');
    if (input) input.value = '';
}

function _renderFotoResultadoFeed() {
    var grid  = document.getElementById('completarDespuesGrid');
    var count = document.getElementById('completarDespuesCount');
    if (!grid) return;
    grid.innerHTML = '';
    if (_completarFotoFile) {
        var item = document.createElement('div');
        item.style.cssText = 'position:relative;width:90px;height:90px;border-radius:var(--radius);overflow:hidden;border:2px solid var(--border);';
        var url = URL.createObjectURL(_completarFotoFile);
        var media;
        if (_completarFotoFile.type.startsWith('video/')) {
            media = document.createElement('video');
            media.src = url;
            media.style.cssText = 'width:100%;height:100%;object-fit:cover;';
            media.muted = true;
        } else {
            media = document.createElement('img');
            media.src = url;
            media.style.cssText = 'width:100%;height:100%;object-fit:cover;';
            media.alt = '';
        }
        item.appendChild(media);
        var btn = document.createElement('button');
        btn.innerHTML = '&#10005;';
        btn.style.cssText = 'position:absolute;top:2px;right:2px;width:18px;height:18px;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:50%;cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center;padding:0;';
        btn.addEventListener('click', function() {
            URL.revokeObjectURL(url);
            _completarFotoFile = null;
            _renderFotoResultadoFeed();
        });
        item.appendChild(btn);
        grid.appendChild(item);
    }
    if (count) count.textContent = _completarFotoFile
        ? (_completarFotoFile.type.startsWith('video/') ? '1 video' : '1 foto')
        : '';
}

async function confirmarCompletar() {
    var errorEl = document.getElementById('completarError');
    errorEl.classList.remove('visible');

    if (!_completarFotoFile) {
        errorEl.textContent = 'Ten\u00e9s que subir la foto o video del resultado (obligatorio)';
        errorEl.classList.add('visible');
        return;
    }

    var btn = document.getElementById('btnConfirmarCompletar');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
        var formData = new FormData();
        formData.append('foto_resultado', _completarFotoFile, _completarFotoFile.name);
        var descripcion = (document.getElementById('completar-descripcion').value || '').trim();
        if (descripcion) formData.append('texto_resultado', descripcion);

        var resp = await fetch('/api/jobs/' + _completarJobId + '/completar', {
            method: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + Auth.getToken() },
            body: formData
        });
        var resData = await resp.json();
        if (!resp.ok) {
            errorEl.textContent = resData.error || 'Error al enviar';
            errorEl.classList.add('visible');
            return;
        }

        cerrarModalCompletar();
        App.showNotification('\u2705 Foto enviada. El due\u00f1o recibir\u00e1 una notificaci\u00f3n para confirmar.', 'success');
        await _cargarWidgetTrabajo();
    } catch (_) {
        errorEl.textContent = 'Error de conexi\u00f3n. Reintent\u00e1 en un momento.';
        errorEl.classList.add('visible');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Enviar y esperar confirmaci\u00f3n del due\u00f1o';
    }
}

window.abrirModalCompletarFeed = abrirModalCompletarFeed;
window.cerrarModalCompletar    = cerrarModalCompletar;
window.confirmarCompletar      = confirmarCompletar;

// ── FIN WIDGET ───────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) { window.location.href = '/index.html'; return; }
    const usuario = Auth.getUser();
    if (usuario) {
        const nombre = usuario.nombre || usuario.email;
        const iniciales = nombre.substring(0, 2).toUpperCase();
        const avatarColor = Feed._avatarColorBg(nombre);
        const el = document.getElementById('sidebarAvatar');
        if (el) { el.textContent = iniciales; el.style.background = avatarColor; }
        const barAvatar = document.getElementById('publishBarAvatar');
        if (barAvatar) { barAvatar.textContent = iniciales; barAvatar.style.background = avatarColor; }
        const nombreEl = document.getElementById('sidebarNombre');
        if (nombreEl) nombreEl.textContent = nombre;
        const rolEl = document.getElementById('sidebarRol');
        if (rolEl) rolEl.textContent = usuario.perfil_activo || usuario.tipo_perfil || '';
    }
    await Feed.init();

    // Event listener del input de foto para el modal de completar
    var completarInput = document.getElementById('completarDespuesInput');
    if (completarInput) {
        completarInput.addEventListener('change', function() {
            var file = this.files[0];
            if (!file || (!file.type.startsWith('image/') && !file.type.startsWith('video/'))) return;
            _completarFotoFile = file;
            _renderFotoResultadoFeed();
            this.value = '';
        });
    }
});

window.Feed = Feed;
