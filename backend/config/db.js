require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Pool } = require("pg");
const logger = require("./logger");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 50,
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.query("SELECT NOW()", (err) => {
  if (err) {
    logger.error({ err: err.message }, "Error conectando a PostgreSQL");
  } else {
    logger.info("Conectado a PostgreSQL");
  }
});

module.exports = pool;