const { NextSteps } = require("../NextSteps");
const { getResponseByCode, getResponseByCodeError } = require("../Fields");
const { getLaPazTimestamp } = require("../utils/getLaPazTimeStamp");

  function handleLotClosuret(context, config) {
    let params = Object.assign(
      { logger: false, device: "---------", response: (resp) => { } },
      config,
    );


    let connectedDevices = context.validConnectDevices(params);
    if (connectedDevices.status == "error") {
      return params.response(connectedDevices);
    }

    const lotClosuret = NextSteps.lotClosuret;
    const device = connectedDevices.device,
      socket = device.socket;

    const sendAck = () => socket.write(Buffer.from("06", "hex"));
    const sendNack = () => socket.write(Buffer.from("15", "hex"));

    const failClosure = (type, message, extra = {}) => {
      device.env.stepNext = "finish";
      params.response({
        status: "error",
        source: "POS",
        type,
        message,
        ...extra,
      });
    };

    try {
      device.env.logger = params.logger;
      device.env.device = connectedDevices.ip;
      device.env.lotes = [];
      device.env.closureExpectedTransactions = 0;
      device.env.closureReceivedTransactions = 0;

      context.executeStep(lotClosuret, "step1", socket, device.env);
      device.env.stepNext = "step2";

      device.frameReader.on("message", function (resp) {
        const strReply = Buffer.from(resp).toString("hex");
        const currentStep = device.env.stepNext;
        const stepParams = lotClosuret[currentStep] || {
          name: "Trama inesperada",
        };

        if (device.env.logger) {
          console.log({
            timeZone: getLaPazTimestamp(),
            step: currentStep,
            process: `Receiving POS: ` + stepParams.name,
            message: strReply,
            device: connectedDevices.ip,
          });
        }

        // Un NAK del POS nunca representa un cierre exitoso. En la version
        // anterior se interpretaba "15" en step3 como success y se cerraba
        // el socket, dejando al POS sin completar su flujo de cierre.
        if (strReply === "15") {
          failClosure(
            "pos_nack",
            "El POS rechazo el flujo de cierre de lote (NAK)",
            { code: "15", step: currentStep },
          );
          return;
        }

        switch (currentStep) {
          case "step2":
            // Flujo 2 del manual: el POS confirma la solicitud con ACK.
            // NO se responde ACK a un ACK; ahora se espera la cantidad de
            // transacciones (flujo 3).
            if (strReply !== "06") {
              sendNack();
              return;
            }
            device.env.stepNext = "step3";
            break;

          case "step3": { // POS -> Caja: cantidad de transacciones (1001 0)
            let unpackMessage;
            try {
              unpackMessage = strReply.unpackMessage();
            } catch (error) {
              sendNack();
              return;
            }

            if (unpackMessage.identifier !== "10010") {
              sendNack();
              return;
            }

            const field48 = unpackMessage.data && unpackMessage.data[48];
            const field90 = unpackMessage.data && unpackMessage.data[90];
            const responseCode = field48 ? field48.value : null;

            // La caja confirma la trama de cantidad (flujo 4).
            sendAck();

            if (responseCode === "XX") {
              failClosure(
                "closure_cancelled",
                "El POS cancelo el cierre de lote",
                { code: "XX", step: currentStep },
              );
              return;
            }

            if (responseCode && responseCode.replace(/\s+/g, "") !== "") {
              failClosure(
                "closure_rejected",
                "El POS reporto una incidencia al iniciar el cierre de lote",
                { code: responseCode, step: currentStep },
              );
              return;
            }

            const expectedTransactions = field90
              ? parseInt(String(field90.value).trim(), 10)
              : NaN;

            if (!Number.isInteger(expectedTransactions) || expectedTransactions < 0) {
              failClosure(
                "protocol_error",
                "Cantidad de transacciones invalida en el cierre de lote",
                { step: currentStep },
              );
              return;
            }

            device.env.closureExpectedTransactions = expectedTransactions;
            device.env.closureReceivedTransactions = 0;
            device.env.stepNext = expectedTransactions > 0 ? "step5" : "step7";
            break;
          }

          case "step5": { // POS -> Caja: datos de cada transaccion (1001 1)
            let unpackMessage;
            try {
              unpackMessage = strReply.unpackMessage();
            } catch (error) {
              sendNack();
              return;
            }

            if (unpackMessage.identifier !== "10011") {
              sendNack();
              return;
            }

            const datas = unpackMessage.data || [];
            const field48 = datas[48];
            const responseCode = field48 ? field48.value : null;

            // Cada transaccion del lote debe ser confirmada por la caja.
            sendAck();

            if (responseCode === "XX") {
              failClosure(
                "closure_cancelled",
                "El POS cancelo el cierre de lote durante el envio del detalle",
                { code: "XX", step: currentStep },
              );
              return;
            }

            device.env.lotes.push({
              authCode: datas[1] ? datas[1].value : null,
              purchaseAmount: datas[40] ? datas[40].value : null,
              receiptNumber: datas[43] ? datas[43].value : null,
              RRN: datas[44] ? datas[44].value : null,
              terminalID: datas[45] ? datas[45].value : null,
              transactionDate: datas[46] ? datas[46].value : null,
              transactionTime: datas[47] ? datas[47].value : null,
              responseCode,
              accountType: datas[50] ? datas[50].value : null,
              installmentNumber: datas[51] ? datas[51].value : null,
              last4Digits: datas[54] ? datas[54].value : null,
              cardBINTarjeta: datas[75] ? datas[75].value : null,
            });

            device.env.closureReceivedTransactions += 1;

            if (
              device.env.closureReceivedTransactions >=
              device.env.closureExpectedTransactions
            ) {
              device.env.stepNext = "step7";
            } else {
              device.env.stepNext = "step5";
            }
            break;
          }

          case "step7": { // POS -> Caja: respuesta del HOST (1001 2)
            let unpackMessage;
            try {
              unpackMessage = strReply.unpackMessage();
            } catch (error) {
              sendNack();
              return;
            }

            if (unpackMessage.identifier !== "10012") {
              sendNack();
              return;
            }

            const datas = unpackMessage.data || [];
            const responseCode = datas[48] ? datas[48].value : null;
            const authCode = datas[1] ? datas[1].value : null;

            // Flujo 12: ACK final de la caja. No se cierra el socket TCP;
            // queda disponible para futuras operaciones del POS.
            sendAck();
            device.env.stepNext = "finish";

            params.response({
              status: responseCode === "00" ? "success" : "error",
              source: "HOST",
              type: "lot_closure_response",
              code: responseCode,
              message:
                responseCode === "00"
                  ? "Cierre de lote ejecutado correctamente"
                  : getResponseByCode(responseCode),
              expectedTransactions: device.env.closureExpectedTransactions,
              receivedTransactions: device.env.closureReceivedTransactions,
              authCode,
              data: device.env.lotes,
            });
            break;
          }

          case "finish":
          default:
            // No destruir el socket persistente. El wrapper de la operacion
            // retirara el listener agregado por este handler al responder.
            break;
        }
      });
    } catch (error) {
      params.response({
        status: "error",
        type: "handler_exception",
        message: error.message,
      });
    }
  }

module.exports = { handleLotClosuret };