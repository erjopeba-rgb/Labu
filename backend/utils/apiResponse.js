/**
 * Respuesta de éxito unificada.
 * Produce: { success: true, ...data }
 */
const successResponse = (res, data = {}, statusCode = 200) => {
    res.status(statusCode).json({ success: true, ...data });
};

module.exports = { successResponse };
