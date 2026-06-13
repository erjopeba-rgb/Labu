const {
  getRubrosConConteo,
  getRubrosConTareas, getTareasByRubro,
  getCatalogoTrabajador, upsertCatalogoItem, deleteCatalogoItem,
  getPrecioPromedio, compararPrecio,
  generarComprobante, getComprobante
} = require("../services/catalogo.service");
const AppError = require("../utils/AppError");
const { successResponse } = require("../utils/apiResponse");

const getEstadisticas = async (req, res, next) => {
  try {
    successResponse(res, { data: await getRubrosConConteo() });
  } catch (err) {
    next(err);
  }
};

const getRubros = async (req, res, next) => {
  try {
    successResponse(res, { rubros: await getRubrosConTareas() });
  } catch (err) {
    next(err);
  }
};

const getTareas = async (req, res, next) => {
  try {
    successResponse(res, { tareas: await getTareasByRubro(parseInt(req.params.rubro_id)) });
  } catch (err) {
    next(err);
  }
};

const getCatalogo = async (req, res, next) => {
  try {
    const trabajadorId = req.params.trabajador_id
      ? parseInt(req.params.trabajador_id)
      : req.usuario.id;
    successResponse(res, { items: await getCatalogoTrabajador(trabajadorId) });
  } catch (err) {
    next(err);
  }
};

const upsertItem = async (req, res, next) => {
  try {
    const { tarea_id, precio, unidad_medida, descripcion_extra } = req.body;
    if (!tarea_id || !precio) {
      throw new AppError("tarea_id y precio son requeridos", 400);
    }
    const item = await upsertCatalogoItem({
      trabajadorId: req.usuario.id,
      tareaId: tarea_id,
      precio,
      unidadMedida: unidad_medida || "por_proyecto",
      descripcionExtra: descripcion_extra || null
    });
    successResponse(res, { item }, 201);
  } catch (err) {
    next(err);
  }
};

const deleteItem = async (req, res, next) => {
  try {
    await deleteCatalogoItem(req.usuario.id, parseInt(req.params.tarea_id));
    successResponse(res, { mensaje: "Item eliminado del catalogo" });
  } catch (err) {
    next(err);
  }
};

const getPromedio = async (req, res, next) => {
  try {
    successResponse(res, await getPrecioPromedio(parseInt(req.params.tarea_id)));
  } catch (err) {
    next(err);
  }
};

const comparar = async (req, res, next) => {
  try {
    const { tarea_id, monto } = req.query;
    if (!tarea_id || !monto) {
      throw new AppError("tarea_id y monto son requeridos", 400);
    }
    successResponse(res, await compararPrecio(parseInt(tarea_id), parseFloat(monto)));
  } catch (err) {
    next(err);
  }
};

const crearComprobante = async (req, res, next) => {
  try {
    const comp = await generarComprobante(parseInt(req.params.trabajo_id));
    successResponse(res, { comprobante: comp }, 201);
  } catch (err) {
    next(err);
  }
};

const verComprobante = async (req, res, next) => {
  try {
    const comp = await getComprobante(parseInt(req.params.trabajo_id), req.usuario.id);
    successResponse(res, { comprobante: comp });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getEstadisticas,
  getRubros, getTareas,
  getCatalogo, upsertItem, deleteItem,
  getPromedio, comparar,
  crearComprobante, verComprobante
};
