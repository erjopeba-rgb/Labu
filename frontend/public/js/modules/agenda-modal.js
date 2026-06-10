/**
 * AgendaModal — Labu
 * Modal de agenda/coordinación de horarios.
 *
 * API pública:
 *   AgendaModal.open({ convId, otroUserId, nombreOtro, trabajadorId?, ofertaId?, jobId?, tiempoEstimadoMin? })
 *   AgendaModal.close()
 */
const AgendaModal = (function () {
    'use strict';

    /* ── Constantes ───────────────────────────────────────────── */
    var MESES_CAP = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    var MESES_ES  = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    var DIAS_ES   = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
    var DIAS_CORTO = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];

    /* ── Estado ───────────────────────────────────────────────── */
    var _el      = null;  // overlay DOM
    var _estado  = null;  // estado actual del modal

    /* ── Utilidades ───────────────────────────────────────────── */

    function _token() {
        return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    }

    function _currentUserId() {
        if (typeof Auth !== 'undefined') { var u = Auth.getUser(); return u ? String(u.id) : null; }
        return null;
    }

    function _api(endpoint, opts) {
        if (typeof App !== 'undefined' && App.apiRequest) return App.apiRequest(endpoint, opts || {});
        opts = opts || {};
        var headers = Object.assign({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _token() }, opts.headers || {});
        return fetch('/api' + endpoint, Object.assign({}, opts, { headers: headers })).then(function (r) { return r.json(); });
    }

    function _pad(n) { return String(n).padStart(2, '0'); }

    // Convierte día JS (0=Dom, 1=Lun…) → Labu (0=Lun…6=Dom)
    function _jsToRtype(jsDay) { return jsDay === 0 ? 6 : jsDay - 1; }

    function _timeToMin(t) { var p = t.split(':'); return parseInt(p[0]) * 60 + (parseInt(p[1]) || 0); }
    function _addMin(t, m) { var s = _timeToMin(t) + m; return _pad(Math.floor(s / 60)) + ':' + _pad(s % 60); }

    function _esc(s) {
        return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function _fechaLarga(d) {
        return DIAS_ES[_jsToRtype(d.getDay())] + ' ' + d.getDate() + ' de ' + MESES_ES[d.getMonth()];
    }

    /* ── Crear DOM del modal ──────────────────────────────────── */

    function _crearModal() {
        var overlay = document.createElement('div');
        overlay.id = 'agenda-modal-overlay';
        overlay.innerHTML =
            '<div class="agenda-modal">' +
                '<div class="agenda-modal-header">' +
                    '<span class="agenda-modal-icono">&#128197;</span>' +
                    '<span class="agenda-modal-titulo">Agenda</span>' +
                    '<button type="button" class="agenda-modal-close" title="Cerrar">&#10005;</button>' +
                '</div>' +
                '<div class="agenda-modal-body">' +
                    '<div class="agenda-panel-cal">' +
                        '<div class="agenda-vista-tabs">' +
                            '<button type="button" class="agenda-vista-tab activo" data-vista="mes">Mes</button>' +
                            '<button type="button" class="agenda-vista-tab" data-vista="semana">Semana</button>' +
                            '<button type="button" class="agenda-vista-tab" data-vista="dia">Día</button>' +
                        '</div>' +
                        '<div class="agenda-cal-nav-row">' +
                            '<button type="button" class="agenda-cal-nav-btn" data-nav="prev">&#8592;</button>' +
                            '<span class="agenda-cal-periodo"></span>' +
                            '<button type="button" class="agenda-cal-nav-btn" data-nav="next">&#8594;</button>' +
                        '</div>' +
                        '<div class="agenda-cal-content"></div>' +
                        '<div class="agenda-horario-section" style="display:none"></div>' +
                        '<div class="agenda-confirm-section" style="display:none"></div>' +
                    '</div>' +
                    '<div class="agenda-panel-trabajos">' +
                        '<div class="agenda-trabajos-titulo">Trabajos activos</div>' +
                        '<div class="agenda-trabajos-lista"><div class="agenda-status-msg">Cargando&#8230;</div></div>' +
                        '<div class="agenda-panel-footer">' +
                            '<button type="button" class="agenda-btn agenda-btn-nueva-cita">&#128197; Agendar nueva cita</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>';

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });
        overlay.querySelector('.agenda-modal-close').addEventListener('click', close);

        // Tabs de vista
        overlay.querySelectorAll('.agenda-vista-tab').forEach(function (btn) {
            btn.addEventListener('click', function () { _cambiarVista(btn.dataset.vista); });
        });

        // Nav de período
        overlay.querySelector('[data-nav="prev"]').addEventListener('click', function () { _navPeriodo(-1); });
        overlay.querySelector('[data-nav="next"]').addEventListener('click', function () { _navPeriodo(1); });

        // Botón nueva cita
        overlay.querySelector('.agenda-btn-nueva-cita').addEventListener('click', _onNuevaCita);

        document.body.appendChild(overlay);
        return overlay;
    }

    /* ── Navegación de período ────────────────────────────────── */

    function _navPeriodo(dir) {
        if (!_estado) return;
        var hoy = new Date(); hoy.setHours(0,0,0,0);
        switch (_estado.vista) {
            case 'mes':
                var nuevo = new Date(_estado.mesActual.getFullYear(), _estado.mesActual.getMonth() + dir, 1);
                var min = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                if (nuevo < min) return;
                _estado.mesActual = nuevo;
                break;
            case 'semana':
                var nuevaRef = new Date(_estado.semanaRef.getTime() + dir * 7 * 86400000);
                var jsDayNueva = nuevaRef.getDay();
                var lunesNueva = new Date(nuevaRef);
                lunesNueva.setDate(nuevaRef.getDate() - (jsDayNueva === 0 ? 6 : jsDayNueva - 1));
                lunesNueva.setHours(0,0,0,0);
                var jsDayHoy = hoy.getDay();
                var lunesHoy = new Date(hoy);
                lunesHoy.setDate(hoy.getDate() - (jsDayHoy === 0 ? 6 : jsDayHoy - 1));
                if (lunesNueva < lunesHoy) return;
                _estado.semanaRef = nuevaRef;
                break;
            case 'dia':
                var nDia = new Date(_estado.diaSeleccionado || _estado.diaRef);
                nDia.setDate(nDia.getDate() + dir);
                if (nDia < hoy) return;
                _estado.diaRef = nDia;
                if (_estado.diaSeleccionado) {
                    _estado.diaSeleccionado = nDia;
                    _estado.slotInicio = null;
                    _estado.slotFin = null;
                }
                break;
        }
        _renderCalendario();
    }

    /* ── Cambiar vista ────────────────────────────────────────── */

    function _cambiarVista(vista) {
        if (!_estado || _estado.vista === vista) return;
        _estado.vista = vista;
        _el.querySelectorAll('.agenda-vista-tab').forEach(function (btn) {
            btn.classList.toggle('activo', btn.dataset.vista === vista);
        });
        _renderCalendario();
    }

    /* ── Render calendario ────────────────────────────────────── */

    function _renderCalendario() {
        if (!_el || !_estado) return;
        var content    = _el.querySelector('.agenda-cal-content');
        var periodo    = _el.querySelector('.agenda-cal-periodo');
        var horarioSec = _el.querySelector('.agenda-horario-section');
        var confirmSec = _el.querySelector('.agenda-confirm-section');

        switch (_estado.vista) {
            case 'mes':    _renderMes(content, periodo); break;
            case 'semana': _renderSemana(content, periodo); break;
            case 'dia':    _renderDia(content, periodo); break;
        }

        // Sección de horario (mes/semana → solo si hay día seleccionado; día → siempre la maneja _renderDia)
        if (_estado.vista !== 'dia') {
            if (_estado.diaSeleccionado) {
                horarioSec.style.display = '';
                horarioSec.innerHTML = _buildHorarioPicker();
                _bindPickerEvents(horarioSec);
                // Inicializar slotInicio/slotFin desde los valores del picker si aún no están seteados
                if (!_estado.slotInicio) {
                    var iniH = horarioSec.querySelector('[data-time="ini-h"]');
                    var iniM = horarioSec.querySelector('[data-time="ini-m"]');
                    if (iniH && iniH.value) {
                        _estado.slotInicio = iniH.value + ':' + (iniM ? iniM.value : '00');
                        if (_estado.tiempoEstimadoMin > 0) {
                            _estado.slotFin = _addMin(_estado.slotInicio, _estado.tiempoEstimadoMin);
                        } else {
                            var finH = horarioSec.querySelector('[data-time="fin-h"]');
                            var finM = horarioSec.querySelector('[data-time="fin-m"]');
                            _estado.slotFin = (finH && finH.value) ? finH.value + ':' + (finM ? finM.value : '00') : null;
                        }
                    }
                }
            } else {
                horarioSec.style.display = 'none';
            }
        } else {
            // vista 'dia' — control de visibilidad de horarioSec centralizado aquí
            var diaDia = _estado.diaRef;
            var hoyDia = new Date(); hoyDia.setHours(0,0,0,0);
            if (diaDia < hoyDia) {
                horarioSec.style.display = 'none';
            } else if (_estado.slotInicio) {
                horarioSec.style.display = '';
                var hint = _estado.tiempoEstimadoMin > 0
                    ? '⏰ ' + _estado.slotInicio + ' → ' + _estado.slotFin
                    : '⏰ ' + _estado.slotInicio + (_estado.slotFin ? ' → ' + _estado.slotFin : ' (tap otro slot para marcar fin)');
                horarioSec.innerHTML = '<div class="agenda-horario-titulo">' + _esc(_fechaLarga(diaDia)) + '</div>' +
                    '<div class="agenda-horario-instruccion">' + hint + '</div>' +
                    _buildWarningHTML();
            } else {
                horarioSec.style.display = '';
                horarioSec.innerHTML = '<div class="agenda-horario-instruccion">Tocá un slot verde para marcar el inicio.</div>';
            }
        }

        // Sección de confirmación
        var _warn = _buildWarning();
        var puedeConfirmar = _estado.diaSeleccionado && _estado.slotInicio && _estado.slotFin
            && _warn === '' && _estado.trabajoSeleccionado;
        if (puedeConfirmar) {
            confirmSec.style.display = '';
            confirmSec.innerHTML = _buildConfirmHTML();
            confirmSec.querySelector('.agenda-btn-confirmar').addEventListener('click', _confirmar);
        } else {
            confirmSec.style.display = 'none';
        }
    }

    /* ── Vista Mes ────────────────────────────────────────────── */

    function _renderMes(content, periodoEl) {
        var mes = _estado.mesActual;
        periodoEl.textContent = MESES_CAP[mes.getMonth()] + ' ' + mes.getFullYear();

        var hoy    = new Date(); hoy.setHours(0,0,0,0);
        var offset = new Date(mes.getFullYear(), mes.getMonth(), 1).getDay() - 1;
        if (offset < 0) offset = 6;
        var diasMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();

        var wdHtml = DIAS_CORTO.map(function (d) { return '<div class="agenda-mes-wd">' + d + '</div>'; }).join('');
        var cells  = '';
        for (var i = 0; i < offset; i++) cells += '<div class="agenda-mes-dia vacio"></div>';
        for (var d = 1; d <= diasMes; d++) {
            var fecha     = new Date(mes.getFullYear(), mes.getMonth(), d);
            var rtype     = _jsToRtype(fecha.getDay());
            var esPasado  = fecha < hoy;
            var esHoy     = fecha.getTime() === hoy.getTime();
            var tieneDisp = !esPasado && _estado.disponibilidad.some(function (x) { return parseInt(x.dia_semana) === rtype; });
            var esSel     = _estado.diaSeleccionado && fecha.getTime() === _estado.diaSeleccionado.getTime();

            var cls = 'agenda-mes-dia';
            var data = '';
            if (esPasado)     { cls += ' pasado no-disponible'; }
            else if (!tieneDisp) { cls += ' no-disponible'; }
            else {
                cls += ' disponible';
                if (esSel) cls += ' seleccionado';
                data = ' data-fecha="' + fecha.toISOString().slice(0,10) + '"';
            }
            if (esHoy) cls += ' hoy';
            cells += '<div class="' + cls + '"' + data + '>' + d + '</div>';
        }

        content.innerHTML = '<div class="agenda-mes-grid">' + wdHtml + cells + '</div>';
        content.querySelectorAll('.agenda-mes-dia.disponible').forEach(function (el) {
            el.addEventListener('click', function () {
                var f = new Date(el.dataset.fecha + 'T12:00:00');
                _seleccionarDia(f);
            });
        });
    }

    /* ── Vista Semana ─────────────────────────────────────────── */

    function _renderSemana(content, periodoEl) {
        var ref = _estado.semanaRef;
        // Calcular lunes de la semana
        var lunes = new Date(ref);
        var jsDay = lunes.getDay();
        lunes.setDate(lunes.getDate() - (jsDay === 0 ? 6 : jsDay - 1));
        lunes.setHours(0,0,0,0);

        var domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
        periodoEl.textContent = lunes.getDate() + ' ' + MESES_ES[lunes.getMonth()] + ' – ' +
            domingo.getDate() + ' ' + MESES_ES[domingo.getMonth()];

        var hoy = new Date(); hoy.setHours(0,0,0,0);
        var cols = '';
        for (var i = 0; i < 7; i++) {
            var dia    = new Date(lunes); dia.setDate(lunes.getDate() + i);
            var rtype  = _jsToRtype(dia.getDay());
            var tieneD = _estado.disponibilidad.some(function (x) { return parseInt(x.dia_semana) === rtype; });
            var esSel  = _estado.diaSeleccionado && dia.getTime() === _estado.diaSeleccionado.getTime();
            var esHoy  = dia.getTime() === hoy.getTime();
            var esPas  = dia < hoy;
            var cls    = 'agenda-semana-col' + (esSel ? ' seleccionado' : '') + (esHoy ? ' hoy' : '');
            var barCls = tieneD && !esPas ? 'verde' : 'rojo';
            var dataAttr = (!esPas && tieneD) ? ' data-fecha="' + dia.toISOString().slice(0,10) + '"' : '';
            cols += '<div class="' + cls + '"' + dataAttr + '>' +
                '<span class="agenda-semana-dia-nombre">' + DIAS_CORTO[i] + '</span>' +
                '<span class="agenda-semana-dia-num">' + dia.getDate() + '</span>' +
                '<div class="agenda-semana-disp-bar ' + barCls + '"></div>' +
            '</div>';
        }
        content.innerHTML = '<div class="agenda-semana-grid">' + cols + '</div>';
        content.querySelectorAll('.agenda-semana-col[data-fecha]').forEach(function (el) {
            el.addEventListener('click', function () {
                var f = new Date(el.dataset.fecha + 'T12:00:00');
                _seleccionarDia(f);
            });
        });
    }

    /* ── Vista Día ────────────────────────────────────────────── */

    function _renderDia(content, periodoEl) {
        var dia = _estado.diaRef;
        periodoEl.textContent = _fechaLarga(dia);

        var hoy = new Date(); hoy.setHours(0,0,0,0);
        if (dia < hoy) {
            content.innerHTML = '<div class="agenda-status-msg">Este día ya pasó.</div>';
            return;
        }

        var rtype      = _jsToRtype(dia.getDay());
        var diasOcup   = _estado.ocupados.filter(function (x) { return parseInt(x.dia_semana) === rtype; });

        var dispRanges = _getDispRangesDia();
        var ocupRanges = diasOcup.map(function (o) {
            return { ini: _timeToMin(o.hora_inicio), fin: _timeToMin(o.hora_fin) };
        });

        var slots = '';
        for (var m = 0; m < 24 * 60; m += 30) {
            var h = _pad(Math.floor(m / 60)), mn = _pad(m % 60);
            var hora = h + ':' + mn;
            var finM = m + 30;
            var dentroDisp = dispRanges.some(function (r) { return m >= r.ini && finM <= r.fin; });
            var ocupado    = ocupRanges.some(function (r) { return m < r.fin && finM > r.ini; });

            var iniM = _estado.slotInicio ? _timeToMin(_estado.slotInicio) : -1;
            var finSel = _estado.slotFin ? _timeToMin(_estado.slotFin) : -1;
            var esInicio = _estado.slotInicio && m === iniM;
            var esRango  = _estado.slotInicio && m > iniM && finSel > 0 && m < finSel;

            var cls = 'agenda-dia-slot';
            var dataAttr = '';
            if (!dentroDisp)    { cls += ' fuera'; }
            else if (ocupado)   { cls += ' ocupado'; }
            else if (esInicio)  { cls += ' inicio'; dataAttr = ' data-slot="' + hora + '"'; }
            else if (esRango)   { cls += ' rango'; dataAttr = ' data-slot="' + hora + '"'; }
            else                { cls += ' disponible'; dataAttr = ' data-slot="' + hora + '"'; }

            slots += '<div class="' + cls + '"' + dataAttr + '>' +
                '<span class="agenda-slot-hora">' + hora + '</span>' +
            '</div>';
        }

        content.innerHTML = '<div class="agenda-dia-slots">' + slots + '</div>';

        // Seleccionar día al hacer click en slot disponible
        if (!_estado.diaSeleccionado || _estado.diaSeleccionado.getTime() !== dia.getTime()) {
            _estado.diaSeleccionado = new Date(dia);
        }

        content.querySelectorAll('.agenda-dia-slot.disponible, .agenda-dia-slot.inicio, .agenda-dia-slot.rango').forEach(function (el) {
            el.addEventListener('click', function () {
                var hora = el.dataset.slot;
                if (!hora) return;
                _seleccionarSlotDia(hora);
            });
        });

    }

    /* ── Selección de día ─────────────────────────────────────── */

    function _seleccionarDia(fecha) {
        _estado.diaSeleccionado = fecha;
        _estado.slotInicio = null;
        _estado.slotFin    = null;
        _estado.diaRef     = fecha;
        _renderCalendario();
    }

    /* ── Selección de slot en vista día ───────────────────────── */

    function _seleccionarSlotDia(hora) {
        if (!_estado.slotInicio) {
            // Primer click: marcar inicio
            _estado.slotInicio = hora;
            if (_estado.tiempoEstimadoMin > 0) {
                _estado.slotFin = _addMin(hora, _estado.tiempoEstimadoMin);
            }
        } else if (!_estado.slotFin) {
            // Si ya hay inicio y tiempo estimado, ignorar clicks adicionales
            if (_estado.tiempoEstimadoMin > 0) return;
            // Segundo click: marcar fin
            if (_timeToMin(hora) <= _timeToMin(_estado.slotInicio)) {
                // Click en o antes del inicio → reiniciar
                _estado.slotInicio = hora;
                _estado.slotFin    = null;
            } else {
                _estado.slotFin = _addMin(hora, 30); // fin = slot + 30 min
            }
        } else {
            // Reiniciar selección
            _estado.slotInicio = hora;
            _estado.slotFin    = null;
            if (_estado.tiempoEstimadoMin > 0) {
                _estado.slotFin = _addMin(hora, _estado.tiempoEstimadoMin);
            }
        }
        _renderCalendario();
    }

    /* ── Helpers de disponibilidad para el picker ────────────── */

    function _getDispRangesDia() {
        if (!_estado.diaSeleccionado) return [];
        var rtype = _jsToRtype(_estado.diaSeleccionado.getDay());
        return _estado.disponibilidad
            .filter(function (x) { return parseInt(x.dia_semana) === rtype; })
            .map(function (b) { return { ini: _timeToMin(b.hora_inicio), fin: _timeToMin(b.hora_fin) }; });
    }

    function _minutoEnDisponibilidad(minAbs, dispRanges) {
        return dispRanges.some(function (r) { return minAbs >= r.ini && minAbs < r.fin; });
    }

    function _primerMinutoDisponibleEnHora(h, dispRanges) {
        for (var m = 0; m < 60; m++) {
            if (_minutoEnDisponibilidad(h * 60 + m, dispRanges)) return m;
        }
        return -1;
    }

    // Autocorrige h:m para que caiga dentro de disponibilidad.
    // Si la hora no tiene ningún minuto disponible, salta a la siguiente hora disponible.
    function _autocorregirTiempo(h, m, dispRanges) {
        if (dispRanges.length === 0) return { h: h, m: m };
        if (_minutoEnDisponibilidad(h * 60 + m, dispRanges)) return { h: h, m: m };
        // Buscar primer minuto disponible en la misma hora
        var primerMin = _primerMinutoDisponibleEnHora(h, dispRanges);
        if (primerMin >= 0) return { h: h, m: primerMin };
        // Saltar a la siguiente hora con disponibilidad
        for (var nextH = h + 1; nextH <= 23; nextH++) {
            var pm = _primerMinutoDisponibleEnHora(nextH, dispRanges);
            if (pm >= 0) return { h: nextH, m: pm };
        }
        return { h: h, m: m }; // sin solución, mantener
    }

    /* ── Time Picker (para vistas mes/semana) ─────────────────── */

    function _buildHorarioPicker() {
        var dia = _estado.diaSeleccionado;
        var rtype     = _jsToRtype(dia.getDay());
        var diasDisp  = _estado.disponibilidad.filter(function (x) { return parseInt(x.dia_semana) === rtype; });
        var nombreDia = DIAS_ES[rtype];
        var dispRanges = _getDispRangesDia();

        var defIniH = '09', defIniM = '00', defFinH = '17', defFinM = '00';
        if (diasDisp.length > 0) {
            var p0 = diasDisp[0].hora_inicio.split(':'), p1 = diasDisp[0].hora_fin.split(':');
            defIniH = _pad(parseInt(p0[0])); defIniM = p0[1] ? _pad(parseInt(p0[1])) : '00';
            defFinH = _pad(parseInt(p1[0])); defFinM = p1[1] ? _pad(parseInt(p1[1])) : '00';
        }

        var curIniH = _estado.slotInicio ? _estado.slotInicio.split(':')[0] : defIniH;
        var curIniM = _estado.slotInicio ? _estado.slotInicio.split(':')[1] : defIniM;
        var curFinH = (_estado.slotFin && _estado.tiempoEstimadoMin === 0) ? _estado.slotFin.split(':')[0] : defFinH;
        var curFinM = (_estado.slotFin && _estado.tiempoEstimadoMin === 0) ? _estado.slotFin.split(':')[1] : defFinM;

        var hint = _estado.tiempoEstimadoMin > 0
            ? (function () {
                var h = Math.floor(_estado.tiempoEstimadoMin / 60), m = _estado.tiempoEstimadoMin % 60;
                return 'Elegí el inicio. Fin auto (' + (h ? h + 'h ' : '') + (m ? m + 'min' : '') + ').';
            }())
            : 'Elegí hora de inicio y de fin.';

        function _hourOpts(cur) {
            var s = '';
            for (var h = 0; h <= 23; h++) {
                var v = _pad(h);
                var tieneMin = dispRanges.length === 0 || _primerMinutoDisponibleEnHora(h, dispRanges) >= 0;
                s += '<option value="' + v + '"' + (cur === v ? ' selected' : '') + (!tieneMin ? ' disabled' : '') + '>' + v + '</option>';
            }
            return s;
        }
        function _minOpts(cur, hStr) {
            var hNum = parseInt(hStr) || 0;
            var s = '';
            for (var m = 0; m < 60; m++) {
                var v = _pad(m);
                var disponible = dispRanges.length === 0 || _minutoEnDisponibilidad(hNum * 60 + m, dispRanges);
                s += '<option value="' + v + '"' + (cur === v ? ' selected' : '') + (!disponible ? ' disabled' : '') + '>' + v + '</option>';
            }
            return s;
        }

        var finAutoTxt = (_estado.slotInicio && _estado.tiempoEstimadoMin > 0)
            ? _addMin(_estado.slotInicio, _estado.tiempoEstimadoMin) : '—';
        var endGroupStyle = _estado.tiempoEstimadoMin > 0 ? ' style="display:none"' : '';
        var endAutoStyle  = _estado.tiempoEstimadoMin > 0 ? '' : ' style="display:none"';

        return '<div class="agenda-horario-titulo">&#9200; ' + _esc(nombreDia) + ' ' + dia.getDate() + ' de ' + MESES_ES[dia.getMonth()] + '</div>' +
            '<div class="agenda-horario-instruccion">' + _esc(hint) + '</div>' +
            '<div class="agenda-horario-picker">' +
                '<div class="agenda-time-group">' +
                    '<div class="agenda-time-label">Inicio</div>' +
                    '<div class="agenda-time-fields">' +
                        '<select class="agenda-time-sel" data-time="ini-h">' + _hourOpts(curIniH) + '</select>' +
                        '<span class="agenda-time-colon">:</span>' +
                        '<select class="agenda-time-sel" data-time="ini-m">' + _minOpts(curIniM, curIniH) + '</select>' +
                    '</div>' +
                '</div>' +
                '<span class="agenda-time-arrow">→</span>' +
                '<div class="agenda-time-group"' + endGroupStyle + '>' +
                    '<div class="agenda-time-label">Fin</div>' +
                    '<div class="agenda-time-fields">' +
                        '<select class="agenda-time-sel" data-time="fin-h">' + _hourOpts(curFinH) + '</select>' +
                        '<span class="agenda-time-colon">:</span>' +
                        '<select class="agenda-time-sel" data-time="fin-m">' + _minOpts(curFinM, curFinH) + '</select>' +
                    '</div>' +
                '</div>' +
                '<div class="agenda-time-group"' + endAutoStyle + '>' +
                    '<div class="agenda-time-label">Fin</div>' +
                    '<div class="agenda-fin-auto">' + _esc(finAutoTxt) + '</div>' +
                '</div>' +
            '</div>' +
            _buildWarningHTML();
    }

    function _bindPickerEvents(container) {
        container.querySelectorAll('.agenda-time-sel').forEach(function (sel) {
            sel.addEventListener('change', _onPickerChange);
        });
    }

    function _onPickerChange() {
        var sec = _el.querySelector('.agenda-horario-section');
        if (!sec) return;
        var iniH = sec.querySelector('[data-time="ini-h"]');
        var iniM = sec.querySelector('[data-time="ini-m"]');
        if (!iniH || !iniH.value) return;

        var h = parseInt(iniH.value);
        var m = parseInt(iniM ? iniM.value : '0');

        // Autocorregir hora de inicio según disponibilidad del trabajador
        var dispRanges = _getDispRangesDia();
        if (dispRanges.length > 0) {
            var corregido = _autocorregirTiempo(h, m, dispRanges);
            h = corregido.h;
            m = corregido.m;
        }

        _estado.slotInicio = _pad(h) + ':' + _pad(m);
        if (_estado.tiempoEstimadoMin > 0) {
            _estado.slotFin = _addMin(_estado.slotInicio, _estado.tiempoEstimadoMin);
        } else {
            var finH = sec.querySelector('[data-time="fin-h"]');
            var finM = sec.querySelector('[data-time="fin-m"]');
            _estado.slotFin = (finH && finH.value) ? finH.value + ':' + (finM ? finM.value : '00') : null;
        }
        _renderCalendario();
    }

    /* ── Validación ───────────────────────────────────────────── */

    function _buildWarning() {
        if (!_estado.diaSeleccionado || !_estado.slotInicio || !_estado.slotFin) return '';
        var iniMin = _timeToMin(_estado.slotInicio);
        var finMin = _timeToMin(_estado.slotFin);
        if (finMin <= iniMin) return '⚠ La hora de fin debe ser mayor que la de inicio.';

        var rtype      = _jsToRtype(_estado.diaSeleccionado.getDay());
        var dispRanges = _getDispRangesDia();
        if (dispRanges.length > 0 && !dispRanges.some(function (r) { return iniMin >= r.ini && finMin <= r.fin; })) {
            return '⚠ Fuera de la disponibilidad del trabajador.';
        }

        var diasOcup   = _estado.ocupados.filter(function (x) { return parseInt(x.dia_semana) === rtype; });
        var ocupRanges = diasOcup.map(function (o) {
            return { ini: _timeToMin(o.hora_inicio), fin: _timeToMin(o.hora_fin) };
        });
        if (ocupRanges.some(function (r) { return iniMin < r.fin && finMin > r.ini; })) {
            return '⚠ El horario incluye horas ya ocupadas.';
        }
        return '';
    }

    function _buildWarningHTML() {
        var w = _buildWarning();
        return w ? '<div class="agenda-horario-warning">' + _esc(w) + '</div>' : '';
    }

    /* ── HTML de confirmación ─────────────────────────────────── */

    function _buildConfirmHTML() {
        var dia      = _estado.diaSeleccionado;
        var trabajo  = _estado.trabajoSeleccionado;
        return '<div class="agenda-confirm-resumen">' +
            '&#128197; <strong>' + _esc(_fechaLarga(dia)) + '</strong><br>' +
            '&#9200; ' + _esc(_estado.slotInicio) + ' – ' + _esc(_estado.slotFin) +
        '</div>' +
        '<div class="agenda-confirm-trabajo">Para: <strong>' + _esc(trabajo.titulo) + '</strong></div>' +
        '<button type="button" class="agenda-btn agenda-btn-confirmar">&#9989; Confirmar horario</button>';
    }

    /* ── Lista de trabajos ────────────────────────────────────── */

    function _renderTrabajos() {
        var lista = _el.querySelector('.agenda-trabajos-lista');
        if (!lista) return;

        if (_estado.trabajos.length === 0) {
            lista.innerHTML = '<div class="agenda-trabajos-empty">No hay trabajos activos con este usuario.</div>';
            return;
        }

        lista.innerHTML = _estado.trabajos.map(function (t) {
            var estadoLabel = _estadoLabel(t.estado);
            var fechaTxt    = t.fecha_inicio ? '&#128197; ' + _fechaLargaStr(t.fecha_inicio) : '';
            var selCls      = (_estado.trabajoSeleccionado && String(_estado.trabajoSeleccionado.id) === String(t.id)) ? ' seleccionado' : '';
            return '<div class="agenda-trabajo-item' + selCls + '" data-job-id="' + t.id + '">' +
                '<div class="agenda-trabajo-nombre">' + _esc(t.titulo) + '</div>' +
                '<span class="agenda-trabajo-estado ' + estadoLabel.cls + '">' + estadoLabel.texto + '</span>' +
                (fechaTxt ? '<div class="agenda-trabajo-fecha">' + fechaTxt + '</div>' : '') +
            '</div>';
        }).join('');

        lista.querySelectorAll('.agenda-trabajo-item').forEach(function (el) {
            el.addEventListener('click', function () {
                var jobId = el.dataset.jobId;
                var job   = _estado.trabajos.find(function (t) { return String(t.id) === String(jobId); });
                if (!job) return;
                _estado.trabajoSeleccionado = job;
                // Actualizar trabajadorId según el trabajo seleccionado
                var miId = _currentUserId();
                _estado.trabajadorId = String(job.dueno_id) === String(miId)
                    ? String(job.trabajador_id)
                    : String(job.dueno_id);
                _estado.ofertaId = job.oferta_id || null;
                // Recargar disponibilidad si cambió el trabajadorId
                lista.querySelectorAll('.agenda-trabajo-item').forEach(function (i) {
                    i.classList.toggle('seleccionado', i.dataset.jobId === jobId);
                });
                _cargarDisponibilidad(_estado.trabajadorId);
                _renderCalendario();
            });
        });

        // Pre-seleccionar si hay un trabajo específico del contexto
        if (!_estado.trabajoSeleccionado && _estado.jobId) {
            var presel = lista.querySelector('[data-job-id="' + _estado.jobId + '"]');
            if (presel) presel.click();
        } else if (!_estado.trabajoSeleccionado && _estado.trabajos.length > 0) {
            // No auto-seleccionar — el usuario elige con "Agendar nueva cita"
        }
    }

    function _estadoLabel(estado) {
        switch (estado) {
            case 'en_negociacion':
            case 'publicado':
                return { cls: 'agenda-estado-negociacion', texto: '🤝 En negociación' };
            case 'en_proceso':
            case 'trabajador_llego':
            case 'pendiente_confirmacion':
                return { cls: 'agenda-estado-en-curso', texto: '🔧 En curso' };
            case 'completado':
                return { cls: 'agenda-estado-completado', texto: '✅ Completado' };
            default:
                return { cls: 'agenda-estado-negociacion', texto: '📋 ' + (estado || '') };
        }
    }

    function _fechaLargaStr(isoStr) {
        try {
            var d = new Date(isoStr);
            return d.getDate() + '/' + (d.getMonth() + 1) + ' ' + _pad(d.getHours()) + ':' + _pad(d.getMinutes());
        } catch (e) { return ''; }
    }

    /* ── Botón "Agendar nueva cita" ───────────────────────────── */

    function _onNuevaCita() {
        if (!_estado.trabajoSeleccionado && _estado.trabajos.length > 0) {
            // Seleccionar el primer trabajo disponible (no completado preferido)
            var activo = _estado.trabajos.find(function (t) { return t.estado !== 'completado'; });
            var job = activo || _estado.trabajos[0];
            var itemEl = _el.querySelector('[data-job-id="' + job.id + '"]');
            if (itemEl) { itemEl.click(); return; }
        }
        if (!_estado.trabajoSeleccionado) {
            if (typeof App !== 'undefined' && App.showNotification) {
                App.showNotification('Seleccioná un trabajo de la lista primero', 'error');
            }
            return;
        }
        // Resetear selección de horario para agendar nueva cita
        _estado.diaSeleccionado = null;
        _estado.slotInicio = null;
        _estado.slotFin    = null;
        _renderCalendario();
        // Scroll al calendario
        var panelCal = _el.querySelector('.agenda-panel-cal');
        if (panelCal) panelCal.scrollTop = 0;
    }

    /* ── Confirmar horario ────────────────────────────────────── */

    async function _confirmar() {
        var btn = _el.querySelector('.agenda-btn-confirmar');
        if (btn) { btn.disabled = true; btn.textContent = 'Confirmando…'; }

        var dia        = _estado.diaSeleccionado;
        var rtype      = _jsToRtype(dia.getDay());
        var horaInicio = _estado.slotInicio + ':00';
        var horaFin    = _estado.slotFin + ':00';
        var parts      = _estado.slotInicio.split(':');
        var fechaInicio = new Date(dia);
        fechaInicio.setHours(parseInt(parts[0]), parseInt(parts[1]) || 0, 0, 0);
        var fechaIsoStr = fechaInicio.toISOString();

        try {
            var ok = false;

            if (_estado.ofertaId) {
                // Flujo con oferta: aceptar + confirmar slot
                var data = await _api('/disponibilidad/reservas/oferta/' + _estado.ofertaId + '/aceptar', {
                    method: 'POST',
                    body: JSON.stringify({
                        dia_semana:   rtype,
                        hora_inicio:  horaInicio,
                        hora_fin:     horaFin,
                        fecha_inicio: fechaIsoStr
                    })
                });
                ok = data && data.success;
            } else if (_estado.trabajoSeleccionado) {
                // Flujo sin oferta pendiente: solo actualizar fecha_inicio
                var data2 = await _api('/jobs/' + _estado.trabajoSeleccionado.id + '/agendar', {
                    method: 'PATCH',
                    body: JSON.stringify({ fecha_inicio: fechaIsoStr })
                });
                ok = data2 && data2.success;
            }

            if (ok) {
                // Enviar mensaje al chat
                if (_estado.convId) {
                    var msgTxt = '📅 Horario agendado: ' + _fechaLarga(dia) + ' de ' + _estado.slotInicio + ' a ' + _estado.slotFin;
                    try {
                        await _api('/chat/' + _estado.convId + '/mensajes', {
                            method: 'POST',
                            body: JSON.stringify({ contenido: msgTxt, tipo: 'sistema' })
                        });
                    } catch (e) { /* no crítico */ }
                }

                if (typeof App !== 'undefined' && App.showNotification) {
                    App.showNotification('Horario confirmado correctamente', 'success');
                }

                // Actualizar fecha en la lista de trabajos
                if (_estado.trabajoSeleccionado) {
                    _estado.trabajoSeleccionado.fecha_inicio = fechaIsoStr;
                    var idx = _estado.trabajos.findIndex(function (t) { return t.id === _estado.trabajoSeleccionado.id; });
                    if (idx >= 0) _estado.trabajos[idx].fecha_inicio = fechaIsoStr;
                }

                // Resetear selección y re-renderizar
                _estado.diaSeleccionado = null;
                _estado.slotInicio      = null;
                _estado.slotFin         = null;
                _estado.ofertaId        = null;
                _renderCalendario();
                _renderTrabajos();
            } else {
                throw new Error('Respuesta sin success');
            }
        } catch (e) {
            console.error('[AgendaModal] Error al confirmar:', e);
            if (typeof App !== 'undefined' && App.showNotification) {
                App.showNotification('Error al confirmar el horario', 'error');
            }
            if (btn) { btn.disabled = false; btn.textContent = '✅ Confirmar horario'; }
        }
    }

    /* ── Cargar datos ─────────────────────────────────────────── */

    async function _cargarDisponibilidad(trabajadorId) {
        if (!trabajadorId) return;
        _estado.disponibilidad = [];
        _estado.ocupados       = [];
        try {
            var results = await Promise.all([
                _api('/disponibilidad/trabajador/' + trabajadorId),
                _api('/disponibilidad/trabajador/' + trabajadorId + '/ocupados')
            ]);
            var d = results[0], o = results[1];
            _estado.disponibilidad = (d && d.success && d.disponibilidad) ? d.disponibilidad : [];
            _estado.ocupados       = (o && o.success && o.ocupados)       ? o.ocupados       : [];
        } catch (e) {
            console.error('[AgendaModal] Error cargando disponibilidad:', e);
        }
        _renderCalendario();
    }

    async function _cargarTrabajos() {
        if (!_estado.otroUserId) return;
        var lista = _el.querySelector('.agenda-trabajos-lista');
        if (lista) lista.innerHTML = '<div class="agenda-status-msg">Cargando trabajos&#8230;</div>';
        try {
            var data = await _api('/jobs/con-usuario/' + _estado.otroUserId);
            _estado.trabajos = (data && data.success && data.jobs) ? data.jobs : [];
        } catch (e) {
            console.error('[AgendaModal] Error cargando trabajos:', e);
            _estado.trabajos = [];
        }
        // Si hay un jobId de contexto, pre-seleccionar
        if (_estado.jobId && !_estado.trabajoSeleccionado) {
            var job = _estado.trabajos.find(function (t) { return String(t.id) === String(_estado.jobId); });
            if (job) {
                _estado.trabajoSeleccionado = job;
            }
        }
        _renderTrabajos();
    }

    /* ── API Pública ──────────────────────────────────────────── */

    /**
     * Abre el modal de agenda.
     * @param {object} params
     * @param {string|number} params.convId          ID de conversación (para enviar mensajes)
     * @param {string|number} params.otroUserId      ID del otro usuario
     * @param {string}        params.nombreOtro      Nombre del otro usuario
     * @param {string|number} [params.trabajadorId]  ID del trabajador (para disponibilidad)
     * @param {string|number} [params.ofertaId]      ID de oferta (si aplica)
     * @param {string|number} [params.jobId]         ID de trabajo a pre-seleccionar
     * @param {number}        [params.tiempoEstimadoMin] Duración estimada en minutos
     */
    function open(params) {
        if (!_el) _el = _crearModal();

        var hoy = new Date(); hoy.setHours(0,0,0,0);
        _estado = {
            convId:             params.convId         || null,
            otroUserId:         String(params.otroUserId || ''),
            nombreOtro:         params.nombreOtro     || 'Usuario',
            trabajadorId:       String(params.trabajadorId || params.otroUserId || ''),
            ofertaId:           params.ofertaId       || null,
            jobId:              params.jobId          || null,
            tiempoEstimadoMin:  parseInt(params.tiempoEstimadoMin) || 0,
            vista:              'mes',
            mesActual:          new Date(hoy.getFullYear(), hoy.getMonth(), 1),
            semanaRef:          new Date(hoy),
            diaRef:             new Date(hoy),
            diaSeleccionado:    null,
            slotInicio:         null,
            slotFin:            null,
            disponibilidad:     [],
            ocupados:           [],
            trabajos:           [],
            trabajoSeleccionado: null
        };

        // Actualizar título
        _el.querySelector('.agenda-modal-titulo').textContent = 'Agenda con ' + params.nombreOtro;

        // Reset tabs
        _el.querySelectorAll('.agenda-vista-tab').forEach(function (btn) {
            btn.classList.toggle('activo', btn.dataset.vista === 'mes');
        });

        // Mostrar modal
        _el.classList.add('visible');
        document.body.style.overflow = 'hidden';

        // Cargar datos en paralelo
        _renderCalendario(); // mostrar estado vacío mientras carga
        _cargarDisponibilidad(_estado.trabajadorId);
        _cargarTrabajos();
    }

    function close() {
        if (_el) _el.classList.remove('visible');
        document.body.style.overflow = '';
        _estado = null;
    }

    return { open: open, close: close };
})();

window.AgendaModal = AgendaModal;
