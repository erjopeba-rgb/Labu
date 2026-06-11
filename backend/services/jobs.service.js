const pool = require("../config/db");
const jobsRepo = require("../repositories/jobs.repository");
const notif = require("./notifications.service");
const { encolarPortfolio } = require("../workers/portfolioWorker");
const logger = require("../config/logger");
const { getLogger } = logger;
const AppError = require("../utils/AppError");
const cache = require("../config/cache");

const FEED_TTL = 60; // segundos
const FEED_CACHE_PATTERN = "cache:feed:*";
const feedKey = (params) => `cache:feed:${JSON.stringify(params)}`;

// Haversine: calcula distancia en metros entre dos coordenadas geográficas
const calcularDistanciaMetros = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const toRad = (g) => g * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const obtenerTrabajos = async ({ rubro_id, modalidad, urgente, limit = 20, offset = 0, trabajador_id = null }) => {
    const key = feedKey({ rubro_id, modalidad, urgente, limit, offset, trabajador_id });
    const cached = await cache.get(key);
    if (cached) return cached;

    const resultado = await jobsRepo.findFeed(trabajador_id, { rubro_id, modalidad, urgente }, limit, offset);
    await cache.set(key, resultado, FEED_TTL);
    return resultado;
};

const crearTrabajo = async ({ dueno_id, titulo, descripcion, rubro_id, modalidad, ciudad, provincia, presupuesto_min, presupuesto_max, es_urgente, fotosUrls, latitud, longitud }) => {
    const fotosJson = fotosUrls && fotosUrls.length > 0 ? JSON.stringify(fotosUrls) : null;

    const trabajo = await jobsRepo.insertJob({ dueno_id, titulo, descripcion, rubro_id, modalidad, ciudad, provincia, presupuesto_min, presupuesto_max, es_urgente, fotosJson, latitud, longitud });
    getLogger().info({ trabajoId: trabajo.id, duenoId: dueno_id }, 'trabajo creado');
    await cache.delPattern(FEED_CACHE_PATTERN);
    return trabajo;
};

const obtenerTrabajoPorId = async (id) => {
    const trabajo = await jobsRepo.findJobById(id);
    if (!trabajo) throw new AppError("Trabajo no encontrado", 404);
    return trabajo;
};

const obtenerMisTrabajos = async (dueno_id, limit = 20, offset = 0) => {
    return jobsRepo.findMisTrabajos(dueno_id, limit, offset);
};

// Trabajos donde el trabajador tiene una oferta aceptada (para mis-trabajos-worker.js)
const obtenerTrabajosAsignados = async (trabajador_id) => {
    return jobsRepo.findTrabajosAsignados(trabajador_id);
};

const cancelarTrabajo = async (id, dueno_id) => {
    const trabajo = await jobsRepo.cancelJob(id, dueno_id);
    if (!trabajo) throw new AppError("Trabajo no encontrado", 404);
    await cache.delPattern(FEED_CACHE_PATTERN);
    return trabajo;
};

// Paso 4→5: Trabajador confirma llegada al lugar → estado pasa directo a trabajador_llego
// latTrabajador y lonTrabajador son opcionales; si se proveen se calcula proximidad (informativo, no bloquea)
const iniciarTrabajo = async (id, trabajador_id, latTrabajador, lonTrabajador) => {
    const oferta = await jobsRepo.findOfertaAceptadaDelTrabajador(id, trabajador_id);
    if (!oferta) throw new AppError('No sos el trabajador de este trabajo', 403);

    // Gate de pago: el trabajo no puede arrancar si el dueño no pagó (la aprobación
    // viene solo de MercadoPago — webhook, pago directo o simulación en development)
    const pago = await jobsRepo.findPagoAprobadoPorTrabajo(id);
    if (!pago) throw new AppError('El dueño todavía no completó el pago de este trabajo. No podés confirmar la llegada hasta que el pago esté aprobado.', 402);

    const client = await pool.connect();
    let job;
    try {
        await client.query('BEGIN');

        // SELECT FOR UPDATE: bloquea la fila para evitar race conditions en la transición de estado
        const { rows } = await client.query(
            `SELECT id, estado, fecha_inicio FROM trabajos WHERE id = $1 FOR UPDATE`,
            [id]
        );
        const jobActual = rows[0];

        if (!jobActual) throw new AppError('Trabajo no encontrado', 404);

        // Idempotencia: si ya está en el estado destino, devolver éxito sin relanzar error
        if (jobActual.estado === 'trabajador_llego') {
            await client.query('ROLLBACK');
            const j = await jobsRepo.findJobById(id);
            return { ...j, proximidad: null }; // finally libera el client
        }

        if (jobActual.estado !== 'en_negociacion') throw new AppError('El trabajo no está en estado de negociación', 400);

        // Validación de ventana temporal: ±3 minutos respecto a fecha_inicio
        if (jobActual.fecha_inicio) {
            const ahora = Date.now();
            const inicio = new Date(jobActual.fecha_inicio).getTime();
            const TRES_MINUTOS = 3 * 60 * 1000;
            if (ahora < inicio - TRES_MINUTOS || ahora > inicio + TRES_MINUTOS) {
                throw new AppError('Fuera del horario de confirmación', 400);
            }
        }

        job = await jobsRepo.setTrabajadorLlego(id, client);
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }

    try {
        await notif.notificarTrabajadorLlego(job.dueno_id, job.titulo, job.id, job.hora_inicio_real);
    } catch (e) {
        logger.error({ trabajoId: id, err: e.message }, 'Error enviando notificación trabajador llegó');
    }

    // Validación de proximidad — informativa, nunca bloquea el request
    let proximidad = null;
    const latJob = job.latitud  != null ? Number(job.latitud)  : null;
    const lonJob = job.longitud != null ? Number(job.longitud) : null;
    const latW   = latTrabajador  != null ? Number(latTrabajador)  : null;
    const lonW   = lonTrabajador  != null ? Number(lonTrabajador)  : null;

    if (latJob !== null && lonJob !== null && latW !== null && lonW !== null) {
        const distanciaMetros = Math.round(calcularDistanciaMetros(latJob, lonJob, latW, lonW));
        proximidad = { dentroDelRadio: distanciaMetros <= 500, distanciaMetros };
    }

    return { ...job, proximidad };
};

