/**
 * agenda.js
 * Modulo de agenda/calendario - Labu
 */

const STORAGE_KEY = 'rtype1_agenda_eventos';
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS  = ['LUN','MAR','MI\u00C9','JUE','VIE','S\u00C1B','DOM'];

let hoy        = new Date();
let mesActual  = hoy.getMonth();
let anioActual = hoy.getFullYear();
let diaSeleccionado = null;
let eventos    = [];

let vistaActual     = 'month';
let semanaActual    = null; // Date: lunes de la semana visible en vista semana
let diaVistaActual  = null; // Date: día visible en vista día

document.addEventListener('DOMContentLoaded', () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '/index.html';
        return;
    }

    // Inicializar semanaActual al lunes de la semana actual
    const dow = hoy.getDay(); // 0=dom
    const diffLun = dow === 0 ? -6 : 1 - dow;
    semanaActual = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + diffLun);
    diaVistaActual = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    cargarEventos();
    renderCalendario();
    renderProximosEventos();
    actualizarStats();
});

// ─── STORAGE ─────────────────────────────────────────────────────────────────

function cargarEventos() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        eventos = raw ? JSON.parse(raw) : [];
    } catch (e) {
        eventos = [];
    }
}

function guardarEventos() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(eventos));
}

// ─── CALENDARIO ──────────────────────────────────────────────────────────────

function renderCalendario() {
    if (vistaActual === 'week') { renderSemana(); return; }
    if (vistaActual === 'day')  { renderDia();    return; }
    renderMes();
}

function renderMes() {
    document.getElementById('monthYear').textContent = MESES[mesActual] + ' ' + anioActual;

    const grid = document.getElementById('calendarGrid');
    grid.className = 'calendar-grid';

    // Headers
    let html = DIAS.map(function (d) {
        return '<div class="calendar-day-header">' + d + '</div>';
    }).join('');

    // Primer dia del mes (0=Dom, ajustado a Lun=0)
    const primerDia = new Date(anioActual, mesActual, 1);
    let inicioSemana = primerDia.getDay(); // 0=Dom
    inicioSemana = (inicioSemana === 0) ? 6 : inicioSemana - 1; // Lunes=0

    const diasEnMes      = new Date(anioActual, mesActual + 1, 0).getDate();
    const diasMesAnterior = new Date(anioActual, mesActual, 0).getDate();

    // Dias del mes anterior
    for (var i = inicioSemana - 1; i >= 0; i--) {
        html += '<div class="calendar-day other-month"><div class="day-number">' + (diasMesAnterior - i) + '</div></div>';
    }

    // Dias del mes actual
    for (var d = 1; d <= diasEnMes; d++) {
        const fecha    = anioActual + '-' + pad(mesActual + 1) + '-' + pad(d);
        const esHoy    = (d === hoy.getDate() && mesActual === hoy.getMonth() && anioActual === hoy.getFullYear());
        const esSelect = (diaSeleccionado === fecha);
        const evsDia   = eventos.filter(function (e) { return e.fecha === fecha; });

        // Weekday 0=Lun..6=Dom (matches disponibilidad_trabajador.dia_semana)
        const dow = new Date(anioActual, mesActual, d).getDay();
        const diaSemana = dow === 0 ? 6 : dow - 1;

        // Priority: confirmado > disponible > no-disponible
        const esConfirmado    = window.fechasConfirmadas  && window.fechasConfirmadas.has(fecha);
        const esDisponible    = !esConfirmado && window.diasDisponibles   && window.diasDisponibles.has(diaSemana);
        const esNoDisponible  = !esConfirmado && !esDisponible &&
                                window.diasNoDisponibles && window.diasNoDisponibles.has(diaSemana);

        let clases = 'calendar-day';
        if (esHoy)           clases += ' today';
        if (esSelect)        clases += ' selected';
        if (esConfirmado)    clases += ' confirmado';
        else if (esDisponible)   clases += ' disponible';
        else if (esNoDisponible) clases += ' no-disponible';

        const dots = evsDia.slice(0, 3).map(function (e) {
            return '<div class="event-dot event-' + (e.tipo || 'otro') + '"></div>';
        }).join('');

        // Show job title on confirmed days
        const jobsHoy = window.eventosConfirmados && window.eventosConfirmados[fecha];
        const jobTitulosHtml = esConfirmado && jobsHoy
            ? jobsHoy.map(function(j) {
                return '<div class="day-job-title">' + j.titulo + '</div>';
            }).join('')
            : '';

        html += '<div class="' + clases + '" onclick="seleccionarDia(\'' + fecha + '\')">' +
            '<div class="day-number">' + d + '</div>' +
            jobTitulosHtml +
            '<div class="day-events">' + dots + '</div>' +
        '</div>';
    }

    // Dias del mes siguiente
    const totalCeldas = Math.ceil((inicioSemana + diasEnMes) / 7) * 7;
    const diasSiguiente = totalCeldas - inicioSemana - diasEnMes;
    for (var s = 1; s <= diasSiguiente; s++) {
        html += '<div class="calendar-day other-month"><div class="day-number">' + s + '</div></div>';
    }

    grid.innerHTML = html;
}

