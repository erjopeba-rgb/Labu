/**
 * notif-modal.js — Modal contextual de notificaciones
 * Labu · Expone window.NotifModal.open(notif)
 *
 * Muestra un modal centrado al hacer click en cualquier notificación,
 * con el contenido y acciones apropiados según el tipo de notificación.
 */
(function () {

    /* ── Íconos por tipo ─────────────────────────────────────── */
    var ICONS = {
        oferta_recibida:              '&#128184;',
        contraoferta_recibida:        '&#8617;',
        oferta_aceptada:              '&#9989;',
        oferta_rechazada:             '&#10060;',
        contraoferta_aceptada:        '&#9989;',
        contraoferta_rechazada:       '&#10060;',
        horario_elegido:              '&#128197;',
        horario_confirmado:           '&#128197;',
        llegada_confirmada:           '&#128205;',
        resultado_subido:             '&#128247;',
        trabajo_completado_pendiente: '&#128247;',
        pedir_calificacion:           '&#11088;',
        trabajo_finalizado:           '&#127942;',
        solicitud_amistad:            '&#128101;',
        trabajador_llego:             '&#128205;',
        agenda_confirmada:            '&#128197;',
    };

    /* ── CSS del modal ───────────────────────────────────────── */
    var CSS = '\
.nm-overlay{\
    display:none;\
    position:fixed;\
    inset:0;\
    background:rgba(0,0,0,0.52);\
    z-index:10000;\
    align-items:center;\
    justify-content:center;\
    padding:1rem;\
}\
.nm-overlay.nm-visible{display:flex;}\
.nm-box{\
    background:#fff;\
    border-radius:16px;\
    box-shadow:0 24px 64px rgba(0,0,0,0.28);\
    max-width:480px;\
    width:100%;\
    max-height:88vh;\
    overflow-y:auto;\
    position:relative;\
    padding:2rem 2rem 1.75rem;\
    animation:nmSlideIn 0.2s ease;\
}\
@keyframes nmSlideIn{\
    from{opacity:0;transform:translateY(-18px) scale(0.96);}\
    to{opacity:1;transform:translateY(0) scale(1);}\
}\
.nm-close{\
    position:absolute;\
    top:0.9rem;\
    right:0.9rem;\
    background:none;\
    border:none;\
    font-size:1.1rem;\
    cursor:pointer;\
    color:#888;\
    width:32px;\
    height:32px;\
    border-radius:50%;\
    display:flex;\
    align-items:center;\
    justify-content:center;\
    transition:background 0.15s;\
}\
.nm-close:hover{background:#f0f0f0;color:#333;}\
.nm-icon-wrap{\
    font-size:2.6rem;\
    text-align:center;\
    margin-bottom:0.6rem;\
    line-height:1;\
}\
.nm-title{\
    font-size:1.15rem;\
    font-weight:700;\
    color:#1a1a2e;\
    text-align:center;\
    margin-bottom:0.45rem;\
}\
.nm-message{\
    font-size:0.88rem;\
    color:#555;\
    text-align:center;\
    line-height:1.55;\
    margin-bottom:1.4rem;\
}\
.nm-photo{\
    width:100%;\
    border-radius:10px;\
    margin-bottom:0.6rem;\
    max-height:260px;\
    object-fit:cover;\
    display:block;\
}\
.nm-photo-text{\
    font-size:0.82rem;\
    color:#666;\
    text-align:center;\
    font-style:italic;\
    margin-bottom:1.2rem;\
}\
.nm-stars{\
    display:flex;\
    justify-content:center;\
    gap:0.4rem;\
    margin-bottom:0.9rem;\
}\
.nm-star{\
    font-size:2.2rem;\
    cursor:pointer;\
    color:#d1d5db;\
    transition:color 0.12s;\
    user-select:none;\
    line-height:1;\
}\
.nm-star.nm-star-active{color:#f59e0b;}\
.nm-star.nm-star-hover{color:#fbbf24;}\
.nm-comment{\
    width:100%;\
    border:2px solid #e5e7eb;\
    border-radius:8px;\
    padding:0.6rem 0.75rem;\
    font-size:0.875rem;\
    font-family:inherit;\
    resize:vertical;\
    min-height:72px;\
    margin-bottom:1rem;\
    box-sizing:border-box;\
    transition:border-color 0.15s;\
}\
.nm-comment:focus{outline:none;border-color:#4a6cf7;}\
.nm-actions{\
    display:flex;\
    gap:0.65rem;\
    flex-wrap:wrap;\
    margin-top:0.25rem;\
}\
.nm-btn{\
    flex:1;\
    min-width:120px;\
    padding:0.65rem 1rem;\
    border:none;\
    border-radius:8px;\
    font-size:0.875rem;\
    font-weight:600;\
    cursor:pointer;\
    transition:opacity 0.15s,transform 0.1s;\
    text-align:center;\
    font-family:inherit;\
}\
.nm-btn:hover:not(:disabled){opacity:0.88;}\
.nm-btn:active:not(:disabled){transform:scale(0.98);}\
.nm-btn:disabled{opacity:0.55;cursor:not-allowed;}\
.nm-btn-primary{background:#4a6cf7;color:#fff;}\
.nm-btn-secondary{background:#f3f4f6;color:#374151;}\
.nm-btn-success{background:#10b981;color:#fff;}\
.nm-error{\
    font-size:0.8rem;\
    color:#ef4444;\
    text-align:center;\
    margin-top:0.75rem;\
    display:none;\
}\
.nm-loading{\
    text-align:center;\
    color:#888;\
    padding:1.5rem 0;\
    font-size:0.9rem;\
}\
.nm-success-wrap .nm-icon-wrap{font-size:3rem;}\
.nm-worker-row{\
    display:flex;\
    align-items:center;\
    justify-content:space-between;\
    padding:0.55rem 0.75rem;\
    background:#f8faff;\
    border-radius:8px;\
    margin-bottom:0.75rem;\
    font-size:0.875rem;\
}\
.nm-worker-name{font-weight:600;color:#1a1a2e;}\
.nm-worker-rating{color:#f59e0b;font-size:0.82rem;}\
.nm-amount{\
    font-size:1.7rem;\
    font-weight:800;\
    color:#10b981;\
    text-align:center;\
    margin:0.5rem 0 0;\
    letter-spacing:-0.02em;\
}\
.nm-amount-label{\
    font-size:0.75rem;\
    color:#888;\
    text-align:center;\
    margin-bottom:0.75rem;\
}\
.nm-quote{\
    font-size:0.85rem;\
    color:#555;\
    font-style:italic;\
    background:#f9fafb;\
    border-left:3px solid #e5e7eb;\
    padding:0.5rem 0.75rem;\
    border-radius:0 6px 6px 0;\
    margin-bottom:0.75rem;\
    line-height:1.5;\
}\
.nm-time-est,.nm-job-city{\
    font-size:0.8rem;\
    color:#6b7280;\
    text-align:center;\
    margin-bottom:0.6rem;\
}\
.nm-counter-input{\
    width:100%;\
    border:2px solid #e5e7eb;\
    border-radius:8px;\
    padding:0.6rem 0.75rem;\
    font-size:0.875rem;\
    font-family:inherit;\
    box-sizing:border-box;\
    transition:border-color 0.15s;\
    display:block;\
    margin-bottom:0.4rem;\
}\
.nm-counter-input:focus{outline:none;border-color:#4a6cf7;}\
.nm-accepted-badge{\
    display:flex;\
    align-items:center;\
    justify-content:center;\
    gap:0.5rem;\
    padding:0.6rem 1rem;\
    background:#d1fae5;\
    color:#065f46;\
    border-radius:8px;\
    font-weight:600;\
    font-size:0.875rem;\
    margin-bottom:0.9rem;\
}\
.nm-contra-compare{\
    display:flex;\
    gap:0.5rem;\
    margin-bottom:0.75rem;\
    justify-content:center;\
}\
.nm-contra-box{\
    flex:1;\
    text-align:center;\
    padding:0.55rem 0.5rem;\
    border-radius:8px;\
    border:1px solid #e5e7eb;\
}\
.nm-contra-box.old{background:#fee2e2;color:#dc2626;}\
.nm-contra-box.new{background:#d1fae5;color:#065f46;}\
.nm-contra-label{font-size:0.72rem;margin-bottom:0.2rem;opacity:0.8;}\
.nm-contra-val{font-size:1.1rem;font-weight:700;}\
@media(max-width:520px){\
    .nm-box{padding:1.5rem 1.25rem 1.25rem;}\
    .nm-btn{min-width:auto;}\
}';

    /* ── Inyectar HTML y CSS al body ─────────────────────────── */
    function inject() {
        if (document.getElementById('notifModalOverlay')) return;

        var style = document.createElement('style');
        style.id = 'notifModalStyles';
        style.textContent = CSS;
        document.head.appendChild(style);

        var overlay = document.createElement('div');
        overlay.id = 'notifModalOverlay';
        overlay.className = 'nm-overlay';
        overlay.innerHTML =
            '<div class="nm-box" id="notifModalBox">' +
                '<button class="nm-close" id="nmClose" aria-label="Cerrar">&#10005;</button>' +
                '<div id="nmContent"></div>' +
            '</div>';
        document.body.appendChild(overlay);

        document.getElementById('nmClose').addEventListener('click', close);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') close();
        });
    }

    /* ── Helpers de visibilidad ──────────────────────────────── */
    function close() {
        var el = document.getElementById('notifModalOverlay');
        if (el) el.classList.remove('nm-visible');
    }

    function showOverlay() {
        var el = document.getElementById('notifModalOverlay');
        if (el) el.classList.add('nm-visible');
    }

    function setContent(html) {
        var el = document.getElementById('nmContent');
        if (el) el.innerHTML = html;
    }

    /* ── API helper ──────────────────────────────────────────── */
    function api(path, opts) {
        if (typeof App !== 'undefined' && App.apiRequest) {
            return App.apiRequest(path, opts || {});
        }
        return Promise.reject(new Error('App no disponible'));
    }

    /* ── Escape HTML ─────────────────────────────────────────── */
    function esc(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /* ── Constructores de HTML reutilizables ─────────────────── */
    function baseHTML(notif, extra, actions) {
        var icon = ICONS[notif.tipo] || '&#128276;';
        return '<div class="nm-icon-wrap">' + icon + '</div>' +
               '<div class="nm-title">' + esc(notif.titulo || 'Notificación') + '</div>' +
               '<div class="nm-message">' + esc(notif.mensaje || '') + '</div>' +
               (extra || '') +
               '<div class="nm-actions">' + (actions || '') + '</div>' +
               '<div class="nm-error" id="nmError"></div>';
    }

    function btnNav(label, page) {
        return '<button class="nm-btn nm-btn-primary" onclick="NotifModal.close();App.navigateTo(\'' + page + '\')">' + label + '</button>';
    }

    function btnClose(label) {
        return '<button class="nm-btn nm-btn-secondary" onclick="NotifModal.close()">' + (label || 'Cerrar') + '</button>';
    }

    /* ── Mostrar error en el modal ───────────────────────────── */
    function showErr(msg) {
        var el = document.getElementById('nmError');
        if (!el) return;
        el.textContent = msg;
        el.style.display = 'block';
        // Re-habilitar botones bloqueados
        var btns = document.querySelectorAll('#nmContent .nm-btn-primary:disabled');
        btns.forEach(function (b) { b.disabled = false; });
    }

    /* ── Pantalla de éxito ───────────────────────────────────── */
    function showSuccess(msg) {
        setContent(
            '<div class="nm-success-wrap">' +
                '<div class="nm-icon-wrap">&#127881;</div>' +
                '<div class="nm-title">&#161;Listo!</div>' +
                '<div class="nm-message">' + msg + '</div>' +
                '<div class="nm-actions"><button class="nm-btn nm-btn-success" onclick="NotifModal.close()">Cerrar</button></div>' +
            '</div>'
        );
    }

    /* ── Marcar notificación como leída silenciosamente ──────── */
    function markRead(notif) {
        if (notif.leida || !notif.id) return;
        notif.leida = true;
        api('/chat/notificaciones/' + notif.id + '/leer', { method: 'PATCH' }).catch(function () {});
    }

    /* ── Parsear fotos_urls (string JSON o array) ────────────── */
    function parseFotos(fotosUrls) {
        if (!fotosUrls) return [];
        if (Array.isArray(fotosUrls)) return fotosUrls;
        try { return JSON.parse(fotosUrls); } catch (_) { return []; }
    }

    /* ── Modal: oferta_recibida — dueño ve oferta del trabajador */
    function openOfertaRecibidaModal(notif, ofertaId) {
        setContent('<div class="nm-loading">&#9203; Cargando oferta...</div>');
        showOverlay();
        api('/offers/detalle/' + ofertaId)
            .then(function (data) {
                if (!data || data.error) throw new Error(data && data.error || 'Error');
                var o = data.oferta;
                var fotos = parseFotos(o.fotos_urls);
                var fotoHtml = fotos.length
                    ? '<img src="' + esc(fotos[0]) + '" class="nm-photo" alt="Foto del trabajo">'
                    : '';
                var workerName = [o.trabajador_nombre, o.trabajador_apellido].filter(Boolean).join(' ') || 'Trabajador';
                var rating = o.trabajador_calificacion
                    ? '&#11088; ' + parseFloat(o.trabajador_calificacion).toFixed(1)
                    : 'Nuevo';
                var cityHtml = o.ciudad
                    ? '<div class="nm-job-city">&#128205; ' + esc(o.ciudad) + (o.provincia ? ', ' + esc(o.provincia) : '') + '</div>'
                    : '';
                var msgHtml = o.mensaje
                    ? '<div class="nm-quote">' + esc(o.mensaje) + '</div>'
                    : '';
                var timeHtml = o.tiempo_estimado
                    ? '<div class="nm-time-est">&#128336; ' + esc(String(o.tiempo_estimado)) + ' ' + esc(o.unidad_tiempo || 'días') + '</div>'
                    : '';

                setContent(
                    '<div class="nm-icon-wrap">' + (ICONS['oferta_recibida'] || '&#128184;') + '</div>' +
                    '<div class="nm-title">' + esc(notif.titulo || 'Nueva oferta') + '</div>' +
                    fotoHtml +
                    '<div class="nm-worker-row"><span class="nm-worker-name">&#128100; ' + esc(workerName) + '</span><span class="nm-worker-rating">' + rating + '</span></div>' +
                    '<div class="nm-amount">$' + Number(o.monto_propuesto).toLocaleString('es-AR') + '</div>' +
                    '<div class="nm-amount-label">Monto ofertado</div>' +
                    cityHtml + msgHtml + timeHtml +
                    '<div id="nmMainActions" class="nm-actions">' +
                        '<button class="nm-btn nm-btn-success" id="nmBtnAceptar">&#9989; Aceptar</button>' +
                        '<button class="nm-btn nm-btn-secondary" id="nmBtnContra">&#8617; Contraofertar</button>' +
                        '<button class="nm-btn" id="nmBtnRechazar" style="background:#fee2e2;color:#dc2626;flex-basis:100%">&#10060; Rechazar</button>' +
                    '</div>' +
                    '<div id="nmContraSection" style="display:none;margin-top:0.75rem;">' +
                        '<input type="number" id="nmCounterAmount" class="nm-counter-input" placeholder="Nuevo monto ($)" min="1">' +
                        '<input type="text" id="nmCounterMsg" class="nm-counter-input" placeholder="Mensaje para el trabajador (opcional)">' +
                        '<div class="nm-actions" style="margin-top:0.65rem;">' +
                            '<button class="nm-btn nm-btn-primary" id="nmBtnEnviarContra">Enviar contraoferta</button>' +
                            '<button class="nm-btn nm-btn-secondary" id="nmBtnCancelContra">Cancelar</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="nm-error" id="nmError"></div>'
                );

                document.getElementById('nmBtnAceptar').addEventListener('click', function () {
                    var btn = this;
                    btn.disabled = true; btn.textContent = 'Aceptando...';
                    document.getElementById('nmBtnContra').disabled = true;
                    document.getElementById('nmBtnRechazar').disabled = true;
                    api('/offers/' + ofertaId + '/accept', { method: 'PATCH' })
                        .then(function (d) {
                            if (d && d.error) { showErr(d.error); btn.disabled = false; return; }
                            showSuccess('&#9989; ¡Oferta aceptada! Coordiná el horario con el trabajador.');
                        })
                        .catch(function (e) { showErr(e.message || 'Error al aceptar.'); btn.disabled = false; });
                });

                document.getElementById('nmBtnContra').addEventListener('click', function () {
                    document.getElementById('nmMainActions').style.display = 'none';
                    document.getElementById('nmContraSection').style.display = 'block';
                });

                document.getElementById('nmBtnCancelContra').addEventListener('click', function () {
                    document.getElementById('nmMainActions').style.display = 'flex';
                    document.getElementById('nmContraSection').style.display = 'none';
                });

                document.getElementById('nmBtnEnviarContra').addEventListener('click', function () {
                    var monto = document.getElementById('nmCounterAmount').value;
                    var msg   = document.getElementById('nmCounterMsg').value;
                    if (!monto || Number(monto) <= 0) { showErr('Ingresá un monto válido.'); return; }
                    var btn = this;
                    btn.disabled = true; btn.textContent = 'Enviando...';
                    api('/offers/' + ofertaId + '/counter', {
                        method: 'PATCH',
                        body: JSON.stringify({ monto_contraoferta: Number(monto), mensaje_contraoferta: msg || null })
                    })
                    .then(function (d) {
                        if (d && d.error) { showErr(d.error); btn.disabled = false; return; }
                        showSuccess('&#8617; ¡Contraoferta enviada al trabajador!');
                    })
                    .catch(function (e) { showErr(e.message || 'Error al enviar contraoferta.'); btn.disabled = false; });
                });

                document.getElementById('nmBtnRechazar').addEventListener('click', function () {
                    var btn = this;
                    if (!btn.dataset.confirmed) {
                        btn.dataset.confirmed = '1';
                        btn.textContent = '&#10060; ¿Confirmar rechazo?';
                        return;
                    }
                    btn.disabled = true; btn.textContent = 'Rechazando...';
                    document.getElementById('nmBtnAceptar').disabled = true;
                    document.getElementById('nmBtnContra').disabled = true;
                    api('/offers/' + ofertaId + '/reject', { method: 'PATCH' })
                        .then(function (d) {
                            if (d && d.error) { showErr(d.error); btn.disabled = false; return; }
                            showSuccess('&#10060; Oferta rechazada.');
                        })
                        .catch(function (e) { showErr(e.message || 'Error al rechazar.'); btn.disabled = false; });
                });
            })
            .catch(function () {
                setContent(baseHTML(notif, null,
                    btnNav('&#128188; Ver Mis Ofertas', 'mis-ofertas-laborales') + btnClose()
                ));
            });
    }

    /* ── Modal: oferta_aceptada — trabajador ve su oferta aceptada */
    function openOfertaAceptadaModal(notif, trabajoId) {
        setContent('<div class="nm-loading">&#9203; Cargando trabajo...</div>');
        showOverlay();
        api('/jobs/' + trabajoId)
            .then(function (data) {
                if (!data || data.error) throw new Error(data && data.error || 'Error');
                var job = data.job || data;
                var fotos = parseFotos(job.fotos_urls);
                var fotoHtml = fotos.length
                    ? '<img src="' + esc(fotos[0]) + '" class="nm-photo" alt="Foto del trabajo">'
                    : '';
                var cityHtml = job.ciudad
                    ? '<div class="nm-job-city">&#128205; ' + esc(job.ciudad) + '</div>'
                    : '';
                setContent(
                    '<div class="nm-icon-wrap">&#9989;</div>' +
                    '<div class="nm-title">&#161;Tu oferta fue aceptada!</div>' +
                    '<div class="nm-accepted-badge">&#127881; El dueño eligió tu propuesta</div>' +
                    fotoHtml +
                    '<div class="nm-title" style="font-size:1rem;margin-bottom:0.3rem;">' + esc(job.titulo || '') + '</div>' +
                    cityHtml +
                    '<div class="nm-message">' + esc(notif.mensaje || '') + '</div>' +
                    '<div class="nm-actions">' +
                        btnNav('&#128736; Ver Mis Trabajos', 'mis-trabajos') +
                        btnClose() +
                    '</div>' +
                    '<div class="nm-error" id="nmError"></div>'
                );
            })
            .catch(function () {
                setContent(baseHTML(notif, null,
                    btnNav('&#128736; Ver Mis Trabajos', 'mis-trabajos') + btnClose()
                ));
            });
    }

    /* ── Modal: contraoferta_recibida — trabajador acepta o rechaza */
    function openContraofertaModal(notif, ofertaId) {
        setContent('<div class="nm-loading">&#9203; Cargando contraoferta...</div>');
        showOverlay();
        api('/offers/detalle/' + ofertaId)
            .then(function (data) {
                if (!data || data.error) throw new Error(data && data.error || 'Error');
                var o = data.oferta;
                var contraHtml =
                    '<div class="nm-contra-compare">' +
                        '<div class="nm-contra-box old"><div class="nm-contra-label">Tu oferta</div><div class="nm-contra-val">$' + Number(o.monto_propuesto).toLocaleString('es-AR') + '</div></div>' +
                        '<div class="nm-contra-box new"><div class="nm-contra-label">Contraoferta</div><div class="nm-contra-val">$' + Number(o.monto_contraoferta).toLocaleString('es-AR') + '</div></div>' +
                    '</div>';
                var msgHtml = o.mensaje_contraoferta
                    ? '<div class="nm-quote">' + esc(o.mensaje_contraoferta) + '</div>'
                    : '';
                setContent(
                    '<div class="nm-icon-wrap">&#8617;</div>' +
                    '<div class="nm-title">' + esc(notif.titulo || 'Contraoferta recibida') + '</div>' +
                    '<div class="nm-message" style="margin-bottom:0.75rem;">' + esc(o.titulo || '') + '</div>' +
                    contraHtml +
                    msgHtml +
                    '<div class="nm-actions">' +
                        '<button class="nm-btn nm-btn-success" id="nmBtnAceptarContra">&#9989; Aceptar</button>' +
                        '<button class="nm-btn" id="nmBtnRechazarContra" style="background:#fee2e2;color:#dc2626;">&#10060; Rechazar</button>' +
                        '<button class="nm-btn nm-btn-secondary" onclick="NotifModal.close()">Decidir después</button>' +
                    '</div>' +
                    '<div class="nm-error" id="nmError"></div>'
                );

                document.getElementById('nmBtnAceptarContra').addEventListener('click', function () {
                    var btn = this;
                    btn.disabled = true; btn.textContent = 'Aceptando...';
                    document.getElementById('nmBtnRechazarContra').disabled = true;
                    api('/offers/' + ofertaId + '/accept-counter', { method: 'PATCH' })
                        .then(function (d) {
                            if (d && d.error) { showErr(d.error); btn.disabled = false; return; }
                            showSuccess('&#9989; ¡Contraoferta aceptada! El dueño recibirá la notificación.');
                        })
                        .catch(function (e) { showErr(e.message || 'Error al aceptar.'); btn.disabled = false; });
                });

                document.getElementById('nmBtnRechazarContra').addEventListener('click', function () {
                    var btn = this;
                    if (!btn.dataset.confirmed) {
                        btn.dataset.confirmed = '1';
                        btn.textContent = '&#10060; ¿Confirmar rechazo?';
                        return;
                    }
                    btn.disabled = true; btn.textContent = 'Rechazando...';
                    document.getElementById('nmBtnAceptarContra').disabled = true;
                    api('/offers/' + ofertaId + '/reject-counter', { method: 'PATCH' })
                        .then(function (d) {
                            if (d && d.error) { showErr(d.error); btn.disabled = false; return; }
                            showSuccess('&#10060; Contraoferta rechazada.');
                        })
                        .catch(function (e) { showErr(e.message || 'Error al rechazar.'); btn.disabled = false; });
                });
            })
            .catch(function () {
                setContent(baseHTML(notif, null,
                    btnNav('&#128736; Ver Mis Trabajos', 'mis-trabajos') + btnClose()
                ));
            });
    }

    /* ── Contenido modal para resultado con foto ─────────────── */
    function openResultadoModal(notif, refId) {
        setContent('<div class="nm-loading">&#9203; Cargando resultado...</div>');
        showOverlay();
        api('/jobs/' + refId)
            .then(function (data) {
                var job = data.job || data;
                var fotoHtml = job.foto_resultado_url
                    ? '<img src="' + esc(job.foto_resultado_url) + '" class="nm-photo" alt="Foto resultado">'
                    : '<div class="nm-message" style="color:#aaa;margin-bottom:0.75rem;">Sin foto adjunta</div>';
                var textoHtml = job.texto_resultado
                    ? '<div class="nm-photo-text">' + esc(job.texto_resultado) + '</div>'
                    : '';
                setContent(baseHTML(
                    notif,
                    fotoHtml + textoHtml,
                    '<button class="nm-btn nm-btn-success" id="nmBtnConfirmar">&#9989; Confirmar Completado</button>' +
                    btnClose()
                ));
                document.getElementById('nmBtnConfirmar').addEventListener('click', function () {
                    var btn = this;
                    btn.disabled = true;
                    btn.textContent = 'Confirmando...';
                    api('/jobs/' + refId + '/confirmar-completado', { method: 'PATCH' })
                        .then(function () { showSuccess('&#127881; ¡Trabajo confirmado! Se enviará la calificación.'); })
                        .catch(function (e) { showErr(e.message || 'Error al confirmar. Intentá desde Mis Ofertas.'); });
                });
            })
            .catch(function () {
                setContent(baseHTML(notif, null,
                    btnNav('&#128188; Ver Mis Ofertas', 'mis-ofertas-laborales') + btnClose()
                ));
            });
    }

    /* ── Modal: trabajador_llego — dueño confirma llegada del trabajador */
    function openTrabajadorLlegoModal(notif, trabajoId) {
        setContent('<div class="nm-loading">&#9203; Cargando...</div>');
        showOverlay();
        api('/jobs/' + trabajoId)
            .then(function (data) {
                var job = data.job || data;
                var fotoHtml = '';
                if (job && job.fotos_urls) {
                    var fotos = parseFotos(job.fotos_urls);
                    if (fotos.length) {
                        fotoHtml = '<img src="' + esc(fotos[0]) + '" class="nm-photo" alt="Foto del trabajo">';
                    }
                }
                var cityHtml = job && job.ciudad
                    ? '<div class="nm-job-city">&#128205; ' + esc(job.ciudad) + '</div>'
                    : '';
                setContent(
                    '<div class="nm-icon-wrap">&#128205;</div>' +
                    '<div class="nm-title">' + esc(notif.titulo || 'El trabajador llegó') + '</div>' +
                    fotoHtml +
                    '<div class="nm-message">' + esc(notif.mensaje || '') + '</div>' +
                    (job ? '<div class="nm-title" style="font-size:0.95rem;margin-bottom:0.3rem;">' + esc(job.titulo || '') + '</div>' : '') +
                    cityHtml +
                    '<div class="nm-actions">' +
                        '<button class="nm-btn nm-btn-success" id="nmBtnConfirmarLlegada">&#128205; Confirmar llegada</button>' +
                        '<button class="nm-btn nm-btn-secondary" onclick="NotifModal.close()">Más tarde</button>' +
                    '</div>' +
                    '<div class="nm-error" id="nmError"></div>'
                );
                document.getElementById('nmBtnConfirmarLlegada').addEventListener('click', function () {
                    var btn = this;
                    btn.disabled = true;
                    btn.textContent = 'Confirmando...';
                    api('/jobs/' + trabajoId + '/confirmar-llegada', { method: 'PATCH' })
                        .then(function (d) {
                            if (d && d.error) { showErr(d.error); btn.disabled = false; return; }
                            showSuccess('&#128205; ¡Llegada confirmada! El trabajo está en curso.');
                        })
                        .catch(function (e) { showErr(e.message || 'Error al confirmar. Intentá desde Mis Ofertas.'); btn.disabled = false; });
                });
            })
            .catch(function () {
                setContent(baseHTML(notif, null,
                    '<button class="nm-btn nm-btn-success" id="nmBtnConfirmarLlegadaFallback">&#128205; Confirmar llegada</button>' +
                    btnClose('Más tarde')
                ));
                document.getElementById('nmBtnConfirmarLlegadaFallback').addEventListener('click', function () {
                    var btn = this;
                    btn.disabled = true;
                    btn.textContent = 'Confirmando...';
                    api('/jobs/' + trabajoId + '/confirmar-llegada', { method: 'PATCH' })
                        .then(function () { showSuccess('&#128205; ¡Llegada confirmada! El trabajo está en curso.'); })
                        .catch(function (e) { showErr(e.message || 'Error al confirmar.'); btn.disabled = false; });
                });
            });
    }

    /* ── Contenido modal de calificación ─────────────────────── */
    function openCalificacionModal(notif, refId) {
        var starsHtml = '<div class="nm-stars">';
        for (var s = 1; s <= 5; s++) {
            starsHtml += '<span class="nm-star" data-val="' + s + '">&#9733;</span>';
        }
        starsHtml += '</div>';

        setContent(baseHTML(
            notif,
            starsHtml +
            '<textarea class="nm-comment" id="nmComentario" placeholder="Dejá un comentario (opcional)..."></textarea>',
            '<button class="nm-btn nm-btn-primary" id="nmBtnCalificar" disabled>&#11088; Enviar Calificación</button>' +
            btnClose()
        ));

        var selectedStars = 0;
        var allStars = document.querySelectorAll('#nmContent .nm-star');

        allStars.forEach(function (star) {
            star.addEventListener('mouseenter', function () {
                var hov = parseInt(this.getAttribute('data-val'), 10);
                allStars.forEach(function (s2) {
                    s2.classList.toggle('nm-star-hover', parseInt(s2.getAttribute('data-val'), 10) <= hov);
                });
            });
            star.addEventListener('mouseleave', function () {
                allStars.forEach(function (s2) { s2.classList.remove('nm-star-hover'); });
            });
            star.addEventListener('click', function () {
                selectedStars = parseInt(this.getAttribute('data-val'), 10);
                allStars.forEach(function (s2) {
                    s2.classList.toggle('nm-star-active', parseInt(s2.getAttribute('data-val'), 10) <= selectedStars);
                });
                document.getElementById('nmBtnCalificar').disabled = false;
            });
        });

        document.getElementById('nmBtnCalificar').addEventListener('click', function () {
            if (!selectedStars) return;
            var btn = this;
            btn.disabled = true;
            btn.textContent = 'Enviando...';
            var comentario = (document.getElementById('nmComentario').value || '').trim();
            api('/calificaciones/trabajo/' + refId, {
                method: 'POST',
                body: JSON.stringify({ puntaje: selectedStars, comentario: comentario })
            })
            .then(function () { showSuccess('&#11088; ¡Calificación enviada! Gracias por tu feedback.'); })
            .catch(function (e) { showErr(e.message || 'Error al enviar calificación.'); });
        });
    }

    /* ── open() — función principal ──────────────────────────── */
    function open(notif) {
        inject();
        markRead(notif);

        var refId = notif.referencia_id;

        switch (notif.tipo) {

            /* Dueño: recibe oferta nueva → modal rico con acciones */
            case 'oferta_recibida':
                openOfertaRecibidaModal(notif, refId);
                return; // showOverlay() llamado internamente

            /* Trabajador: recibe contraoferta del dueño → aceptar o rechazar */
            case 'contraoferta_recibida':
                openContraofertaModal(notif, refId);
                return; // showOverlay() llamado internamente

            /* Trabajador: su oferta fue aceptada → ver detalles del trabajo */
            case 'oferta_aceptada':
                openOfertaAceptadaModal(notif, refId);
                return; // showOverlay() llamado internamente

            /* Dueño: trabajador llegó al lugar → confirmar su llegada */
            case 'trabajador_llego':
                openTrabajadorLlegoModal(notif, refId);
                return; // showOverlay() llamado internamente

            /* Dueño: trabajo quedó agendado en su calendario */
            case 'agenda_confirmada':
                setContent(baseHTML(notif, null,
                    btnNav('&#128197; Ver Mis Ofertas', 'mis-ofertas-laborales') + btnClose('Entendido')
                ));
                break;

            /* Trabajador: su oferta fue rechazada */
            case 'oferta_rechazada':
                setContent(baseHTML(notif, null, btnClose('Entendido')));
                break;

            /* Dueño: trabajador aceptó la contraoferta → debe elegir horario */
            case 'contraoferta_aceptada':
                setContent(baseHTML(notif, null,
                    btnNav('&#128188; Ver Mis Ofertas', 'mis-ofertas-laborales') + btnClose()
                ));
                break;

            /* Dueño: trabajador rechazó la contraoferta */
            case 'contraoferta_rechazada':
                setContent(baseHTML(notif, null, btnClose('Entendido')));
                break;

            /* Trabajador: dueño eligió horario → solo aviso, sin acción inmediata */
            case 'horario_elegido':
                setContent(baseHTML(notif, null,
                    btnNav('&#128188; Ver Mis Trabajos', 'mis-trabajos') + btnClose('Entendido')
                ));
                break;

            /* Dueño: trabajador confirmó el horario */
            case 'horario_confirmado':
                setContent(baseHTML(notif, null,
                    btnNav('&#128188; Ver Mis Ofertas', 'mis-ofertas-laborales') + btnClose()
                ));
                break;

            /* Trabajador: dueño confirmó su llegada */
            case 'llegada_confirmada':
                setContent(baseHTML(notif, null,
                    btnNav('&#128736; Ver Mis Trabajos', 'mis-trabajos') + btnClose()
                ));
                break;

            /* Dueño: trabajador subió foto del resultado → revisar y confirmar */
            case 'resultado_subido':
            case 'trabajo_completado_pendiente':
                openResultadoModal(notif, refId);
                return; // showOverlay() llamado internamente

            /* Ambos: calificar el trabajo finalizado */
            case 'pedir_calificacion':
                openCalificacionModal(notif, refId);
                break;

            /* Info general de trabajo finalizado */
            case 'trabajo_finalizado':
                setContent(baseHTML(notif, null, btnClose('&#127942; Cerrar')));
                break;

            /* Solicitud de amistad: aceptar o rechazar */
            case 'solicitud_amistad':
                setContent(baseHTML(notif, null,
                    '<button class="nm-btn nm-btn-success" id="nmBtnAceptar">&#10003; Aceptar</button>' +
                    '<button class="nm-btn nm-btn-secondary" id="nmBtnRechazar">&#10005; Rechazar</button>'
                ));
                document.getElementById('nmBtnAceptar').addEventListener('click', function () {
                    var btn = this;
                    btn.disabled = true;
                    btn.textContent = 'Aceptando...';
                    api('/contactos/' + refId + '/aceptar', { method: 'PATCH' })
                        .then(function () { showSuccess('&#128101; Solicitud aceptada. Ahora son amigos.'); })
                        .catch(function (e) { showErr(e.message || 'Error al aceptar. Intenta de nuevo.'); });
                });
                document.getElementById('nmBtnRechazar').addEventListener('click', function () {
                    var btn = this;
                    btn.disabled = true;
                    btn.textContent = 'Rechazando...';
                    api('/contactos/' + refId + '/rechazar', { method: 'PATCH' })
                        .then(function () { showSuccess('&#10005; Solicitud rechazada.'); })
                        .catch(function (e) { showErr(e.message || 'Error al rechazar. Intenta de nuevo.'); });
                });
                break;

            default:
                setContent(baseHTML(notif, null, btnClose()));
        }

        showOverlay();
    }

    /* ── API pública ─────────────────────────────────────────── */
    window.NotifModal = { open: open, close: close };

    /* ── Auto-inyectar en DOMContentLoaded ──────────────────── */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject);
    } else {
        inject();
    }

})();