// Paso 6: Trabajador termina el trabajo, sube foto → dueño recibe notif con foto
const marcarCompletado = async (id, trabajador_id, fotoResultadoUrl, textoResultado) => {
    const oferta = await jobsRepo.findOfertaAceptadaDelTrabajador(id, trabajador_id);
    if (!oferta) throw new AppError('No sos el trabajador de este trabajo', 403);

    const job = await jobsRepo.setPendienteConfirmacion(id, fotoResultadoUrl, textoResultado);
    if (!job) throw new AppError('El trabajo no puede marcarse como completado en su estado actual', 400);

    try {
        await notif.notificarResultadoSubido(job.dueno_id, job.titulo, job.id);
    } catch (e) {
        logger.error({ trabajoId: id, err: e.message }, 'Error enviando notificación resultado subido');
    }

    return job;
};

// Paso 7→8→9: Dueño confirma que el trabajo está correcto → auto-portfolio + notif calificación
const confirmarCompletado = async (id, dueno_id) => {
    const client = await pool.connect();
    let job;
    let distribucionesLiberadas = 0;
    try {
        await client.query('BEGIN');

        // SELECT FOR UPDATE: bloquea la fila para evitar doble confirmación concurrente
        const { rows } = await client.query(
            `SELECT id, estado FROM trabajos WHERE id = $1 AND dueno_id = $2 FOR UPDATE`,
            [id, dueno_id]
        );
        const jobActual = rows[0];

        if (!jobActual) throw new AppError('Trabajo no encontrado o no tenés permiso', 404);

        // Idempotencia: si ya está completado, devolver éxito sin relanzar error
        if (jobActual.estado === 'completado') {
            await client.query('ROLLBACK');
            return await jobsRepo.findJobById(id); // finally libera el client
        }

        if (jobActual.estado !== 'pendiente_confirmacion') throw new AppError('El trabajo no está pendiente de confirmación', 400);

        job = await jobsRepo.setCompletado(id, dueno_id, client);

        // Paso 8a: Liberar el dinero retenido — las distribuciones del pago aprobado
        // pasan a 'procesado' (saldo disponible del trabajador) en la misma transacción
        distribucionesLiberadas = await jobsRepo.liberarDistribucionesPorTrabajo(id, client);

        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }

    if (distribucionesLiberadas === 0) {
        logger.warn({ trabajoId: id }, 'Trabajo completado sin distribuciones pendientes para liberar');
    } else {
        getLogger().info({ trabajoId: id, distribuciones: distribucionesLiberadas }, 'pago liberado al completar trabajo');
    }

    // Encontrar al trabajador y monto acordado (para portfolio y notificaciones)
    const oferta = await jobsRepo.findOfertaAceptadaConMonto(id);

    // Pasos 8b+8c: Auto-crear portfolio en segundo plano (desacoplado vía cola)
    await encolarPortfolio(job, oferta, dueno_id);

    // Paso 9: Notificar a ambos para calificarse
    try {
        await notif.notificarPedirCalificacion(dueno_id, job.titulo, job.id);
        if (oferta) await notif.notificarPedirCalificacion(oferta.trabajador_id, job.titulo, job.id);
    } catch (e) {
        logger.error({ trabajoId: id, err: e.message }, 'Error enviando notificación calificación');
    }

    getLogger().info({ trabajoId: id, duenoId: dueno_id }, 'trabajo completado');
    return job;
};

// Trabajos donde ambos usuarios están involucrados (dueño + trabajador)
const obtenerTrabajosConUsuario = async (miId, otroId) => {
    return jobsRepo.findTrabajosConUsuario(miId, otroId);
};

// Actualizar fecha_inicio de un trabajo (agendar cita)
const agendarTrabajo = async (jobId, usuarioId, fechaInicio) => {
    const job = await jobsRepo.findJobParaAgendar(jobId, usuarioId);
    if (!job) throw new AppError('No tenés permiso para agendar este trabajo', 403);

    return jobsRepo.updateFechaInicio(jobId, fechaInicio);
};

const agregarComentario = async (trabajoId, usuarioId, contenido) => {
    const job = await jobsRepo.findJobExists(trabajoId);
    if (!job) throw new AppError('Trabajo no encontrado', 404);

    const comentario = await jobsRepo.insertComentario(trabajoId, usuarioId, contenido);

    // Adjuntar datos del usuario al comentario retornado
    const perfil = await jobsRepo.findPerfilUsuario(usuarioId);
    return { ...comentario, ...perfil };
};

const obtenerComentarios = async (trabajoId) => {
    return jobsRepo.findComentarios(trabajoId);
};

module.exports = {
    obtenerTrabajos,
    crearTrabajo,
    obtenerTrabajoPorId,
    obtenerMisTrabajos,
    obtenerTrabajosAsignados,
    obtenerTrabajosConUsuario,
    agendarTrabajo,
    cancelarTrabajo,
    iniciarTrabajo,
    marcarCompletado,
    confirmarCompletado,
    agregarComentario,
    obtenerComentarios
};
