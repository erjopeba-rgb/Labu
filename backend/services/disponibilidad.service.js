const repo = require("../repositories/disponibilidad.repository");

const getDisponibilidad = async (trabajador_id) => {
    const slots = await repo.findByTrabajador(trabajador_id);
    return {
        slots,
        tiempo_preparacion_minutos: slots[0]?.tiempo_preparacion_minutos ?? 15
    };
};

const setDisponibilidad = (trabajador_id, slots, tiempo_preparacion_minutos = 15) =>
    repo.replaceSlots(trabajador_id, slots, tiempo_preparacion_minutos);

module.exports = { getDisponibilidad, setDisponibilidad };
