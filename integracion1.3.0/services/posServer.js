const net = require("net");
const IntegrationPos = require("../libraryPI/IntegrationPos");
const { POS_PORT } = require("../config/env");
const devices = require("../config/devices");

let NetServer = null;

function startPosServer(onDeviceEvent) {
  NetServer = IntegrationPos.initialize({
    port: POS_PORT,
    host: "0.0.0.0",
    server: net.createServer(),
    devicesConfig: devices.devicesConfig,
    captureDevice: (evt) => {
      try {
        onDeviceEvent(evt);
      } catch (e) {
        console.error("devices_status.json | error en captureDevice:", e.message);
      }
    },
    useTips: true,
  });
  NetServer.start();
  console.log("Servidor TCP iniciado en el puerto " + POS_PORT);
  return NetServer;
}

function getNetServer() {
  return NetServer;
}

module.exports = { startPosServer, getNetServer };
