
const DELIMITER = "1C";
const SENDDEFAULT = "02";
const packageInfo = require("./package.json");
const fields = require("./Fields").fields;
const getResponseByCode = require("./Fields").getResponseByCode;
const getResponseByCodeError = require("./Fields").getResponseByCodeError;
const { handleCtl: CtlHandler } = require("./handlers/handleCtl");
const { handleChip } = require("./handlers/handleChip");
const { handleAnnulment } = require("./handlers/handleAnnulment");
const { handleLotClosuret } = require("./handlers/handleLotClosuret");
const tls = require("tls");
const fs = require("fs");
const Extesions = require("./Extensions");
const NextSteps = require("./NextSteps").NextSteps;
const { PosFrameReader } = require("./frameParser");

function getLaPazTimestamp() {
  const now = new Date();
  const options = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false, // Formato de 24 horas
    timeZone: "America/La_Paz", // Zona horaria para La Paz
  };
  const timestamp = new Intl.DateTimeFormat("en-GB", options).format(now);
  return timestamp; // Retorna la fecha con el formato 'DD/MM/YYYY, HH:mm:ss'
}

// Uso del método
const laPazTime = getLaPazTimestamp();
console.log(laPazTime); // Ejemplo de salida: "12/03/2025, 12:12:13"

function logMessage(message) {
  const timestamp = getLaPazTimestamp(); // Formato: 'YYYY-MM-DD HH:MM:SS'
  const logMessage = `${timestamp} | ${"INFO"} | ${message}`;
  console.log(logMessage);
}

class IntegrationPos {
  HOST = "";
  PORT = "";
  useTLSSecurePOS = false;
  tlsCertificateOptions = null;
  useTips = false;

  messageError = {
    INVALID_FORMAT: "Invalid unpacked data format",
    CLOUSURE_CANCELLED: "Cierre de lote cancelada",
    CANCELED_NOT_CONFIRMED: "Anulación no confirmada",
    NO_TRANSACTION: "Transacción no existe",
    ERROR_PIN: "Error en el ingreso del PIN",
    CANCEL_PIN: "Usuario canceló el ingreso de PIN",
    CARD_DECLINED: "Transacción declinada por tarjeta",
    READING_ERROR: "Error al leer la tarjeta",
    TIMEOUT_READING_ERROR: "Tiempo de espera al leer la tarjeta agotado.",
    QR_INVALID: "Proceso no valida.",
    ERROR_PROCESSING: "Error de procesamiento del mensaje",
    ERROR_TRANSACTION: "Transacción rechazada."
  };

  connectedDevices = new Map();
  connectedDevicesByIp = new Map();
  isIp = true;
  constructor() { }

  sendMessageBoxToPos(msg, socket, env) {
    socket.write(Buffer.from(msg, "hex"));
    if (env.logger) {
      console.log({
        timeZone: getLaPazTimestamp(),
        step: env.stepNext,
        process: "Sent to POS: " + env.name,
        message: msg,
        device: env.device,
      });
    }
  }
  log(msg) {
    console.log(
      `${new Date().toISOString().replace("T", " ").split(".")[0]} |  ${msg}`,
    );
  }
  initialize(params) {
    this.PORT = params.port;
    this.HOST = params.host;
    this.server = params.server;
    this.devicesConfig = params.devicesConfig;
    this.useTLSSecurePOS = params.useTLSSecurePOS || false;
    this.tlsCertificateOptions = params.tlsCertificateOptions || null;
    this.useTips = params.useTips || false;

    if (params.captureDevice && typeof params.captureDevice === "function") {
      this.captureDevice = params.captureDevice;
    }

    console.log(
      `Servidor POS inicializado - TLS: ${this.useTLSSecurePOS ? "HABILITADO" : "DESHABILITADO"
      }`,
    );
    return this;
  }
  getActiveConnections() {
    const connectionsList = [];
    for (const [ip, info] of this.connectedDevicesByIp.entries()) {
      const socket = info.socket;
      connectionsList.push({
        ip: ip,
        remotePort: socket.remotePort,
        family: socket.remoteFamily,
        destroyed: socket.destroyed,
        security: this.useTLSSecurePOS ? "TLS" : "TCP",
      });
    }
    if (connectionsList.length) {
      console.table(connectionsList);
    }
    return connectionsList;
  }
  findKeyByValue(obj, value) {
    return Object.keys(obj).find((key) => obj[key] === value);
  }
  eventCallback(type, instance) {
    if (typeof this.captureDevice === "function") {
      this.captureDevice({
        type: type,
        device: instance,
      });
    }
  }
  getDeviceBySerial(serial, preferredIp = null) {
    const matches = [];
    let thiss = this;
    for (const [ip, device] of this.connectedDevicesByIp) {
      if (device.serial === serial) {
        matches.push([ip, device]);
      }
    }
    if (matches.length === 0) return null;
    let [keepIp, keepDevice] = matches[0];
    if (preferredIp) {
      const preferred = matches.find(([ip]) => ip === preferredIp);
      if (preferred) [keepIp, keepDevice] = preferred;
    }
    for (const [ip] of matches) {
      if (ip !== keepIp) {
        thiss.eventCallback("delete", {
          ip,
          ...thiss.connectedDevicesByIp.get(ip),
        });
        thiss.connectedDevicesByIp.delete(ip);
      }
    }
    return { ip: keepIp, ...keepDevice };
  }

