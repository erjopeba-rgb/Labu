const profileRepo = require("../repositories/profile.repository");
const { calcularNivel } = require("./confianza.service");

const MEDIOS_VALIDOS = ['auto', 'moto', 'bici', 'caminando'];

const completarPerfil = async ({
    usuario_id, nombre, apellido, telefono, ciudad, provincia, descripcion,
    clasificacion, nombre_negocio,
    anios_experiencia, descripcion_habilidades, herramientas,
    disponibilidad_general, medio_transporte, rubros, zonas
}) => {
    const medioTransporte = MEDIOS_VALIDOS.includes(medio_transporte) ? medio_transporte : null;

    await profileRepo.upsertPerfil({
        usuario_id, nombre, apellido, telefono, ciudad, provincia, descripcion,
        clasificacion, nombre_negocio,
        anios_experiencia, descripcion_habilidades, herramientas,
        disponibilidad_general, medioTransporte
    });

    if (Array.isArray(rubros)) {
        await profileRepo.replaceRubros(usuario_id, rubros);
    }

    if (Array.isArray(zonas)) {
        await profileRepo.replaceZonas(usuario_id, zonas);
    }

    return { nombre, apellido };
};

const actualizarAvatar = async (usuario_id, avatar_url) => {
    await profileRepo.updateAvatar(usuario_id, avatar_url);
    return { avatar_url };
};

const obtenerPerfil = async (usuario_id) => {
    const perfil = await profileRepo.findPerfil(usuario_id);
    if (!perfil) return null;

    perfil.rubros = await profileRepo.findRubros(usuario_id);
    const zonas = await profileRepo.findZonas(usuario_id);
    perfil.zonas = zonas.map(z => z.localidad);
    return perfil;
};

const obtenerPerfilPublico = async (usuario_id) => {
    const usuario = await profileRepo.findUsuarioActivo(usuario_id);
    if (!usuario) return null;

    const [perfil, stats, resenas, totalTrabajos] = await Promise.all([
        obtenerPerfil(usuario_id),
        profileRepo.findStats(usuario_id),
        profileRepo.findResenas(usuario_id),
        profileRepo.findTotalTrabajosCompletados(usuario_id)
    ]);

    return {
        usuario,
        perfil,
        stats: {
            trabajos_completados: parseInt(stats.trabajos_completados) || 0,
            rating:               stats.rating ? Number(stats.rating).toFixed(1) : null,
            total_resenas:        parseInt(stats.total_resenas) || 0,
            tasa_exito:           stats.tasa_exito ? parseInt(stats.tasa_exito) : null,
            nivel_confianza:      calcularNivel(totalTrabajos),
            total_trabajos_et:    totalTrabajos
        },
        resenas: resenas.map(r => ({
            rating:          r.rating,
            comentario:      r.comentario,
            created_at:      r.created_at,
            autor_nombre:    ((r.autor_nombre || '') + ' ' + (r.autor_apellido || '')).trim() || 'Usuario'
        })),
        habilidades: []   // kept for backward compat
    };
};

module.exports = { completarPerfil, actualizarAvatar, obtenerPerfil, obtenerPerfilPublico };