function seleccionarDia(fecha) {
    diaSeleccionado = fecha;
    renderCalendario();
    renderProximosEventos(fecha);
    abrirModalDia(fecha);
}

function abrirModalDia(fecha) {
    const partes = fecha.split('-');
    const d = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
    const diasSemana = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const titulo = diasSemana[d.getDay()] + ' ' + parseInt(partes[2]) + ' de ' + MESES[parseInt(partes[1]) - 1] + ' ' + partes[0];
    document.getElementById('modalDiaTitulo').textContent = titulo;

    const evsDia = eventos.filter(function(e) { return e.fecha === fecha; });

    // Mapa hora → array de eventos (hora como número 0–23)
    const mapaHoras = {};
    evsDia.forEach(function(ev) {
        const h = ev.hora ? parseInt(ev.hora.split(':')[0]) : 0;
        if (!mapaHoras[h]) mapaHoras[h] = [];
        mapaHoras[h].push(ev);
    });

    // Merge confirmed jobs from API
    const confirmadosDia = (window.eventosConfirmados && window.eventosConfirmados[fecha]) || [];
    confirmadosDia.forEach(function(job) {
        const h = job.hora_inicio ? parseInt(job.hora_inicio.split(':')[0]) : 0;
        if (!mapaHoras[h]) mapaHoras[h] = [];
        mapaHoras[h].push({
            titulo: job.titulo,
            hora: job.hora_inicio,
            tipo: 'trabajo',
            cliente: job.cliente,
            _confirmado: true
        });
    });

    const grid = document.getElementById('horarioGrid');
    let html = '';
    for (var h = 0; h < 24; h++) {
        const label = (h < 10 ? '0' : '') + h + ':00';
        const tieneEvs = mapaHoras[h] && mapaHoras[h].length > 0;
        const ocupadaClass = tieneEvs ? 'ocupada' : '';
        const hint = !tieneEvs ? '<span class="hora-libre-hint">+ Agregar evento</span>' : '';

        const eventosHtml = tieneEvs ? mapaHoras[h].map(function(ev) {
            const tc = 'tipo-' + (ev.tipo || 'otro');
            const clienteSpan = ev.cliente ? '<span class="hora-evento-cliente">· ' + ev.cliente + '</span>' : '';
            return '<div class="hora-evento ' + tc + '">' +
                '<span class="hora-evento-titulo">' + ev.titulo + '</span>' +
                clienteSpan +
            '</div>';
        }).join('') : '';

        const hCopy = h;
        html += '<div class="hora-slot">' +
            '<div class="hora-label">' + label + '</div>' +
            '<div class="hora-contenido ' + ocupadaClass + '" ' +
                (!tieneEvs ? 'onclick="abrirModalEventoEnHora(\'' + fecha + '\', \'' + (h < 10 ? '0'+h : h) + ':00\')"' : '') + '>' +
                eventosHtml + hint +
            '</div>' +
        '</div>';
    }
    grid.innerHTML = html;
    document.getElementById('modalDia').classList.add('active');
}

function cerrarModalDia() {
    document.getElementById('modalDia').classList.remove('active');
}

function abrirModalEventoDesdeVista() {
    cerrarModalDia();
    abrirModalEvento();
}