  start() {
    let thiss = this;
    // Este modulo esta empaquetado de forma independiente del entrypoint;
    // lee su politica desde env para no acoplarse a variables del bundle principal.
    const keepAliveInitialDelayMs = Math.max(0, parseInt(
      process.env.POS_TCP_KEEPALIVE_INITIAL_DELAY_MS || "10000",
      10,
    ) || 10000);
    const hardIdleTimeoutMs = Math.max(0, parseInt(
      process.env.POS_HARD_IDLE_TIMEOUT_MS || "43200000",
      10,
    ) || 0);

    // rc.8: ya no se destruye un socket por 15 min de ocio. La salud de
    // heartbeat es telemetria y el hard-idle es un fusible independiente.
    this.server.on("connection", (socket) => {
      thiss.isIp = true;

      socket.setEncoding(null);
      socket.setKeepAlive(true, keepAliveInitialDelayMs);

      let instance = {
        family: socket.remoteFamily,
        ip: socket.remoteAddress,
        port: socket.remotePort + " => " + thiss.PORT,
        Cliente: "** new connection **",
        timestamp: getLaPazTimestamp(),
        version: packageInfo.version,
        serial: null,
        terminalId: null,
        security: thiss.useTLSSecurePOS ? "TLS" : "TCP",
      };

      if (thiss.connectedDevicesByIp.has(instance.ip)) {
        // FIX: conexion nueva de una IP que ya tenia socket = REEMPLAZO.
        // Se notifica como "replaced" y no como desconexion, porque el
        // equipo sigue conectado a traves del socket nuevo.
        const previousSocket = thiss.connectedDevicesByIp.get(instance.ip).socket;
        if (previousSocket) previousSocket.__disconnectReason = "socket_replaced";
        if (previousSocket && !previousSocket.destroyed) previousSocket.destroy();
        thiss.connectedDevicesByIp.delete(instance.ip);
        thiss.eventCallback("replaced", instance);
      }

      thiss.server.getConnections((error, count) => {
        if (error) {
          console.error("Error obteniendo conexiones:", error);
          return;
        }
        console.log("Conexiones activas en servidor (TCP):", count);
        console.log(
          "Conexiones activas registradas (mapa):",
          thiss.connectedDevicesByIp.size,
        );
        thiss.getActiveConnections();
      });

      const connectedAt = Date.now();
      socket.__connAt = connectedAt;
      socket.__lastActivityAt = connectedAt;
      socket.__disconnectReason = null;

      const deviceObj = {
        socket: socket,
        ip: instance.ip,
        env: { logger: false, stepNext: "step0", name: "------" },
        pendingData: null,
        // Heartbeat ATC v6.0 (manual 7.1): el POS envia ENQ 0x05
        // cada 2 min cuando esta conectado y en reposo.
        lastHeartbeatAt: null,
        lastActivityAt: connectedAt,
        heartbeatCount: 0,
      };
      thiss.connectedDevicesByIp.set(instance.ip, deviceObj);

      const frameReader = new PosFrameReader();
      deviceObj.frameReader = frameReader;
      socket.on("data", (chunk) => frameReader.push(chunk));
      frameReader.on("frameError", (err) => {
        logMessage(`WPOSS frame error | device=${instance.ip} | reason=${err.reason} | ${err.message}`);
      });
      socket.once("close", () => frameReader.reset());

      const onHeartbeatData = (data) => {
        const currentDevice = thiss.connectedDevicesByIp.get(instance.ip);
        if (!currentDevice || currentDevice.socket !== socket) return;

        const now = Date.now();
        currentDevice.lastActivityAt = now;
        socket.__lastActivityAt = now;

        const buf = Buffer.from(data);
        if (buf.length !== 1 || buf[0] !== 0x05) return;

        currentDevice.lastHeartbeatAt = now;
        currentDevice.heartbeatCount = (currentDevice.heartbeatCount || 0) + 1;
        socket.__lastHeartbeatAt = now;

        if (!socket.destroyed && socket.writable) {
          socket.write(Buffer.from([0x06]));
        }

        // Fuerza actualizacion de devices.json sin llenar out.log con una
        // traza cada 2 minutos.
        thiss.eventCallback("heartbeat", {
          ip: instance.ip,
          heartbeatAt: now,
        });
      };
      socket.prependListener("data", onHeartbeatData);
      socket.once("close", () => socket.removeListener("data", onHeartbeatData));

      console.table(instance);
      thiss.eventCallback("connected", instance);

      socket.once("data", (data) => {
        const dataStr = data.toString("utf8").trim().toUpperCase();
        const parts = dataStr.split("1C");
        const isHandshake = parts.length === 2 && parts[0] && parts[1];

        thiss.isIp = false;

        if (isHandshake) {
          const parsed = { serial: parts[0], terminalId: parts[1] };
          let device = thiss.connectedDevicesByIp.get(instance.ip);
          if (device) {
            device.serial = parsed.serial;
            device.terminalId = parsed.terminalId;
            thiss.connectedDevicesByIp.set(instance.ip, device);
          }
          thiss.getDeviceBySerial(parsed.serial, instance.ip);
          Object.assign(instance, parsed);
          console.table(instance);
          thiss.eventCallback("connected", instance);
        } else {
          let device = thiss.connectedDevicesByIp.get(instance.ip);
          if (device) {
            device.pendingData = data;
          }
        }
      });

    
      let identityProbeBuffer = Buffer.alloc(0);
      let identityProbeDone = false;
      let identityProbeTimer = null;

      const cleanupIdentityProbe = () => {
        if (identityProbeDone) return;
        identityProbeDone = true;
        if (identityProbeTimer) clearTimeout(identityProbeTimer);
        socket.removeListener("data", onIdentityProbeData);
      };

      const onIdentityProbeData = (data) => {
        if (identityProbeDone) return;

        const currentDevice = thiss.connectedDevicesByIp.get(instance.ip);

        // Si este socket ya no es el vigente para la IP, no actualizamos
        // metadata con informacion de una conexion anterior.
        if (!currentDevice || currentDevice.socket !== socket) {
          cleanupIdentityProbe();
          return;
        }

        // El listener original ya pudo identificarlo con el primer paquete.
        if (currentDevice.serial && currentDevice.terminalId) {
          cleanupIdentityProbe();
          return;
        }

        identityProbeBuffer = Buffer.concat([
          identityProbeBuffer,
          Buffer.from(data),
        ]);

        // El handshake es pequeno. El limite evita acumular una trama POS
        // completa si el equipo no envia identificacion en esta conexion.
        if (identityProbeBuffer.length > 128) {
          cleanupIdentityProbe();
          return;
        }

        const probeText = identityProbeBuffer
          .toString("utf8")
          .trimStart()
          .toUpperCase();

        // Formato observado: SERIAL + "1C" + TERMINAL_ID.
        // Ejemplos: 92200758491C05470803 y H3R0007000144231C05470803.
        // El serial puede ser numerico o alfanumerico; el Terminal ID se
        // mantiene estricto en 8 digitos para no confundir una trama
        // transaccional normal con el handshake.
        const match = probeText.match(/^([A-Z0-9]{6,20})1C([0-9]{8})/);
        if (!match) return;

        const parsed = {
          serial: match[1],
          terminalId: match[2],
        };

        currentDevice.serial = parsed.serial;
        currentDevice.terminalId = parsed.terminalId;
        thiss.connectedDevicesByIp.set(instance.ip, currentDevice);

        thiss.getDeviceBySerial(parsed.serial, instance.ip);
        Object.assign(instance, parsed);

        console.log(
          `POS identificado en reconexion | ip=${instance.ip} | serial=${parsed.serial} | terminalId=${parsed.terminalId}`,
        );

        // Solo fuerza la actualizacion de devices.json.
        thiss.eventCallback("connected", instance);
        cleanupIdentityProbe();
      };

      socket.on("data", onIdentityProbeData);

      identityProbeTimer = setTimeout(() => {
        if (identityProbeDone) return;

        const currentDevice = thiss.connectedDevicesByIp.get(instance.ip);
        if (
          currentDevice &&
          currentDevice.socket === socket &&
          !(currentDevice.serial && currentDevice.terminalId)
        ) {
          console.log(`POS conectado sin identificacion completa | ip=${instance.ip}`);
        }

        cleanupIdentityProbe();
      }, 3000);

      socket.once("close", cleanupIdentityProbe);

      // Hard-idle rc.8: ultimo fusible, no politica normal de vida del POS.
      // Se mide por bytes RECIBIDOS del POS (lastActivityAt). El heartbeat
      // 0x05, ACK/NAK y tramas financieras refrescan esa marca.
      // TCP keepalive del SO/Node sigue siendo la primera defensa ante peers
      // realmente muertos.
      let hardIdleTimer = null;
      if (hardIdleTimeoutMs > 0) {
        const checkEvery = Math.max(1000, Math.min(60000, Math.floor(hardIdleTimeoutMs / 4)));
        hardIdleTimer = setInterval(() => {
          const currentDevice = thiss.connectedDevicesByIp.get(instance.ip);
          if (!currentDevice || currentDevice.socket !== socket || socket.destroyed) {
            if (hardIdleTimer) clearInterval(hardIdleTimer);
            hardIdleTimer = null;
            return;
          }

          const lastActivityAt = currentDevice.lastActivityAt || socket.__lastActivityAt || socket.__connAt || Date.now();
          const idleMs = Date.now() - lastActivityAt;
          if (idleMs < hardIdleTimeoutMs) return;

          socket.__disconnectReason = "hard_idle_timeout";
          socket.__hardIdleMs = idleMs;
          logMessage(
            `POS hard-idle cleanup | device=${instance.ip} | ` +
            `idleFor=${Math.round(idleMs / 1000)}s | ` +
            `threshold=${Math.round(hardIdleTimeoutMs / 1000)}s`,
          );
          if (hardIdleTimer) clearInterval(hardIdleTimer);
          hardIdleTimer = null;
          if (!socket.destroyed) socket.destroy();
        }, checkEvery);
        if (hardIdleTimer && typeof hardIdleTimer.unref === "function") hardIdleTimer.unref();
      }
      socket.once("close", () => {
        if (hardIdleTimer) clearInterval(hardIdleTimer);
        hardIdleTimer = null;
      });

      socket.on("end", () => {
        if (!socket.__disconnectReason) socket.__disconnectReason = "remote_end";
        logMessage(`Transaccion finalizada ip=${instance.ip}`);
      });

      socket.on("error", function (e) {
        const ip = socket.remoteAddress;
        const errorMessage = e.code || e.message || e;
        if (!socket.__disconnectReason) socket.__disconnectReason = String(errorMessage || "socket_error");
        const errorLog = {
          timeZone: getLaPazTimestamp(),
          type: "SocketError",
          clientIP: ip,
          error: errorMessage,
          security: thiss.useTLSSecurePOS ? "TLS" : "TCP",
          reason: "",
        };
        if (e.code === "ECONNABORTED") {
          errorLog.reason =
            "La conexión fue abortada desde el cliente. Puede deberse a una interrupción de red o cierre inesperado.";
          console.warn(errorLog);
        } else if (errorMessage === "ECONNRESET") {
          errorLog.reason =
            "La conexión fue cerrada abruptamente por el cliente. Posible falla de red, apagado inesperado, o cierre no controlado del POS.";
          console.error(errorLog);
        } else {
          errorLog.reason = "Error desconocido o inesperado.";
          console.error(errorLog);
        }
        try {
          if (!socket.destroyed) {
            socket.destroy();
            instance["reason"] = error;
            thiss.eventCallback("disconnected", instance);
          }
        } catch (destroyErr) {
          console.error({
            timeZone: getLaPazTimestamp(),
            error: "Error al destruir el socket",
            destroyErr: destroyErr.message,
          });
        }
      });

      socket.on("close", (hadError) => {
        if (!hadError) {
          console.log({
            timeZone: getLaPazTimestamp(),
            ok: "success",
            msg: `La conexión fue cerrada: ${instance.ip}`,
          });
        } else {
          console.log({
            timeZone: getLaPazTimestamp(),
            error: hadError,
            msg: `La conexión fue cerrada con error.`,
          });
        }
        // FIX: borrar solo si la entrada del mapa pertenece a ESTE socket.
        // Antes se borraba por IP, por lo que el cierre de un socket viejo
        // eliminaba la entrada de un socket nuevo ya activo de la misma IP,
        // dejando al equipo conectado pero invisible para la API.
        const actualEnMapa = thiss.connectedDevicesByIp.get(instance.ip);
        const esMiEntrada = actualEnMapa && actualEnMapa.socket === socket;
        if (esMiEntrada) {
          thiss.connectedDevicesByIp.delete(instance.ip);
        }
        setTimeout(() => {
          thiss.server.getConnections((error, count) => {
            console.table({ "Conexiones activas en servidor (TCP)": count });
            console.log(
              "Conexiones activas registradas (mapa):",
              thiss.connectedDevicesByIp.size,
            );
          });
          if (esMiEntrada) {
            thiss.eventCallback("disconnected", instance);
          } else {
            thiss.eventCallback("replaced", instance);
          }
        }, 300);
      });
    });

    this.server.listen({ host: thiss.HOST, port: thiss.PORT }, function () {
      logMessage(
        `Servidor POS ${thiss.useTLSSecurePOS ? "TLS" : "TCP"} iniciado en puerto: ${thiss.PORT}`,
      );
    });
    return this;
  }

