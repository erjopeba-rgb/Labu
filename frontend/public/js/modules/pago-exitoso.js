const CONFIGS = {
    success: { titulo: '¡Pago realizado con éxito!', icono: '✅', mensaje: 'Tu pago fue procesado correctamente. El trabajador fue notificado y el trabajo está en marcha.' },
    failure: { titulo: 'Pago rechazado',              icono: '❌', mensaje: 'No pudimos procesar el pago. Podés intentarlo nuevamente desde tus trabajos.' },
    pending: { titulo: 'Pago pendiente',              icono: '⏳', mensaje: 'Tu pago está siendo procesado. Te notificaremos cuando se confirme.' },
};

const params    = new URLSearchParams(window.location.search);
const rawStatus = params.get('status');
const status    = CONFIGS[rawStatus] ? rawStatus : 'pending';
const paymentId = params.get('payment_id');
const cfg       = CONFIGS[status];

document.title = `Labu — ${cfg.titulo}`;
document.getElementById('pagoIcono').textContent   = cfg.icono;
document.getElementById('pagoTitulo').textContent  = cfg.titulo;
document.getElementById('pagoMensaje').textContent = cfg.mensaje;

const badge = document.getElementById('pagoBadge');
badge.textContent = status;
badge.classList.add(status);

if (paymentId) {
    document.getElementById('pagoId').textContent = `ID de pago: ${paymentId}`;
}
