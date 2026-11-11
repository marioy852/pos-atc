 const { NextSteps } = require("../NextSteps");
 const { getResponseByCode, getResponseByCodeError } = require("../Fields");
 const { getLaPazTimestamp } = require("../utils/getLaPazTimeStamp");
 const { splitPurchaseAmountAndTip } = require("../utils/getTipAmount");

function handleChip(context, config) {
    let params = Object.assign(
      {
        logger: false,
        device: "---------",
        importe: "00.00",
        response: (resp) => { },
      },
      config,
    );


    let connectedDevicesByIp = context.validConnectDevices(params);
    if (connectedDevicesByIp.status == "error") {
      return params.response(connectedDevicesByIp);
    }

    const chipSteps = NextSteps.chip;
    const device = connectedDevicesByIp.device,
      socket = device.socket;
    let steps = "step1";

    try {
      let importe = parseFloat(params.importe).toFixed(2).validateAmount();
      device.env.logger = params.logger;
      device.env.device = connectedDevicesByIp.ip;
      //Steps 1, send : Transacción de solicitud de conexión
      context.executeStep(chipSteps, "step1", socket, device.env);

      device.env.stepNext = "step2";
      device.frameReader.on("message", function (resp) {
        //Steps 2, 3
        const strReply = Buffer.from(resp).toString("hex");
        let unpackMessage = "";
        steps = device.env.stepNext;
        let stepParams = chipSteps[steps];

        if (device.env.logger) {
          console.log({
            timeZone: getLaPazTimestamp(),
            step: device.env.stepNext,
            process: ` Receiving POS: ` + stepParams.name,
            message: strReply,
            device: connectedDevicesByIp.ip,
          });
        }
        switch (device.env.stepNext) {
          case "step2": //reception: message Ack
            device.env.stepNext = "step3";
            break;
          case "step3": //reception: Ultima transacción
          if (strReply.isNAck()) {
              params.response({
                status: "error",
                message: context.messageError["ERROR_PROCESSING"],
              });
            } else {
                          //send: message Ack
              context.executeStep(chipSteps, "step4", socket, device.env);
              //send: Transacción No reverso
              context.executeStep(chipSteps, "step5", socket, device.env);
              device.env.stepNext = "step6";
            }

            break;
          case "step6": //reception: message Ack
            unpackMessage = strReply.unpackMessage();
            context.handleErrorResponse(
              unpackMessage,
              chipSteps,
              socket,
              device,
              params,
              "step7",
            );
            break;
          case "step7": //reception: Solicitud nueva pantalla
            if (strReply.isNAck()) {
              params.response({
                status: "error",
                message: context.messageError["ERROR_PROCESSING"],
              });
            } else {
              unpackMessage = strReply.unpackMessage();
              if (
                unpackMessage.data &&
                unpackMessage.data[87] &&
                unpackMessage.data[87].value == "1201"
              ) {
                //send: message Ack
                context.executeStep(chipSteps, "step8", socket, device.env);
                device.env.stepNext = "step9";
              } else {
                params.response({
                  status: "error",
                  message: context.messageError["ERROR_PIN"],
                });
              }
            }
            break;
          case "step9": //send: Solicitud de datos
            if (strReply.isNAck()) {
              params.response({
                status: "error",
                message: context.messageError["READING_ERROR"],
              });
            } else {
              unpackMessage = strReply.unpackMessage();

              if (unpackMessage.data[48] != undefined) {
                //clean_value = unpackMessage.data["48"].value.strip()
                if (unpackMessage.data["48"].value.replace(/\s+/g, "") != "") {
                  let respcode = getResponseByCode(
                    unpackMessage.data["48"].value,
                  );
                  const isInvalidCode = !respcode || respcode === "CONTACTE / BANCO";
                  params.response({
                    status: "error",
                    message: isInvalidCode
                      ? context.messageError["TIMEOUT_READING_ERROR"]
                      : respcode,
                  });

                } else {
                  //send: message Ack
                  context.executeStep(chipSteps, "step10", socket, device.env);
                  //send: Transacción de envío de datos
                  let step11 = chipSteps["step11"];
                  context.sendMessageBoxToPos(
                    step11.func(importe),
                    socket,
                    Object.assign(device.env, {
                      name: step11.name,
                      stepNext: "step11",
                    }),
                  );
                  device.env.stepNext = "step12";
                }
              } else {
                params.response({
                  status: "error",
                  message: context.messageError["READING_ERROR"],
                });
              }
            }
            break;
          case "step12": //reception: message Ack
            device.env.stepNext = "step13";
            break;
          case "step13": //reception: Solicitud nueva pantalla PIN
            if (strReply.isNAck()) {
              params.response({
                status: "error",
                message: context.messageError["ERROR_PROCESSING"],
              });
            }
            unpackMessage = strReply.unpackMessage();
            if (
              unpackMessage.data &&
              unpackMessage.data[87] &&
              unpackMessage.data[87].value == "1202"
            ) {
              //send: message Ack
              context.executeStep(chipSteps, "step14", socket, device.env);
              //step15: Envio dirigido al host   || step16: Recepcion destinada host
              device.env.stepNext = "step17";
            } else {
              params.response({
                status: "error",
                message: context.messageError["ERROR_PIN"],
              });
            }
            break;
          case "step17": //reception: Respuesta del host
            if (strReply.isNAck()) {
              params.response({
                status: "error",
                message: context.messageError["CANCEL_PIN"],
              });
            } else {
              let resp = stepParams.func(strReply);
              let responseCodeValue = resp.find(
                (item) => item.name === "responseCode",
              ).value;
              //send: message Ack
              if (responseCodeValue == "77") {
                context.executeStep(chipSteps, "step18", socket, device.env);
                device.env.stepNext = "step21";
              } else {
                context.executeStep(chipSteps, "finish", socket, device.env);
                params.response({
                  status: (responseCodeValue == "00" || responseCodeValue == "77") ? "success" : "error",
                  message: getResponseByCode(responseCodeValue),
                  data: splitPurchaseAmountAndTip(resp, importe),
                });
              }
            }
            break;
          case "step21":
            if (strReply.isNAck()) {
              params.response({
                status: "error",
                message: context.messageError["CANCEL_PIN"],
              });
            } else {
              let resp = stepParams.func(strReply);
              let responseCodeValue = resp.find(
                (item) => item.name === "responseCode",
              ).value;
              //send: message Ack
              context.executeStep(chipSteps, "finish", socket, device.env);
              params.response({
                status: (responseCodeValue == "00" || responseCodeValue == "77") ? "success" : "error",
                message: getResponseByCode(responseCodeValue),
                data: splitPurchaseAmountAndTip(resp, importe),
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

  module.exports = { handleChip };