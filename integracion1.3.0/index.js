const devices = require("./config/devices");
const env = require("./config/env");
const createApp = require("./app");
const { startPosServer } = require("./services/posServer");
const { onDeviceEvent, startMonitoring } = require("./services/deviceMonitor");

// ---- Cargar devices.json ----
try {
  devices.cargarDispositivosDesdeArchivo();
} catch (e) {
  console.error("[CONFIG] " + e.message);
  console.error("[CONFIG] POS Gateway no se iniciara hasta corregir devices.json");
  process.exit(1);
}

console.log(`POS Gateway ${env.POS_GATEWAY_VERSION} | build ${env.POS_GATEWAY_BUILD}`);
console.log("------ POLITICA DE CONEXION POS ------");
console.log(`TCP keepalive: habilitado | initialDelay=${env.POS_TCP_KEEPALIVE_INITIAL_DELAY_MS} ms`);
console.log(`Heartbeat STALE: ${env.POS_HEARTBEAT_STALE_MS} ms`);
console.log(`Heartbeat MISSING: ${env.EFFECTIVE_HEARTBEAT_MISSING_MS} ms`);
console.log(`Hard idle: ${env.POS_HARD_IDLE_TIMEOUT_MS === 0 ? "deshabilitado" : env.POS_HARD_IDLE_TIMEOUT_MS + " ms"}`);
console.log("Heartbeat activo Gateway -> POS: deshabilitado");
console.log("--------------------------------------");
console.log("------ DISPOSITIVOS CONFIGURADOS -----");
console.table(
  Object.keys(devices.devicesConfig).map(function (ip) {
    return { nombre: devices.deviceLabels[ip], ip: ip };
  }),
);
console.log("--------------------------------------");

// ---- Servidor TCP hacia los POS ----
startPosServer(onDeviceEvent);

// ---- Monitoreo de dispositivos (devices_status.json + historial) ----
startMonitoring();

// ---- Servidor web Express ----
const app = createApp();
app.listen(env.API_PORT, env.API_HOST, () => console.log(`Servidor web iniciado en ${env.API_HOST}:${env.API_PORT}`));