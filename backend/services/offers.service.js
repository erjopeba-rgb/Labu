const pool = require("../config/db");
const offersRepo = require("../repositories/offers.repository");
const { liberarReservasPorOferta } = require("./reservas.service");
const { encolarAgendamiento } = require("../workers/osrmWorker");
const { crearPreferenciaTrabajo, getConfig: getConfigPagos } = require("./pagos.service");
const notif = require("./notifications.service");
const logger = require("../config/logger");
const { getLogger } = logger;
const AppError = require("../utils/AppError");
const cache = require("../config/cache");

const FEED_CACHE_PATTERN = "cache:feed:*";

// Paso 2: Trabajador envía oferta → dueño recibe notificación
const crearOferta = async ({ trabajo_id, trabajador_id, monto_propuesto, mensaje, tiempo_estimado, unidad_tiempo, hora_inicio_propuesta, hora_fin_propuesta }) => {
    const trabajo = await offersRepo.findTrabajoPublicado(trabajo_id);
    if (!trabajo) throw new AppError("Trabajo no encontrado o no disponible", 404);
    if (trabajo.dueno_id === trabajador_id) throw new AppError("No podés ofertar en tu propio trabajo", 400);

    // Validar que el trabajador tiene medio de transporte configurado
    const perfil = await offersRepo.findPerfilTrabajador(trabajador_id);
    if (!perfil || !perfil.medio_transporte) {
        throw new AppError("Completá tu perfil: agregá tu medio de transporte", 400);
    }

    const oferta = await offersRepo.insertOferta({ trabajo_id, trabajador_id, monto_propuesto, mensaje, tiempo_estimado, unidad_tiempo, hora_inicio_propuesta, hora_fin_propuesta });
    getLogger().info({ ofertaId: oferta.id, trabajoId: trabajo_id, trabajadorId: trabajador_id }, 'oferta creada');

    try {
        const p = await offersRepo.findPerfilTrabajador(trabajador_id);
        const nombre = p ? `${p.nombre}${p.apellido ? ' ' + p.apellido : ''}` : 'Un trabajador';
        await notif.notificarOfertaRecibida(trabajo.dueno_id, nombre, trabajo.titulo, oferta.id);
    } catch (e) {
        logger.error({ ofertaId: oferta.id, err: e.message }, 'Error enviando notificación oferta recibida');
    }

    return oferta;
};

const obtenerOfertasPorTrabajo = async (trabajo_id) => {
    return offersRepo.findOfertasPorTrabajo(trabajo_id);
};

