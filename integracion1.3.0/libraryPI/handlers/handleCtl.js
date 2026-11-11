 const { NextSteps } = require("../NextSteps");
 const { getResponseByCode, getResponseByCodeError } = require("../Fields");
 const { getLaPazTimestamp } = require("../utils/getLaPazTimeStamp");
 const { splitPurchaseAmountAndTip } = require("../utils/getTipAmount");

 function handleCtl(context, config) {
    let params = Object.assign(
      {
        logger: false,
        device: "---------",
        importe: "00.00",
        response: (resp) => { },
      },
      config,
    );

    let connectedDevices = context.validConnectDevices(params);

    if (connectedDevices.status == "error") {
      return params.response(connectedDevices);
    }

    const ctlSteps = NextSteps.ctl;
    const device = connectedDevices.device,
      socket = device.socket;
    let steps = "step1";

    try {
      let importe = parseFloat(params.importe).toFixed(2).validateAmount();

      device.env.logger = params.logger;
      device.env.device = connectedDevices.ip;

      //Steps 1, send : Transacción de solicitud de conexión
      context.executeStep(ctlSteps, "step1", socket, device.env);

      device.env.stepNext = "step2";
      device.frameReader.on("message", function (resp) {
        //Steps 2, 3
        const strReply = Buffer.from(resp).toString("hex");
        let unpackMessage = "";
        steps = device.env.stepNext;
        let stepParams = ctlSteps[steps];

        if (device.env.logger) {
          console.log({
            timeZone: getLaPazTimestamp(),
            step: device.env.stepNext,
            process: `Receiving POS: ` + stepParams.name,
            message: strReply,
            device: connectedDevices.ip,
          });
        }

        // En estos estados CTL la caja espera exclusivamente un ACK (0x06).
        // Si el POS responde NAK (0x15), la operacion debe finalizar de
        // inmediato. Avanzar el step como si fuera ACK deja el handler
        // esperando una trama que nunca llegara y mantiene el POS device_busy.
        const ctlAckExpectedSteps = new Set(["step2", "step6", "step10", "step14"]);
        if (strReply.isNAck() && ctlAckExpectedSteps.has(device.env.stepNext)) {
          const rejectedAtStep = device.env.stepNext;
          device.env.stepNext = "finish";
          params.response({
            status: "error",
            source: "POS",
            type: "pos_nack",
            code: "15",
            message: "El POS rechazo la solicitud actual (NAK)",
            step: rejectedAtStep,
          });
          return;
        }

        // Una Notificacion de incidencia (Presentation Header 1007 0) puede
        // llegar en cualquier punto del flujo CTL, incluso cuando esperabamos
        // un ACK. Debe resolverse antes del switch de stepNext para evitar que
        // el flujo quede esperando y mantenga el POS bloqueado.
        if (!strReply.isAck() && !strReply.isNAck()) {
          try {
            const incoming = strReply.unpackMessage();
            if (incoming && incoming.identifier === "10070") {
              const field48 = incoming.data && incoming.data[48];
              const field61 = incoming.data && incoming.data[61];
              const incidentCode = field48 && field48.value != null
                ? String(field48.value).trim()
                : "";

              context.executeStep(ctlSteps, "finish", socket, device.env);
              device.env.stepNext = "finish";
              params.response({
                status: "error",
                source: "POS",
                type: "pos_incident",
                code: incidentCode || null,
                message: incidentCode
                  ? getResponseByCodeError(incidentCode)
                  : "INCIDENTE POS SIN CODIGO",
                detail: field61 && field61.value != null
                  ? String(field61.value).trim()
                  : null,
                identifier: incoming.identifier,
              });
              return;
            }
          } catch (incidentParseError) {
            // Si no era una trama desempaquetable, el flujo normal decide que hacer.
          }
        }
        switch (device.env.stepNext) {
          case "step2": //reception: message Ack
            device.env.stepNext = "step3";
            break;
          case "step3": //reception: Ultima transacción
            //send: message Ack
            context.executeStep(ctlSteps, "step4", socket, device.env);
            //send: Transacción No reverso
            context.executeStep(ctlSteps, "step5", socket, device.env);
            device.env.stepNext = "step6";
            break;
          case "step6": //reception: message Ack
            device.env.stepNext = "step7";
            break;
          case "step7": //reception: Solicitud  de datos
            unpackMessage = strReply.unpackMessage();
            if (unpackMessage.data[48] != undefined) {
              //send: message ACK
              context.executeStep(ctlSteps, "step8", socket, device.env);
              //send: Transacción de envío de datos
              let step0 = ctlSteps["step9"];
              context.sendMessageBoxToPos(
                step0.func(importe),
                socket,
                Object.assign(device.env, {
                  name: step0.name,
                  stepNext: "step9",
                }),
              );
              device.env.stepNext = "step10";
            } else {
              params.response({
                status: "error",
                message: context.messageError["READING_ERROR"],
              });
            }
            break;
          case "step10": //reception: message Ack
            unpackMessage = strReply.unpackMessage();
            context.handleErrorResponse(
              unpackMessage,
              ctlSteps,
              socket,
              device,
              params,
              "step11",
            );
            break;
          case "step11": //reception: Solicitud nueva pantalla
            if (strReply.isNAck()) {
              device.env.stepNext = "finish";
              params.response({
                status: "error",
                source: "POS",
                type: "pos_nack",
                code: "15",
                message: context.messageError["ERROR_PROCESSING"],
                step: "step11",
              });
              return;
            }
            unpackMessage = strReply.unpackMessage();
            if (
              unpackMessage.data &&
              unpackMessage.data[87] &&
              unpackMessage.data[87].value == "1201"
            ) {
              //send: message Ack
              context.executeStep(ctlSteps, "step12", socket, device.env);
              context.executeStep(ctlSteps, "step13", socket, device.env);
              device.env.stepNext = "step14";
            }
            break;
          case "step14": //reception: message Ack
            device.env.stepNext = "step15";
            break;
          case "step15": //reception: Solicitud nueva pantalla PIN / posible incidencia POS
            if (strReply.isNAck()) {
              params.response({
                status: "error",
                source: "POS",
                type: "transport_error",
                message: context.messageError["TIMEOUT_READING_ERROR"],
              });
            } else {
              unpackMessage = strReply.unpackMessage();

              // Manual ATC 9220: Presentation Header 1007 0 (identifier 10070)
              // corresponde a Notificacion de incidencia. El campo 48 contiene
              // el codigo de incidencia y el campo 61, cuando viene presente,
              // contiene el detalle/mensaje de la incidencia.
              if (unpackMessage.identifier === "10070") {
                const field48 = unpackMessage.data && unpackMessage.data[48];
                const field61 = unpackMessage.data && unpackMessage.data[61];
                const incidentCode = field48 && field48.value != null
                  ? String(field48.value).trim()
                  : "";

                // Toda trama recibida debe ser reconocida por la caja.
                context.executeStep(ctlSteps, "finish", socket, device.env);
                params.response({
                  status: "error",
                  source: "POS",
                  type: "pos_incident",
                  code: incidentCode || null,
                  message: incidentCode
                    ? getResponseByCodeError(incidentCode)
                    : "INCIDENTE POS SIN CODIGO",
                  detail: field61 && field61.value != null
                    ? String(field61.value).trim()
                    : null,
                  identifier: unpackMessage.identifier,
                });
                break;
              }

              if (unpackMessage.data && unpackMessage.data[87] != undefined) {
                //send: message Ack
                context.executeStep(ctlSteps, "step16", socket, device.env);
                //step15: Envio dirigido al host   || step16: Recepcion destinada host
                device.env.stepNext = "step19";
              } else {
                const field48 = unpackMessage.data && unpackMessage.data[48];
                const responseCodeValue = field48 && field48.value != null
                  ? String(field48.value).trim()
                  : "";
                params.response({
                  status: "error",
                  source: "POS",
                  type: "unexpected_message",
                  code: responseCodeValue || null,
                  message: responseCodeValue
                    ? getResponseByCodeError(responseCodeValue)
                    : context.messageError["ERROR_PROCESSING"],
                  identifier: unpackMessage.identifier || null,
                });
              }
            }
            break;
          case "step19": //reception: Respuesta del host / posible incidencia POS
          
            if (strReply.isNAck()) {
              params.response({
                status: "error",
                source: "POS",
                type: "transport_error",
                message: context.messageError["CANCEL_PIN"],
              });
            } else {
              unpackMessage = strReply.unpackMessage();
              // Una incidencia interna del POS puede llegar en lugar de la
              // respuesta HOST. Se distingue por Presentation Header 1007 0.
              if (unpackMessage.identifier === "10070") {
                const field48 = unpackMessage.data && unpackMessage.data[48];
                const field61 = unpackMessage.data && unpackMessage.data[61];
                const incidentCode = field48 && field48.value != null
                  ? String(field48.value).trim()
                  : "";

                context.executeStep(ctlSteps, "finish", socket, device.env);
                params.response({
                  status: "error",
                  source: "POS",
                  type: "pos_incident",
                  code: incidentCode || null,
                  message: incidentCode
                    ? getResponseByCodeError(incidentCode)
                    : "INCIDENTE POS SIN CODIGO",
                  detail: field61 && field61.value != null
                    ? String(field61.value).trim()
                    : null,
                  identifier: unpackMessage.identifier,
                });
                break;
              }

              let resp = stepParams.func(strReply);
              const responseField = resp.find(
                (item) => item.name === "responseCode",
              );
              const detailField = resp.find(
                (item) => item.name === "errorMessage"
              );
              let responseCodeValue = responseField
                ? String(responseField.value).trim()
                : "";
              
              //send: message Ack
              if (responseCodeValue == "77") {
                context.executeStep(ctlSteps, "step20", socket, device.env);
                device.env.stepNext = "step23";
              } else {
                context.executeStep(ctlSteps, "finish", socket, device.env);
                params.response({
                  status: (responseCodeValue == "00" || responseCodeValue == "77" ) ? "success" : "error",
                  source: "HOST",
                  type: "host_response",
                  code: responseCodeValue || null,
                  message: responseCodeValue
                    ? getResponseByCode(responseCodeValue)
                    : "RESPUESTA HOST SIN CODIGO",
                  detail: detailField ? detailField.value : null,
                  identifier: unpackMessage.identifier || null,
                  data: splitPurchaseAmountAndTip(resp, importe)
                });
              }
            }
            break;
            case "step23":                 
            if (strReply.isNAck()) {
              params.response({
                status: "error",
                source: "POS",
                type: "transport_error",
                message: context.messageError["CANCEL_PIN"],
              });
            } else {
              unpackMessage = strReply.unpackMessage();
              // Una incidencia interna del POS puede llegar en lugar de la
              // respuesta HOST. Se distingue por Presentation Header 1007 0.
              if (unpackMessage.identifier === "10070") {
                const field48 = unpackMessage.data && unpackMessage.data[48];
                const field61 = unpackMessage.data && unpackMessage.data[61];
                const incidentCode = field48 && field48.value != null
                  ? String(field48.value).trim()
                  : "";

                context.executeStep(ctlSteps, "finish", socket, device.env);
                params.response({
                  status: "error",
                  source: "POS",
                  type: "pos_incident",
                  code: incidentCode || null,
                  message: incidentCode
                    ? getResponseByCodeError(incidentCode)
                    : "INCIDENTE POS SIN CODIGO",
                  detail: field61 && field61.value != null
                    ? String(field61.value).trim()
                    : null,
                  identifier: unpackMessage.identifier,
                });
                break;
              }

              let resp = stepParams.func(strReply);
              const responseField = resp.find(
                (item) => item.name === "responseCode",
              );
              const detailField = resp.find(
                (item) => item.name === "errorMessage"
              );
              let responseCodeValue = responseField
                ? String(responseField.value).trim()
                : "";
              
              //send: message Ack
                context.executeStep(ctlSteps, "finish", socket, device.env);
                params.response({
                  status: (responseCodeValue == "00" || responseCodeValue == "77" ) ? "success" : "error",
                  source: "HOST",
                  type: "host_response",
                  code: responseCodeValue || null,
                  message: responseCodeValue
                    ? getResponseByCode(responseCodeValue)
                    : "RESPUESTA HOST SIN CODIGO",
                  detail: detailField ? detailField.value : null,
                  identifier: unpackMessage.identifier || null,
                  data: splitPurchaseAmountAndTip(resp, importe)
                });
            }
            break;
          default:
            console.error("Unknown step: " + steps);
        }
      });
    } catch (error) {
      params.response({
        status: "error",
        message: error.message,
      });
    }
  }

module.exports = { handleCtl };