function abrirModalEventoEnHora(fecha, hora) {
    cerrarModalDia();
    document.getElementById('inputFecha').value = fecha;
    document.getElementById('inputHora').value  = hora;
    document.getElementById('modalAddEvent').classList.add('active');
}

function prevMonth() {
    if (vistaActual === 'week') {
        semanaActual = new Date(semanaActual.getFullYear(), semanaActual.getMonth(), semanaActual.getDate() - 7);
    } else if (vistaActual === 'day') {
        diaVistaActual = new Date(diaVistaActual.getFullYear(), diaVistaActual.getMonth(), diaVistaActual.getDate() - 1);
    } else {
        mesActual--;
        if (mesActual < 0) { mesActual = 11; anioActual--; }
    }
    renderCalendario();
}

function nextMonth() {
    if (vistaActual === 'week') {
        semanaActual = new Date(semanaActual.getFullYear(), semanaActual.getMonth(), semanaActual.getDate() + 7);
    } else if (vistaActual === 'day') {
        diaVistaActual = new Date(diaVistaActual.getFullYear(), diaVistaActual.getMonth(), diaVistaActual.getDate() + 1);
    } else {
        mesActual++;
        if (mesActual > 11) { mesActual = 0; anioActual++; }
    }
    renderCalendario();
}

function switchView(view, el) {
    document.querySelectorAll('.view-btn').forEach(function (b) { b.classList.remove('active'); });
    el.classList.add('active');
    vistaActual = view;
    // Al cambiar a semana/día, sincronizar con el día seleccionado o hoy
    if (view === 'week' && diaSeleccionado) {
        const p = diaSeleccionado.split('-');
        const d = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
        const dow = d.getDay();
        const diffLun = dow === 0 ? -6 : 1 - dow;
        semanaActual = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffLun);
    }
    if (view === 'day' && diaSeleccionado) {
        const p = diaSeleccionado.split('-');
        diaVistaActual = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
    }
    renderCalendario();
}

// ─── VISTA SEMANA ────────────────────────────────────────────────────────────

function renderSemana() {
    const grid = document.getElementById('calendarGrid');
    grid.className = 'calendar-grid semana-vista';

    const finSemana = new Date(semanaActual.getFullYear(), semanaActual.getMonth(), semanaActual.getDate() + 6);
    const inicioLbl = pad(semanaActual.getDate()) + ' ' + MESES[semanaActual.getMonth()].substring(0, 3);
    const finLbl    = pad(finSemana.getDate()) + ' ' + MESES[finSemana.getMonth()].substring(0, 3) + ' ' + finSemana.getFullYear();
    document.getElementById('monthYear').textContent = inicioLbl + ' \u2013 ' + finLbl;

    const DIAS_CORTOS = ['LUN','MAR','MI\u00C9','JUE','VIE','S\u00C1B','DOM'];
    const hoyStr = hoy.getFullYear() + '-' + pad(hoy.getMonth()+1) + '-' + pad(hoy.getDate());

    const diasDates = [];
    for (var i = 0; i < 7; i++) {
        diasDates.push(new Date(semanaActual.getFullYear(), semanaActual.getMonth(), semanaActual.getDate() + i));
    }
    const diasFechas = diasDates.map(function(d) {
        return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
    });

    function evsCelda(fechaStr, hora) {
        var result = eventos.filter(function(e) {
            return e.fecha === fechaStr && parseInt((e.hora || '0').split(':')[0]) === hora;
        });
        var confirmados = (window.eventosConfirmados && window.eventosConfirmados[fechaStr]) || [];
        confirmados.forEach(function(job) {
            var h = job.hora_inicio ? parseInt(job.hora_inicio.split(':')[0]) : 0;
            if (h === hora) result.push({ titulo: job.titulo, hora: job.hora_inicio, tipo: 'trabajo', cliente: job.cliente, _confirmado: true });
        });
        return result;
    }

    var html = '<div class="semana-container">';

    // Cabecera con nombre del día
    html += '<div class="semana-row semana-header-row"><div class="semana-time-cell"></div>';
    diasDates.forEach(function(d, idx) {
        var esHoy = diasFechas[idx] === hoyStr;
        html += '<div class="semana-day-header' + (esHoy ? ' semana-hoy' : '') + '" onclick="switchToDia(\'' + diasFechas[idx] + '\')">' +
            '<div class="semana-dia-nombre">' + DIAS_CORTOS[idx] + '</div>' +
            '<div class="semana-dia-num' + (esHoy ? ' semana-hoy-num' : '') + '">' + d.getDate() + '</div>' +
        '</div>';
    });
    html += '</div>';

    // Filas de horas
    for (var h = 0; h < 24; h++) {
        var labelHora = (h < 10 ? '0' : '') + h + ':00';
        html += '<div class="semana-row"><div class="semana-time-cell">' + labelHora + '</div>';
        diasFechas.forEach(function(fechaStr, idx) {
            var evs = evsCelda(fechaStr, h);
            var tieneEvs = evs.length > 0;
            var hStr = (h < 10 ? '0' : '') + h + ':00';
            html += '<div class="semana-hora-celda' + (tieneEvs ? ' semana-ocupada' : '') + '"' +
                (!tieneEvs ? ' onclick="abrirModalEventoEnHora(\'' + fechaStr + '\',\'' + hStr + '\')"' : '') + '>';
            evs.forEach(function(ev) {
                html += '<div class="semana-evento semana-evento-' + (ev.tipo || 'otro') + '">' +
                    '<span class="semana-evento-titulo">' + ev.titulo + '</span>' +
                '</div>';
            });
            html += '</div>';
        });
        html += '</div>';
    }

    html += '</div>';
    grid.innerHTML = html;
}