// Paso 3a: Dueño acepta oferta directamente (sin slot) → notifica trabajador
const aceptarOferta = async (id, dueno_id) => {
    // Verificar que MercadoPago está configurado antes de aceptar (omitir en tests)
    if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development') {
        const mpToken = await getConfigPagos('mp_access_token');
        if (!mpToken) throw new AppError('El procesador de pagos no está configurado. No se pueden aceptar ofertas hasta que se configure MercadoPago en la plataforma.', 503);
    } else if (process.env.NODE_ENV === 'development') {
        const mpToken = await getConfigPagos('mp_access_token').catch(() => null);
        if (!mpToken) getLogger().warn('MercadoPago token no configurado en development — el pago no se procesará');
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const oferta = await offersRepo.findOfertaParaAceptar(id, dueno_id, client);
        if (!oferta) throw new AppError("Oferta no encontrada o no tenés permiso para aceptarla", 404);

        await offersRepo.updateOfertaAceptada(id, client);
        await offersRepo.updateTrabajoEnNegociacion(oferta.trabajo_id, client);

        // Rechazar automáticamente todas las demás ofertas pendientes del mismo trabajo
        const rechazadas = await offersRepo.rechazarOtrasOfertas(oferta.trabajo_id, id, client);

        await client.query("COMMIT");

        try { await cache.delPattern(FEED_CACHE_PATTERN); } catch (e) {
            logger.warn({ err: e.message }, '[cache] Error invalidando cache del feed al aceptar oferta');
        }

        // Liberar reservas tentativas de las ofertas rechazadas automáticamente
        for (const o of rechazadas) {
            try { await liberarReservasPorOferta(o.id); } catch (e) { /* no crítico */ }
        }

        let tituloTrabajo = null;
        try {
            const info = await offersRepo.findTituloTrabajo(oferta.trabajo_id);
            tituloTrabajo = info?.titulo || null;
            if (info) await notif.notificarOfertaAceptada(oferta.trabajador_id, info.titulo, oferta.trabajo_id);
        } catch (e) {
            logger.error({ ofertaId: id, err: e.message }, 'Error enviando notificación oferta aceptada');
        }

        // Iniciar pago automáticamente al aceptar la oferta
        let init_point = null;
        try {
            const pref = await crearPreferenciaTrabajo({
                trabajoId: oferta.trabajo_id,
                pagadorId: dueno_id,
                montoTotal: parseFloat(oferta.monto_propuesto),
                conSeguro: false
            });
            init_point = pref?.init_point || null;
            getLogger().info({ trabajoId: oferta.trabajo_id, monto: oferta.monto_propuesto }, 'preferencia de pago creada al aceptar oferta');
        } catch (e) {
            logger.error({ ofertaId: id, trabajoId: oferta.trabajo_id, err: e.message }, 'Error iniciando pago al aceptar oferta');
            try {
                if (tituloTrabajo) await notif.notificarPagoPendiente(dueno_id, tituloTrabajo, oferta.trabajo_id);
            } catch (_) { /* no crítico */ }
        }

        // Calcular horario en segundo plano — resultado llega vía notificación in-app
        encolarAgendamiento({
            trabajadorId: oferta.trabajador_id,
            trabajoId:    oferta.trabajo_id,
            duenoId:      dueno_id,
            tituloTrabajo: tituloTrabajo,
        }).catch((e) => logger.error({ ofertaId: id, err: e.message }, 'Error encolando agendamiento'));

        getLogger().info({ ofertaId: id, trabajoId: oferta.trabajo_id, trabajadorId: oferta.trabajador_id }, 'oferta aceptada');
        return { cuando: null, init_point };
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
};

// Paso 3b: Dueño rechaza oferta → notifica al trabajador
const rechazarOferta = async (id, dueno_id) => {
    const info = await offersRepo.findOfertaConTrabajo(id);
    if (!info || info.dueno_id !== dueno_id) throw new AppError('No autorizado', 403);

    await offersRepo.rechazarOfertaByDueno(id, dueno_id);
    await liberarReservasPorOferta(id);

    try {
        await notif.notificarOfertaRechazada(info.trabajador_id, info.titulo, info.trabajo_id);
    } catch (e) {
        logger.error({ ofertaId: id, err: e.message }, 'Error enviando notificación oferta rechazada');
    }
};

const obtenerMisOfertas = async (trabajador_id, limit = 20, offset = 0) => {
    return offersRepo.findMisOfertas(trabajador_id, limit, offset);
};

const cancelarOferta = async (id, trabajador_id) => {
    const deleted = await offersRepo.deleteOferta(id, trabajador_id);
    if (!deleted) throw new AppError("Oferta no encontrada o ya procesada", 404);
};

// Paso 3c: Dueño contraoferta → notifica al trabajador
const contraofertar = async ({ id, dueno_id, monto_contraoferta, mensaje_contraoferta }) => {
    const oferta = await offersRepo.updateContraoferta(id, dueno_id, monto_contraoferta, mensaje_contraoferta);
    if (!oferta) throw new AppError("Oferta no encontrada", 404);

    try {
        const trabajo = await offersRepo.findTituloTrabajo(oferta.trabajo_id);
        await notif.notificarContraofertaRecibida(
            oferta.trabajador_id,
            monto_contraoferta,
            trabajo?.titulo || 'un trabajo',
            oferta.id
        );
    } catch (e) {
        logger.error({ ofertaId: oferta.id, err: e.message }, 'Error enviando notificación contraoferta');
    }

    return oferta;
};

