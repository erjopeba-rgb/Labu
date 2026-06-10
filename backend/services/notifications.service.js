const { crearNotificacion } = require('./chat.service');

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const fmt = (hora) => hora ? String(hora).slice(0, 5) : '';

// Paso 2: Dueño recibe nueva oferta
const notificarOfertaRecibida = async (duenoId, trabajadorNombre, trabajoTitulo, ofertaId) => {
    await crearNotificacion({
        usuarioId: duenoId,
        tipo: 'oferta_recibida',
        titulo: 'Nueva oferta recibida',
        mensaje: `${trabajadorNombre} ofertó para "${trabajoTitulo}"`,
        referenciaTipo: 'oferta',
        referenciaId: ofertaId
    });
};

// Paso 3a: Trabajador recibe notificación cuando su oferta es ACEPTADA
const notificarOfertaAceptada = async (trabajadorId, trabajoTitulo, trabajoId) => {
    await crearNotificacion({
        usuarioId: trabajadorId,
        tipo: 'oferta_aceptada',
        titulo: 'Tu oferta fue aceptada',
        mensaje: `Tu oferta fue aceptada para "${trabajoTitulo}". El dueño elegirá un horario.`,
        referenciaTipo: 'trabajo',
        referenciaId: trabajoId
    });
};

// Paso 3b: Trabajador recibe notificación cuando su oferta es RECHAZADA
const notificarOfertaRechazada = async (trabajadorId, trabajoTitulo, trabajoId) => {
    await crearNotificacion({
        usuarioId: trabajadorId,
        tipo: 'oferta_rechazada',
        titulo: 'Tu oferta fue rechazada',
        mensaje: `El dueño rechazó tu oferta para "${trabajoTitulo}"`,
        referenciaTipo: 'trabajo',
        referenciaId: trabajoId
    });
};

// Paso 3c: Trabajador recibe notificación de CONTRAOFERTA del dueño
const notificarContraofertaRecibida = async (trabajadorId, monto, trabajoTitulo, ofertaId) => {
    await crearNotificacion({
        usuarioId: trabajadorId,
        tipo: 'contraoferta_recibida',
        titulo: 'El dueño hizo una contraoferta',
        mensaje: `Nueva contraoferta de $${Number(monto).toLocaleString('es-AR')} para "${trabajoTitulo}". Podés aceptar o rechazar.`,
        referenciaTipo: 'oferta',
        referenciaId: ofertaId
    });
};

// Paso 3c: Dueño recibe notificación cuando trabajador RECHAZA la contraoferta
const notificarContraofertaRechazada = async (duenoId, trabajoTitulo, trabajoId) => {
    await crearNotificacion({
        usuarioId: duenoId,
        tipo: 'contraoferta_rechazada',
        titulo: 'Contraoferta rechazada',
        mensaje: `El trabajador rechazó tu contraoferta para "${trabajoTitulo}"`,
        referenciaTipo: 'trabajo',
        referenciaId: trabajoId
    });
};

// Paso 3c: Dueño recibe notificación cuando trabajador ACEPTA la contraoferta → debe elegir horario
const notificarContraofertaAceptada = async (duenoId, trabajoTitulo, trabajoId) => {
    await crearNotificacion({
        usuarioId: duenoId,
        tipo: 'contraoferta_aceptada',
        titulo: 'Contraoferta aceptada',
        mensaje: `El trabajador aceptó tu contraoferta para "${trabajoTitulo}". Ahora elegí un horario.`,
        referenciaTipo: 'trabajo',
        referenciaId: trabajoId
    });
};

