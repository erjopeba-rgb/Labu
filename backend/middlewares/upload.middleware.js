const multer = require("multer");

const memoriaStorage = multer.memoryStorage();
const MAX_IMAGEN_SIZE = 5 * 1024 * 1024; // 5MB
const TIPOS_IMAGEN_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];

function filtroImagenEstricto(_req, file, cb) {
    if (TIPOS_IMAGEN_PERMITIDOS.includes(file.mimetype)) return cb(null, true);
    const err = new Error(`Tipo de archivo no permitido. Solo se aceptan JPEG, PNG y WebP`);
    err.esErrorTipoArchivo = true;
    cb(err);
}

// Envuelve un uploader de multer y devuelve 400 con mensaje claro ante tamaño o tipo incorrecto
function wrapUpload(uploader, limiteMB = 5) {
    return (req, res, next) => {
        uploader(req, res, (err) => {
            if (!err) return next();
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: `El archivo supera el límite de ${limiteMB}MB` });
            }
            if (err.esErrorTipoArchivo) {
                return res.status(400).json({ error: err.message });
            }
            next(err);
        });
    };
}

const uploadJobMedia = wrapUpload(multer({
    storage: memoriaStorage,
    fileFilter: filtroImagenEstricto,
    limits: { fileSize: MAX_IMAGEN_SIZE }
}).array("media", 13));

const uploadPortfolioMedia = wrapUpload(multer({
    storage: memoriaStorage,
    fileFilter: filtroImagenEstricto,
    limits: { fileSize: MAX_IMAGEN_SIZE }
}).fields([
    { name: "foto_despues", maxCount: 1 },
    { name: "foto_antes",   maxCount: 1 }
]));

const uploadResultadoMedia = wrapUpload(multer({
    storage: memoriaStorage,
    fileFilter: filtroImagenEstricto,
    limits: { fileSize: MAX_IMAGEN_SIZE }
}).single("foto_resultado"));

const uploadAvatar = wrapUpload(multer({
    storage: memoriaStorage,
    fileFilter: filtroImagenEstricto,
    limits: { fileSize: MAX_IMAGEN_SIZE }
}).single("avatar"));

const uploadVerificacion = wrapUpload(multer({
    storage: memoriaStorage,
    fileFilter: filtroImagenEstricto,
    limits: { fileSize: MAX_IMAGEN_SIZE }
}).fields([
    { name: "dni_frente", maxCount: 1 },
    { name: "dni_dorso",  maxCount: 1 },
    { name: "selfie",     maxCount: 1 }
]));

const MAX_VIDEO_SIZE              = 50 * 1024 * 1024;
const TIPOS_EVIDENCIA_PERMITIDOS  = [...TIPOS_IMAGEN_PERMITIDOS, 'video/mp4'];

function filtroEvidenciaEstricto(_req, file, cb) {
    if (TIPOS_EVIDENCIA_PERMITIDOS.includes(file.mimetype)) return cb(null, true);
    const err = new Error(`Tipo de archivo no permitido. Solo se aceptan JPEG, PNG, WebP y MP4`);
    err.esErrorTipoArchivo = true;
    cb(err);
}

const uploadEvidencia = wrapUpload(multer({
    storage: memoriaStorage,
    fileFilter: filtroEvidenciaEstricto,
    limits: { fileSize: MAX_VIDEO_SIZE }
}).array("evidencia", 5), 50);

module.exports = { uploadJobMedia, uploadPortfolioMedia, uploadResultadoMedia, uploadAvatar, uploadVerificacion, uploadEvidencia };
