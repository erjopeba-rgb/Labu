const pool = require("../config/db");

// ─── PERFIL TIENDA ────────────────────────────────────────────────────────────

const crearPerfilTienda = async ({ usuarioId, nombreTienda, descripcion, telefono, whatsapp, emailContacto, direccion, ciudad, provincia, latitud, longitud, radioEntregaKm, haceEnvios, costoEnvioBase, envioGratisDesde, horarios, logoUrl, bannerUrl }) => {
  const { rows: [u] } = await pool.query("SELECT tipo_perfil FROM usuarios WHERE id = $1", [usuarioId]);
  if (u.tipo_perfil !== 'tienda') throw new Error("Solo cuentas de tipo tienda pueden crear un perfil de tienda");

  const { rows: [t] } = await pool.query(
    `INSERT INTO perfiles_tienda (usuario_id, nombre_tienda, descripcion, telefono, whatsapp, email_contacto, direccion, ciudad, provincia, latitud, longitud, radio_entrega_km, hace_envios, costo_envio_base, envio_gratis_desde, horarios, logo_url, banner_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     ON CONFLICT (usuario_id) DO UPDATE SET
       nombre_tienda=EXCLUDED.nombre_tienda, descripcion=EXCLUDED.descripcion,
       telefono=EXCLUDED.telefono, whatsapp=EXCLUDED.whatsapp,
       email_contacto=EXCLUDED.email_contacto, direccion=EXCLUDED.direccion,
       ciudad=EXCLUDED.ciudad, provincia=EXCLUDED.provincia,
       latitud=EXCLUDED.latitud, longitud=EXCLUDED.longitud,
       radio_entrega_km=EXCLUDED.radio_entrega_km, hace_envios=EXCLUDED.hace_envios,
       costo_envio_base=EXCLUDED.costo_envio_base, envio_gratis_desde=EXCLUDED.envio_gratis_desde,
       horarios=EXCLUDED.horarios, logo_url=EXCLUDED.logo_url, banner_url=EXCLUDED.banner_url,
       actualizado_en=NOW()
     RETURNING *`,
    [usuarioId, nombreTienda, descripcion||null, telefono||null, whatsapp||null, emailContacto||null, direccion||null, ciudad||null, provincia||null, latitud||null, longitud||null, radioEntregaKm||10, haceEnvios??true, costoEnvioBase||null, envioGratisDesde||null, horarios||null, logoUrl||null, bannerUrl||null]
  );
  return t;
};

const getPerfilTienda = async (usuarioId) => {
  const { rows: [t] } = await pool.query(
    "SELECT * FROM perfiles_tienda WHERE usuario_id = $1",
    [usuarioId]
  );
  return t || null;
};

const getPerfilTiendaById = async (tiendaId) => {
  const { rows: [t] } = await pool.query(
    "SELECT * FROM perfiles_tienda WHERE id = $1 AND activa = TRUE",
    [tiendaId]
  );
  return t || null;
};

const buscarTiendas = async ({ ciudad, provincia, query }) => {
  let where = "WHERE pt.activa = TRUE";
  const params = [];
  let i = 1;
  if (ciudad) { where += ` AND pt.ciudad ILIKE $${i++}`; params.push(`%${ciudad}%`); }
  if (provincia) { where += ` AND pt.provincia ILIKE $${i++}`; params.push(`%${provincia}%`); }
  if (query) { where += ` AND pt.nombre_tienda ILIKE $${i++}`; params.push(`%${query}%`); }

  const { rows } = await pool.query(
    `SELECT pt.*, u.email FROM perfiles_tienda pt
     JOIN usuarios u ON u.id = pt.usuario_id
     ${where}
     ORDER BY pt.calificacion_promedio DESC, pt.total_ventas DESC`,
    params
  );
  return rows;
};

// ─── PRODUCTOS ────────────────────────────────────────────────────────────────

const getProductosByTienda = async (tiendaId) => {
  const { rows } = await pool.query(
    `SELECT p.*, c.nombre AS categoria_nombre
     FROM productos p
     LEFT JOIN categorias_producto c ON c.id = p.categoria_id
     WHERE p.tienda_id = $1 AND p.activo = TRUE
     ORDER BY p.destacado DESC, p.nombre ASC`,
    [tiendaId]
  );
  return rows;
};

