const path = require("path");
const POS_GATEWAY_VERSION = "1.0.0-rc.8";
const POS_GATEWAY_BUILD = "V8-HB4-CONNECTION";
require('dotenv').config();
const POS_PORT = parseInt(process.env.POS_PORT || "15455", 10);
const API_PORT = parseInt(process.env.API_PORT || "7392", 10);
// La API es local a la caja; solo el puerto del POS se expone a la LAN.
const API_HOST = process.env.API_HOST || "127.0.0.1";
// Origenes del navegador (sin ruta) que pueden llamar a la API; se separan con comas.
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "https://web.sintesis.com.bo")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function envMs(name, fallback, minValue = 0) {
  const raw = process.env[name];
  const parsed = raw === undefined ? fallback : parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < minValue) {
    console.warn(`[CONFIG] ${name} invalido (${raw}); usando ${fallback}`);
    return fallback;
  }
  return parsed;
}

const POS_TCP_KEEPALIVE_INITIAL_DELAY_MS = envMs("POS_TCP_KEEPALIVE_INITIAL_DELAY_MS", 10000, 0);
const POS_HEARTBEAT_STALE_MS = envMs("POS_HEARTBEAT_STALE_MS", 300000, 1000);
const POS_HEARTBEAT_MISSING_MS = envMs("POS_HEARTBEAT_MISSING_MS", 900000, 1000);
const POS_HARD_IDLE_TIMEOUT_MS = envMs("POS_HARD_IDLE_TIMEOUT_MS", 43200000, 0);
const EFFECTIVE_HEARTBEAT_MISSING_MS = Math.max(POS_HEARTBEAT_MISSING_MS, POS_HEARTBEAT_STALE_MS);

// El terminal corta a los 30 s (chip/ctl) y responde en 4 s como maximo; 40 s deja margen de red.
const POS_OPERATION_TIMEOUT_MS = envMs("POS_OPERATION_TIMEOUT_MS", 40000, 1000);

const TZ = "America/La_Paz";
const TZ_OFFSET = "-04:00";

// __dirname aqui es /config, por eso subimos un nivel con ".."
const ROOT_DIR = path.join(__dirname, "..");
const LOG_DIR = path.join(ROOT_DIR, "logs");
const DEVICES_STATUS_FILE = path.join(LOG_DIR, "devices_status.json");
const HISTORY_FILE = path.join(LOG_DIR, "devices_history.log");
const HISTORY_MAX_BYTES = 5 * 1024 * 1024;
const HISTORY_KEEP = 5;
const DEVICES_CONFIG_FILE = path.join(ROOT_DIR, "devices.json");

module.exports = {
  POS_GATEWAY_VERSION,
  POS_GATEWAY_BUILD,
  POS_PORT,
  API_PORT,
  API_HOST,
  CORS_ORIGINS,
  POS_TCP_KEEPALIVE_INITIAL_DELAY_MS,
  POS_HEARTBEAT_STALE_MS,
  POS_HEARTBEAT_MISSING_MS,
  POS_HARD_IDLE_TIMEOUT_MS,
  EFFECTIVE_HEARTBEAT_MISSING_MS,
  POS_OPERATION_TIMEOUT_MS,
  TZ,
  TZ_OFFSET,
  ROOT_DIR,
  LOG_DIR,
  DEVICES_STATUS_FILE,
  HISTORY_FILE,
  HISTORY_MAX_BYTES,
  HISTORY_KEEP,
  DEVICES_CONFIG_FILE,
};
