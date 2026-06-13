const svc = require("../services/tienda.service");
const AppError = require("../utils/AppError");
const { successResponse } = require("../utils/apiResponse");

// ─── PERFIL TIENDA ────────────────────────────────────────────────────────────

const crearPerfil = async (req, res, next) => {
  try {
    const t = await svc.crearPerfilTienda({ usuarioId: req.usuario.id, ...req.body });
    successResponse(res, { tienda: t }, 201);
  } catch (err) {
    next(err);
  }
};

const getMiPerfil = async (req, res, next) => {
  try {
    const t = await svc.getPerfilTienda(req.usuario.id);
    if (!t) throw new AppError("Perfil de tienda no encontrado", 404);
    successResponse(res, { tienda: t });
  } catch (err) {
    next(err);
  }
};

const getPerfilById = async (req, res, next) => {
  try {
    const t = await svc.getPerfilTiendaById(parseInt(req.params.id));
    if (!t) throw new AppError("Tienda no encontrada", 404);
    successResponse(res, { tienda: t });
  } catch (err) {
    next(err);
  }
};

const buscarTiendas = async (req, res, next) => {
  try {
    const { ciudad, provincia, query } = req.query;
    successResponse(res, { tiendas: await svc.buscarTiendas({ ciudad, provincia, query }) });
  } catch (err) {
    next(err);
  }
};

// ─── PRODUCTOS ────────────────────────────────────────────────────────────────

const getCategorias = async (req, res, next) => {
  try {
    successResponse(res, { categorias: await svc.getCategorias() });
  } catch (err) {
    next(err);
  }
};

const getProductosTienda = async (req, res, next) => {
  try {
    successResponse(res, { productos: await svc.getProductosByTienda(parseInt(req.params.tienda_id)) });
  } catch (err) {
    next(err);
  }
};

const buscarProductos = async (req, res, next) => {
  try {
    const { query, categoria_id, ciudad, precio_min, precio_max } = req.query;
    successResponse(res, { productos: await svc.buscarProductos({
      query, categoriaId: categoria_id ? parseInt(categoria_id) : null,
      ciudad, precioMin: precio_min ? parseFloat(precio_min) : null,
      precioMax: precio_max ? parseFloat(precio_max) : null
    }) });
  } catch (err) {
    next(err);
  }
};

const upsertProducto = async (req, res, next) => {
  try {
    const { nombre, precio } = req.body;
    if (!nombre || !precio) throw new AppError("nombre y precio son requeridos", 400);

    const tienda = await svc.getPerfilTienda(req.usuario.id);
    if (!tienda) throw new AppError("Perfil de tienda no encontrado", 404);

    const p = await svc.upsertProducto({
      tiendaId: tienda.id,
      productoId: req.params.id ? parseInt(req.params.id) : null,
      ...req.body
    });
    successResponse(res, { producto: p }, req.params.id ? 200 : 201);
  } catch (err) {
    next(err);
  }
};

const deleteProducto = async (req, res, next) => {
  try {
    const tienda = await svc.getPerfilTienda(req.usuario.id);
    if (!tienda) throw new AppError("Perfil de tienda no encontrado", 404);
    await svc.deleteProducto(tienda.id, parseInt(req.params.id));
    successResponse(res, { mensaje: "Producto eliminado" });
  } catch (err) {
    next(err);
  }
};

// ─── PEDIDOS ─────────────────────────────────────────────────────────────────

const crearPedido = async (req, res, next) => {
  try {
    const { titulo, items } = req.body;
    if (!titulo || !items || items.length === 0) {
      throw new AppError("titulo e items son requeridos", 400);
    }
    const p = await svc.crearPedido({ duenioId: req.usuario.id, ...req.body });
    successResponse(res, { pedido: p }, 201);
  } catch (err) {
    next(err);
  }
};

const getPedido = async (req, res, next) => {
  try {
    successResponse(res, { pedido: await svc.getPedido(parseInt(req.params.id)) });
  } catch (err) {
    next(err);
  }
};

const getPedidosAbiertos = async (req, res, next) => {
  try {
    successResponse(res, { pedidos: await svc.getPedidosAbiertos(req.query.ciudad || null) });
  } catch (err) {
    next(err);
  }
};

// ─── OFERTAS TIENDA ───────────────────────────────────────────────────────────

const crearOferta = async (req, res, next) => {
  try {
    const { monto_total, items_oferta } = req.body;
    if (!monto_total) throw new AppError("monto_total es requerido", 400);

    const tienda = await svc.getPerfilTienda(req.usuario.id);
    if (!tienda) throw new AppError("Perfil de tienda no encontrado", 404);

    const o = await svc.crearOfertaTienda({
      pedidoId: parseInt(req.params.pedido_id),
      tiendaId: tienda.id,
      montoTotal: monto_total,
      detalle: req.body.detalle || null,
      incluyeEnvio: req.body.incluye_envio || false,
      costoEnvio: req.body.costo_envio || 0,
      tiempoEntregaDias: req.body.tiempo_entrega_dias || null,
      itemsOferta: items_oferta || []
    });
    successResponse(res, { oferta: o }, 201);
  } catch (err) {
    next(err);
  }
};

const aceptarOferta = async (req, res, next) => {
  try {
    const o = await svc.aceptarOfertaTienda({
      ofertaId: parseInt(req.params.oferta_id),
      duenioId: req.usuario.id
    });
    successResponse(res, { oferta: o });
  } catch (err) {
    next(err);
  }
};

// ─── SUGERENCIAS ─────────────────────────────────────────────────────────────

const getSugerencias = async (req, res, next) => {
  try {
    successResponse(res, { sugerencias: await svc.getSugerenciasByTarea(parseInt(req.params.tarea_id)) });
  } catch (err) {
    next(err);
  }
};

// ─── CALIFICACIONES ───────────────────────────────────────────────────────────

const calificar = async (req, res, next) => {
  try {
    const { puntaje, comentario, oferta_id } = req.body;
    if (!puntaje) throw new AppError("puntaje es requerido", 400);
    const cal = await svc.calificarTienda({
      tiendaId: parseInt(req.params.tienda_id),
      usuarioId: req.usuario.id,
      ofertaId: oferta_id || null,
      puntaje, comentario: comentario || null
    });
    successResponse(res, { calificacion: cal }, 201);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  crearPerfil, getMiPerfil, getPerfilById, buscarTiendas,
  getCategorias, getProductosTienda, buscarProductos, upsertProducto, deleteProducto,
  crearPedido, getPedido, getPedidosAbiertos,
  crearOferta, aceptarOferta,
  getSugerencias, calificar
};
