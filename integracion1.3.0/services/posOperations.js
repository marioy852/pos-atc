const { POS_OPERATION_TIMEOUT_MS } = require("../config/env");
const { getNetServer } = require("./posServer");
const { tsLocal } = require("./deviceMonitor");

// Control de operaciones concurrentes por dispositivo
const activePOSRequests = new Map();
console.log(`Operation timeout: ${POS_OPERATION_TIMEOUT_MS} ms`);

function handlePOSRequest(handler, params, res) {
  const NetServer = getNetServer();
  const deviceKey = params && params.device;

  if (deviceKey && activePOSRequests.has(deviceKey)) {
    const active = activePOSRequests.get(deviceKey);
    const currentDevice = NetServer.connectedDevicesByIp
      ? NetServer.connectedDevicesByIp.get(deviceKey)
      : null;
    const currentSocket = currentDevice && currentDevice.socket;
    const staleLock = !active || !active.socket || !currentSocket
      || active.socket !== currentSocket
      || active.socket.destroyed
      || !active.socket.writable;

    if (staleLock) {
      console.warn(
        `Liberando lock huerfano | device=${deviceKey} handler=${active && active.handler ? active.handler : "?"}`,
      );
      if (active && typeof active.release === "function") active.release("stale_lock");
      else activePOSRequests.delete(deviceKey);
    } else {
      return res.status(409).json({
        status: "error",
        type: "device_busy",
        device: deviceKey,
        message: "El dispositivo ya tiene una transaccion en curso",
        activeSince: active && active.startedAt ? active.startedAt : null,
      });
    }
  }

  const deviceInfo = deviceKey && NetServer.connectedDevicesByIp
    ? NetServer.connectedDevicesByIp.get(deviceKey)
    : null;
  const socket = deviceInfo && deviceInfo.socket;
  const frameReader = deviceInfo && deviceInfo.frameReader;
  const listenersBefore = frameReader
    ? new Set(frameReader.listeners("message"))
    : new Set();
  let requestListeners = [];
  let released = false;
  let watchdog = null;

  const onSocketClose = () => failSocketOperation(
    "socket_close",
    503,
    "La conexion con el POS se cerro antes de completar la operacion",
  );
  const onSocketEnd = () => failSocketOperation(
    "socket_end",
    503,
    "El POS finalizo la conexion antes de completar la operacion",
  );
  const onSocketError = (error) => failSocketOperation(
    "socket_error",
    503,
    "Error de conexion con el POS durante la operacion",
    error,
  );
  const onSocketTimeout = () => failSocketOperation(
    "socket_timeout",
    504,
    "Tiempo de espera agotado en la conexion con el POS",
  );

  const releaseOperation = (reason = "completed") => {
    if (released) return;
    released = true;
    if (watchdog) clearTimeout(watchdog);

    if (frameReader) {
      for (const listener of requestListeners) {
        frameReader.removeListener("message", listener);
      }
    }
    if (socket) {
      socket.removeListener("close", onSocketClose);
      socket.removeListener("end", onSocketEnd);
      socket.removeListener("error", onSocketError);
      socket.removeListener("timeout", onSocketTimeout);
    }

    if (deviceKey) {
      const active = activePOSRequests.get(deviceKey);
      if (!active || active.socket === socket) activePOSRequests.delete(deviceKey);
    }
    console.log(`POS operation released | device=${deviceKey || "?"} handler=${handler} reason=${reason}`);
  };

  const failSocketOperation = (reason, httpStatus, message, error = null) => {
    if (released) return;
    releaseOperation(reason);
    if (!res.headersSent && !res.writableEnded) {
      res.status(httpStatus).json({
        status: "error",
        type: "pos_connection_lost",
        device: deviceKey || null,
        reason,
        message,
        detail: error && error.message ? error.message : null,
      });
    }
  };

  if (socket) {
    socket.once("close", onSocketClose);
    socket.once("end", onSocketEnd);
    socket.once("error", onSocketError);
    socket.once("timeout", onSocketTimeout);
  }

  if (deviceKey) {
    activePOSRequests.set(deviceKey, {
      handler,
      startedAt: tsLocal(),
      socket,
      release: releaseOperation,
    });
  }

  watchdog = setTimeout(() => {
    console.error(
      `POS operation timeout | device=${deviceKey || "?"} handler=${handler}`,
    );
    releaseOperation("watchdog_timeout");
    if (!res.headersSent) {
      res.status(504).json({
        status: "error",
        type: "operation_timeout",
        device: deviceKey || null,
        message: "Tiempo de espera agotado esperando respuesta del POS",
      });
    }
  }, POS_OPERATION_TIMEOUT_MS);

  try {
    NetServer[handler]({
      ...params,
      logger: true,
      response: (response) => {
        releaseOperation("handler_response");
        console.log(response);
        if (!res.headersSent) res.json(response);
      },
    });

    if (frameReader) {
      const operationListeners = frameReader
        .listeners("message")
        .filter((listener) => !listenersBefore.has(listener));

      requestListeners = operationListeners.map((listener) => {
        frameReader.removeListener("message", listener);
        const wrapped = function (resp) {
          const buf = Buffer.from(resp);
          if (buf.length === 1 && buf[0] === 0x05) return;
          return listener.apply(this, arguments);
        };
        frameReader.on("message", wrapped);
        return wrapped;
      });

      if (released) {
        for (const listener of requestListeners) {
          frameReader.removeListener("message", listener);
        }
      }
    }
  } catch (error) {
    releaseOperation("handler_exception");
    console.error("Error esperando la respuesta:", error);
    if (!res.headersSent) {
      res
        .status(500)
        .send({ error: "Error esperando la respuesta del dispositivo." });
    }
  }
}

module.exports = { handlePOSRequest, activePOSRequests };
