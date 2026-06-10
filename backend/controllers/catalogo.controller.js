const {
  getRubrosConConteo,
  getRubrosConTareas, getTareasByRubro,
  getCatalogoTrabajador, upsertCatalogoItem, deleteCatalogoItem,
  getPrecioPromedio, compararPrecio,
  generarComprobante, getComprobante
} = require("../services/catalogo.service");

const getEstadisticas = async (req, res) => {
  try {
    const data = await getRubrosConConteo();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getRubros = async (req, res) => {
  try {
    const data = await getRubrosConTareas();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getTareas = async (req, res) => {
  try {
    const data = await getTareasByRubro(parseInt(req.params.rubro_id));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getCatalogo = async (req, res) => {
  try {
    const trabajadorId = req.params.trabajador_id
      ? parseInt(req.params.trabajador_id)
      : req.usuario.id;
    const data = await getCatalogoTrabajador(trabajadorId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const upsertItem = async (req, res) => {
  try {
    const { tarea_id, precio, unidad_medida, descripcion_extra } = req.body;
    if (!tarea_id || !precio) {
      return res.status(400).json({ error: "tarea_id y precio son requeridos" });
    }
    const item = await upsertCatalogoItem({
      trabajadorId: req.usuario.id,
      tareaId: tarea_id,
      precio,
      unidadMedida: unidad_medida || "por_proyecto",
      descripcionExtra: descripcion_extra || null
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const deleteItem = async (req, res) => {
  try {
    await deleteCatalogoItem(req.usuario.id, parseInt(req.params.tarea_id));
    res.json({ mensaje: "Item eliminado del catalogo" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getPromedio = async (req, res) => {
  try {
    const data = await getPrecioPromedio(parseInt(req.params.tarea_id));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const comparar = async (req, res) => {
  try {
    const { tarea_id, monto } = req.query;
    if (!tarea_id || !monto) {
      return res.status(400).json({ error: "tarea_id y monto son requeridos" });
    }
    const data = await compararPrecio(parseInt(tarea_id), parseFloat(monto));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const crearComprobante = async (req, res) => {
  try {
    const comp = await generarComprobante(parseInt(req.params.trabajo_id));
    res.status(201).json(comp);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const verComprobante = async (req, res) => {
  try {
    const comp = await getComprobante(parseInt(req.params.trabajo_id), req.usuario.id);
    res.json(comp);
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
};

module.exports = {
  getEstadisticas,
  getRubros, getTareas,
  getCatalogo, upsertItem, deleteItem,
  getPromedio, comparar,
  crearComprobante, verComprobante
};
