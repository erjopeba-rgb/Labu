const pool = require("../config/db");
const notif = require("./notifications.service");
const logger = require("../config/logger");
const AppError = require("../utils/AppError");

const crearReservasTentativas = async (oferta_id, trabajador_id, trabajo_id, slots) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Verificar pertenencia dentro de la transacción para evitar TOCTOU
        const { rows: [oferta] } = await client.query(
            "SELECT id FROM ofertas WHERE id = $1 AND trabajador_id = $2",
            [oferta_id, trabajador_id]
        );
        if (!oferta) throw new AppError("No autorizado", 403);

        await client.query(
            "DELETE FROM reservas_tentativas WHERE oferta_id = $1 AND estado = 'tentativa'",
            [oferta_id]
        );
        let reservas = [];
        if (slots.length > 0) {
            const dias        = slots.map(s => s.dia_semana);
            const horasInicio = slots.map(s => s.hora_inicio);
            const horasFin    = slots.map(s => s.hora_fin);
            const res = await client.query(
                `INSERT INTO reservas_tentativas (oferta_id, trabajador_id, trabajo_id, dia_semana, hora_inicio, hora_fin)
                 SELECT $1, $2, $3, UNNEST($4::int[]), UNNEST($5::time[]), UNNEST($6::time[])
                 RETURNING *`,
                [oferta_id, trabajador_id, trabajo_id, dias, horasInicio, horasFin]
            );
            reservas = res.rows;
        }
        await client.query("COMMIT");
        return reservas;
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
};

const getReservasPorOferta = async (oferta_id) => {
    const res = await pool.query(
        `SELECT * FROM reservas_tentativas
         WHERE oferta_id = $1 AND estado = 'tentativa'
         ORDER BY dia_semana, hora_inicio`,
        [oferta_id]
    );
    return res.rows;
};

// Dueño elige un slot de los propuestos por el trabajador → confirma, libera el resto, acepta oferta
const confirmarReserva = async (reserva_id, dueno_id, hora_inicio_elegida, hora_fin_elegida, fecha_inicio) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const reservaRes = await client.query(
            `SELECT rt.*, o.trabajo_id as job_id
             FROM reservas_tentativas rt
             JOIN ofertas o ON rt.oferta_id = o.id
             WHERE rt.id = $1`,
            [reserva_id]
        );
        if (reservaRes.rows.length === 0) throw new AppError("Reserva no encontrada", 404);

        const reserva = reservaRes.rows[0];

        const jobRes = await client.query(
            "SELECT id, titulo FROM trabajos WHERE id = $1 AND dueno_id = $2",
            [reserva.job_id, dueno_id]
        );
        if (jobRes.rows.length === 0) throw new AppError("No autorizado", 403);

        if (hora_inicio_elegida && hora_fin_elegida) {
            await client.query(
                "UPDATE reservas_tentativas SET estado = 'confirmada', hora_inicio = $2, hora_fin = $3 WHERE id = $1",
                [reserva_id, hora_inicio_elegida, hora_fin_elegida]
            );
        } else {
            await client.query(
                "UPDATE reservas_tentativas SET estado = 'confirmada' WHERE id = $1",
                [reserva_id]
            );
        }
        await client.query(
            "UPDATE reservas_tentativas SET estado = 'liberada' WHERE oferta_id = $1 AND id != $2 AND estado = 'tentativa'",
            [reserva.oferta_id, reserva_id]
        );
        await client.query(
            "UPDATE ofertas SET estado = 'aceptada' WHERE id = $1",
            [reserva.oferta_id]
        );
        await client.query(
            "UPDATE trabajos SET estado = 'en_negociacion', fecha_inicio = COALESCE($2, fecha_inicio) WHERE id = $1",
            [reserva.job_id, fecha_inicio || null]
        );

        await client.query("COMMIT");

        const hiUse = hora_inicio_elegida || reserva.hora_inicio;
        const hfUse = hora_fin_elegida || reserva.hora_fin;
        const cuando = _formatearCuando(reserva.dia_semana, hiUse, hfUse, fecha_inicio);

        try {
            await notif.notificarHorarioElegido(
                reserva.trabajador_id,
                reserva.dia_semana,
                hiUse,
                hfUse,
                jobRes.rows[0].titulo,
                reserva.job_id,
                fecha_inicio
            );
        } catch (e) {
            logger.error({ err: e.message }, 'Error enviando notificación horario elegido');
        }
        try {
            await notif.notificarAgendaConfirmadaDueno(
                dueno_id,
                jobRes.rows[0].titulo,
                cuando,
                reserva.job_id
            );
        } catch (e) {
            logger.error({ err: e.message }, 'Error enviando notificación agenda dueño');
        }

        return reserva;
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
};

