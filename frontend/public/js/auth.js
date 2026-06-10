/**
 * Labu — auth.js
 * Maneja login, registro y sesiones
 */

const Auth = {
    currentUser: null,
    token: null,

    init() {
        this.loadSession();
    },

    loadSession() {
        this.token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        const userData = localStorage.getItem('user_data');
        if (this.token && userData) {
            try {
                this.currentUser = JSON.parse(userData);
                this.checkSession();
            } catch (e) {
                this.logout();
            }
        }
    },

    async checkSession() {
        if (!this.token) return false;
        try {
            const response = await fetch('/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();
            if (data.valido && data.usuario) {
                this.currentUser = data.usuario;
                this.saveUserData();
                this.updateUI();
                return true;
            } else {
                this.logout();
                return false;
            }
        } catch (error) {
            console.error('Error verificando sesión:', error);
            return false;
        }
    },

    async login(email, password, remember = false) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (data.token) {
                this.token = data.token;
                this.currentUser = data.usuario;
                localStorage.setItem('auth_token', this.token);
                localStorage.setItem('user_data', JSON.stringify(this.currentUser));
                // Traer perfil si existe
                   try {
                const perfilRes = await fetch('/api/profile', {
                  headers: { 'Authorization': `Bearer ${this.token}` }
                 });
                const perfilData = await perfilRes.json();
                 if (perfilData.perfil) {
                      this.currentUser.nombre = perfilData.perfil.nombre;
                    this.currentUser.apellido = perfilData.perfil.apellido;
                     localStorage.setItem('user_data', JSON.stringify(this.currentUser));
                     }
                   } catch(e) {}

                 this.updateUI();
                    window.location.href = '/pages/feed.html';
                return { success: true };
            }
            return { success: false, error: data.error || 'Error al iniciar sesión' };
        } catch (error) {
            console.error('Error en login:', error);
            return { success: false, error: 'Error de conexión' };
        }
    },

    async register(formData) {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password,
                    tipo_perfil: formData.tipo_usuario || 'dueno',
                    fecha_nacimiento: formData.fecha_nacimiento
                })
            });
            const data = await response.json();
            if (data.token) {
                this.token = data.token;
                this.currentUser = data.usuario;
                localStorage.setItem('auth_token', this.token);
                localStorage.setItem('user_data', JSON.stringify(this.currentUser));
                this.updateUI();
                // No redirigir: mostrar mensaje de verificación de email en el modal
                return { success: true, devVerificationLink: data.dev_verification_link || null };
            }
            return { success: false, error: data.error || 'Error al registrar' };
        } catch (error) {
            console.error('Error en registro:', error);
            return { success: false, error: 'Error de conexión' };
        }
    },

    logout() {
        this.token = null;
        this.currentUser = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('user_data');
        window.location.href = '/index.html';
    },

    isAuthenticated() {
        return this.token !== null && this.currentUser !== null;
    },

    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/index.html';
            return false;
        }
        return true;
    },

    getUser()  { return this.currentUser; },
    getToken() { return this.token; },

    // Actualiza el token y los datos del usuario sin hacer logout
    // Usado al cambiar de perfil activo
    updateToken(newToken, newUser) {
        this.token = newToken;
        this.currentUser = Object.assign({}, this.currentUser, newUser);
        localStorage.setItem('auth_token', this.token);
        localStorage.setItem('user_data', JSON.stringify(this.currentUser));
    },

    updateUI() {
        const userNameEl   = document.getElementById('user-name');
        const userAvatarEl = document.getElementById('user-avatar');

        if (this.isAuthenticated()) {
            const nombre = this.currentUser.nombre || this.currentUser.email;
            if (userNameEl)   userNameEl.textContent   = nombre;
            if (userAvatarEl) userAvatarEl.textContent = nombre.charAt(0).toUpperCase();

            document.querySelectorAll('[data-auth="guest"]').forEach(el => el.style.display = 'none');
            document.querySelectorAll('[data-auth="user"]').forEach(el  => el.style.display = '');
        } else {
            document.querySelectorAll('[data-auth="guest"]').forEach(el => el.style.display = '');
            document.querySelectorAll('[data-auth="user"]').forEach(el  => el.style.display = 'none');
        }
    },

    saveUserData() {
        if (localStorage.getItem('auth_token')) {
            localStorage.setItem('user_data', JSON.stringify(this.currentUser));
        } else {
            sessionStorage.setItem('user_data', JSON.stringify(this.currentUser));
        }
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Auth.init());
} else {
    Auth.init();
}

window.Auth = Auth;