 const { NextSteps } = require("../NextSteps");
 const { getResponseByCode, getResponseByCodeError } = require("../Fields");
 const { getLaPazTimestamp } = require("../utils/getLaPazTimeStamp");

function handleAnnulment(context, config) {
    let params = Object.assign(
      {
        logger: false,
        device: "---------",
        reference: "0000",
        response: (resp) => { },
      },
      config,
    );


    let connectedDevices = context.validConnectDevices(params);
    if (connectedDevices.status == "error") {
      return params.response(connectedDevices);
    }

    const chipSteps = NextSteps.annulment;
    const device = connectedDevices.device,
      socket = device.socket;
    let steps = "step1";

    try {
      device.env.logger = params.logger;
      let reference = params.reference.toString().validateReference();
      device.env.device = connectedDevices.ip;
      //Steps 1, send : Solicitud de anulación
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
            process: `Receiving POS: ` + stepParams.name,
            message: strReply,
            device: connectedDevices.ip,
          });
        }

        switch (device.env.stepNext) {
          case "step2": //reception: message Ack
            device.env.stepNext = "step3";
            break;
          case "step3": //reception: Solicitud de la referencia
            //send: message Ack
            context.executeStep(chipSteps, "step4", socket, device.env);
            //send: Referencia de la transacción
            let steptemp = chipSteps["step5"];
            context.sendMessageBoxToPos(
              steptemp.func(reference),
              socket,
              Object.assign(device.env, {
                name: steptemp.name,
                stepNext: "step5",
              }),
            );
            device.env.stepNext = "step6";
            break;
          case "step6": //reception: message Ack
            device.env.stepNext = "step7";
            break; //
          case "step7": //send: Solicitud de datos
            unpackMessage = strReply.unpackMessage();

            if (unpackMessage.data[48] != undefined) {
              if (unpackMessage.data[48].value !== "  ") {
                params.response({
                  status: "error",
                  message: context.messageError["NO_TRANSACTION"],
                });
                context.executeStep(chipSteps, "finish", socket, device.env);
                device.env.stepNext = "finish";
              } else {
                //send: message Ack
                context.executeStep(chipSteps, "step8", socket, device.env);
                //send: Transacción de envío de datos
                context.executeStep(chipSteps, "step9", socket, device.env);
                device.env.stepNext = "step10";
              }
            } else {
              params.response({
                status: "error",
                message: context.messageError["NO_TRANSACTION"],
              });
            }
            break;
          case "step10": //reception: message Ack
            device.env.stepNext = "step11";
            context.finishFlow(
              strReply,
              params,
              chipSteps,
              socket,
              device,
              context.messageError["CANCELED_NOT_CONFIRMED"],
            );
            break;
          case "step11": //reception: Respuesta del host
            if (strReply.isNAck()) {
              context.finishFlow(
                strReply,
                params,
                chipSteps,
                socket,
                device,
                context.messageError["CANCELED_NOT_CONFIRMED"],
              );
            } else {
              let resp = stepParams.func(strReply);

              let responseCodeValue = resp.find(
                (item) => item.name === "responseCode",
              ).value;

              //send: message Ack
              context.executeStep(chipSteps, "step12", socket, device.env);
              params.response({
                status: responseCodeValue == "00" ? "success" : "error",
                message: getResponseByCode(responseCodeValue),
                data: resp,
              });
            }
            break;
          case "finish":
          default:
            socket.end();
        }
      });
    } catch (error) {
      params.response({
        status: "error",
        message: error.message,
      });
    }
  }

module.exports = { handleAnnulment };