// ─── VISTA DÍA (inline) ──────────────────────────────────────────────────────

function renderDia() {
    const grid = document.getElementById('calendarGrid');
    grid.className = 'calendar-grid dia-vista';

    const fechaStr = diaVistaActual.getFullYear() + '-' + pad(diaVistaActual.getMonth()+1) + '-' + pad(diaVistaActual.getDate());
    const DIAS_SEMANA = ['Domingo','Lunes','Martes','Mi\u00E9rcoles','Jueves','Viernes','S\u00E1bado'];
    const label = DIAS_SEMANA[diaVistaActual.getDay()] + ' ' + diaVistaActual.getDate() + ' de ' +
        MESES[diaVistaActual.getMonth()] + ' ' + diaVistaActual.getFullYear();
    document.getElementById('monthYear').textContent = label;

    // Construir mapa hora → eventos
    var mapaHoras = {};
    eventos.filter(function(e) { return e.fecha === fechaStr; }).forEach(function(ev) {
        var h = parseInt((ev.hora || '0').split(':')[0]);
        if (!mapaHoras[h]) mapaHoras[h] = [];
        mapaHoras[h].push(ev);
    });
    var confirmadosDia = (window.eventosConfirmados && window.eventosConfirmados[fechaStr]) || [];
    confirmadosDia.forEach(function(job) {
        var h = job.hora_inicio ? parseInt(job.hora_inicio.split(':')[0]) : 0;
        if (!mapaHoras[h]) mapaHoras[h] = [];
        mapaHoras[h].push({ titulo: job.titulo, hora: job.hora_inicio, tipo: 'trabajo', cliente: job.cliente, _confirmado: true });
    });

    var html = '<div class="dia-container">';
    for (var h = 0; h < 24; h++) {
        var labelHora = (h < 10 ? '0' : '') + h + ':00';
        var evs = mapaHoras[h] || [];
        var tieneEvs = evs.length > 0;
        var hStr = (h < 10 ? '0' : '') + h + ':00';
        html += '<div class="hora-slot">' +
            '<div class="hora-label">' + labelHora + '</div>' +
            '<div class="hora-contenido' + (tieneEvs ? ' ocupada' : '') + '"' +
                (!tieneEvs ? ' onclick="abrirModalEventoEnHora(\'' + fechaStr + '\',\'' + hStr + '\')"' : '') + '>';
        if (tieneEvs) {
            evs.forEach(function(ev) {
                var tc = 'tipo-' + (ev.tipo || 'otro');
                var clienteSpan = ev.cliente ? '<span class="hora-evento-cliente">\u00B7 ' + ev.cliente + '</span>' : '';
                html += '<div class="hora-evento ' + tc + '">' +
                    '<span class="hora-evento-titulo">' + ev.titulo + '</span>' + clienteSpan +
                '</div>';
            });
        } else {
            html += '<span class="hora-libre-hint">+ Agregar evento</span>';
        }
        html += '</div></div>';
    }
    html += '</div>';
    grid.innerHTML = html;
}

