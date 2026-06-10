const express = require("express");
const router = express.Router();
const {
    crearPerfil, getMiPerfil, getPerfilById, buscarTiendas,
    getCategorias, getProductosTienda, buscarProductos, upsertProducto, deleteProducto,
    crearPedido, getPedido, getPedidosAbiertos,
    crearOferta, aceptarOferta,
    getSugerencias, calificar
} = require("../controllers/tienda.controller");
const { verificarToken } = require("../middlewares/auth.middleware");

router.post("/perfil",                     verificarToken, crearPerfil);
router.get("/perfil/mio",                  verificarToken, getMiPerfil);
router.get("/perfil/:id",                              getPerfilById);
router.get("/buscar",                                  buscarTiendas);

router.get("/categorias",                              getCategorias);
router.get("/:tienda_id/productos",                    getProductosTienda);
router.get("/productos/buscar",                        buscarProductos);
router.post("/productos",                  verificarToken, upsertProducto);
router.put("/productos/:id",               verificarToken, upsertProducto);
router.delete("/productos/:id",            verificarToken, deleteProducto);

router.post("/pedidos",                    verificarToken, crearPedido);
router.get("/pedidos",                                 getPedidosAbiertos);
router.get("/pedidos/:id",                             getPedido);
router.post("/pedidos/:pedido_id/ofertas", verificarToken, crearOferta);
router.post("/pedidos/:pedido_id/ofertas/:oferta_id/aceptar", verificarToken, aceptarOferta);

router.get("/sugerencias/:tarea_id",                   getSugerencias);
router.post("/:tienda_id/calificar",       verificarToken, calificar);

module.exports = router;
