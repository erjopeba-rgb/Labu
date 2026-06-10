const svc = require("../services/tienda.service");

// ─── PERFIL TIENDA ────────────────────────────────────────────────────────────

const crearPerfil = async (req, res) => {
  try {
    const t = await svc.crearPerfilTienda({ usuarioId: req.usuario.id, ...req.body });
    res.status(201).json(t);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getMiPerfil = async (req, res) => {
  try {
    const t = await svc.getPerfilTienda(req.usuario.id);
    if (!t) return res.status(404).json({ error: "Perfil de tienda no encontrado" });
    res.json(t);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getPerfilById = async (req, res) => {
  try {
    const t = await svc.getPerfilTiendaById(parseInt(req.params.id));
    if (!t) return res.status(404).json({ error: "Tienda no encontrada" });
    res.json(t);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const buscarTiendas = async (req, res) => {
  try {
    const { ciudad, provincia, query } = req.query;
    res.json(await svc.buscarTiendas({ ciudad, provincia, query }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── PRODUCTOS ────────────────────────────────────────────────────────────────

const getCategorias = async (req, res) => {
  try {
    res.json(await svc.getCategorias());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getProductosTienda = async (req, res) => {
  try {
    res.json(await svc.getProductosByTienda(parseInt(req.params.tienda_id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const buscarProductos = async (req, res) => {
  try {
    const { query, categoria_id, ciudad, precio_min, precio_max } = req.query;
    res.json(await svc.buscarProductos({
      query, categoriaId: categoria_id ? parseInt(categoria_id) : null,
      ciudad, precioMin: precio_min ? parseFloat(precio_min) : null,
      precioMax: precio_max ? parseFloat(precio_max) : null
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const upsertProducto = async (req, res) => {
  try {
    const { nombre, precio } = req.body;
    if (!nombre || !precio) return res.status(400).json({ error: "nombre y precio son requeridos" });

    const tienda = await svc.getPerfilTienda(req.usuario.id);
    if (!tienda) return res.status(404).json({ error: "Perfil de tienda no encontrado" });

    const p = await svc.upsertProducto({
      tiendaId: tienda.id,
      productoId: req.params.id ? parseInt(req.params.id) : null,
      ...req.body
    });
    res.status(req.params.id ? 200 : 201).json(p);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const deleteProducto = async (req, res) => {
  try {
    const tienda = await svc.getPerfilTienda(req.usuario.id);
    if (!tienda) return res.status(404).json({ error: "Perfil de tienda no encontrado" });
    await svc.deleteProducto(tienda.id, parseInt(req.params.id));
    res.json({ mensaje: "Producto eliminado" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ─── PEDIDOS ─────────────────────────────────────────────────────────────────

const crearPedido = async (req, res) => {
  try {
    const { titulo, items } = req.body;
    if (!titulo || !items || items.length === 0) {
      return res.status(400).json({ error: "titulo e items son requeridos" });
    }
    const p = await svc.crearPedido({ duenioId: req.usuario.id, ...req.body });
    res.status(201).json(p);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getPedido = async (req, res) => {
  try {
    res.json(await svc.getPedido(parseInt(req.params.id)));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

const getPedidosAbiertos = async (req, res) => {
  try {
    res.json(await svc.getPedidosAbiertos(req.query.ciudad || null));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── OFERTAS TIENDA ───────────────────────────────────────────────────────────

const crearOferta = async (req, res) => {
  try {
    const { monto_total, items_oferta } = req.body;
    if (!monto_total) return res.status(400).json({ error: "monto_total es requerido" });

    const tienda = await svc.getPerfilTienda(req.usuario.id);
    if (!tienda) return res.status(404).json({ error: "Perfil de tienda no encontrado" });

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
    res.status(201).json(o);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const aceptarOferta = async (req, res) => {
  try {
    const o = await svc.aceptarOfertaTienda({
      ofertaId: parseInt(req.params.oferta_id),
      duenioId: req.usuario.id
    });
    res.json(o);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ─── SUGERENCIAS ─────────────────────────────────────────────────────────────

const getSugerencias = async (req, res) => {
  try {
    res.json(await svc.getSugerenciasByTarea(parseInt(req.params.tarea_id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── CALIFICACIONES ───────────────────────────────────────────────────────────

const calificar = async (req, res) => {
  try {
    const { puntaje, comentario, oferta_id } = req.body;
    if (!puntaje) return res.status(400).json({ error: "puntaje es requerido" });
    const cal = await svc.calificarTienda({
      tiendaId: parseInt(req.params.tienda_id),
      usuarioId: req.usuario.id,
      ofertaId: oferta_id || null,
      puntaje, comentario: comentario || null
    });
    res.status(201).json(cal);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = {
  crearPerfil, getMiPerfil, getPerfilById, buscarTiendas,
  getCategorias, getProductosTienda, buscarProductos, upsertProducto, deleteProducto,
  crearPedido, getPedido, getPedidosAbiertos,
  crearOferta, aceptarOferta,
  getSugerencias, calificar
};