// Paso 3c: Trabajador acepta contraoferta → dueño recibe notif para elegir horario
const aceptarContraoferta = async (id, trabajador_id) => {
    // Verificar que MercadoPago está configurado antes de aceptar (omitir en tests)
    if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development') {
        const mpToken = await getConfigPagos('mp_access_token');
        if (!mpToken) throw new AppError('El procesador de pagos no está configurado. No se pueden aceptar ofertas hasta que se configure MercadoPago en la plataforma.', 503);
    } else if (process.env.NODE_ENV === 'development') {
        const mpToken = await getConfigPagos('mp_access_token').catch(() => null);
        if (!mpToken) getLogger().warn('MercadoPago token no configurado en development — el pago no se procesará');
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const oferta = await offersRepo.findOfertaParaContraoferta(id, trabajador_id, client);
        if (!oferta) throw new AppError('Contraoferta no encontrada', 404);

        await offersRepo.updateOfertaAceptada(id, client);
        await offersRepo.updateTrabajoEnNegociacion(oferta.trabajo_id, client);

        await client.query("COMMIT");

        try { await cache.delPattern(FEED_CACHE_PATTERN); } catch (e) {
            logger.warn({ err: e.message }, '[cache] Error invalidando cache del feed al aceptar contraoferta');
        }

        try {
            await notif.notificarContraofertaAceptada(oferta.dueno_id, oferta.titulo, oferta.t_id);
        } catch (e) {
            logger.error({ ofertaId: id, err: e.message }, 'Error enviando notificación contraoferta aceptada');
        }

        // Iniciar pago automáticamente al aceptar la contraoferta
        try {
            const montoContraoferta = parseFloat(oferta.monto_contraoferta || oferta.monto_propuesto);
            await crearPreferenciaTrabajo({
                trabajoId: oferta.t_id,
                pagadorId: oferta.dueno_id,
                montoTotal: montoContraoferta,
                conSeguro: false
            });
            getLogger().info({ trabajoId: oferta.t_id, monto: montoContraoferta }, 'preferencia de pago creada al aceptar contraoferta');
        } catch (e) {
            logger.error({ ofertaId: id, trabajoId: oferta.t_id, err: e.message }, 'Error iniciando pago al aceptar contraoferta');
            try {
                if (oferta.titulo) await notif.notificarPagoPendiente(oferta.dueno_id, oferta.titulo, oferta.t_id);
            } catch (_) { /* no crítico */ }
        }

        // Calcular horario en segundo plano — resultado llega vía notificación in-app
        encolarAgendamiento({
            trabajadorId: oferta.trabajador_id,
            trabajoId:    oferta.t_id,
            duenoId:      oferta.dueno_id,
            tituloTrabajo: oferta.titulo,
        }).catch((e) => logger.error({ ofertaId: id, err: e.message }, 'Error encolando agendamiento (contraoferta)'));

        return { cuando: null };
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
};

// Paso 3c: Trabajador rechaza contraoferta → dueño recibe notif
const rechazarContraoferta = async (id, trabajador_id) => {
    const oferta = await offersRepo.findOfertaParaContraoferta(id, trabajador_id, pool);
    if (!oferta) throw new AppError('Contraoferta no encontrada', 404);

    await offersRepo.rechazarOfertaById(id);
    await liberarReservasPorOferta(id);

    try {
        await notif.notificarContraofertaRechazada(oferta.dueno_id, oferta.titulo, oferta.t_id);
    } catch (e) {
        logger.error({ ofertaId: id, err: e.message }, 'Error enviando notificación contraoferta rechazada');
    }
};

// Detalle de una oferta con datos del trabajo y el trabajador (para modales de notificación)
const obtenerOfertaConDetalle = async (ofertaId) => {
    const oferta = await offersRepo.findOfertaConDetalle(ofertaId);
    if (!oferta) throw new AppError('Oferta no encontrada', 404);
    return oferta;
};

module.exports = {
    crearOferta,
    obtenerOfertasPorTrabajo,
    obtenerOfertaConDetalle,
    aceptarOferta,
    rechazarOferta,
    obtenerMisOfertas,
    cancelarOferta,
    contraofertar,
    aceptarContraoferta,
    rechazarContraoferta
};
