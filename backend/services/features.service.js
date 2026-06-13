const pool = require("../config/db");
const AppError = require("../utils/AppError");

// ─── PLANNER ──────────────────────────────────────────────────────────────────

const getPlanners = async (usuarioId) => {
  const { rows } = await pool.query(
    `SELECT p.*, t.titulo AS trabajo_titulo
     FROM planners p
     LEFT JOIN trabajos t ON t.id = p.trabajo_id
     WHERE p.usuario_id = $1 AND p.activo = TRUE
     ORDER BY p.actualizado_en DESC`,
    [usuarioId]
  );
  return rows;
};

const getPlanner = async (plannerId, usuarioId) => {
  const { rows: [p] } = await pool.query(
    "SELECT * FROM planners WHERE id = $1 AND usuario_id = $2 AND activo = TRUE",
    [plannerId, usuarioId]
  );
  if (!p) throw new AppError("Planner no encontrado o sin permiso", 404);
  return p;
};

const crearPlanner = async ({ usuarioId, trabajoId, nombre, anchoTotal, altoTotal, unidad, datosJson }) => {
  const { rows: [p] } = await pool.query(
    `INSERT INTO planners (usuario_id, trabajo_id, nombre, ancho_total, alto_total, unidad, datos_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [usuarioId, trabajoId||null, nombre, anchoTotal||null, altoTotal||null, unidad||'metros', datosJson||{}]
  );
  return p;
};

const actualizarPlanner = async (plannerId, usuarioId, datos) => {
  const { rows: [p] } = await pool.query(
    `UPDATE planners SET
       nombre = COALESCE($1, nombre),
       ancho_total = COALESCE($2, ancho_total),
       alto_total = COALESCE($3, alto_total),
       datos_json = COALESCE($4, datos_json),
       trabajo_id = COALESCE($5, trabajo_id),
       actualizado_en = NOW()
     WHERE id = $6 AND usuario_id = $7 RETURNING *`,
    [datos.nombre||null, datos.ancho_total||null, datos.alto_total||null,
     datos.datos_json||null, datos.trabajo_id||null, plannerId, usuarioId]
  );
  if (!p) throw new AppError("Planner no encontrado o sin permiso", 404);
  return p;
};

const eliminarPlanner = async (plannerId, usuarioId) => {
  const { rows: [p] } = await pool.query(
    "UPDATE planners SET activo = FALSE WHERE id = $1 AND usuario_id = $2 RETURNING id",
    [plannerId, usuarioId]
  );
  if (!p) throw new AppError("Planner no encontrado o sin permiso", 404);
};

// ─── PROYECTOS ────────────────────────────────────────────────────────────────

const getProyectos = async (duenioId) => {
  const { rows } = await pool.query(
    `SELECT p.*,
            (SELECT COUNT(*) FROM trabajos_proyecto tp WHERE tp.proyecto_id = p.id) AS total_trabajos,
            (SELECT COUNT(*) FROM trabajos_proyecto tp
             JOIN trabajos t ON t.id = tp.trabajo_id
             WHERE tp.proyecto_id = p.id AND t.estado = 'finalizado') AS trabajos_completados
     FROM proyectos p
     WHERE p.dueno_id = $1 AND p.activo = TRUE
     ORDER BY p.creado_en DESC`,
    [duenioId]
  );
  return rows;
};

const getProyecto = async (proyectoId, duenioId) => {
  const { rows: [p] } = await pool.query(
    "SELECT * FROM proyectos WHERE id = $1 AND dueno_id = $2 AND activo = TRUE",
    [proyectoId, duenioId]
  );
  if (!p) throw new AppError("Proyecto no encontrado o sin permiso", 404);

  const { rows: trabajos } = await pool.query(
    `SELECT tp.*, t.titulo, t.estado, t.rubro_id, r.nombre AS rubro_nombre,
            pf.nombre AS trabajador_nombre
     FROM trabajos_proyecto tp
     JOIN trabajos t ON t.id = tp.trabajo_id
     LEFT JOIN rubros r ON r.id = t.rubro_id
     LEFT JOIN perfiles pf ON pf.usuario_id = t.trabajador_id
     WHERE tp.proyecto_id = $1
     ORDER BY tp.orden ASC`,
    [proyectoId]
  );

  return { ...p, trabajos };
};

const crearProyecto = async ({ duenioId, titulo, descripcion, presupuestoTotal, fechaInicio, fechaEstimadaFin, plannerId }) => {
  const { rows: [p] } = await pool.query(
    `INSERT INTO proyectos (dueno_id, titulo, descripcion, presupuesto_total, fecha_inicio, fecha_estimada_fin, planner_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [duenioId, titulo, descripcion||null, presupuestoTotal||null, fechaInicio||null, fechaEstimadaFin||null, plannerId||null]
  );
  return p;
};

const agregarTrabajoProyecto = async (proyectoId, duenioId, trabajoId, orden, dependeDe) => {
  const { rows: [proy] } = await pool.query(
    "SELECT id FROM proyectos WHERE id = $1 AND dueno_id = $2", [proyectoId, duenioId]
  );
  if (!proy) throw new AppError("Proyecto no encontrado o sin permiso", 404);

  const { rows: [tp] } = await pool.query(
    `INSERT INTO trabajos_proyecto (proyecto_id, trabajo_id, orden, depende_de)
     VALUES ($1,$2,$3,$4) ON CONFLICT (proyecto_id, trabajo_id) DO UPDATE SET orden = EXCLUDED.orden
     RETURNING *`,
    [proyectoId, trabajoId, orden||0, dependeDe||null]
  );
  return tp;
};

const actualizarProyecto = async (proyectoId, duenioId, datos) => {
  const sets = [];
  const params = [];
  let i = 1;
  if (datos.titulo) { sets.push(`titulo=$${i++}`); params.push(datos.titulo); }
  if (datos.descripcion !== undefined) { sets.push(`descripcion=$${i++}`); params.push(datos.descripcion); }
  if (datos.estado) { sets.push(`estado=$${i++}`); params.push(datos.estado); }
  if (datos.presupuesto_total) { sets.push(`presupuesto_total=$${i++}`); params.push(datos.presupuesto_total); }
  if (datos.fecha_estimada_fin) { sets.push(`fecha_estimada_fin=$${i++}`); params.push(datos.fecha_estimada_fin); }
  sets.push(`actualizado_en=NOW()`);
  params.push(proyectoId, duenioId);

  const { rows: [p] } = await pool.query(
    `UPDATE proyectos SET ${sets.join(',')} WHERE id = $${i++} AND dueno_id = $${i++} RETURNING *`,
    params
  );
  if (!p) throw new AppError("Proyecto no encontrado o sin permiso", 404);
  return p;
};

// ─── HERRAMIENTAS ─────────────────────────────────────────────────────────────

const getHerramientas = async (trabajadorId) => {
  const { rows } = await pool.query(
    "SELECT * FROM herramientas WHERE trabajador_id = $1 AND activo = TRUE ORDER BY categoria, nombre",
    [trabajadorId]
  );
  return rows;
};

const addHerramienta = async ({ trabajadorId, nombre, descripcion, categoria, marca, fotoUrl }) => {
  const { rows: [h] } = await pool.query(
    `INSERT INTO herramientas (trabajador_id, nombre, descripcion, categoria, marca, foto_url)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [trabajadorId, nombre, descripcion||null, categoria||null, marca||null, fotoUrl||null]
  );
  return h;
};

const updateHerramienta = async (herramientaId, trabajadorId, datos) => {
  const { rows: [h] } = await pool.query(
    `UPDATE herramientas SET
       nombre=COALESCE($1,nombre), descripcion=COALESCE($2,descripcion),
       categoria=COALESCE($3,categoria), marca=COALESCE($4,marca),
       disponible=COALESCE($5,disponible)
     WHERE id=$6 AND trabajador_id=$7 RETURNING *`,
    [datos.nombre||null, datos.descripcion||null, datos.categoria||null, datos.marca||null, datos.disponible??null, herramientaId, trabajadorId]
  );
  if (!h) throw new AppError("Herramienta no encontrada o sin permiso", 404);
  return h;
};

const deleteHerramienta = async (herramientaId, trabajadorId) => {
  const { rows: [h] } = await pool.query(
    "UPDATE herramientas SET activo = FALSE WHERE id = $1 AND trabajador_id = $2 RETURNING id",
    [herramientaId, trabajadorId]
  );
  if (!h) throw new AppError("Herramienta no encontrada o sin permiso", 404);
};

// ─── VIDEOS ───────────────────────────────────────────────────────────────────

const subirVideo = async ({ autorId, titulo, descripcion, urlVideo, urlExterno, urlThumbnail, duracionSegundos, categoria, rubroId, precio, esGratis, nivel }) => {
  const { rows: [v] } = await pool.query(
    `INSERT INTO videos_educativos (autor_id, titulo, descripcion, url_video, url_externo, url_thumbnail, duracion_segundos, categoria, rubro_id, precio, es_gratis, nivel)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [autorId, titulo, descripcion||null, urlVideo||null, urlExterno||null, urlThumbnail||null, duracionSegundos||null, categoria||null, rubroId||null, precio||0, esGratis||false, nivel||'principiante']
  );
  return v;
};

const getMisVideos = async (autorId) => {
  const { rows } = await pool.query(
    `SELECT v.*,
            (SELECT COUNT(*) FROM accesos_video WHERE video_id = v.id) AS total_compradores,
            (SELECT ROUND(AVG(puntaje)::numeric,1) FROM calificaciones_video WHERE video_id = v.id) AS calificacion
     FROM videos_educativos v
     WHERE v.autor_id = $1 AND v.activo = TRUE
     ORDER BY v.creado_en DESC`,
    [autorId]
  );
  return rows;
};

module.exports = {
  getPlanners, getPlanner, crearPlanner, actualizarPlanner, eliminarPlanner,
  getProyectos, getProyecto, crearProyecto, agregarTrabajoProyecto, actualizarProyecto,
  getHerramientas, addHerramienta, updateHerramienta, deleteHerramienta,
  subirVideo, getMisVideos
};
