
const fields = require("./Fields");
require("./Extensions"); // registers String.prototype helpers (isAck, isNAck, unpackMessage, etc.)

exports.NextSteps = {
  ack: {
    name: "ACK",
    message: "06",
    fields: [],
  },
  chip: {
    step1: {
      action: "send",
      identifier: "1000000",
      name: "Transacción de solicitud de conexión",
      message: "02001736303030303030303030313030303030300323",
      fields: [],
    },
    step2: {
      action: "receive",
      identifier: "06",
      name: "ACK",
      message: "",
      fields: [],
    },
    step3: {
      action: "receive",
      identifier: "10001",
      name: "Última transacción",
      message: "",
      fields: [43, 48],
    },
    step4: {
      action: "send",
      identifier: "06",
      name: "ACK",
      message: "06",
      fields: [],
    },
    step5: {
      action: "send",
      identifier: "1000001",
      name: "Transacción No reverso",
      message: "02002436303030303030303030313030303030311C3438000258580303",
      fields: [48],
    },
    step6: {
      action: "receive",
      identifier: "06",
      name: "ACK",
      message: "",
      fields: [],
    },
    step7: {
      action: "receive",
      identifier: "10040",
      name: "Solicitud nueva pantalla",
      message: "",
      fields: [48, 87],
    },
    step8: {
      action: "send",
      identifier: "06",
      name: "ACK",
      message: "06",
      fields: [],
    },
    step9: {
      action: "receive",
      identifier: "10002",
      name: "Solicitud de datos",
      message: "",
      fields: [48],
    },
    step10: {
      action: "send",
      identifier: "06",
      name: "ACK",
      message: "06",
      fields: [],
    },
    step11: {
      action: "send",
      identifier: "1000002",
      name: "Transacción de envío de datos",
      message: "007736303030303030303030313030303030321C",
      fields: [40, 42, 48, 53, 88],
      func: function (imports) {
        const list = fields.getFields(this.fields);
        const values = {
          40: imports,
          42: "123".padEnd(10, " "),
          48: "  ",
          53: "123456".padEnd(10, " "),
          88: "1",
        };
        return this.message.packMessage(list, values);
      },
    },
    step12: {
      action: "receive",
      identifier: "06",
      name: "ACK",
      message: "",
      fields: [],
    },
    step13: {
      action: "receive",
      identifier: "10040",
      name: "Solicitud nueva pantalla PIN",
      message: "",
      fields: [48, 87],
    },
    step14: {
      action: "send",
      identifier: "06",
      name: "ACK",
      message: "06",
      fields: [],
    },
    step17: {
      action: "receive",
      identifier: "10003",
      name: "Respuesta del HOST de la venta realizada",
      message: "",
      fields: [1, 40, 43, 44, 45, 46, 47, 48, 50, 51, 54, 61, 75],
      func: function (strReply) {
        let response = strReply.unpackMessage();
        const extractedValues = response.data
          .filter((item) => item && item.name && item.value) // Filtrar elementos válidos
          .map((item) => ({
            name: item.name,
            value: item.value,
          }));
        return extractedValues;
      },
    },
    step18: {
      action: "send",
      identifier: "06",
      name: "ACK",
      message: "06",
      fields: [],
    },
    step21: {
      action: "receive",
      identifier: "10060",
      name: "Respuesta del HOST de la venta realizada por contactless",
      message: "",
      fields: [1, 40, 43, 44, 45, 46, 47, 48, 50, 51, 54, 61, 75],
      func: function (strReply) {
        let response = strReply.unpackMessage();
        const extractedValues = response.data
          .filter((item) => item && item.name && item.value) // Filtrar elementos válidos
          .map((item) => ({
            name: item.name,
            value: item.value,
          }));

        return extractedValues;
      },
    },
    finish: {
      action: "send",
      identifier: "06",
      name: "ACK",
      message: "06",
      fields: [],
    },
  },
  ctl: {
    step1: {
      action: "send",
      identifier: "1006000",
      name: "Solicitud de conexión de una venta por contactless",
      message: "02001736303030303030303030313030363030300325",
      fields: [],
    },
    step2: {
      action: "receive",
      identifier: "06",
      name: "ACK",
      message: "",
      fields: [],
    },
    step3: {
      action: "receive",
      identifier: "10001",
      name: "Última transacción",
      message: "",
      fields: [43, 48],
    },
    step4: {
      action: "send",
      identifier: "06",
      name: "ACK",
      message: "06",
      fields: [],
    },
    step5: {
      action: "send",
      identifier: "1000001",
      name: "Transacción No reverso",
      message: "02002436303030303030303030313030303030311C3438000258580303",
      fields: [48],
    },
    step6: {
      action: "receive",
      identifier: "06",
      name: "ACK",
      message: "",
      fields: [],
    },
    step7: {
      action: "receive",
      identifier: "10002",
      name: "Solicitud de datos",
      message: "",
      fields: [48],
    },
    step8: {
      action: "send",
      identifier: "06",
      name: "ACK",
      message: "06",
      fields: [],
    },
    step9: {
      action: "send",
      identifier: "1000002",
      name: "Transacción de envío de datos",
      message: "007736303030303030303030313030303030321C",
      fields: [40, 42, 48, 53, 88],
      func: function (imports) {
        const list = fields.getFields(this.fields);
        const values = {
          40: imports,
          42: "123".padEnd(10, " "),
          48: "  ",
          53: "123456".padEnd(10, " "),
          88: "1",
        };

        return this.message.packMessage(list, values);
      },
    },
    step10: {
      action: "receive",
      identifier: "06",
      name: "ACK",
      message: "",
      fields: [],
    },
    step11: {
      action: "receive",
      identifier: "10040",
      name: "Solicitud nueva pantalla",
      message: "",
      fields: [48, 87],
    },
    step12: {
      action: "send",
      identifier: "06",
      name: "ACK",
      message: "06",
      fields: [],
    },
    step13: {
      action: "send",
      identifier: "1006001",
      name: "Tipo de lectura de la tarjeta",
      message: "02001736303030303030303030313030363030310324",
      fields: [48],
    },
    step14: {
      action: "receive",
      identifier: "06",
      name: "ACK",
      message: "",
      fields: [],
    },
    step15: {
      action: "receive",
      identifier: "10040",
      name: "Solicitud nueva pantalla PIN",
      message: "",
      fields: [48, 87],
    },
    step16: {
      action: "send",
      identifier: "06",
      name: "ACK",
      message: "06",
      fields: [],
    },
    step19: {
      action: "receive",
      identifier: "10060",
      name: "Respuesta del HOST de la venta realizada por contactless",
      message: "",
      fields: [1, 40, 43, 44, 45, 46, 47, 48, 50, 51, 54, 61, 75],
      func: function (strReply) {
        let response = strReply.unpackMessage();
        const extractedValues = response.data
          .filter((item) => item && item.name && item.value) // Filtrar elementos válidos
          .map((item) => ({
            name: item.name,
            value: item.value,
          }));

        return extractedValues;
      },
    },
    step20: {
      action: "send",
      identifier: "06",
      name: "ACK",
      message: "06",
      fields: [],
    },
    step23: {
      action: "receive",
      identifier: "10060",
      name: "Respuesta del HOST de la venta realizada por contactless",
      message: "",
      fields: [1, 40, 43, 44, 45, 46, 47, 48, 50, 51, 54, 61, 75],
      func: function (strReply) {
        let response = strReply.unpackMessage();
        const extractedValues = response.data
          .filter((item) => item && item.name && item.value) // Filtrar elementos válidos
          .map((item) => ({
            name: item.name,
            value: item.value,
          }));

        return extractedValues;
      },
    },
    finish: {
      action: "send",
      identifier: "06",
      name: "ACK",
      message: "06",
      fields: [],
    },
  },
  annulment: {
    step1: {
      action: "send",
      identifier: "1005000",
      name: "Solicitud de anulación",
      message: "02001736303030303030303030313030353030300326",
      fields: [],
    },
    step2: {
      action: "receive",
      identifier: "06",
      name: "ACK",
      message: "",
      fields: [],
    },
    step3: {
      action: "receive",
      identifier: " 10050",
      name: "Solicitud de la referencia ",
      message: "",
      fields: [48],
    },
    step4: {
      action: "send",
      identifier: "06",
      name: "ACK",
      message: "06",
      fields: [],
    },
    step5: {
      action: "send",
      identifier: "1005001",
      name: "Referencia de la transacción",
      message: "36303030303030303030313030353030311C",
      fields: [48],
      func: function (referencia) {
        const campo43Original = fields.getField(43);
        const campo43Dinamico = {
          ...campo43Original,
          length: referencia.length,
        };
        const listaCampos = [campo43Dinamico, fields.getField(48)];
        const values = { 43: referencia, 48: "  " };
        const parteVariable = "".packFieldsWithList(listaCampos, values);
        const mensajeCompleto = this.message + parteVariable;
        return "".packFinalMessage(mensajeCompleto);
      },
    },
    step6: {
      action: "receive",
      identifier: "06",
      name: "ACK",
      message: "",
      fields: [],
    },
    step7: {
      action: "receive",
      identifier: "10051",
      name: "Resultados de la búsqueda de la referencia",
      message: "",
      fields: [48],
    },
    step8: {
      action: "send",
      identifier: "06",
      name: "ACK",
      message: "06",
      fields: [],
    },
    step9: {
      action: "send",
      identifier: "1005002",
      name: "Confirmación de la anulación",
      message: "02002436303030303030303030313030353030321C3438000230300305",
      fields: [48],
    },
    step10: {
      action: "receive",
      identifier: "06",
      name: "ACK",
      message: "",
      fields: [],
    },
    step11: {
      action: "receive",
      identifier: "10060",
      name: "Respuesta del HOST de la anulación",
      message: "",
      fields: [1, 40, 43, 44, 45, 46, 47, 48, 54, 61, 75],
      func: function (strReply) {
        let response = strReply.unpackMessage();
        const extractedValues = response.data
          .filter((item) => item && item.name && item.value) // Filtrar elementos válidos
          .map((item) => ({
            name: item.name,
            value: item.value,
          }));
        return extractedValues;
      },
    },
    step12: {
      action: "send",
      identifier: "06",
      name: "ACK",
      message: "06",
      fields: [],
    },
    finish: { action: "finish", name: "FINISH - ACK", message: "06" },
  },
  // lotClosuret: {
  //   step1: {
  //     action: "send",
  //     identifier: "1001000",
  //     name: "Solicitud de cierre",
  //     message: "02001736303030303030303030313030313030300322",
  //     fields: [],
  //   },
  //   step2: {
  //     action: "receive",
  //     identifier: "06",
  //     name: "ACK del POS",
  //     message: "",
  //     fields: [],
  //   },
  //   step3: {
  //     action: "receive",
  //     identifier: ["15"],
  //     name: "Respuesta del cierre",
  //     message: "",
  //     fields: [48],
  //   },
  // },

  lotClosuret: {
    step1: {
      action: "send",
      identifier: "1001000",
      name: "Solicitud de cierre",
      message: "02001736303030303030303030313030313030300322",
      fields: [],
    },
    step2: {
      action: "receive",
      identifier: "06",
      name: "ACK/NACK",
      message: "",
      fields: [],
    },
    step3: {
      action: "receive",
      identifier: "10010",
      name: "Cantidad de transacciones",
      message: "",
      fields: [48, 90],
    },
    step4: {
      action: "send",
      identifier: "06",
      name: "ACK/NACK",
      message: "06",
      fields: [],
    },
    step5: {
      action: "receive",
      identifier: "10011",
      name: "Transacción 1, 2, ...N",
      message: "",
      fields: [1, 40, 43, 44, 45, 46, 47, 48, 50, 51, 54, 75],
      func: function (strReply) {
        let response = strReply.unpackMessage();
        const extractedValues = response.data
          .filter((item) => item && item.name && item.value) // Filtrar elementos válidos
          .map((item) => ({
            name: item.name,
            value: item.value,
          }));
        return extractedValues;
      },
    },
    step6: {
      action: "send",
      identifier: "06",
      name: "ACK/NACK",
      message: "06",
      fields: [],
    },
    step7: {
      action: "receive",
      identifier: "10012",
      name: "Respuesta del HOST del cierre",
      message: "",
      fields: [1, 48],
      func: function (strReply) {
        let response = strReply.unpackMessage();
        const extractedValues = response.data
          .filter((item) => item && item.name && item.value) // Filtrar elementos válidos
          .map((item) => ({
            name: item.name,
            value: item.value,
          }));
        return extractedValues;
      },
    },
    step8: {
      action: "send",
      identifier: "06",
      name: "ACK/NACK",
      message: "06",
      fields: [],
    },
    stepNack: {
      action: "send",
      identifier: "15",
      name: "ACK/NACK",
      message: "15",
      fields: [],
    },
    finish: { action: "finish", name: "FINISH - ACK", message: "06" },
  },
  initialize: {
    step1: {
      action: "send",
      identifier: "1005000",
      name: "Solicitud de inicialización",
      message: "02001736303030303030303030313030323030300321",
      fields: [],
    },
    step2: {
      action: "receive",
      identifier: "06",
      name: "ACK/NACK",
      message: "",
      fields: [],
    },
    step3: {
      action: "receive",
      identifier: " 10050",
      name: "Respuesta del HOST de la inicialización",
      message: "",
      fields: [48],
    },
    step4: {
      action: "send",
      identifier: "06",
      name: "ACK/NACK",
      message: "06",
      fields: [],
    },
    finish: { action: "finish", name: "FINISH - ACK", message: "06" },
  },
  echo: {
    step1: {
      action: "send",
      identifier: "1003000",
      name: "Solicitud de inicialización",
      message: "02001736303030303030303030313030333030300320",
      fields: [],
    },
    step2: {
      action: "receive",
      identifier: "06",
      name: "ACK/NACK",
      message: "",
      fields: [],
    },
    step3: {
      action: "receive",
      identifier: " 10050",
      name: "Respuesta del HOST de la Envio numero de serie,version,terminal",
      message: "",
      fields: [42, 45, 46, 47, 88],
    },
    step4: {
      action: "send",
      identifier: "06",
      name: "ACK/NACK",
      message: "06",
      fields: [],
    },
    finish: { action: "finish", name: "FINISH - ACK", message: "06" },
  },
  posIdentifier: {
    step1: {
      action: "send",
      identifier: "1003000",
      name: "Solicitud de información del POS",
      message: "02001736303030303030303030313030333030300320",
      fields: [],
    },
    step2: {
      action: "receive",
      identifier: "06",
      name: "ACK del POS",
      message: "",
      fields: [],
    },
    step3: {
      action: "receive",
      identifier: "10030",
      name: "Datos POS (serial, terminal, fecha, hora, versión)",
      message: "31303033202030",
      fields: [42, 45, 46, 47, 88],
    },
    step4: {
      action: "send",
      identifier: "06",
      name: "ACK final",
      message: "06",
      fields: [],
    },
  },

  posIdentifier: {
    step1: {
      action: "send",
      identifier: "1003000",
      name: "Solicitud de información del POS",
      message: "02001736303030303030303030313030333030300320",
      fields: [],
    },
    step2: {
      action: "receive",
      identifier: "06",
      name: "ACK del POS",
      message: "",
      fields: [],
    },
    step3: {
      action: "receive",
      identifier: "10030",
      name: "Datos POS (serial, terminal, fecha, hora, versión)",
      message: "31303033202030",
      fields: [42, 45, 46, 47, 88],
    },
    step4: {
      action: "send",
      identifier: "06",
      name: "ACK final",
      message: "06",
      fields: [],
    },
  },
  dcc: {
    step1: {
      action: "send",
      identifier: "06",
      name: "ACK",
      message: "06",
      fields: [],
    },
    step2: {
      action: "receive",
      identifier: "10060",
      name: "Respuesta del HOST de la venta realizada por despues de dcc confirmado",
      message: "",
      fields: [1, 40, 43, 44, 45, 46, 47, 48, 50, 51, 54, 61, 75, 91],
      func: function (strReply) {
        let response = strReply.unpackMessage();
        const extractedValues = response.data
          .filter((item) => item && item.name && item.value) // Filtrar elementos válidos
          .map((item) => ({
            name: item.name,
            value: item.value,
          }));

        return extractedValues;
      },
    },
  },
};

