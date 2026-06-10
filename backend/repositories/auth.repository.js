const pool = require("../config/db");

// ─── Usuarios ─────────────────────────────────────────────────────────────────

const findByEmail = async (email) => {
    const { rows } = await pool.query("SELECT id FROM usuarios WHERE email = $1", [email]);
    return rows[0] || null;
};

const findActiveByEmail = async (email) => {
    const { rows } = await pool.query(
        "SELECT * FROM usuarios WHERE email = $1 AND activo = TRUE",
        [email]
    );
    return rows[0] || null;
};

const insertUser = async (email, password_hash, tipo_perfil, fecha_nacimiento) => {
    const { rows } = await pool.query(
        `INSERT INTO usuarios (email, password_hash, tipo_perfil, perfil_activo, fecha_nacimiento)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, tipo_perfil, perfil_activo`,
        [email, password_hash, tipo_perfil, tipo_perfil, fecha_nacimiento]
    );
    return rows[0];
};

const findById = async (usuarioId) => {
    const { rows } = await pool.query(
        "SELECT id, email, tipo_perfil, perfil_activo FROM usuarios WHERE id = $1 AND activo = TRUE",
        [usuarioId]
    );
    return rows[0] || null;
};

const updatePerfilActivo = async (usuarioId, perfil, tipo) => {
    await pool.query(
        "UPDATE usuarios SET perfil_activo = $1, tipo_perfil = $2 WHERE id = $3",
        [perfil, tipo, usuarioId]
    );
};

// ─── Términos y condiciones ───────────────────────────────────────────────────

const updateTyC = async (usuarioId) => {
    const { rowCount } = await pool.query(
        "UPDATE usuarios SET tyc_aceptado = NOW() WHERE id = $1",
        [usuarioId]
    );
    return rowCount;
};

const findVersionTyCVigente = async () => {
    const { rows: [tyc] } = await pool.query(
        "SELECT id FROM versiones_tyc WHERE vigente = TRUE LIMIT 1"
    );
    return tyc || null;
};

const insertAceptacionTyC = async (usuarioId, versionId, ip) => {
    await pool.query(
        `INSERT INTO aceptaciones_tyc (usuario_id, version_tyc_id, ip_address)
         VALUES ($1, $2, $3)
         ON CONFLICT (usuario_id, version_tyc_id) DO NOTHING`,
        [usuarioId, versionId, ip || null]
    );
};

// ─── Contraseña ───────────────────────────────────────────────────────────────

const findPasswordHash = async (usuarioId) => {
    const { rows } = await pool.query(
        "SELECT password_hash FROM usuarios WHERE id = $1 AND activo = TRUE",
        [usuarioId]
    );
    return rows[0] || null;
};

const updatePassword = async (usuarioId, hash) => {
    await pool.query(
        "UPDATE usuarios SET password_hash = $1 WHERE id = $2",
        [hash, usuarioId]
    );
};

// ─── Perfil activo ────────────────────────────────────────────────────────────

const findPerfilActivo = async (usuarioId) => {
    const { rows } = await pool.query(
        "SELECT perfil_activo, tipo_perfil, email_verificado FROM usuarios WHERE id = $1",
        [usuarioId]
    );
    return rows[0] || null;
};

module.exports = {
    findByEmail,
    findActiveByEmail,
    insertUser,
    findById,
    updatePerfilActivo,
    updateTyC,
    findVersionTyCVigente,
    insertAceptacionTyC,
    findPasswordHash,
    updatePassword,
    findPerfilActivo,
};