// Paso 4: Trabajador recibe notificación cuando dueño elige horario
const notificarHorarioElegido = async (trabajadorId, diaSemana, horaInicio, horaFin, trabajoTitulo, trabajoId, fechaInicio) => {
    const dia = DIAS[diaSemana] ?? `Día ${diaSemana}`;
    let cuando;
    if (fechaInicio) {
        const partes = String(fechaInicio).substring(0, 10).split('-');
        cuando = `${partes[2]}/${partes[1]}/${partes[0]} de ${fmt(horaInicio)} a ${fmt(horaFin)}`;
    } else {
        cuando = `${dia} de ${fmt(horaInicio)} a ${fmt(horaFin)}`;
    }
    await crearNotificacion({
        usuarioId: trabajadorId,
        tipo: 'horario_elegido',
        titulo: 'El dueño eligió un horario',
        mensaje: `Trabajo "${trabajoTitulo}" agendado para el ${cuando}. Presentate el día acordado.`,
        referenciaTipo: 'trabajo',
        referenciaId: trabajoId
    });
};

// Paso 4: Dueño recibe confirmación de que el trabajo quedó agendado
const notificarAgendaConfirmadaDueno = async (duenoId, trabajoTitulo, cuando, trabajoId) => {
    await crearNotificacion({
        usuarioId: duenoId,
        tipo: 'agenda_confirmada',
        titulo: 'Trabajo agendado en tu calendario',
        mensaje: `"${trabajoTitulo}" quedó agendado para el ${cuando}.`,
        referenciaTipo: 'trabajo',
        referenciaId: trabajoId
    });
};

// Paso 4→5: Dueño recibe confirmación cuando trabajador confirma inicio
const notificarHorarioConfirmado = async (duenoId, diaSemana, horaInicio, trabajoTitulo, trabajoId) => {
    const dia = diaSemana !== null && diaSemana !== undefined ? (DIAS[diaSemana] ?? `Día ${diaSemana}`) : null;
    const horario = dia && horaInicio ? ` para el ${dia} a las ${fmt(horaInicio)}` : '';
    await crearNotificacion({
        usuarioId: duenoId,
        tipo: 'horario_confirmado',
        titulo: 'Trabajador confirmó el trabajo',
        mensaje: `El trabajador confirmó el trabajo${horario} — "${trabajoTitulo}". Confirmá su llegada el día acordado.`,
        referenciaTipo: 'trabajo',
        referenciaId: trabajoId
    });
};

