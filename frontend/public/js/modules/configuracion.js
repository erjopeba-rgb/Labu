/**
 * configuracion.js
 * Modulo de configuracion de cuenta - Labu
 */

let perfilData = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '/index.html';
        return;
    }
    await cargarPerfil();
});

async function cargarPerfil() {
    try {
        const usuario = Auth.getUser();
        const data    = await App.apiRequest('/profile');
        perfilData    = data.perfil;

        const nombre = perfilData && perfilData.nombre ? perfilData.nombre : '';
        const apellido = perfilData && perfilData.apellido ? perfilData.apellido : '';
        const iniciales = (nombre.charAt(0) + apellido.charAt(0)).toUpperCase() || usuario.email.substring(0, 2).toUpperCase();

        document.getElementById('avatarPreview').textContent  = iniciales;
        document.getElementById('input-nombre').value         = nombre;
        document.getElementById('input-apellido').value       = apellido;
        document.getElementById('input-email').value          = usuario.email || '';
        document.getElementById('input-telefono').value       = perfilData && perfilData.telefono   ? perfilData.telefono   : '';
        document.getElementById('input-biografia').value      = perfilData && perfilData.descripcion ? perfilData.descripcion : '';

    } catch (err) {
        console.error('Error cargando perfil:', err);
    }
}

function showSection(seccion, el) {
    document.querySelectorAll('.config-section').forEach(function (s) { s.classList.remove('active'); });
    document.querySelectorAll('.menu-item').forEach(function (m) { m.classList.remove('active'); });
    document.getElementById('section-' + seccion).classList.add('active');
    el.classList.add('active');
}

async function guardarPerfil() {
    const btn = document.getElementById('btnGuardarPerfil');
    btn.disabled    = true;
    btn.textContent = 'Guardando...';

    try {
        const body = {
            nombre:      document.getElementById('input-nombre').value.trim(),
            apellido:    document.getElementById('input-apellido').value.trim()  || null,
            telefono:    document.getElementById('input-telefono').value.trim()  || null,
            descripcion: document.getElementById('input-biografia').value.trim() || null
        };

        const data = await App.apiRequest('/profile/complete', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        if (data.success) {
            mostrarExito('perfilSuccess', 'Perfil actualizado correctamente');
            await cargarPerfil();
        } else {
            mostrarError('perfilError', data.error || 'Error al guardar');
        }
    } catch (err) {
        mostrarError('perfilError', 'Error de conexi&#243;n');
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Guardar Cambios';
    }
}

async function cambiarPassword() {
    const actual   = document.getElementById('input-pass-actual').value;
    const nueva    = document.getElementById('input-pass-nueva').value;
    const confirma = document.getElementById('input-pass-confirma').value;

    if (!actual || !nueva || !confirma) {
        mostrarError('passError', 'Complet&#225; todos los campos');
        return;
    }
    if (nueva !== confirma) {
        mostrarError('passError', 'Las contrase&#241;as no coinciden');
        return;
    }
    if (nueva.length < 8) {
        mostrarError('passError', 'La contrase&#241;a debe tener al menos 8 caracteres');
        return;
    }

    const btn = document.getElementById('btnCambiarPass');
    btn.disabled    = true;
    btn.textContent = 'Cambiando...';

    try {
        const data = await App.apiRequest('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ password_actual: actual, password_nueva: nueva })
        });

        if (data.success) {
            mostrarExito('passSuccess', 'Contrase&#241;a actualizada correctamente');
            document.getElementById('input-pass-actual').value   = '';
            document.getElementById('input-pass-nueva').value    = '';
            document.getElementById('input-pass-confirma').value = '';
        } else {
            mostrarError('passError', data.error || 'Error al cambiar contrase&#241;a');
        }
    } catch (err) {
        mostrarError('passError', 'Error de conexi&#243;n');
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Cambiar Contrase&#241;a';
    }
}

function cerrarSesion() {
    if (confirm('&#191;Cerrar sesi&#243;n?')) {
        Auth.logout();
    }
}

function eliminarCuenta() {
    App.showNotification('Para eliminar tu cuenta contact&#225; al soporte', 'info');
}

function mostrarExito(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.classList.add('visible');
    setTimeout(function () { el.classList.remove('visible'); }, 3000);
}

function mostrarError(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.classList.add('visible');
    setTimeout(function () { el.classList.remove('visible'); }, 4000);
}

window.showSection    = showSection;
window.guardarPerfil  = guardarPerfil;
window.cambiarPassword = cambiarPassword;
window.cerrarSesion   = cerrarSesion;
window.eliminarCuenta = eliminarCuenta;
