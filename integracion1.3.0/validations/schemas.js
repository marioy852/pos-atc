const yup = require("yup");
const devices = require("../config/devices");

const deviceField = yup
  .string()
  .trim()
  .test(
    "device-configurado",
    "Dispositivo no configurado",
    (value) => !value || !!devices.resolveConfiguredDevice(value),
  );

const importeField = yup
  .number()
  .positive()
  .typeError("Monto inválido")
  .transform((value, originalValue) => (originalValue === "" ? undefined : value));

const referenceField = yup
  .number()
  .integer()
  .typeError("Referencia inválida")
  .transform((value, originalValue) => (originalValue === "" ? undefined : value));

const typePayField = yup
  .string()
  .oneOf(["chip", "ctl"], "Tipo de pago no válido");


const anularSchema = yup.object({
  device: deviceField.required("Campo device es requerido"),
  reference: referenceField.required("La referencia es requerida"),
});

const cerrarSchema = yup.object({
  device: deviceField.required("Campo device es requerido"),
});

const pagoSchema = yup.object({
  device: deviceField.required("Campo device es requerido"),
  typePay: typePayField.required("El tipo de pago es requerido"),
  importe: importeField.required("El monto es requerido"),
});

module.exports = { anularSchema, cerrarSchema, pagoSchema };
