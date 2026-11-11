const devices = require("../config/devices");

/**
 * Crea un middleware Express que valida req.body contra un schema de Yup.
 * Si el body incluye "device" y es válido, deja el dispositivo resuelto
 * en req.posDevice (mismo comportamiento que el validateParams original).
 */
function validateBody(schema) {
  return async (req, res, next) => {
    try {
      const validated = await schema.validate(req.body, { abortEarly: true });
      req.body = { ...req.body, ...validated };

      if (validated.device) {
        req.posDevice = devices.resolveConfiguredDevice(validated.device);
      }

      next();
    } catch (err) {
      const message = err.errors && err.errors.length ? err.errors[0] : err.message;
      return res.status(400).send({ error: message });
    }
  };
}

module.exports = { validateBody };
