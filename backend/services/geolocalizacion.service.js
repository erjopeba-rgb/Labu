const pool = require("../config/db");

// ─── ZONAS DEL TRABAJADOR ─────────────────────────────────────────────────────

const getZonasTrabajador = async (trabajadorId) => {
  const { rows } = await pool.query(
    "SELECT * FROM zonas_trabajo WHERE trabajador_id = $1 AND activa = TRUE ORDER BY provincia, localidad",
    [trabajadorId]
  );
  return rows;
};

const setZonasTrabajador = async (trabajadorId, zonas) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE zonas_trabajo SET activa = FALSE WHERE trabajador_id = $1", [trabajadorId]);
    for (const z of zonas) {
      await client.query(
        `INSERT INTO zonas_trabajo (trabajador_id, provincia, localidad)
         VALUES ($1,$2,$3)
         ON CONFLICT (trabajador_id, provincia, localidad) DO UPDATE SET activa = TRUE`,
        [trabajadorId, z.provincia, z.localidad]
      );
    }
    await client.query("COMMIT");
    return await getZonasTrabajador(trabajadorId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const addZona = async (trabajadorId, provincia, localidad) => {
  const { rows: [z] } = await pool.query(
    `INSERT INTO zonas_trabajo (trabajador_id, provincia, localidad)
     VALUES ($1,$2,$3)
     ON CONFLICT (trabajador_id, provincia, localidad) DO UPDATE SET activa = TRUE
     RETURNING *`,
    [trabajadorId, provincia, localidad]
  );
  return z;
};

const removeZona = async (trabajadorId, zonaId) => {
  const { rows: [z] } = await pool.query(
    "UPDATE zonas_trabajo SET activa = FALSE WHERE id = $1 AND trabajador_id = $2 RETURNING id",
    [zonaId, trabajadorId]
  );
  if (!z) throw new Error("Zona no encontrada o sin permiso");
};

// ─── FEED DE TRABAJOS POR ZONA ────────────────────────────────────────────────

const getTrabajosPorZona = async (trabajadorId, { estado, rubroId, limit, offset }) => {
  const { rows: zonas } = await pool.query(
    "SELECT provincia, localidad FROM zonas_trabajo WHERE trabajador_id = $1 AND activa = TRUE",
    [trabajadorId]
  );

  let whereExtra = "";
  const params = [];
  let i = 1;

  if (estado) { whereExtra += ` AND t.estado = $${i++}`; params.push(estado); }
  if (rubroId) { whereExtra += ` AND t.rubro_id = $${i++}`; params.push(rubroId); }

  const lim = limit || 20;
  const off = offset || 0;

  // Remotos: siempre visibles
  // Presenciales/hibridos: solo si coinciden con alguna zona del trabajador
  let query;
  if (zonas.length === 0) {
    // Sin zonas configuradas: solo remotos
    query = await pool.query(
      `SELECT t.*, r.nombre AS rubro_nombre, p.nombre AS dueno_nombre
       FROM trabajos t
       JOIN rubros r ON r.id = t.rubro_id
       JOIN perfiles p ON p.usuario_id = t.dueno_id
       WHERE t.estado = 'publicado' AND t.modalidad = 'remoto'
       ${whereExtra}
       ORDER BY t.es_urgente DESC, t.creado_en DESC
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, lim, off]
    );
  } else {
    const zonasValues = zonas.map((z, idx) =>
      `($${i + idx * 2}, $${i + idx * 2 + 1})`
    ).join(",");
    const zonasParams = zonas.flatMap(z => [z.provincia, z.localidad]);
    i += zonas.length * 2;

    query = await pool.query(
      `SELECT t.*, r.nombre AS rubro_nombre, p.nombre AS dueno_nombre
       FROM trabajos t
       JOIN rubros r ON r.id = t.rubro_id
       JOIN perfiles p ON p.usuario_id = t.dueno_id
       WHERE t.estado = 'publicado'
       AND (
         t.modalidad = 'remoto'
         OR (t.modalidad IN ('presencial','hibrido') AND (t.provincia, t.ciudad) IN (${zonasValues}))
       )
       ${whereExtra}
       ORDER BY t.es_urgente DESC, t.creado_en DESC
       LIMIT $${i++} OFFSET $${i++}`,
      [...zonasParams, ...params, lim, off]
    );
  }

  return query.rows;
};

// ─── BUSQUEDA CON RADIO ───────────────────────────────────────────────────────

const buscarTrabajadoresCercanos = async ({ latitud, longitud, radioKm, rubroId, q, calificacionMin, tarifaMin, tarifaMax, orden, diaSemana }) => {
  const tieneGeo = latitud != null && longitud != null;
  const params = [];
  const condiciones = ["u.tipo_perfil = 'trabajador'", "u.suspendido = FALSE"];
  let i = 1;

  if (tieneGeo) {
    params.push(latitud, longitud); // $1, $2
    i = 3;
    condiciones.push("p.latitud IS NOT NULL", "p.longitud IS NOT NULL");
  }

  if (rubroId)       { condiciones.push(`p.rubro_id = $${i++}`);                  params.push(parseInt(rubroId)); }
  if (q)             { condiciones.push(`p.nombre ILIKE $${i++}`);                params.push(`%${q}%`); }
  if (calificacionMin) { condiciones.push(`p.calificacion_promedio >= $${i++}`);  params.push(parseFloat(calificacionMin)); }
  if (tarifaMin)     { condiciones.push(`p.tarifa_hora >= $${i++}`);              params.push(parseFloat(tarifaMin)); }
  if (tarifaMax)     { condiciones.push(`p.tarifa_hora <= $${i++}`);              params.push(parseFloat(tarifaMax)); }

  let joinDisp = '';
  if (diaSemana != null && diaSemana !== '') {
    joinDisp = `JOIN disponibilidad_trabajador dt ON dt.trabajador_id = p.usuario_id AND dt.dia_semana = $${i++} AND dt.activo = TRUE`;
    params.push(parseInt(diaSemana));
  }

  const where = 'WHERE ' + condiciones.join(' AND ');

  let orderBy;
  switch (orden) {
    case 'calificacion': orderBy = 'p.calificacion_promedio DESC NULLS LAST'; break;
    case 'tarifa_asc':   orderBy = 'p.tarifa_hora ASC NULLS LAST';            break;
    case 'tarifa_desc':  orderBy = 'p.tarifa_hora DESC NULLS LAST';           break;
    default:             orderBy = tieneGeo ? 'distancia_km ASC NULLS LAST' : 'p.calificacion_promedio DESC NULLS LAST';
  }

  let rows;
  if (tieneGeo) {
    const radioIdx = i++;
    params.push(radioKm || 20);
    const resultado = await pool.query(
      `WITH distancias AS (
         SELECT p.*, u.tipo_perfil,
           ROUND((6371 * acos(LEAST(1.0,
             cos(radians($1)) * cos(radians(p.latitud)) *
             cos(radians(p.longitud) - radians($2)) +
             sin(radians($1)) * sin(radians(p.latitud))
           )))::numeric, 1) AS distancia_km
         FROM perfiles p
         JOIN usuarios u ON u.id = p.usuario_id
         ${joinDisp}
         ${where}
       )
       SELECT * FROM distancias WHERE distancia_km <= $${radioIdx}
       ORDER BY ${orderBy}`,
      params
    );
    rows = resultado.rows;
  } else {
    const resultado = await pool.query(
      `SELECT p.*, u.tipo_perfil, NULL::numeric AS distancia_km
       FROM perfiles p
       JOIN usuarios u ON u.id = p.usuario_id
       ${joinDisp}
       ${where}
       ORDER BY ${orderBy}`,
      params
    );
    rows = resultado.rows;
  }

  return rows.map(r => ({ ...r, id: r.usuario_id }));
};

const buscarTiendasCercanas = async ({ latitud, longitud, radioKm }) => {
  const { rows } = await pool.query(
    `WITH distancias AS (
       SELECT pt.*,
         ROUND((
           6371 * acos(
             cos(radians($1)) * cos(radians(pt.latitud)) *
             cos(radians(pt.longitud) - radians($2)) +
             sin(radians($1)) * sin(radians(pt.latitud))
           )
         )::numeric, 1) AS distancia_km
       FROM perfiles_tienda pt
       WHERE pt.activa = TRUE
         AND pt.latitud IS NOT NULL
         AND pt.longitud IS NOT NULL
     )
     SELECT * FROM distancias WHERE distancia_km <= $3
     ORDER BY distancia_km ASC`,
    [latitud, longitud, radioKm || 20]
  );
  return rows;
};

// ─── DATOS PARA MAPA ──────────────────────────────────────────────────────────

const getMapaDisponibilidad = async ({ latitud, longitud, radioKm, tipo }) => {
  const radio = radioKm || 30;
  const resultado = { trabajadores: [], tiendas: [] };

  if (!tipo || tipo === 'trabajadores') {
    resultado.trabajadores = await buscarTrabajadoresCercanos({ latitud, longitud, radioKm: radio });
  }
  if (!tipo || tipo === 'tiendas') {
    resultado.tiendas = await buscarTiendasCercanas({ latitud, longitud, radioKm: radio });
  }

  return resultado;
};

// ─── ACTUALIZAR UBICACION ─────────────────────────────────────────────────────

const actualizarUbicacionPerfil = async (usuarioId, { latitud, longitud, ciudad, provincia, localidad }) => {
  const sets = [];
  const params = [];
  let i = 1;

  if (latitud !== undefined) { sets.push(`latitud=$${i++}`); params.push(latitud); }
  if (longitud !== undefined) { sets.push(`longitud=$${i++}`); params.push(longitud); }
  if (ciudad) { sets.push(`ciudad=$${i++}`); params.push(ciudad); }
  if (provincia) { sets.push(`provincia=$${i++}`); params.push(provincia); }
  sets.push(`actualizado_en=NOW()`);
  params.push(usuarioId);

  await pool.query(
    `UPDATE perfiles SET ${sets.join(",")} WHERE usuario_id = $${i}`,
    params
  );
};

module.exports = {
  getZonasTrabajador, setZonasTrabajador, addZona, removeZona,
  getTrabajosPorZona,
  buscarTrabajadoresCercanos, buscarTiendasCercanas,
  getMapaDisponibilidad, actualizarUbicacionPerfil
};
