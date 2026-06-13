const svc = require("../services/geolocalizacion.service");
const AppError = require("../utils/AppError");
const { successResponse } = require("../utils/apiResponse");

const getZonas = async (req, res, next) => {
  try {
    successResponse(res, { zonas: await svc.getZonasTrabajador(req.usuario.id) });
  } catch (err) {
    next(err);
  }
};

const setZonas = async (req, res, next) => {
  try {
    const { zonas } = req.body;
    if (!zonas || !Array.isArray(zonas)) throw new AppError("zonas debe ser un array", 400);
    successResponse(res, { zonas: await svc.setZonasTrabajador(req.usuario.id, zonas) });
  } catch (err) {
    next(err);
  }
};

const addZona = async (req, res, next) => {
  try {
    const { provincia, localidad } = req.body;
    if (!provincia || !localidad) throw new AppError("provincia y localidad son requeridos", 400);
    successResponse(res, { zona: await svc.addZona(req.usuario.id, provincia, localidad) }, 201);
  } catch (err) {
    next(err);
  }
};

const removeZona = async (req, res, next) => {
  try {
    await svc.removeZona(req.usuario.id, parseInt(req.params.id));
    successResponse(res, { mensaje: "Zona eliminada" });
  } catch (err) {
    next(err);
  }
};

const getFeed = async (req, res, next) => {
  try {
    const { estado, rubro_id, limit, offset } = req.query;
    const trabajos = await svc.getTrabajosPorZona(req.usuario.id, {
      estado: estado || 'publicado',
      rubroId: rubro_id ? parseInt(rubro_id) : null,
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0
    });
    successResponse(res, { data: trabajos });
  } catch (err) {
    next(err);
  }
};

const buscarTrabajadores = async (req, res, next) => {
  try {
    const { lat, lng, radio, rubro_id, q, calificacion_min, tarifa_min, tarifa_max, orden, dia_semana } = req.query;

    // Si se provee solo una coordenada, la petición es inválida
    if ((lat && !lng) || (!lat && lng)) {
      throw new AppError("Se requieren lat y lng juntos, o ninguno", 400);
    }

    successResponse(res, { trabajadores: await svc.buscarTrabajadoresCercanos({
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
    }) });
  } catch (err) {
    next(err);
  }
};

const buscarTiendas = async (req, res, next) => {
  try {
    const { lat, lng, radio } = req.query;
    if (!lat || !lng) throw new AppError("lat y lng son requeridos", 400);
    successResponse(res, { tiendas: await svc.buscarTiendasCercanas({
      latitud: parseFloat(lat),
      longitud: parseFloat(lng),
      radioKm: radio ? parseFloat(radio) : 20
    }) });
  } catch (err) {
    next(err);
  }
};

const getMapa = async (req, res, next) => {
  try {
    const { lat, lng, radio, tipo } = req.query;
    if (!lat || !lng) throw new AppError("lat y lng son requeridos", 400);
    successResponse(res, await svc.getMapaDisponibilidad({
      latitud: parseFloat(lat),
      longitud: parseFloat(lng),
      radioKm: radio ? parseFloat(radio) : 30,
      tipo: tipo || null
    }));
  } catch (err) {
    next(err);
  }
};

const actualizarUbicacion = async (req, res, next) => {
  try {
    await svc.actualizarUbicacionPerfil(req.usuario.id, req.body);
    successResponse(res, { mensaje: "Ubicacion actualizada" });
  } catch (err) {
    next(err);
  }
};

// Alias público usado por el mapa del sidebar y feed
const nearby = async (req, res, next) => {
  try {
    const { lat, lng, radio } = req.query;
    if (!lat || !lng) throw new AppError("lat y lng son requeridos", 400);
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
    successResponse(res, { workers: result });
  } catch (err) {
    next(err);
  }
};

module.exports = { getZonas, setZonas, addZona, removeZona, getFeed, buscarTrabajadores, buscarTiendas, getMapa, actualizarUbicacion, nearby };
