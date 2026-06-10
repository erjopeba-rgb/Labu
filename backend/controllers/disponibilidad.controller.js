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

const obtenerDisponibilidad = async (req, res) => {
    try {
        const { slots, tiempo_preparacion_minutos } = await getDisponibilidad(req.usuario.id);
        res.json({ success: true, disponibilidad: slots, tiempo_preparacion_minutos });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.error || "Error interno" });
    }
};

const guardarDisponibilidad = async (req, res) => {
    const { slots, tiempo_preparacion_minutos } = req.body;
    if (!Array.isArray(slots)) return res.status(400).json({ error: "Se esperaba un array de slots" });

    for (const slot of slots) {
        if (slot.dia_semana === undefined || !slot.hora_inicio || !slot.hora_fin) {
            return res.status(400).json({ error: "Cada slot necesita dia_semana, hora_inicio y hora_fin" });
        }
    }

    const tiempoPrep = Number.isInteger(Number(tiempo_preparacion_minutos))
        ? Math.max(0, parseInt(tiempo_preparacion_minutos, 10))
        : 15;

    try {
        await setDisponibilidad(req.usuario.id, slots, tiempoPrep);
        res.json({ success: true });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.error || "Error al guardar disponibilidad" });
    }
};

const crearReservas = async (req, res) => {
    const { oferta_id, trabajo_id, slots } = req.body;
    if (!oferta_id || !trabajo_id || !Array.isArray(slots) || slots.length === 0) {
        return res.status(400).json({ error: "Faltan datos requeridos" });
    }
    try {
        const reservas = await crearReservasTentativas(oferta_id, req.usuario.id, trabajo_id, slots);
        res.status(201).json({ success: true, reservas });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.error || "Error interno" });
    }
};

const obtenerReservasOferta = async (req, res) => {
    try {
        const reservas = await getReservasPorOferta(req.params.oferta_id);
        res.json({ success: true, reservas });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.error || "Error interno" });
    }
};

const confirmarSlot = async (req, res) => {
    const { hora_inicio, hora_fin, fecha_inicio } = req.body || {};
    try {
        const reserva = await confirmarReserva(req.params.id, req.usuario.id, hora_inicio, hora_fin, fecha_inicio);
        res.json({ success: true, reserva });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.error || "Error interno" });
    }
};

const obtenerReservasConfirmadas = async (req, res) => {
    try {
        const reservas = await getReservasConfirmadasTrabajador(req.usuario.id);
        res.json({ success: true, reservas });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.error || "Error interno" });
    }
};

const obtenerDisponibilidadTrabajador = async (req, res) => {
    try {
        const { slots, tiempo_preparacion_minutos } = await getDisponibilidad(req.params.id);
        res.json({ success: true, disponibilidad: slots, tiempo_preparacion_minutos });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.error || "Error interno" });
    }
};

const confirmarSlotDirectoCtrl = async (req, res) => {
    const { dia_semana, hora_inicio, hora_fin, fecha_inicio } = req.body;
    if (dia_semana === undefined || !hora_inicio || !hora_fin) {
        return res.status(400).json({ error: "Faltan datos del horario" });
    }
    try {
        const reserva = await confirmarSlotDirecto(
            req.params.oferta_id, req.usuario.id, dia_semana, hora_inicio, hora_fin, fecha_inicio
        );
        res.json({ success: true, reserva });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.error || err.message || "Error interno" });
    }
};

const obtenerOcupadosTrabajador = async (req, res) => {
    try {
        const ocupados = await getOcupadosTrabajador(req.params.id);
        res.json({ success: true, ocupados });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.error || "Error interno" });
    }
};

const obtenerReservasConfirmadasDueno = async (req, res) => {
    try {
        const reservas = await getReservasConfirmadasDueno(req.usuario.id);
        res.json({ success: true, reservas });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.error || "Error interno" });
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
