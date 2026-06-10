const { saveFile, deleteFile, generarNombreArchivo } = require("../config/storage");

const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
const TIPOS_VIDEO  = ['video/mp4'];

const REGLAS = {
    'avatars':            { mimes: TIPOS_IMAGEN,                       maxBytes: 5  * 1024 * 1024 },
    'dni':                { mimes: TIPOS_IMAGEN,                       maxBytes: 5  * 1024 * 1024 },
    'portfolio':          { mimes: TIPOS_IMAGEN,                       maxBytes: 5  * 1024 * 1024 },
    'evidencia-disputas': { mimes: [...TIPOS_IMAGEN, ...TIPOS_VIDEO],  maxBytes: 50 * 1024 * 1024, maxImageBytes: 5 * 1024 * 1024 },
};

async function uploadToS3(file, folder) {
    const regla = REGLAS[folder];
    if (!regla) {
        const err = new Error(`Carpeta de destino desconocida: ${folder}`);
        err.status = 400;
        throw err;
    }

    if (!regla.mimes.includes(file.mimetype)) {
        const err = new Error(`Tipo de archivo no permitido: ${file.mimetype}`);
        err.status = 400;
        throw err;
    }

    const esImagen = TIPOS_IMAGEN.includes(file.mimetype);
    const limite   = esImagen && regla.maxImageBytes ? regla.maxImageBytes : regla.maxBytes;
    if (file.size > limite) {
        const mb  = Math.round(limite / 1024 / 1024);
        const err = new Error(`El archivo supera el límite de ${mb}MB`);
        err.status = 400;
        throw err;
    }

    if (process.env.NODE_ENV === 'test') {
        const nombre = generarNombreArchivo(file.originalname);
        return `https://mock-s3.local/${folder}/${nombre}`;
    }

    const nombre = generarNombreArchivo(file.originalname);
    return saveFile(file.buffer, nombre, folder);
}

async function deleteFromS3(keyOrUrl) {
    if (process.env.NODE_ENV === 'test') return;
    return deleteFile(keyOrUrl);
}

async function getSignedUrl(key, expiresIn = 3600) {
    if (process.env.NODE_ENV === 'test' || !process.env.AWS_S3_BUCKET) {
        return `https://mock-s3.local/${key}`;
    }
    const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
    const { getSignedUrl: awsGetSignedUrl } = require("@aws-sdk/s3-request-presigner");
    const client = new S3Client({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: {
            accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });
    return awsGetSignedUrl(
        client,
        new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: key }),
        { expiresIn }
    );
}

module.exports = { uploadToS3, deleteFromS3, getSignedUrl };