// Dueño elige un slot de la disponibilidad semanal del trabajador (sin reservas previas)
const confirmarSlotDirecto = async (oferta_id, dueno_id, dia_semana, hora_inicio, hora_fin, fecha_inicio) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const ofertaRes = await client.query(
            `SELECT o.*, t.dueno_id, t.titulo, t.id AS trabajo_id
             FROM ofertas o JOIN trabajos t ON o.trabajo_id = t.id
             WHERE o.id = $1`,
            [oferta_id]
        );
        if (ofertaRes.rows.length === 0) throw new AppError("Oferta no encontrada", 404);
        const oferta = ofertaRes.rows[0];
        if (oferta.dueno_id !== dueno_id) throw new AppError("No autorizado", 403);

        await client.query(
            "UPDATE reservas_tentativas SET estado = 'liberada' WHERE oferta_id = $1 AND estado = 'tentativa'",
            [oferta_id]
        );
        await client.query(
            `INSERT INTO reservas_tentativas (oferta_id, trabajador_id, trabajo_id, dia_semana, hora_inicio, hora_fin, estado)
             VALUES ($1, $2, $3, $4, $5, $6, 'confirmada')`,
            [oferta_id, oferta.trabajador_id, oferta.trabajo_id, dia_semana, hora_inicio, hora_fin]
        );
        await client.query("UPDATE ofertas SET estado = 'aceptada' WHERE id = $1", [oferta_id]);
        await client.query(
            "UPDATE trabajos SET estado = 'en_negociacion', fecha_inicio = COALESCE($2, fecha_inicio) WHERE id = $1",
            [oferta.trabajo_id, fecha_inicio || null]
        );

        await client.query("COMMIT");

        const cuando = _formatearCuando(dia_semana, hora_inicio, hora_fin, fecha_inicio);

        try {
            await notif.notificarHorarioElegido(
                oferta.trabajador_id, dia_semana, hora_inicio, hora_fin,
                oferta.titulo, oferta.trabajo_id, fecha_inicio
            );
        } catch (e) {
            logger.error({ err: e.message }, 'Error enviando notificación horario elegido');
        }
        try {
            await notif.notificarAgendaConfirmadaDueno(
                dueno_id, oferta.titulo, cuando, oferta.trabajo_id
            );
        } catch (e) {
            logger.error({ err: e.message }, 'Error enviando notificación agenda dueño');
        }

        return { oferta_id, dia_semana, hora_inicio, hora_fin };
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
};

// Libera todos los slots tentativas de una oferta (al rechazar).
// Acepta un clienteExterno para participar en una transacción mayor.
const liberarReservasPorOferta = async (oferta_id, clienteExterno = null) => {
    const query = "UPDATE reservas_tentativas SET estado = 'liberada' WHERE oferta_id = $1 AND estado = 'tentativa'";
    if (clienteExterno) {
        await clienteExterno.query(query, [oferta_id]);
        return;
    }
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(query, [oferta_id]);
        await client.query("COMMIT");
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
};

// Slots confirmados del trabajador (para saber qué horas ya están ocupadas)
const getOcupadosTrabajador = async (trabajador_id) => {
    const res = await pool.query(
        `SELECT rt.dia_semana, rt.hora_inicio, rt.hora_fin
         FROM reservas_tentativas rt
         JOIN trabajos t ON rt.trabajo_id = t.id
         WHERE rt.trabajador_id = $1
           AND rt.estado = 'confirmada'
           AND t.estado IN ('en_negociacion', 'en_curso', 'trabajador_llego', 'pendiente_confirmacion')`,
        [trabajador_id]
    );
    return res.rows;
};

// Reservas confirmadas del trabajador (para su agenda)
const getReservasConfirmadasTrabajador = async (trabajador_id) => {
    const res = await pool.query(
        `SELECT rt.*, t.titulo as trabajo_titulo, t.dueno_id, t.fecha_inicio,
                p.nombre as dueno_nombre, p.apellido as dueno_apellido
         FROM reservas_tentativas rt
         JOIN trabajos t ON rt.trabajo_id = t.id
         LEFT JOIN perfiles p ON t.dueno_id = p.usuario_id
         WHERE rt.trabajador_id = $1 AND rt.estado = 'confirmada'
         ORDER BY rt.dia_semana, rt.hora_inicio`,
        [trabajador_id]
    );
    return res.rows;
};

// Reservas confirmadas del dueño (para su agenda)
const getReservasConfirmadasDueno = async (dueno_id) => {
    const res = await pool.query(
        `SELECT rt.*, t.titulo as trabajo_titulo, t.fecha_inicio,
                p.nombre as trabajador_nombre, p.apellido as trabajador_apellido
         FROM reservas_tentativas rt
         JOIN trabajos t ON rt.trabajo_id = t.id
         LEFT JOIN perfiles p ON rt.trabajador_id = p.usuario_id
         WHERE t.dueno_id = $1 AND rt.estado = 'confirmada'
         ORDER BY rt.dia_semana, rt.hora_inicio`,
        [dueno_id]
    );
    return res.rows;
};

// Helper privado: formatea string legible de cuándo ocurre el slot
const _formatearCuando = (dia_semana, hora_inicio, hora_fin, fecha_inicio) => {
    const fmt = (h) => h ? String(h).slice(0, 5) : '';
    const fechaStr = fecha_inicio ? String(fecha_inicio).substring(0, 10) : null;
    if (fechaStr) {
        const [y, m, d] = fechaStr.split('-');
        return `${d}/${m}/${y} de ${fmt(hora_inicio)} a ${fmt(hora_fin)}`;
    }
    const DIAS_N = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    return `${DIAS_N[dia_semana] ?? 'el día acordado'} de ${fmt(hora_inicio)} a ${fmt(hora_fin)}`;
};

module.exports = {
    crearReservasTentativas,
    getReservasPorOferta,
    confirmarReserva,
    confirmarSlotDirecto,
    liberarReservasPorOferta,
    getOcupadosTrabajador,
    getReservasConfirmadasTrabajador,
    getReservasConfirmadasDueno
};
