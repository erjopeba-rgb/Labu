const http = require("http");
const https = require("https");
const { formatInTimeZone, fromZonedTime } = require("date-fns-tz");
const pool = require("../config/db");
const logger = require("../config/logger");

// Zona horaria del negocio: todas las comparaciones de calendario se hacen en ART,
// nunca en UTC (un trabajo a las 21:00+ ART cae en el día UTC siguiente).
const TZ = 'America/Argentina/Buenos_Aires';

// El demo público de OSRM tiene rate limiting agresivo y sin SLA — solo apto para desarrollo.
const OSRM_URL = (process.env.OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, '');

if (process.env.NODE_ENV === 'production' && !process.env.OSRM_URL) {
    logger.warn('[scheduling] OSRM_URL no configurada — usando el demo público (rate-limited, sin SLA)');
}

const OSRM_PERFILES = {
    auto:      'driving',
    moto:      'driving',
    bici:      'cycling',
    caminando: 'foot'
};

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// "HH:MM:SS" → minutos desde medianoche
const horaAMinutos = (hora) => {
    const partes = String(hora).split(':');
    return parseInt(partes[0]) * 60 + parseInt(partes[1]);
};

// minutos desde medianoche → "HH:MM"
const _minutosAHora = (minutos) => {
    const hh = Math.floor(minutos / 60).toString().padStart(2, '0');
    const mm = (minutos % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
};

// Intenta una sola llamada a OSRM; rechaza la promesa si falla o hay timeout.
const _intentarOSRM = (urlStr) => {
    return new Promise((resolve, reject) => {
        const cliente = urlStr.startsWith('https') ? https : http;
        const req = cliente.get(urlStr, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.code === 'Ok' && json.routes?.[0]) {
                        resolve(Math.ceil(json.routes[0].duration / 60));
                    } else {
                        reject(new Error('OSRM respuesta inválida'));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.setTimeout(5000, () => { req.destroy(); reject(new Error('OSRM timeout')); });
        req.on('error', reject);
    });
};

// Llama OSRM con 2 reintentos (backoff 500ms/1000ms); fallback: 30 min.
const obtenerTiempoViaje = async (medioTransporte, lat1, lng1, lat2, lng2) => {
    const perfil = OSRM_PERFILES[medioTransporte] || 'driving';
    const urlStr = `${OSRM_URL}/route/v1/${perfil}/${lng1},${lat1};${lng2},${lat2}?overview=false`;

    for (let i = 0; i < 3; i++) {
        try {
            return await _intentarOSRM(urlStr);
        } catch (err) {
            if (i < 2) {
                await new Promise(r => setTimeout(r, 500 * Math.pow(2, i)));
            }
        }
    }
    return 30;
};

/**
 * Busca el próximo slot disponible para el trabajador en el trabajo dado.
 * Considera:
 *   - Disponibilidad semanal del trabajador (disponibilidad_trabajador)
 *   - Disponibilidad semanal del dueño (disponibilidad_trabajador con su usuario_id)
 *   - Trabajos ya confirmados del trabajador (para evitar conflictos)
 *   - Tiempo de desplazamiento vía OSRM:
 *       · Primer trabajo del día: desde casa del trabajador + tiempo_preparacion_minutos
 *       · Con trabajos previos ese día: desde el último trabajo confirmado
 *       · Sin coordenadas disponibles: fallback 30 min
 *   - Si viaje + duración estimada no caben en el slot → se descarta y pasa al siguiente día
 *
 * Retorna { fecha_inicio, dia_semana, hora_inicio, hora_fin, cuando } o null si no hay slot.
 */
const calcularProximoSlot = async (trabajadorId, trabajoId) => {
    // Disponibilidad semanal del trabajador
    const dispRes = await pool.query(
        `SELECT dia_semana, hora_inicio, hora_fin, tiempo_preparacion_minutos
         FROM disponibilidad_trabajador
         WHERE trabajador_id = $1 AND activo = TRUE
         ORDER BY dia_semana, hora_inicio`,
        [trabajadorId]
    );
    logger.info({ trabajadorId, trabajoId, slots: dispRes.rows }, '[scheduling] slots del trabajador');
    if (dispRes.rows.length === 0) {
        logger.info({ trabajadorId }, '[scheduling] trabajador sin disponibilidad semanal configurada → retorna null');
        return null;
    }
    const tiempoPreparacion = dispRes.rows[0].tiempo_preparacion_minutos ?? 15;

    // Datos del trabajo: coordenadas, dueño y días disponibles del dueño para este trabajo
    const trabajoRes = await pool.query(
        "SELECT latitud, longitud, dueno_id, disponibilidad_dueno FROM trabajos WHERE id = $1",
        [trabajoId]
    );
    if (!trabajoRes.rows[0]) {
        logger.info({ trabajoId }, '[scheduling] trabajo no encontrado → retorna null');
        return null;
    }
    const trabajo = trabajoRes.rows[0];
    logger.info({ trabajoId, dueno_id: trabajo.dueno_id, latitud: trabajo.latitud, longitud: trabajo.longitud }, '[scheduling] datos del trabajo');

    // Días disponibles del dueño: leídos de trabajos.disponibilidad_dueno (JSONB)
    // Formato: [{ dia_semana: 0, disponible: true }, ...]
    let dispDuenoRaw = trabajo.disponibilidad_dueno;
    if (typeof dispDuenoRaw === 'string') {
        try { dispDuenoRaw = JSON.parse(dispDuenoRaw); } catch (_) { dispDuenoRaw = null; }
    }
    const diasDisponiblesDueno = Array.isArray(dispDuenoRaw) && dispDuenoRaw.length > 0
        ? new Set(dispDuenoRaw.filter(d => d.disponible).map(d => d.dia_semana))
        : null; // null = sin restricciones
    logger.info({
        dueno_id: trabajo.dueno_id,
        disponibilidad_dueno: dispDuenoRaw,
        diasDisponiblesDueno: diasDisponiblesDueno ? [...diasDisponiblesDueno] : 'sin restricciones'
    }, '[scheduling] días disponibles del dueño (del trabajo)');

    // Dueño marcó todos sus días como NO disponible → imposible agendar
    if (diasDisponiblesDueno !== null && diasDisponiblesDueno.size === 0) {
        logger.info({ trabajoId }, '[scheduling] dueño marcó todos los días como no disponibles → retorna null');
        return null;
    }

    // Slots válidos = días del trabajador que coincidan con días disponibles del dueño.
    // Si el dueño no configuró disponibilidad en el trabajo → acepta cualquier día del trabajador.
    const slotsValidos = diasDisponiblesDueno !== null
        ? dispRes.rows.filter(s => diasDisponiblesDueno.has(s.dia_semana))
        : dispRes.rows;

    logger.info({
        diasDisponiblesDueno: diasDisponiblesDueno ? [...diasDisponiblesDueno] : null,
        slotsValidosCount: slotsValidos.length,
        slotsValidos,
        razon: diasDisponiblesDueno === null ? 'dueño sin disponibilidad configurada → acepta cualquier día del trabajador' : 'intersección de días trabajador ∩ dueño'
    }, '[scheduling] intersección de disponibilidad');

    if (slotsValidos.length === 0) {
        logger.info({ trabajadorId }, '[scheduling] ningún slot del trabajador coincide con días del dueño → retorna null');
        return null;
    }

    // Trabajos ya confirmados del trabajador con hora, duración y ubicación.
    // tiempo_estimado permite derivar la franja ocupada cuando no hay reserva confirmada.
    const confirmadosRes = await pool.query(
        `SELECT t.fecha_inicio, t.latitud, t.longitud, o.tiempo_estimado,
                rt.hora_inicio AS rt_inicio, rt.hora_fin AS rt_fin
         FROM trabajos t
         JOIN ofertas o ON o.trabajo_id = t.id
             AND o.trabajador_id = $1 AND o.estado = 'aceptada'
         LEFT JOIN reservas_tentativas rt ON rt.oferta_id = o.id AND rt.estado = 'confirmada'
         WHERE t.estado IN ('en_negociacion', 'en_curso', 'trabajador_llego', 'pendiente_confirmacion')
           AND t.fecha_inicio IS NOT NULL
           AND t.id <> $2
         ORDER BY t.fecha_inicio`,
        [trabajadorId, trabajoId]
    );
    const confirmados = confirmadosRes.rows;

    // Medio de transporte y coordenadas de casa del trabajador
    const perfilRes = await pool.query(
        "SELECT medio_transporte, latitud, longitud FROM perfiles WHERE usuario_id = $1",
        [trabajadorId]
    );
    const medioTransporte = perfilRes.rows[0]?.medio_transporte || 'auto';
    const latCasa = perfilRes.rows[0]?.latitud != null ? parseFloat(perfilRes.rows[0].latitud) : null;
    const lonCasa = perfilRes.rows[0]?.longitud != null ? parseFloat(perfilRes.rows[0].longitud) : null;

    // Duración estimada del trabajo según la última oferta del trabajador (fallback: 60 min)
    const ofertaDurRes = await pool.query(
        `SELECT tiempo_estimado FROM ofertas
         WHERE trabajo_id = $1 AND trabajador_id = $2
         ORDER BY creado_en DESC LIMIT 1`,
        [trabajoId, trabajadorId]
    );
    const duracionHoras = parseFloat(ofertaDurRes.rows[0]?.tiempo_estimado ?? 1);
    const duracionMin = Math.ceil(duracionHoras * 60);
    logger.info({ tiempoPreparacion, duracionHoras, duracionMin, latCasa, lonCasa, medioTransporte }, '[scheduling] parámetros de búsqueda');

    // Iterar desde mañana hasta 60 días adelante — calendario en hora argentina (TZ)
    const hoyStrTZ = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
    const [hoyY, hoyM, hoyD] = hoyStrTZ.split('-').map(Number);
    // Ancla a mediodía UTC: sumar 24h por día mantiene estable la fecha de calendario
    const base = new Date(Date.UTC(hoyY, hoyM - 1, hoyD, 12, 0, 0));

    for (let diasAdelante = 1; diasAdelante <= 60; diasAdelante++) {
        const fecha = new Date(base.getTime() + diasAdelante * 24 * 60 * 60 * 1000);
        const fechaStr = fecha.toISOString().substring(0, 10); // fecha de calendario ART por construcción

        // Convertir getUTCDay() (0=Dom) a dia_semana (0=Lun…6=Dom)
        const jsDay = fecha.getUTCDay();
        const diaSemana = jsDay === 0 ? 6 : jsDay - 1;

        const slotsEsteDia = slotsValidos.filter(s => s.dia_semana === diaSemana);
        if (slotsEsteDia.length === 0) continue;

        logger.info({ fechaStr, diaSemana, diaNombre: DIAS[diaSemana], slotsEsteDia }, '[scheduling] evaluando día');

        // Trabajos confirmados en este mismo día (comparación de calendario en TZ, no UTC).
        // Con reserva confirmada se usa su franja; sin reserva (trabajos agendados manualmente
        // o auto-agendados antes de este fix) se deriva desde fecha_inicio + duración de la oferta.
        const confirmedHoy = confirmados
            .filter(tc => formatInTimeZone(new Date(tc.fecha_inicio), TZ, 'yyyy-MM-dd') === fechaStr)
            .map(tc => {
                if (tc.rt_inicio && tc.rt_fin) {
                    return { ...tc, ocupado_inicio: tc.rt_inicio, ocupado_fin: tc.rt_fin };
                }
                const inicioMin = horaAMinutos(formatInTimeZone(new Date(tc.fecha_inicio), TZ, 'HH:mm'));
                const durMin = Math.ceil(parseFloat(tc.tiempo_estimado ?? 1) * 60);
                return {
                    ...tc,
                    ocupado_inicio: _minutosAHora(inicioMin),
                    ocupado_fin: _minutosAHora(Math.min(inicioMin + durMin, 23 * 60 + 59))
                };
            });

        for (const slot of slotsEsteDia) {
            const inicioSlotMin = horaAMinutos(slot.hora_inicio);
            const finSlotMin   = horaAMinutos(slot.hora_fin);
            const duracionSlot = finSlotMin - inicioSlotMin;

            if (confirmedHoy.length === 0) {
                // Primer trabajo del día: OSRM desde casa + tiempo de preparación
                let tiempoViajeCasa = 30; // fallback si no hay coordenadas
                const hayCoordsOrigen = latCasa !== null && lonCasa !== null;
                const hayCoordsDestino = trabajo.latitud && trabajo.longitud;
                if (hayCoordsOrigen && hayCoordsDestino) {
                    tiempoViajeCasa = await obtenerTiempoViaje(
                        medioTransporte,
                        latCasa, lonCasa,
                        parseFloat(trabajo.latitud), parseFloat(trabajo.longitud)
                    );
                }
                const inicioEfectivoMin = inicioSlotMin + tiempoPreparacion + tiempoViajeCasa;
                const necesita = tiempoPreparacion + tiempoViajeCasa + duracionMin;

                logger.info({
                    slot: `${slot.hora_inicio}-${slot.hora_fin}`,
                    inicioSlotMin, finSlotMin, duracionSlot,
                    tiempoPreparacion, tiempoViajeCasa, hayCoordsOrigen, hayCoordsDestino,
                    inicioEfectivoMin, duracionMin,
                    necesita, disponible: duracionSlot,
                    cabe: inicioEfectivoMin + duracionMin <= finSlotMin
                }, '[scheduling] slot primer-trabajo: cálculo de espacio');

                if (inicioEfectivoMin + duracionMin > finSlotMin) {
                    logger.info({ slot: `${slot.hora_inicio}-${slot.hora_fin}`, necesita, disponible: duracionSlot }, '[scheduling] slot descartado: preparación+viaje+duración no caben → probar siguiente slot del día');
                    continue; // probar el siguiente slot del mismo día
                }

                const slotEfectivo = { ...slot, hora_inicio: _minutosAHora(inicioEfectivoMin) };
                const resultado = _armarResultado(fechaStr, diaSemana, slotEfectivo, duracionMin);
                logger.info({ tiempoPreparacion, tiempoViajeCasa, duracionMin, cuando: resultado.cuando }, '[scheduling] SLOT ENCONTRADO (primer trabajo del día)');
                return resultado;
            }

            // Trabajo anterior más cercano (termina justo antes de que empiece el nuevo slot)
            const jobAntes = confirmedHoy
                .filter(tc => horaAMinutos(tc.ocupado_fin) <= inicioSlotMin)
                .sort((a, b) => horaAMinutos(b.ocupado_fin) - horaAMinutos(a.ocupado_fin))[0];

            let tiempoViaje = 30;
            if (jobAntes && jobAntes.latitud && jobAntes.longitud
                && trabajo.latitud && trabajo.longitud) {
                tiempoViaje = await obtenerTiempoViaje(
                    medioTransporte,
                    parseFloat(jobAntes.latitud), parseFloat(jobAntes.longitud),
                    parseFloat(trabajo.latitud),  parseFloat(trabajo.longitud)
                );
            }

            const hayConflicto = confirmedHoy.some(tc => {
                const tcInicioMin = horaAMinutos(tc.ocupado_inicio);
                const tcFinMin    = horaAMinutos(tc.ocupado_fin);

                if (tcFinMin <= inicioSlotMin) {
                    // Trabajo anterior: verificar que hay suficiente gap para el viaje
                    return (inicioSlotMin - tcFinMin) < tiempoViaje;
                }
                if (finSlotMin <= tcInicioMin) {
                    // Trabajo posterior: verificar buffer mínimo de 30 min para volver
                    return (tcInicioMin - finSlotMin) < 30;
                }
                // Se solapan
                return true;
            });

            logger.info({
                slot: `${slot.hora_inicio}-${slot.hora_fin}`,
                inicioSlotMin, finSlotMin, tiempoViaje, duracionMin,
                hayConflicto, confirmedHoyCount: confirmedHoy.length,
                jobAntes: jobAntes ? `${jobAntes.ocupado_inicio}-${jobAntes.ocupado_fin}` : null
            }, '[scheduling] slot con trabajos previos: evaluando conflicto');

            if (!hayConflicto) {
                // Verificar que viaje + duración caben dentro del slot
                const inicioConViaje = inicioSlotMin + tiempoViaje;
                if (inicioConViaje + duracionMin > finSlotMin) {
                    logger.info({ slot: `${slot.hora_inicio}-${slot.hora_fin}`, tiempoViaje, duracionMin, necesita: tiempoViaje + duracionMin, disponible: duracionSlot }, '[scheduling] slot descartado: viaje+duración no caben → probar siguiente slot del día');
                    continue; // probar el siguiente slot del mismo día
                }

                const resultado = _armarResultado(fechaStr, diaSemana, slot, duracionMin);
                logger.info({ tiempoViaje, duracionMin, cuando: resultado.cuando }, '[scheduling] SLOT ENCONTRADO (con trabajos confirmados ese día)');
                return resultado;
            }
            logger.info({ slot: `${slot.hora_inicio}-${slot.hora_fin}`, fechaStr }, '[scheduling] slot descartado por conflicto con trabajo confirmado');
        }
    }

    logger.info({ trabajadorId, trabajoId }, '[scheduling] No se encontró slot disponible en 60 días → retorna null');
    return null;
};

const _armarResultado = (fechaStr, diaSemana, slot, duracionMin) => {
    const horaInicio = String(slot.hora_inicio).slice(0, 5);
    const horaFin    = String(slot.hora_fin).slice(0, 5);

    // Instante real: "fechaStr horaInicio" interpretado como hora argentina
    const fechaInicio = fromZonedTime(`${fechaStr} ${horaInicio}:00`, TZ);

    // Franja que el trabajo realmente ocupa (inicio + duración) — es lo que bloquea
    // la reserva confirmada, no toda la ventana de disponibilidad
    const finOcupadoMin = Math.min(horaAMinutos(horaInicio) + duracionMin, 23 * 60 + 59);

    const partes = fechaStr.split('-');
    const cuando = `${partes[2]}/${partes[1]}/${partes[0]} de ${horaInicio} a ${horaFin}`;

    return {
        fecha_inicio: fechaInicio,
        dia_semana: diaSemana,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        hora_fin_ocupada: _minutosAHora(finOcupadoMin),
        cuando
    };
};

/**
 * Persiste el slot asignado de forma atómica:
 *   - fecha_inicio en trabajos
 *   - reserva 'confirmada' en reservas_tentativas con la franja real del trabajo,
 *     para que el detector de conflictos vea este trabajo en agendamientos futuros (fix C1)
 * Idempotente: si la oferta ya tiene reserva confirmada, la actualiza en vez de duplicar.
 */
const asignarSlotATrabajo = async (trabajadorId, trabajoId, slot) => {
    const horaFinReserva = slot.hora_fin_ocupada || slot.hora_fin;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        await client.query(
            "UPDATE trabajos SET fecha_inicio = $1, actualizado_en = NOW() WHERE id = $2",
            [slot.fecha_inicio, trabajoId]
        );

        const { rows: [oferta] } = await client.query(
            `SELECT id FROM ofertas
             WHERE trabajo_id = $1 AND trabajador_id = $2 AND estado = 'aceptada'
             ORDER BY creado_en DESC LIMIT 1`,
            [trabajoId, trabajadorId]
        );

        if (oferta) {
            const upd = await client.query(
                `UPDATE reservas_tentativas
                 SET dia_semana = $2, hora_inicio = $3, hora_fin = $4
                 WHERE oferta_id = $1 AND estado = 'confirmada'`,
                [oferta.id, slot.dia_semana, slot.hora_inicio, horaFinReserva]
            );
            if (upd.rowCount === 0) {
                await client.query(
                    `INSERT INTO reservas_tentativas
                         (oferta_id, trabajador_id, trabajo_id, dia_semana, hora_inicio, hora_fin, estado)
                     VALUES ($1, $2, $3, $4, $5, $6, 'confirmada')`,
                    [oferta.id, trabajadorId, trabajoId, slot.dia_semana, slot.hora_inicio, horaFinReserva]
                );
            }
        } else {
            logger.warn({ trabajoId, trabajadorId }, '[scheduling] Sin oferta aceptada para crear la reserva confirmada');
        }

        await client.query("COMMIT");
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
};

// Namespace de advisory locks de scheduling (evita colisiones con otros usos de locks)
const SCHED_LOCK_CLASS = 47001;

/**
 * Calcula y persiste el próximo slot serializando por trabajador con un advisory lock
 * de PostgreSQL: dos ofertas aceptadas en paralelo para el mismo trabajador no pueden
 * elegir el mismo horario (agravante de C1).
 * Retorna el slot asignado o null si no hay disponibilidad.
 */
const agendarTrabajo = async (trabajadorId, trabajoId) => {
    const lockClient = await pool.connect();
    try {
        await lockClient.query("SELECT pg_advisory_lock($1, $2)", [SCHED_LOCK_CLASS, trabajadorId]);
        const slot = await calcularProximoSlot(trabajadorId, trabajoId);
        if (!slot) return null;
        await asignarSlotATrabajo(trabajadorId, trabajoId, slot);
        return slot;
    } finally {
        try {
            await lockClient.query("SELECT pg_advisory_unlock($1, $2)", [SCHED_LOCK_CLASS, trabajadorId]);
        } catch (_) { /* la conexión se libera igual */ }
        lockClient.release();
    }
};

module.exports = { calcularProximoSlot, asignarSlotATrabajo, agendarTrabajo };
