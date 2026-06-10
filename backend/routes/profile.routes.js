const express = require("express");
const router = express.Router();
const { completeProfile, uploadProfileAvatar, getProfile, getPublicProfile } = require("../controllers/profile.controller");
const { verificarToken } = require("../middlewares/auth.middleware");
const { uploadAvatar } = require("../middlewares/upload.middleware");

router.post("/complete", verificarToken, completeProfile);
router.post("/avatar",   verificarToken, uploadAvatar, uploadProfileAvatar);
router.get("/",          verificarToken, getProfile);
router.get("/public/:id", verificarToken, getPublicProfile);

module.exports = router;
