const pool = require("../config/db");

const CATEGORIAS = ["fraude","contenido_inapropiado","acoso","identidad_falsa","servicio_prohibido","incumplimiento","otro"];
const TIPOS = ["usuario","trabajo","oferta","comportamiento"];

const createDenuncia = async ({ denuncianteId, denunciadoId, trabajoId, tipo, categoria, descripcion, evidenciaUrls=[] }) => {
  if (!TIPOS.includes(tipo)) throw new Error("Tipo de denuncia invalido");
  if (!CATEGORIAS.includes(categoria)) throw new Error("Categoria invalida");
  if (!descripcion || descripcion.length < 20) throw new Error("La descripcion debe tener al menos 20 caracteres");
  if (denunciadoId && denunciadoId === denuncianteId) throw new Error("No puedes denunciarte a ti mismo");
  const { rows: [d] } = await pool.query(
    `INSERT INTO denuncias (denunciante_id, denunciado_id, trabajo_id, tipo, categoria, descripcion, evidencia_urls)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, tipo, categoria, estado, created_at`,
    [denuncianteId, denunciadoId||null, trabajoId||null, tipo, categoria, descripcion, evidenciaUrls]
  );
  return d;
};

const getDenuncias = async (estado) => {
  const where = estado ? "WHERE d.estado=$1" : "";
  const params = estado ? [estado] : [];
  const { rows } = await pool.query(
    `SELECT d.*, u1.nombre AS denunciante_nombre, u2.nombre AS denunciado_nombre
     FROM denuncias d
     JOIN usuarios u1 ON u1.id=d.denunciante_id
     LEFT JOIN usuarios u2 ON u2.id=d.denunciado_id
     ${where}
     ORDER BY d.created_at DESC`,
    params
  );
  return rows;
};

const resolverDenuncia = async ({ denunciaId, moderadorId, estado, resolucion }) => {
  if (!["resuelta","desestimada","en_revision"].includes(estado)) throw new Error("Estado invalido");
  const { rows: [d] } = await pool.query(
    `UPDATE denuncias SET estado=$1, resolucion=$2, moderador_id=$3, updated_at=NOW()
     WHERE id=$4 RETURNING *`,
    [estado, resolucion, moderadorId, denunciaId]
  );
  if (!d) throw new Error("Denuncia no encontrada");
  return d;
};

module.exports = { createDenuncia, getDenuncias, resolverDenuncia };
