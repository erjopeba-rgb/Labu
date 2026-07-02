/**
 * disponibilidad.js
 * Módulo de disponibilidad semanal del trabajador - Labu
 * Cargado en agenda.html para configurar disponibilidad
 */

const DIAS_SEMANA = ['Lunes', 'Martes', 'Mi\u00E9rcoles', 'Jueves', 'Viernes', 'S\u00E1bado', 'Domingo'];

document.addEventListener('DOMContentLoaded', async function () {
    if (!Auth.isAuthenticated()) return;

    const usuario = Auth.getUser();
    const esDueno = usuario && (usuario.perfil_activo || usuario.tipo_perfil) === 'dueno';

    if (esDueno) {
        // Adaptar texto del card para el perfil dueño
        const descripcion = document.querySelector('#cardDisponibilidad p');
        if (descripcion) {
            descripcion.textContent = 'Configurá los días y horarios en los que estás disponible para recibir trabajadores. El agendamiento automático respetará estos horarios al aceptar una oferta.';
        }
        // Cargar formulario de disponibilidad y luego enriquecer el calendario con datos del dueño
        await inicializarDisponibilidad();
        await inicializarCalendarioDueno();
        return;
    }

    await inicializarDisponibilidad();
    await cargarReservasConfirmadas();
});

async function inicializarDisponibilidad() {
    const form = document.getElementById('dispForm');
    if (!form) return;

    // Load existing availability
    let disponibilidad = [];
    try {
        const data = await App.apiRequest('/disponibilidad');
        if (data.success) {
            disponibilidad = data.disponibilidad || [];
            const inputPrep = document.getElementById('inputPreparacion');
            if (inputPrep && data.tiempo_preparacion_minutos != null) {
                inputPrep.value = data.tiempo_preparacion_minutos;
            }
        }
    } catch (e) {
        // If tables don't exist yet, silently ignore - will work after migration
    }

    // Build a map: dia_semana → {hora_inicio, hora_fin}
    const dispMap = {};
    disponibilidad.forEach(function (slot) {
        dispMap[slot.dia_semana] = slot;
    });

    // Expose active days globally so the calendar can highlight them
    window.eventosConfirmados = {};
    window.diasDisponibles = new Set(disponibilidad.map(function (s) { return s.dia_semana; }));

    // All other days are unavailable (only meaningful if at least one day is configured)
    if (disponibilidad.length > 0) {
        window.diasNoDisponibles = new Set([0,1,2,3,4,5,6].filter(function(d) {
            return !window.diasDisponibles.has(d);
        }));
    } else {
        window.diasNoDisponibles = new Set();
    }

    // Fetch confirmed jobs (with fecha_inicio) to mark on calendar
    try {
        const jobsData = await App.apiRequest('/jobs/asignados');
        const jobs = jobsData.success ? (jobsData.jobs || []) : [];
        window.fechasConfirmadas = new Set(
            jobs
                .filter(function(j) { return j.fecha_inicio; })
                .map(function(j) { return j.fecha_inicio.substring(0, 10); })
        );
    } catch(e) {
        window.fechasConfirmadas = new Set();
    }

    if (typeof renderCalendario === 'function') renderCalendario();
    if (typeof renderProximosEventos === 'function') renderProximosEventos();
    if (typeof actualizarStats === 'function') actualizarStats();

    let html = '';
    DIAS_SEMANA.forEach(function (nombre, idx) {
        const slot    = dispMap[idx];
        const checked = slot ? 'checked' : '';
        const desde   = slot ? slot.hora_inicio.substring(0, 5) : '08:00';
        const hasta   = slot ? slot.hora_fin.substring(0, 5)   : '18:00';
        const disabled = slot ? '' : 'disabled';

        html +=
            '<div class="disp-day-row" id="dispRow' + idx + '">' +
                '<input type="checkbox" id="dispCheck' + idx + '" ' + checked +
                    ' onchange="toggleDispDia(' + idx + ')">' +
                '<label class="day-name" for="dispCheck' + idx + '">' + nombre + '</label>' +
                '<input type="time" class="disp-time-input" id="dispDesde' + idx + '"' +
                    ' value="' + desde + '" ' + disabled + '>' +
                '<input type="time" class="disp-time-input" id="dispHasta' + idx + '"' +
                    ' value="' + hasta + '" ' + disabled + '>' +
            '</div>';
    });

    form.innerHTML = html;
}

