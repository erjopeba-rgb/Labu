// Agrega el header X-API-Version a todas las respuestas
module.exports = (req, res, next) => {
  res.setHeader("X-API-Version", "1.0.0");
  next();
};
