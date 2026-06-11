/**
 * Labu — main.js
 * Controlador principal de la aplicación
 */

const App = {
    initialized: false,

    init() {
        if (this.initialized) return;
        console.log('🚀 Iniciando Labu...');

        this.setupGlobalErrorHandling();
        this.checkAuthentication();
        this.setupNavigation();

        const storedToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        if (storedToken) {
            this.loadNotificationCount();
            this.loadMessageCount();
            this.startPeriodicUpdates();
            this.initPerfilToggle();
        }

        this.initialized = true;
        console.log('✅ Labu inicializado');
    },

    setupGlobalErrorHandling() {
        window.addEventListener('error', (e) => console.error('Error global:', e.error));
        window.addEventListener('unhandledrejection', (e) => console.error('Promise rechazada:', e.reason));
    },

    checkAuthentication() {
        const currentPath = window.location.pathname;
        const publicPages = ['/index.html', '/', '/views/index.html'];
        const isPublic = publicPages.some(p => currentPath.endsWith(p) || currentPath === p);

        if (!isPublic && !Auth.isAuthenticated()) {
            window.location.href = '/index.html';
        }
    },

    setupNavigation() {
        // Links directos a páginas protegidas
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (link) {
                const href = link.getAttribute('href');
                const isProtected = href.includes('/pages/') || href.includes('/views/pages/');
                if (isProtected && !Auth.isAuthenticated()) {
                    e.preventDefault();
                    window.location.href = '/index.html';
                }
            }
        });

        // Botones con data-page
        document.addEventListener('click', (e) => {
            const navBtn = e.target.closest('[data-page]');
            if (navBtn) {
                e.preventDefault();
                this.navigateTo(navBtn.getAttribute('data-page'));
            }
        });
    },

    navigateTo(page) {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/index.html';
            return;
        }

         const pageMap = {
          'feed':              '/pages/feed.html',
          'mi-perfil':         '/pages/mi-perfil.html',
          'publicar-trabajo':  '/pages/publicar-trabajo.html',
          'mis-trabajos':          '/pages/mis-trabajos.html',
          'mis-ofertas-laborales': '/pages/mis-ofertas-laborales.html',
          'mis-ofertas':       '/pages/mis-ofertas.html',
          'mensajes':          '/pages/mensajes.html',
          'notificaciones':    '/pages/notificaciones.html',
          'agenda':            '/pages/agenda.html',
          'busqueda':          '/pages/busqueda-avanzada.html',
          'catalogo':          '/pages/catalogo.html',
          'mis-pagos':         '/pages/mis-pagos.html',
          'configuracion':     '/pages/configuracion.html',
          'perfil-publico':    '/pages/perfil-publico.html',
          'ayudantes':         '/pages/ayudantes.html'
          };

        const url = pageMap[page];
        if (url) window.location.href = url;
    },

    // ── API ────────────────────────────────────────────────
    async apiRequest(endpoint, options = {}) {
        const finalOptions = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Auth.getToken()}`,
                ...options.headers
            }
        };

        try {
            const response = await fetch(`/api${endpoint}`, finalOptions);

            if (response.status === 401) {
                Auth.logout();
                return { success: false, error: 'Sesión expirada' };
            }

            if (response.status === 403) {
                const data = await response.json();
                if (data.error === 'TYCS_PENDIENTES') {
                    window.location.href = '/pages/terminos-y-condiciones.html';
                }
                return { success: false, error: data.error || 'Acceso denegado' };
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: 'Error de conexión' };
        }
    },

    // ── NOTIFICACIONES ────────────────────────────────────
    async loadNotificationCount() {
        if (!(localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token'))) return;
        try {
            const data = await this.apiRequest('/notifications?unread=true');
            this.updateBadge('notification-badge', data.count || 0);
        } catch (e) {}
    },

    async loadMessageCount() {
        if (!(localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token'))) return;
        try {
            const data = await this.apiRequest('/messages?unread=true');
            this.updateBadge('message-badge', data.count || 0);
        } catch (e) {}
    },

    updateBadge(id, count) {
        const badge = document.getElementById(id);
        if (!badge) return;
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    },

    startPeriodicUpdates() {
        setInterval(() => {
            this.loadNotificationCount();
            this.loadMessageCount();
        }, 30000);
    },

    // ── TOGGLE DE PERFIL ACTIVO ────────────────────────────
    initPerfilToggle() {
        const toggleEl = document.getElementById('navPerfilToggle');
        if (!toggleEl) return; // página sin toggle en el navbar

        if (!Auth.isAuthenticated()) return;
        const user = Auth.getUser();
        if (!user) return;

        const modoActivo = user.perfil_activo || user.tipo_perfil;
        console.log('[PerfilToggle] perfil_activo:', user.perfil_activo, '| tipo_perfil:', user.tipo_perfil, '| modoActivo usado:', modoActivo);

        const MODOS = {
            dueno:      { label: 'Dueño',      icon: '&#127968;' },
            trabajador: { label: 'Trabajador',  icon: '&#128736;' }
        };

        const infoActivo = MODOS[modoActivo];
        if (!infoActivo) {
            console.log('[PerfilToggle] modo sin toggle definido:', modoActivo, '— no se muestra el botón');
            return;
        }

        const iconEl  = document.getElementById('navModoIcon');
        const labelEl = document.getElementById('navModoLabel');
        if (iconEl)  iconEl.innerHTML   = infoActivo.icon;
        if (labelEl) labelEl.textContent = infoActivo.label;
        toggleEl.style.display = 'flex';
        toggleEl.title = 'Modo actual: ' + infoActivo.label + '. Click para cambiar.';

        toggleEl.addEventListener('click', () => {
            if (toggleEl.classList.contains('loading')) return;
            const nuevoModo = modoActivo === 'dueno' ? 'trabajador' : 'dueno';
            this._cambiarPerfilActivo(nuevoModo, toggleEl);
        });

        // Mostrar mensaje de primera vez si quedó en sessionStorage
        const primerVezMsg = sessionStorage.getItem('perfil_primer_vez_msg');
        if (primerVezMsg) {
            sessionStorage.removeItem('perfil_primer_vez_msg');
            setTimeout(() => this._mostrarToastPerfil(primerVezMsg), 500);
        }
    },

    _cambiarPerfilActivo(nuevoPerfil, toggleEl) {
        if (toggleEl) toggleEl.classList.add('loading');

        fetch('/api/auth/cambiar-perfil', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + Auth.getToken()
            },
            body: JSON.stringify({ nuevo_perfil: nuevoPerfil })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                if (toggleEl) toggleEl.classList.remove('loading');
                alert('No se pudo cambiar el perfil: ' + data.error);
                return;
            }
            Auth.updateToken(data.token, data.usuario);
            if (data.primer_vez) {
                const labels = { dueno: 'Dueño', trabajador: 'Trabajador' };
                const label  = labels[nuevoPerfil] || nuevoPerfil;
                sessionStorage.setItem('perfil_primer_vez_msg',
                    'Activando modo ' + label + ' por primera vez. ' +
                    'Completá tu perfil para poder ' +
                    (nuevoPerfil === 'trabajador' ? 'ofertar en trabajos.' : 'publicar trabajos.')
                );
            }
            window.location.reload();
        })
        .catch(() => {
            if (toggleEl) toggleEl.classList.remove('loading');
            alert('Error de conexión al cambiar el perfil.');
        });
    },

    _mostrarToastPerfil(mensaje) {
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);' +
            'background:#1e293b;color:#fff;padding:0.85rem 1.25rem;border-radius:10px;' +
            'font-size:0.875rem;max-width:360px;box-shadow:0 4px 20px rgba(0,0,0,0.25);' +
            'z-index:99999;line-height:1.4;text-align:center;';
        toast.textContent = mensaje;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 350);
        }, 5000);
    },

    // ── MODALES ───────────────────────────────────────────
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    },

    // ── LOADING ───────────────────────────────────────────
    showLoading() {
        let loader = document.getElementById('global-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'global-loader';
            loader.innerHTML = '<div class="loader-spinner"></div>';
            document.body.appendChild(loader);
        }
        loader.style.display = 'flex';
    },

    hideLoading() {
        const loader = document.getElementById('global-loader');
        if (loader) loader.style.display = 'none';
    },

    // ── NOTIFICACIONES UI ─────────────────────────────────
    showNotification(message, type = 'info') {
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            document.body.appendChild(container);
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        container.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },

    // ── UTILIDADES ────────────────────────────────────────
    formatCurrency(amount) {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
    },

    formatDate(date) {
        return new Date(date).toLocaleDateString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    },

    formatDateTime(date) {
        return new Date(date).toLocaleString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    },

    timeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        if (seconds < 60) return 'ahora';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `hace ${minutes}m`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `hace ${hours}h`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `hace ${days}d`;
        return this.formatDate(date);
    },

    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }
};

// ── CERRAR MODALES CON ESC ─────────────────────────────────
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        document.body.style.overflow = '';
    }
});

// ── AUTO-INIT ──────────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}

window.App = App;
// ── LOGOUT ────────────────────────────────────────────────
document.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="logout"]')) {
        e.preventDefault();
        Auth.logout();
    }
});