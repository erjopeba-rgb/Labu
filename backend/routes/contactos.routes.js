const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/contactos.controller");
const { verificarToken } = require("../middlewares/auth.middleware");

const auth = [verificarToken];

// Estado de la relacion entre el usuario autenticado y otro usuario
router.get("/estado/:userId", ...auth, ctrl.getEstado);

// Conteos de amigos/seguidores de un usuario (para mostrar en perfil)
router.get("/conteos/:userId", ...auth, ctrl.getConteos);

// Mis contactos (amigos + seguidos aceptados)
router.get("/mis-contactos", ...auth, ctrl.listarContactos);

// Enviar solicitud de amistad o comenzar a seguir
router.post("/solicitar/:userId", ...auth, ctrl.solicitar);

// Aceptar solicitud pendiente
router.patch("/:id/aceptar", ...auth, ctrl.aceptar);

// Rechazar solicitud pendiente
router.patch("/:id/rechazar", ...auth, ctrl.rechazar);

// Eliminar relacion existente (dejar de seguir / eliminar amigo)
router.delete("/:id", ...auth, ctrl.eliminar);

module.exports = router;