function switchToDia(fechaStr) {
    var p = fechaStr.split('-');
    diaVistaActual = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
    vistaActual = 'day';
    document.querySelectorAll('.view-btn').forEach(function(b, i) {
        b.classList.toggle('active', i === 2); // botón "Día" es el 3ro
    });
    renderCalendario();
}

// ─── EVENTOS ─────────────────────────────────────────────────────────────────

function renderProximosEventos(fechaFiltro) {
    const lista = document.getElementById('proximosEventos');
    const hoyStr = hoy.getFullYear() + '-' + pad(hoy.getMonth() + 1) + '-' + pad(hoy.getDate());

    // Combinar eventos manuales (localStorage) + trabajos confirmados (API)
    let todosEventos = eventos.slice();

    if (window.eventosConfirmados) {
        Object.keys(window.eventosConfirmados).forEach(function (fecha) {
            window.eventosConfirmados[fecha].forEach(function (job) {
                // Evitar duplicados si ya existe un evento API con mismo titulo+fecha
                const existe = todosEventos.some(function(e) {
                    return e._esApiJob && e.fecha === fecha && e.titulo === job.titulo;
                });
                if (!existe) {
                    todosEventos.push({
                        id: 'api_' + fecha + '_' + job.titulo,
                        titulo: job.titulo,
                        fecha: fecha,
                        hora: job.hora_inicio || '00:00',
                        tipo: 'trabajo',
                        cliente: job.cliente || null,
                        _esApiJob: true
                    });
                }
            });
        });
    }

    let evsFiltrados;
    if (fechaFiltro) {
        evsFiltrados = todosEventos.filter(function (e) { return e.fecha === fechaFiltro; });
    } else {
        evsFiltrados = todosEventos
            .filter(function (e) { return e.fecha >= hoyStr; })
            .sort(function (a, b) { return a.fecha.localeCompare(b.fecha) || (a.hora || '').localeCompare(b.hora || ''); });
    }

    if (evsFiltrados.length === 0) {
        lista.innerHTML = '<div class="empty-events">No hay eventos' + (fechaFiltro ? ' para este d\u00EDa' : ' pr\u00F3ximos') + '</div>';
        return;
    }

    lista.innerHTML = evsFiltrados.map(function (ev) {
        const fechaLabel = ev.fecha === hoyStr ? 'Hoy' : formatFechaCorta(ev.fecha);
        const clienteHtml = ev.cliente ? '<div class="event-location">&#128100; ' + ev.cliente + '</div>' : '';
        const ubicacionHtml = ev.ubicacion ? '<div class="event-location">&#128205; ' + ev.ubicacion + '</div>' : '';
        const deleteBtn = !ev._esApiJob
            ? '<button class="event-delete-btn" onclick="eliminarEvento(\'' + ev.id + '\')">&#128465;</button>'
            : '';
        return '<div class="event-item event-item-' + (ev.tipo || 'otro') + '">' +
            '<div class="event-item-header">' +
                '<div class="event-type-dot dot-' + (ev.tipo || 'otro') + '"></div>' +
                '<div class="event-title">' + ev.titulo + '</div>' +
                deleteBtn +
            '</div>' +
            '<div class="event-meta">' +
                '<span class="event-time">&#128197; ' + fechaLabel + '</span>' +
                (ev.hora && ev.hora !== '00:00' ? '<span class="event-time">&#128336; ' + ev.hora + '</span>' : '') +
            '</div>' +
            clienteHtml + ubicacionHtml +
            '<span class="event-type type-' + (ev.tipo || 'otro') + '">' + labelTipo(ev.tipo) + '</span>' +
        '</div>';
    }).join('');
}