function toggleDispDia(idx) {
    const checked = document.getElementById('dispCheck' + idx).checked;
    document.getElementById('dispDesde' + idx).disabled = !checked;
    document.getElementById('dispHasta' + idx).disabled = !checked;
}

async function guardarDisponibilidad() {
    const slots = [];
    DIAS_SEMANA.forEach(function (_, idx) {
        const checked = document.getElementById('dispCheck' + idx).checked;
        if (!checked) return;
        const desde = document.getElementById('dispDesde' + idx).value;
        const hasta = document.getElementById('dispHasta' + idx).value;
        if (!desde || !hasta) return;
        if (desde >= hasta) {
            App.showNotification('El horario de fin debe ser mayor al de inicio (' + DIAS_SEMANA[idx] + ')', 'error');
            return;
        }
        slots.push({ dia_semana: idx, hora_inicio: desde, hora_fin: hasta });
    });

    const inputPrep = document.getElementById('inputPreparacion');
    const tiempoPrep = inputPrep ? Math.max(0, parseInt(inputPrep.value, 10) || 0) : 15;

    const btn = document.getElementById('btnGuardarDisp');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        const data = await App.apiRequest('/disponibilidad', {
            method: 'PUT',
            body: JSON.stringify({ slots, tiempo_preparacion_minutos: tiempoPrep })
        });
        if (data.success) {
            App.showNotification('Disponibilidad guardada', 'success');
        } else {
            App.showNotification(data.error || 'Error al guardar', 'error');
        }
    } catch (e) {
        App.showNotification('Error de conexi\u00F3n', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar Disponibilidad';
    }
}

async function inicializarCalendarioDueno() {
    try {
        const data = await App.apiRequest('/jobs/mis-trabajos');
        const jobs = (data && data.success) ? (data.data || []) : (Array.isArray(data) ? data : []);

        const diasAvail   = new Set();
        const diasUnavail = new Set();

        jobs.forEach(function(job) {
            if (!job.disponibilidad_dueno) return;
            let dispo = job.disponibilidad_dueno;
            if (typeof dispo === 'string') { try { dispo = JSON.parse(dispo); } catch(_) { return; } }
            if (!Array.isArray(dispo)) return;
            dispo.forEach(function(item) {
                if (item.disponible) diasAvail.add(item.dia_semana);
                else                 diasUnavail.add(item.dia_semana);
            });
        });

        // Available overrides unavailable
        window.diasDisponibles   = diasAvail;
        window.diasNoDisponibles = new Set([...diasUnavail].filter(function(d) { return !diasAvail.has(d); }));

        // Confirmed jobs that have a scheduled date
        window.fechasConfirmadas = new Set(
            jobs
                .filter(function(j) { return j.fecha_inicio; })
                .map(function(j) { return j.fecha_inicio.substring(0, 10); })
        );
    } catch(e) {
        window.diasDisponibles   = new Set();
        window.diasNoDisponibles = new Set();
        window.fechasConfirmadas = new Set();
    }

    // Load confirmed reservations with exact times for the hourly view
    try {
        const confirmData = await App.apiRequest('/disponibilidad/reservas/confirmadas-dueno');
        window.eventosConfirmados = {};
        if (confirmData.success && confirmData.reservas) {
            confirmData.reservas.forEach(function(r) {
                if (!r.fecha_inicio) return;
                const fecha = r.fecha_inicio.substring(0, 10);
                if (!window.eventosConfirmados[fecha]) window.eventosConfirmados[fecha] = [];
                const trabajador = r.trabajador_nombre
                    ? r.trabajador_nombre + (r.trabajador_apellido ? ' ' + r.trabajador_apellido : '')
                    : 'Trabajador';
                window.eventosConfirmados[fecha].push({
                    titulo: r.trabajo_titulo || 'Trabajo',
                    hora_inicio: r.hora_inicio ? r.hora_inicio.substring(0, 5) : '00:00',
                    hora_fin: r.hora_fin ? r.hora_fin.substring(0, 5) : null,
                    cliente: trabajador
                });
            });
        }
    } catch(e) {
        window.eventosConfirmados = {};
    }

    if (typeof renderCalendario === 'function') renderCalendario();
    if (typeof renderProximosEventos === 'function') renderProximosEventos();
    if (typeof actualizarStats === 'function') actualizarStats();
}

