const path = require("path");
const fs   = require("fs");

const UPLOADS_DIR = path.join(__dirname, "../../frontend/public/uploads");

const usarS3 = () => !!process.env.AWS_S3_BUCKET;

const _getS3Client = () => {
    const { S3Client } = require("@aws-sdk/client-s3");
    return new S3Client({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: {
            accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });
};

const _contentType = (filename) => {
    const ext = path.extname(filename).toLowerCase();
    const tipos = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp", ".mp4": "video/mp4" };
    return tipos[ext] || "application/octet-stream";
};

async function saveFile(buffer, filename, folder) {
    if (usarS3()) {
        const { PutObjectCommand } = require("@aws-sdk/client-s3");
        const bucket = process.env.AWS_S3_BUCKET;
        const region = process.env.AWS_REGION || "us-east-1";
        const key = `${folder}/${filename}`;
        await _getS3Client().send(new PutObjectCommand({
            Bucket:      bucket,
            Key:         key,
            Body:        buffer,
            ContentType: _contentType(filename),
        }));
        return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    }

    // Almacenamiento local
    const destDir = path.join(UPLOADS_DIR, folder);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const filePath = path.join(destDir, filename);
    await fs.promises.writeFile(filePath, buffer);
    return `/uploads/${folder}/${filename}`;
}

async function deleteFile(fileUrl) {
    if (usarS3()) {
        const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
        // Extraer la key desde la URL pública: https://bucket.s3.region.amazonaws.com/folder/file
        const url = new URL(fileUrl);
        const key = url.pathname.replace(/^\//, "");
        await _getS3Client().send(new DeleteObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key:    key,
        }));
        return;
    }

    // Eliminar del filesystem local
    const relativePath = fileUrl.replace(/^\/uploads\//, "");
    const filePath = path.join(UPLOADS_DIR, relativePath);
    try {
        await fs.promises.unlink(filePath);
    } catch (err) {
        if (err.code !== "ENOENT") throw err; // ignorar si ya no existe
    }
}

/**
 * Genera un nombre de archivo único conservando la extensión original.
 * @param {string} originalname - Nombre original del archivo
 * @returns {string}
 */
function generarNombreArchivo(originalname) {
    const ext = path.extname(originalname).toLowerCase();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
}

module.exports = { saveFile, deleteFile, generarNombreArchivo };
