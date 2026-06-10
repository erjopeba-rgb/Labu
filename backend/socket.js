const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { enviarMensaje, crearNotificacion } = require("./services/chat.service");
const logger = require("./config/logger");
const { buildAdapter } = require("./config/socketAdapter");

// Rate limiting en memoria: { usuarioId -> timestamp último evento }
const ultimoMensaje = new Map();   // ventana deslizante: timestamps de mensajes recientes
const ultimoTyping  = new Map();   // timestamp del último typing emitido

const MENSAJE_LIMITE   = 10;   // máx mensajes por segundo
const MENSAJE_VENTANA  = 1000; // ms
const TYPING_COOLDOWN  = 500;  // ms entre eventos typing

const permitirMensaje = (usuarioId) => {
  const ahora = Date.now();
  const ventana = ahora - MENSAJE_VENTANA;
  const lista = (ultimoMensaje.get(usuarioId) || []).filter(t => t > ventana);
  if (lista.length >= MENSAJE_LIMITE) return false;
  lista.push(ahora);
  ultimoMensaje.set(usuarioId, lista);
  return true;
};

const permitirTyping = (usuarioId) => {
  const ahora = Date.now();
  const ultimo = ultimoTyping.get(usuarioId) || 0;
  if (ahora - ultimo < TYPING_COOLDOWN) return false;
  ultimoTyping.set(usuarioId, ahora);
  return true;
};

const iniciarSocket = async (httpServer) => {
  const origenesPermitidos = (process.env.CORS_ORIGIN || "http://localhost:3000")
    .split(",")
    .map(o => o.trim());
  const io = new Server(httpServer, {
    cors: { origin: origenesPermitidos, methods: ["GET", "POST"] }
  });

  const adapter = await buildAdapter();
  if (adapter) io.adapter(adapter);

  // Middleware de autenticación
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error("Token requerido"));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.usuario = decoded;
      next();
    } catch {
      next(new Error("Token invalido"));
    }
  });

  io.on("connection", (socket) => {
    const usuarioId = socket.usuario.id;

    // Sala personal para notificaciones
    socket.join(`user_${usuarioId}`);

    // ── Unirse a conversación ──────────────────────────────────────
    socket.on("join_conversacion", (conversacionId) => {
      socket.join(`conv_${conversacionId}`);
    });

    // ── Salir de conversación ─────────────────────────────────────
    socket.on("leave_conversacion", (conversacionId) => {
      socket.leave(`conv_${conversacionId}`);
    });

    // ── Enviar mensaje ─────────────────────────────────────────────
    socket.on("mensaje", async ({ conversacionId, contenido, tipo }, callback) => {
      if (!permitirMensaje(usuarioId)) return;
      if (!conversacionId || !contenido) {
        if (callback) callback({ ok: false, error: "conversacionId y contenido son requeridos" });
        return;
      }

      try {
        const msg = await enviarMensaje({
          conversacionId: parseInt(conversacionId),
          remitenteId: usuarioId,
          contenido,
          tipo: tipo || "texto"
        });

        // Emitir a todos en la sala (incluido el remitente para confirmar)
        io.to(`conv_${conversacionId}`).emit("nuevo_mensaje", msg);

        if (callback) callback({ ok: true, mensaje: msg });
      } catch (err) {
        logger.error({ usuarioId, conversacionId, err: err.message }, "[socket.mensaje] ERROR");
        if (callback) callback({ ok: false, error: err.message });
      }
    });

    // ── Typing indicators ──────────────────────────────────────────
    socket.on("typing", ({ conversacionId }) => {
      if (!permitirTyping(usuarioId)) return;
      socket.to(`conv_${conversacionId}`).emit("usuario_escribiendo", {
        usuarioId,
        conversacionId
      });
    });

    socket.on("stop_typing", ({ conversacionId }) => {
      socket.to(`conv_${conversacionId}`).emit("usuario_dejo_escribir", {
        usuarioId,
        conversacionId
      });
    });

    socket.on("disconnect", () => {
      ultimoMensaje.delete(usuarioId);
      ultimoTyping.delete(usuarioId);
    });
  });

  return io;
};

// Helper para enviar notificación desde cualquier parte del backend
const notificar = async (io, usuarioId, notif) => {
  try {
    const n = await crearNotificacion({ usuarioId, ...notif });
    io.to(`user_${usuarioId}`).emit("notificacion", n);
    return n;
  } catch (err) {
    logger.error({ err: err.message }, "[notificar] Error");
  }
};

module.exports = { iniciarSocket, notificar };