  executeStep(tempSteps, step, socket, env) {
    let stepParams = tempSteps[step];
    this.sendMessageBoxToPos(
      stepParams.message,
      socket,
      Object.assign(env, { name: stepParams.name, stepNext: step }),
    );
  }

  validConnectDevices(params) {

    if (this.isIp) {
      try {
        params.device = this.devicesConfig != undefined ? this.devicesConfig[params.device] : params.device;
      } catch (error) {
      }
    }
    console.log("validated params", params);
    var device = this.connectedDevicesByIp.get(params.device);

    if (!device) {
      return {
        timeZone: getLaPazTimestamp(),
        status: "error",
        message: "Device not conected",
        device: params.device,
      };
    }
    return {
      timeZone: getLaPazTimestamp(),
      status: "success",
      message: "connected successfully",
      device: device,
      ip: params.device,
    };
  }

  handleChip(config) {
    return handleChip(this,config);
  }

  handleErrorResponse(unpackMessage, steps, socket, device, params, stepNext) {
    var thiss = this;
    if (!unpackMessage || !unpackMessage.data) {
      device.env.stepNext = stepNext;
      return;
    }
    const field48 = unpackMessage.data[48];
    const responseCodeValue = field48 && field48.value;

    if (responseCodeValue !== undefined) {
      thiss.executeStep(steps, "finish", socket, device.env); // ACK
      params.response({
        status: "error",
        message: getResponseByCodeError(responseCodeValue),
      });
    } else {
      device.env.stepNext = stepNext;
    }
  }