const buscarProductos = async ({ query, categoriaId, ciudad, precioMin, precioMax }) => {
  let where = "WHERE p.activo = TRUE AND pt.activa = TRUE";
  const params = [];
  let i = 1;
  if (query) { where += ` AND p.nombre ILIKE $${i++}`; params.push(`%${query}%`); }
  if (categoriaId) { where += ` AND p.categoria_id = $${i++}`; params.push(categoriaId); }
  if (ciudad) { where += ` AND pt.ciudad ILIKE $${i++}`; params.push(`%${ciudad}%`); }
  if (precioMin) { where += ` AND p.precio >= $${i++}`; params.push(precioMin); }
  if (precioMax) { where += ` AND p.precio <= $${i++}`; params.push(precioMax); }

  const { rows } = await pool.query(
    `SELECT p.*, pt.nombre_tienda, pt.ciudad, pt.hace_envios, pt.costo_envio_base,
            c.nombre AS categoria_nombre
     FROM productos p
     JOIN perfiles_tienda pt ON pt.id = p.tienda_id
     LEFT JOIN categorias_producto c ON c.id = p.categoria_id
     ${where}
     ORDER BY p.destacado DESC, p.precio ASC`,
    params
  );
  return rows;
};

const upsertProducto = async ({ tiendaId, productoId, nombre, descripcion, precio, precioOferta, unidad, stock, stockIlimitado, fotosUrls, marca, codigoSku, categoriaId, destacado }) => {
  if (productoId) {
    const { rows: [p] } = await pool.query(
      `UPDATE productos SET nombre=$1, descripcion=$2, precio=$3, precio_oferta=$4, unidad=$5,
         stock=$6, stock_ilimitado=$7, fotos_urls=$8, marca=$9, codigo_sku=$10,
         categoria_id=$11, destacado=$12, actualizado_en=NOW()
       WHERE id=$13 AND tienda_id=$14 RETURNING *`,
      [nombre, descripcion||null, precio, precioOferta||null, unidad||'unidad', stock||0, stockIlimitado||false, fotosUrls||null, marca||null, codigoSku||null, categoriaId||null, destacado||false, productoId, tiendaId]
    );
    if (!p) throw new Error("Producto no encontrado o sin permiso");
    return p;
  } else {
    const { rows: [p] } = await pool.query(
      `INSERT INTO productos (tienda_id, nombre, descripcion, precio, precio_oferta, unidad, stock, stock_ilimitado, fotos_urls, marca, codigo_sku, categoria_id, destacado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [tiendaId, nombre, descripcion||null, precio, precioOferta||null, unidad||'unidad', stock||0, stockIlimitado||false, fotosUrls||null, marca||null, codigoSku||null, categoriaId||null, destacado||false]
    );
    return p;
  }
};

const deleteProducto = async (tiendaId, productoId) => {
  const { rows: [p] } = await pool.query(
    "UPDATE productos SET activo = FALSE WHERE id = $1 AND tienda_id = $2 RETURNING id",
    [productoId, tiendaId]
  );
  if (!p) throw new Error("Producto no encontrado o sin permiso");
};

// ─── PEDIDOS DE MATERIALES ────────────────────────────────────────────────────

const crearPedido = async ({ duenioId, trabajoId, titulo, descripcion, ciudad, provincia, items }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [pedido] } = await client.query(
      `INSERT INTO pedidos_materiales (dueno_id, trabajo_id, titulo, descripcion, ciudad, provincia)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [duenioId, trabajoId||null, titulo, descripcion||null, ciudad||null, provincia||null]
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO items_pedido (pedido_id, nombre_material, cantidad, unidad, descripcion_extra)
         VALUES ($1,$2,$3,$4,$5)`,
        [pedido.id, item.nombre_material, item.cantidad, item.unidad||'unidad', item.descripcion_extra||null]
      );
    }

    await client.query("COMMIT");
    return pedido;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const getPedido = async (pedidoId) => {
  const { rows: [pedido] } = await pool.query(
    `SELECT p.*, u.email AS dueno_email, pf.nombre AS dueno_nombre
     FROM pedidos_materiales p
     JOIN usuarios u ON u.id = p.dueno_id
     JOIN perfiles pf ON pf.usuario_id = p.dueno_id
     WHERE p.id = $1`,
    [pedidoId]
  );
  if (!pedido) throw new Error("Pedido no encontrado");

  const { rows: items } = await pool.query(
    "SELECT * FROM items_pedido WHERE pedido_id = $1",
    [pedidoId]
  );

  const { rows: ofertas } = await pool.query(
    `SELECT ot.*, pt.nombre_tienda, pt.calificacion_promedio
     FROM ofertas_tienda ot
     JOIN perfiles_tienda pt ON pt.id = ot.tienda_id
     WHERE ot.pedido_id = $1`,
    [pedidoId]
  );

  return { ...pedido, items, ofertas };
};

const getPedidosAbiertos = async (ciudad) => {
  let where = "WHERE p.estado = 'abierto'";
  const params = [];
  if (ciudad) { where += " AND p.ciudad ILIKE $1"; params.push(`%${ciudad}%`); }

  const { rows } = await pool.query(
    `SELECT p.*, pf.nombre AS dueno_nombre,
            (SELECT COUNT(*) FROM items_pedido WHERE pedido_id = p.id) AS total_items,
            (SELECT COUNT(*) FROM ofertas_tienda WHERE pedido_id = p.id) AS total_ofertas
     FROM pedidos_materiales p
     JOIN perfiles pf ON pf.usuario_id = p.dueno_id
     ${where}
     ORDER BY p.creado_en DESC`,
    params
  );
  return rows;
};

// ─── OFERTAS DE TIENDAS ───────────────────────────────────────────────────────

const crearOfertaTienda = async ({ pedidoId, tiendaId, montoTotal, detalle, incluyeEnvio, costoEnvio, tiempoEntregaDias, itemsOferta }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [oferta] } = await client.query(
      `INSERT INTO ofertas_tienda (pedido_id, tienda_id, monto_total, detalle, incluye_envio, costo_envio, tiempo_entrega_dias)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [pedidoId, tiendaId, montoTotal, detalle||null, incluyeEnvio||false, costoEnvio||0, tiempoEntregaDias||null]
    );

    if (itemsOferta && itemsOferta.length > 0) {
      for (const item of itemsOferta) {
        await client.query(
          `INSERT INTO items_oferta_tienda (oferta_id, item_pedido_id, producto_id, precio_unitario, cantidad, subtotal)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [oferta.id, item.item_pedido_id, item.producto_id||null, item.precio_unitario, item.cantidad, item.precio_unitario * item.cantidad]
        );
      }
    }

    await client.query("COMMIT");
    return oferta;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const aceptarOfertaTienda = async ({ ofertaId, duenioId }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [oferta] } = await client.query(
      `SELECT ot.*, p.dueno_id FROM ofertas_tienda ot
       JOIN pedidos_materiales p ON p.id = ot.pedido_id
       WHERE ot.id = $1`,
      [ofertaId]
    );
    if (!oferta) throw new Error("Oferta no encontrada");
    if (oferta.dueno_id !== duenioId) throw new Error("Sin permiso");

    await client.query("UPDATE ofertas_tienda SET estado = 'aceptada' WHERE id = $1", [ofertaId]);
    await client.query("UPDATE ofertas_tienda SET estado = 'rechazada' WHERE pedido_id = $1 AND id != $2", [oferta.pedido_id, ofertaId]);
    await client.query("UPDATE pedidos_materiales SET estado = 'cerrado' WHERE id = $1", [oferta.pedido_id]);
    await client.query("UPDATE perfiles_tienda SET total_ventas = total_ventas + 1 WHERE id = $1", [oferta.tienda_id]);

    await client.query("COMMIT");
    return oferta;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// ─── SUGERENCIAS DE MATERIALES ────────────────────────────────────────────────

const getSugerenciasByTarea = async (tareaId) => {
  const { rows } = await pool.query(
    `SELECT s.*, c.nombre AS categoria_nombre,
            (SELECT COUNT(*) FROM productos p
             JOIN perfiles_tienda pt ON pt.id = p.tienda_id
             WHERE p.categoria_id = s.categoria_id AND p.activo = TRUE AND pt.activa = TRUE) AS disponible_en_tiendas
     FROM sugerencias_materiales s
     LEFT JOIN categorias_producto c ON c.id = s.categoria_id
     WHERE s.tarea_id = $1
     ORDER BY s.orden ASC`,
    [tareaId]
  );
  return rows;
};

// ─── CALIFICACIONES ───────────────────────────────────────────────────────────

const calificarTienda = async ({ tiendaId, usuarioId, ofertaId, puntaje, comentario }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [cal] } = await client.query(
      `INSERT INTO calificaciones_tienda (tienda_id, usuario_id, oferta_id, puntaje, comentario)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [tiendaId, usuarioId, ofertaId||null, puntaje, comentario||null]
    );

    await client.query(
      `UPDATE perfiles_tienda SET
         calificacion_promedio = (SELECT ROUND(AVG(puntaje)::numeric,2) FROM calificaciones_tienda WHERE tienda_id = $1),
         total_calificaciones = (SELECT COUNT(*) FROM calificaciones_tienda WHERE tienda_id = $1)
       WHERE id = $1`,
      [tiendaId]
    );

    await client.query("COMMIT");
    return cal;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const getCategorias = async () => {
  const { rows } = await pool.query("SELECT * FROM categorias_producto WHERE activa = TRUE ORDER BY nombre");
  return rows;
};

module.exports = {
  crearPerfilTienda, getPerfilTienda, getPerfilTiendaById, buscarTiendas,
  getProductosByTienda, buscarProductos, upsertProducto, deleteProducto,
  crearPedido, getPedido, getPedidosAbiertos,
  crearOfertaTienda, aceptarOfertaTienda,
  getSugerenciasByTarea, calificarTienda, getCategorias
};
