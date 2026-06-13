const { obtenerRubros } = require("../services/rubros.service");
const { successResponse } = require("../utils/apiResponse");

const getRubros = async (req, res, next) => {
    try {
        const rubros = await obtenerRubros();
        successResponse(res, { rubros });
    } catch (err) {
        next(err);
    }
};

module.exports = { getRubros };