  handleCtl(config) {
    return CtlHandler(this, config);
  }

  finishFlow(strReply, params, chipSteps, socket, device, message) {
    if (strReply == "15") {
      params.response({ status: "error", message: message });
      this.executeStep(chipSteps, "finish", socket, device.env);
      device.env.stepNext = "finish";
    }
  }
  handleAnnulment(config) {
    return handleAnnulment(this, config);
  }
  
  handleLotClosuret(config) {
    return handleLotClosuret(this, config);
  }


  handleInitialization(config) {
    let params = Object.assign(
      { logger: false, device: "---------", response: (resp) => { } },
      config,
    );

    var thiss = this;

    let connectedDevices = this.validConnectDevices(params);

    if (connectedDevices.status == "error") {
      return params.response(connectedDevices);
    }

    const lotClosuret = NextSteps.initialize;
    const device = connectedDevices.device,
      socket = device.socket;
    let steps = "step1";

    try {
      device.env.logger = params.logger;
      //Steps 1, send : Solicitud de anulación
      thiss.executeStep(lotClosuret, "step1", socket, device.env);
      device.env.stepNext = "step2";
      device.env.lotes = [];
      device.frameReader.on("message", function (resp) {
        //Steps 2, 3
        const strReply = Buffer.from(resp).toString("hex");
        let unpackMessage = "";
        steps = device.env.stepNext;
        let stepParams = lotClosuret[steps];

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
            thiss.finishFlow(
              strReply,
              params,
              lotClosuret,
              socket,
              device,
              "Error en la inicializacion",
            );
            if (strReply == "0615") {
              device.env.stepNext = "finish";
              params.response({
                status: "success",
                message: "Inicializacion rechazada",
              });
            } else {
              device.env.stepNext = "step3";
            }
            break;
          case "step3": //reception: Solicitud de la referencia
            unpackMessage = strReply.unpackMessage();
            //send: message Ack

            if (strReply.isNAck()) {
              params.response({
                status: "error",
                message: "Inicializacion rechazada",
              });
            } else {
              params.response({
                status: "success",
                message: "Inicializacion exitosa",
              });
            }
            thiss.executeStep(lotClosuret, "step4", socket, device.env);
            device.env.stepNext = "finish";
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

  handleEcho(config) {
    let params = Object.assign(
      { logger: false, device: "---------", response: (resp) => { } },
      config,
    );

    var thiss = this;

    const echo = NextSteps.echo;
    const device = {
      env: {
        stepNext: "step1",
        logger: params.logger,
        device: params.device,
      },
    },
      socket = config.device;
    let steps = "step1";
    try {
      device.env.logger = params.logger;
      //Steps 1, send : Solicitud de anulación
      thiss.executeStep(echo, "step1", socket, device.env);
      device.env.stepNext = "step2";
      device.env.lotes = [];
      device.frameReader.on("message", function (resp) {
        //Steps 2, 3
        const strReply = Buffer.from(resp).toString("hex");
        let unpackMessage = "";
        steps = device.env.stepNext;
        let stepParams = echo[steps];

        if (device.env.logger) {
          console.log({
            step: device.env.stepNext,
            process: `Receiving POS: ` + stepParams.name,
            message: strReply,
          });
        }
        switch (device.env.stepNext) {
          case "step2": //reception: message Ack
            thiss.finishFlow(
              strReply,
              params,
              echo,
              socket,
              device,
              "Error en la Sincronizacion",
            );
            if (strReply == "0615") {
              device.env.stepNext = "finish";
              params.response({
                status: "success",
                message: "Sincronizacion rechazada",
              });
            } else {
              device.env.stepNext = "step3";
            }
            break;
          case "step3": //reception: Solicitud de la referencia
            unpackMessage = strReply.unpackMessage();
            //send: message Ack
            if (strReply.isNAck()) {
              params.response({
                status: "error",
                message: "Sincronizacion rechazada",
                data: unpackMessage.data || null,
              });
            } else {
              params.response({
                status: "success",
                message: "Sincronizacion exitosa",
                data: unpackMessage.data,
              });
            }
            thiss.executeStep(echo, "step4", socket, device.env);
            device.env.stepNext = "finish";
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
}

module.exports = new IntegrationPos();