// Paso 5 (nuevo): Dueño recibe notificación cuando el trabajador confirma su llegada al lugar
const notificarTrabajadorLlego = async (duenoId, trabajoTitulo, trabajoId, horaInicioReal) => {
    let hora = '';
    if (horaInicioReal) {
        const d = new Date(horaInicioReal);
        hora = ` a las ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    await crearNotificacion({
        usuarioId: duenoId,
        tipo: 'trabajador_llego',
        titulo: 'El trabajador llegó',
        mensaje: `El trabajador confirmó que llegó${hora} al trabajo "${trabajoTitulo}". El trabajo está en curso.`,
        referenciaTipo: 'trabajo',
        referenciaId: trabajoId
    });
};

// Paso 5: Trabajador recibe notificación cuando dueño confirma su llegada
const notificarLlegadaConfirmada = async (trabajadorId, trabajoTitulo, trabajoId) => {
    await crearNotificacion({
        usuarioId: trabajadorId,
        tipo: 'llegada_confirmada',
        titulo: 'El dueño confirmó tu llegada',
        mensaje: `El dueño confirmó que llegaste al trabajo "${trabajoTitulo}". ¡Completalo y subí una foto del resultado!`,
        referenciaTipo: 'trabajo',
        referenciaId: trabajoId
    });
};

// Paso 6→7: Dueño recibe notificación con la foto del resultado
const notificarResultadoSubido = async (duenoId, trabajoTitulo, trabajoId) => {
    await crearNotificacion({
        usuarioId: duenoId,
        tipo: 'resultado_subido',
        titulo: 'El trabajador terminó el trabajo',
        mensaje: `El trabajador terminó el trabajo "${trabajoTitulo}". Confirmá para cerrar y liberar el pago.`,
        referenciaTipo: 'trabajo',
        referenciaId: trabajoId
    });
};

// Paso 7→8 (legacy, kept for compatibility): Dueño recibe notificación de trabajo pendiente confirmación
const notificarTrabajoCompletadoPendiente = async (duenoId, trabajoTitulo, trabajoId) => {
    await crearNotificacion({
        usuarioId: duenoId,
        tipo: 'trabajo_completado_pendiente',
        titulo: 'El trabajador terminó el trabajo',
        mensaje: `El trabajador dice que terminó "${trabajoTitulo}". Revisá la foto y confirmá para cerrar.`,
        referenciaTipo: 'trabajo',
        referenciaId: trabajoId
    });
};

// Paso 9: Ambos reciben notificación para calificarse mutuamente
const notificarPedirCalificacion = async (usuarioId, trabajoTitulo, trabajoId) => {
    await crearNotificacion({
        usuarioId,
        tipo: 'pedir_calificacion',
        titulo: '¡Calificá tu experiencia!',
        mensaje: `El trabajo "${trabajoTitulo}" finalizó. Dejá tu calificación con estrellas.`,
        referenciaTipo: 'trabajo',
        referenciaId: trabajoId
    });
};

// Agendamiento automático: notifica a ambos usuarios con el horario asignado por el sistema
const notificarHorarioAutoAsignado = async (usuarioId, trabajoTitulo, cuando, trabajoId) => {
    await crearNotificacion({
        usuarioId,
        tipo: 'horario_auto_asignado',
        titulo: 'Horario asignado automáticamente',
        mensaje: `"${trabajoTitulo}" quedó agendado para el ${cuando}.`,
        referenciaTipo: 'trabajo',
        referenciaId: trabajoId
    });
};

const notificarPagoPendiente = async (duenoId, trabajoTitulo, trabajoId) => {
    await crearNotificacion({
        usuarioId: duenoId,
        tipo: 'pago_pendiente',
        titulo: 'Completá el pago para confirmar el trabajo',
        mensaje: `El pago para "${trabajoTitulo}" no pudo iniciarse automáticamente. Ingresá al trabajo para completarlo.`,
        referenciaTipo: 'trabajo',
        referenciaId: trabajoId
    });
};

// Notificación general de trabajo finalizado (para compatibilidad)
const notificarTrabajoFinalizado = async (usuarioId, trabajoId) => {
    await crearNotificacion({
        usuarioId,
        tipo: 'trabajo_finalizado',
        titulo: 'Trabajo finalizado',
        mensaje: 'El trabajo fue confirmado como completado. ¡Calificá tu experiencia!',
        referenciaTipo: 'trabajo',
        referenciaId: trabajoId
    });
};

const notificarDisputaAbierta = async (usuarioId, trabajoTitulo, trabajoId) => {
    await crearNotificacion({
        usuarioId,
        tipo: 'disputa_abierta',
        titulo: 'Disputa abierta',
        mensaje: `Se abrió una disputa sobre el trabajo "${trabajoTitulo}". Un moderador la revisará pronto.`,
        referenciaTipo: 'trabajo',
        referenciaId: trabajoId
    });
};

const notificarDisputaResuelta = async (usuarioId, trabajoTitulo, resolucion, trabajoId) => {
    await crearNotificacion({
        usuarioId,
        tipo: 'disputa_resuelta',
        titulo: 'Disputa resuelta',
        mensaje: `La disputa sobre "${trabajoTitulo}" fue resuelta: ${resolucion}`,
        referenciaTipo: 'trabajo',
        referenciaId: trabajoId
    });
};

module.exports = {
    notificarHorarioAutoAsignado,
    notificarOfertaRecibida,
    notificarOfertaAceptada,
    notificarOfertaRechazada,
    notificarContraofertaRecibida,
    notificarContraofertaRechazada,
    notificarContraofertaAceptada,
    notificarHorarioElegido,
    notificarAgendaConfirmadaDueno,
    notificarHorarioConfirmado,
    notificarTrabajadorLlego,
    notificarLlegadaConfirmada,
    notificarResultadoSubido,
    notificarTrabajoCompletadoPendiente,
    notificarPedirCalificacion,
    notificarTrabajoFinalizado,
    notificarPagoPendiente,
    notificarDisputaAbierta,
    notificarDisputaResuelta,
};