function actualizarStats() {
    const mesStr = hoy.getFullYear() + '-' + pad(hoy.getMonth() + 1);

    // Eventos manuales este mes
    let esteMes = eventos.filter(function (e) { return e.fecha.startsWith(mesStr); }).length;

    // Sumar trabajos API confirmados este mes
    if (window.eventosConfirmados) {
        Object.keys(window.eventosConfirmados).forEach(function (fecha) {
            if (fecha.startsWith(mesStr)) esteMes += window.eventosConfirmados[fecha].length;
        });
    }

    const recurrentes = eventos.filter(function (e) { return e.tipo === 'recurrente'; });
    const clientesFijos = new Set(recurrentes.map(function (e) { return e.cliente; })).size;

    // Total de todos los eventos guardados
    const totalEventos = eventos.length + (window.eventosConfirmados
        ? Object.values(window.eventosConfirmados).reduce(function(acc, arr) { return acc + arr.length; }, 0)
        : 0);

    document.getElementById('statTrabajos').textContent = esteMes;
    document.getElementById('statClientes').textContent = clientesFijos;
    const statIngresos = document.getElementById('statIngresos');
    if (statIngresos) statIngresos.textContent = totalEventos;
}

function abrirModalEvento() {
    if (diaSeleccionado) {
        document.getElementById('inputFecha').value = diaSeleccionado;
    }
    document.getElementById('modalAddEvent').classList.add('active');
}

function cerrarModalEvento() {
    document.getElementById('modalAddEvent').classList.remove('active');
}

function guardarEvento() {
    const titulo    = document.getElementById('inputTitulo').value.trim();
    const fecha     = document.getElementById('inputFecha').value;
    const hora      = document.getElementById('inputHora').value;
    const tipo      = document.getElementById('selectTipo').value;
    const cliente   = document.getElementById('inputCliente').value.trim();
    const ubicacion = document.getElementById('inputUbicacion').value.trim();
    const notas     = document.getElementById('inputNotas').value.trim();

    if (!titulo || !fecha) {
        App.showNotification('T\u00EDtulo y fecha son obligatorios', 'error');
        return;
    }

    const evento = {
        id:       Date.now().toString(),
        titulo,
        fecha,
        hora:     hora || '00:00',
        tipo,
        cliente:  cliente || null,
        ubicacion: ubicacion || null,
        notas:    notas || null
    };

    eventos.push(evento);
    guardarEventos();
    cerrarModalEvento();
    limpiarFormulario();
    renderCalendario();
    renderProximosEventos(diaSeleccionado);
    actualizarStats();
    App.showNotification('Evento guardado', 'success');
}

function eliminarEvento(id) {
    if (!confirm('\u00BFEliminar este evento?')) return;
    eventos = eventos.filter(function (e) { return e.id !== id; });
    guardarEventos();
    renderCalendario();
    renderProximosEventos(diaSeleccionado);
    actualizarStats();
}

function limpiarFormulario() {
    document.getElementById('inputTitulo').value   = '';
    document.getElementById('inputFecha').value    = '';
    document.getElementById('inputHora').value     = '';
    document.getElementById('selectTipo').value    = 'trabajo';
    document.getElementById('inputCliente').value  = '';
    document.getElementById('inputUbicacion').value = '';
    document.getElementById('inputNotas').value    = '';
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function pad(n) { return n < 10 ? '0' + n : String(n); }

function labelTipo(tipo) {
    const map = { trabajo: 'Trabajo', recurrente: 'Recurrente', mantenimiento: 'Mantenimiento', otro: 'Otro' };
    return map[tipo] || tipo;
}

function formatFechaCorta(fechaStr) {
    const partes = fechaStr.split('-');
    return partes[2] + ' ' + MESES[parseInt(partes[1]) - 1].substring(0, 3);
}

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('modalAddEvent').addEventListener('click', function (e) {
        if (e.target === this) cerrarModalEvento();
    });
    document.getElementById('modalDia').addEventListener('click', function (e) {
        if (e.target === this) cerrarModalDia();
    });
});

window.prevMonth                = prevMonth;
window.nextMonth                = nextMonth;
window.switchView               = switchView;
window.switchToDia              = switchToDia;
window.seleccionarDia           = seleccionarDia;
window.abrirModalEvento         = abrirModalEvento;
window.cerrarModalEvento        = cerrarModalEvento;
window.guardarEvento            = guardarEvento;
window.eliminarEvento           = eliminarEvento;
window.cerrarModalDia           = cerrarModalDia;
window.abrirModalEventoDesdeVista = abrirModalEventoDesdeVista;
window.abrirModalEventoEnHora   = abrirModalEventoEnHora;
