const jwt = require("jsonwebtoken");

const verificarToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: "Token requerido" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
};

// Middleware opcional: si hay token lo verifica; si no hay o es inválido, continúa sin usuario
const verificarTokenOpcional = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token) {
    try {
      req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    } catch (_) {
      // Token inválido o ausente: continuar sin usuario autenticado
    }
  }
  next();
};

module.exports = { verificarToken, verificarTokenOpcional };