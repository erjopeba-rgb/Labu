const { getDisponibilidad, setDisponibilidad } = require("../services/disponibilidad.service");
const {
    crearReservasTentativas,
    getReservasPorOferta,
    confirmarReserva,
    confirmarSlotDirecto,
    getReservasConfirmadasTrabajador,
    getReservasConfirmadasDueno,
    getOcupadosTrabajador
} = require("../services/reservas.service");
const AppError = require("../utils/AppError");
const { successResponse } = require("../utils/apiResponse");

const obtenerDisponibilidad = async (req, res, next) => {
    try {
        const { slots, tiempo_preparacion_minutos } = await getDisponibilidad(req.usuario.id);
        successResponse(res, { disponibilidad: slots, tiempo_preparacion_minutos });
    } catch (err) {
        next(err);
    }
};

const guardarDisponibilidad = async (req, res, next) => {
    try {
        const { slots, tiempo_preparacion_minutos } = req.body;
        if (!Array.isArray(slots)) throw new AppError("Se esperaba un array de slots", 400);

        for (const slot of slots) {
            if (slot.dia_semana === undefined || !slot.hora_inicio || !slot.hora_fin) {
                throw new AppError("Cada slot necesita dia_semana, hora_inicio y hora_fin", 400);
            }
        }

        const tiempoPrep = Number.isInteger(Number(tiempo_preparacion_minutos))
            ? Math.max(0, parseInt(tiempo_preparacion_minutos, 10))
            : 15;

        await setDisponibilidad(req.usuario.id, slots, tiempoPrep);
        successResponse(res);
    } catch (err) {
        next(err);
    }
};

const crearReservas = async (req, res, next) => {
    try {
        const { oferta_id, trabajo_id, slots } = req.body;
        if (!oferta_id || !trabajo_id || !Array.isArray(slots) || slots.length === 0) {
            throw new AppError("Faltan datos requeridos", 400);
        }
        const reservas = await crearReservasTentativas(oferta_id, req.usuario.id, trabajo_id, slots);
        successResponse(res, { reservas }, 201);
    } catch (err) {
        next(err);
    }
};

const obtenerReservasOferta = async (req, res, next) => {
    try {
        const reservas = await getReservasPorOferta(req.params.oferta_id);
        successResponse(res, { reservas });
    } catch (err) {
        next(err);
    }
};

const confirmarSlot = async (req, res, next) => {
    try {
        const { hora_inicio, hora_fin, fecha_inicio } = req.body || {};
        const reserva = await confirmarReserva(req.params.id, req.usuario.id, hora_inicio, hora_fin, fecha_inicio);
        successResponse(res, { reserva });
    } catch (err) {
        next(err);
    }
};

const obtenerReservasConfirmadas = async (req, res, next) => {
    try {
        const reservas = await getReservasConfirmadasTrabajador(req.usuario.id);
        successResponse(res, { reservas });
    } catch (err) {
        next(err);
    }
};

const obtenerDisponibilidadTrabajador = async (req, res, next) => {
    try {
        const { slots, tiempo_preparacion_minutos } = await getDisponibilidad(req.params.id);
        successResponse(res, { disponibilidad: slots, tiempo_preparacion_minutos });
    } catch (err) {
        next(err);
    }
};

const confirmarSlotDirectoCtrl = async (req, res, next) => {
    try {
        const { dia_semana, hora_inicio, hora_fin, fecha_inicio } = req.body;
        if (dia_semana === undefined || !hora_inicio || !hora_fin) {
            throw new AppError("Faltan datos del horario", 400);
        }
        const reserva = await confirmarSlotDirecto(
            req.params.oferta_id, req.usuario.id, dia_semana, hora_inicio, hora_fin, fecha_inicio
        );
        successResponse(res, { reserva });
    } catch (err) {
        next(err);
    }
};

const obtenerOcupadosTrabajador = async (req, res, next) => {
    try {
        const ocupados = await getOcupadosTrabajador(req.params.id);
        successResponse(res, { ocupados });
    } catch (err) {
        next(err);
    }
};

const obtenerReservasConfirmadasDueno = async (req, res, next) => {
    try {
        const reservas = await getReservasConfirmadasDueno(req.usuario.id);
        successResponse(res, { reservas });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    obtenerDisponibilidad,
    obtenerDisponibilidadTrabajador,
    guardarDisponibilidad,
    crearReservas,
    obtenerReservasOferta,
    confirmarSlot,
    confirmarSlotDirectoCtrl,
    obtenerReservasConfirmadas,
    obtenerReservasConfirmadasDueno,
    obtenerOcupadosTrabajador
};