async function cargarReservasConfirmadas() {
    const card  = document.getElementById('cardReservasConfirmadas');
    const lista = document.getElementById('listaReservasConfirmadas');
    if (!card || !lista) return;

    // Revelamos el card y mostramos estado de carga para dar feedback inmediato
    // (antes se quedaba oculto: en blanco tanto si tardaba como si fallaba).
    card.style.display = 'block';
    lista.innerHTML = '<div class="empty-state"><div class="empty-icon">&#9203;</div>' +
        '<p>Cargando trabajos agendados...</p></div>';

    let data;
    try {
        data = await App.apiRequest('/disponibilidad/reservas/confirmadas');
    } catch (e) {
        data = null;
    }

    // Estado de error (con reintentar)
    if (!data || data.success === false) {
        lista.innerHTML = '<div class="empty-state"><div class="empty-icon">&#9888;&#65039;</div>' +
            '<p>No pudimos cargar tus trabajos agendados.</p>' +
            '<button type="button" class="disp-save-btn" onclick="cargarReservasConfirmadas()">Reintentar</button></div>';
        return;
    }

    const reservas = data.reservas || [];

    // Estado vacío (con CTA al feed)
    if (reservas.length === 0) {
        lista.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128197;</div>' +
            '<p>Todavía no tenés trabajos agendados.</p>' +
            '<p style="font-size:0.85rem;color:var(--gray);">Cuando aceptes ofertas, los trabajos con fecha aparecen acá.</p>' +
            '<button type="button" class="disp-save-btn" onclick="App.navigateTo(\'feed\')">Ver feed</button></div>';
        return;
    }

    // Con datos: poblar eventos del calendario + lista
    {
        // Populate calendar events for confirmed jobs
        window.eventosConfirmados = window.eventosConfirmados || {};
        window.fechasConfirmadas  = window.fechasConfirmadas  || new Set();
        reservas.forEach(function(r) {
            if (!r.fecha_inicio) return;
            const fecha = r.fecha_inicio.substring(0, 10);
            window.fechasConfirmadas.add(fecha);
            if (!window.eventosConfirmados[fecha]) window.eventosConfirmados[fecha] = [];
            const dueno = r.dueno_nombre
                ? r.dueno_nombre + (r.dueno_apellido ? ' ' + r.dueno_apellido : '')
                : 'Cliente';
            window.eventosConfirmados[fecha].push({
                titulo: r.trabajo_titulo || 'Trabajo',
                hora_inicio: r.hora_inicio ? r.hora_inicio.substring(0, 5) : '00:00',
                hora_fin: r.hora_fin ? r.hora_fin.substring(0, 5) : null,
                cliente: dueno
            });
        });
        if (typeof renderCalendario === 'function') renderCalendario();
        if (typeof renderProximosEventos === 'function') renderProximosEventos();
        if (typeof actualizarStats === 'function') actualizarStats();

        lista.innerHTML = reservas.map(function (r) {
            const dia   = DIAS_SEMANA[r.dia_semana] || 'D\u00EDa ' + r.dia_semana;
            const desde = r.hora_inicio.substring(0, 5);
            const hasta = r.hora_fin.substring(0, 5);
            const dueno = r.dueno_nombre
                ? r.dueno_nombre + (r.dueno_apellido ? ' ' + r.dueno_apellido : '')
                : 'Cliente';
            const fechaLabel = r.fecha_inicio
                ? r.fecha_inicio.substring(0, 10).split('-').reverse().join('/')
                : dia;
            return '<div class="reserva-confirmada-item">' +
                '<div class="rc-titulo">' + (r.trabajo_titulo || 'Trabajo') + '</div>' +
                '<div class="rc-horario">&#128197; ' + fechaLabel + ' de ' + desde + ' a ' + hasta +
                    ' &bull; &#128100; ' + dueno + '</div>' +
            '</div>';
        }).join('');
    }
}

window.toggleDispDia        = toggleDispDia;
window.guardarDisponibilidad = guardarDisponibilidad;
window.cargarReservasConfirmadas = cargarReservasConfirmadas;
