const express = require("express");
const router = express.Router();
const { getPublicProfile } = require("../controllers/profile.controller");
const { verificarTokenOpcional } = require("../middlewares/auth.middleware");

// GET /api/users/:id/profile  → perfil público, accesible sin login
router.get("/:id/profile", verificarTokenOpcional, getPublicProfile);

module.exports = router;
