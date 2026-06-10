const svc = require("../services/geolocalizacion.service");

const getZonas = async (req, res) => {
  try {
    res.json(await svc.getZonasTrabajador(req.usuario.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const setZonas = async (req, res) => {
  try {
    const { zonas } = req.body;
    if (!zonas || !Array.isArray(zonas)) return res.status(400).json({ error: "zonas debe ser un array" });
    res.json(await svc.setZonasTrabajador(req.usuario.id, zonas));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const addZona = async (req, res) => {
  try {
    const { provincia, localidad } = req.body;
    if (!provincia || !localidad) return res.status(400).json({ error: "provincia y localidad son requeridos" });
    res.status(201).json(await svc.addZona(req.usuario.id, provincia, localidad));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const removeZona = async (req, res) => {
  try {
    await svc.removeZona(req.usuario.id, parseInt(req.params.id));
    res.json({ mensaje: "Zona eliminada" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getFeed = async (req, res) => {
  try {
    const { estado, rubro_id, limit, offset } = req.query;
    const trabajos = await svc.getTrabajosPorZona(req.usuario.id, {
      estado: estado || 'publicado',
      rubroId: rubro_id ? parseInt(rubro_id) : null,
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0
    });
    res.json(trabajos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const buscarTrabajadores = async (req, res) => {
  try {
    const { lat, lng, radio, rubro_id, q, calificacion_min, tarifa_min, tarifa_max, orden, dia_semana } = req.query;

    // Si se provee solo una coordenada, la petición es inválida
    if ((lat && !lng) || (!lat && lng)) {
      return res.status(400).json({ error: "Se requieren lat y lng juntos, o ninguno" });
    }

    res.json(await svc.buscarTrabajadoresCercanos({
      latitud:        lat  ? parseFloat(lat)  : null,
      longitud:       lng  ? parseFloat(lng)  : null,
      radioKm:        radio          ? parseFloat(radio)          : 20,
      rubroId:        rubro_id       ? parseInt(rubro_id)         : null,
      q:              q              || null,
      calificacionMin: calificacion_min || null,
      tarifaMin:      tarifa_min     || null,
      tarifaMax:      tarifa_max     || null,
      orden:          orden          || null,
      diaSemana:      dia_semana != null && dia_semana !== '' ? dia_semana : null
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const buscarTiendas = async (req, res) => {
  try {
    const { lat, lng, radio } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: "lat y lng son requeridos" });
    res.json(await svc.buscarTiendasCercanas({
      latitud: parseFloat(lat),
      longitud: parseFloat(lng),
      radioKm: radio ? parseFloat(radio) : 20
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getMapa = async (req, res) => {
  try {
    const { lat, lng, radio, tipo } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: "lat y lng son requeridos" });
    res.json(await svc.getMapaDisponibilidad({
      latitud: parseFloat(lat),
      longitud: parseFloat(lng),
      radioKm: radio ? parseFloat(radio) : 30,
      tipo: tipo || null
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const actualizarUbicacion = async (req, res) => {
  try {
    await svc.actualizarUbicacionPerfil(req.usuario.id, req.body);
    res.json({ mensaje: "Ubicacion actualizada" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Alias público usado por el mapa del sidebar y feed
const nearby = async (req, res) => {
  try {
    const { lat, lng, radio } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: "lat y lng son requeridos" });
    const workers = await svc.buscarTrabajadoresCercanos({
      latitud: parseFloat(lat),
      longitud: parseFloat(lng),
      radioKm: radio ? parseFloat(radio) : 20
    });
    // Mapear nombres de campo al formato esperado por el frontend
    const result = workers.map(w => ({
      ...w,
      lat: w.latitud,
      lng: w.longitud,
      distancia: w.distancia_km
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getZonas, setZonas, addZona, removeZona, getFeed, buscarTrabajadores, buscarTiendas, getMapa, actualizarUbicacion, nearby };
