const fs = require("fs");
const {
  TZ,
  TZ_OFFSET,
  LOG_DIR,
  DEVICES_STATUS_FILE,
  HISTORY_FILE,
  HISTORY_MAX_BYTES,
  HISTORY_KEEP,
  POS_HEARTBEAT_STALE_MS,
  EFFECTIVE_HEARTBEAT_MISSING_MS,
} = require("../config/env");
const devices = require("../config/devices");
const { getNetServer } = require("./posServer");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const RESYNC_MS = 5 * 1000;
let lastSnapshot = "";
let ultimoTcpCount = null;
const historial = {};

function tsLocal(valor) {
  const d = valor ? new Date(valor) : new Date();
  try {
    const txt = new Intl.DateTimeFormat("sv-SE", {
      timeZone: TZ,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).format(d);
    return txt.replace(" ", "T") + TZ_OFFSET;
  } catch (e) {
    return d.toISOString();
  }
}

function hist(ip) {
  if (!historial[ip]) {
    historial[ip] = {
      reconexiones: 0,
      reemplazos: 0,
      ultimaDesconexion: null,
      lastSock: null,
      heartbeatStatus: null,
    };
  }
  return historial[ip];
}

function rotarHistorial() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return;
    if (fs.statSync(HISTORY_FILE).size < HISTORY_MAX_BYTES) return;
    const viejo = `${HISTORY_FILE}.${HISTORY_KEEP}`;
    if (fs.existsSync(viejo)) fs.unlinkSync(viejo);
    for (let i = HISTORY_KEEP - 1; i >= 1; i--) {
      const desde = `${HISTORY_FILE}.${i}`;
      if (fs.existsSync(desde)) fs.renameSync(desde, `${HISTORY_FILE}.${i + 1}`);
    }
    fs.renameSync(HISTORY_FILE, `${HISTORY_FILE}.1`);
  } catch (e) {}
}

function logHistorial(linea) {
  const ts = tsLocal();
  console.log(`devices | ${linea}`);
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    rotarHistorial();
    fs.appendFileSync(HISTORY_FILE, `${ts} | ${linea}\n`);
  } catch (e) {}
}

function heartbeatHealth(lastHeartbeatAt, connectedAt, now) {
  const reference = lastHeartbeatAt || connectedAt || now;
  const ageMs = Math.max(0, now - reference);
  if (lastHeartbeatAt && ageMs < POS_HEARTBEAT_STALE_MS) {
    return { status: "HEALTHY", ageMs };
  }
  if (!lastHeartbeatAt && ageMs < POS_HEARTBEAT_STALE_MS) {
    return { status: "WAITING", ageMs };
  }
  if (ageMs < EFFECTIVE_HEARTBEAT_MISSING_MS) {
    return { status: "STALE", ageMs };
  }
  return { status: "MISSING", ageMs };
}

function buildSnapshot() {
  const NetServer = getNetServer();
  const list = [];
  const map = NetServer && NetServer.connectedDevicesByIp;
  const ahora = Date.now();

  if (map && typeof map.forEach === "function") {
    map.forEach((info, ip) => {
      const sock = info && info.socket;
      const vivo = sock && sock.destroyed !== true;
      if (!vivo) return;

      const h = hist(ip);
      if (h.lastSock !== sock) {
        const esReconexion = h.lastSock !== null || h.ultimaDesconexion !== null;
        if (esReconexion) {
          h.reconexiones += 1;
          logHistorial(`RECONECTADO  ${ip} (reconexión #${h.reconexiones})`);
        } else {
          logHistorial(`CONECTADO    ${ip}`);
        }
        h.lastSock = sock;
        h.heartbeatStatus = null;
        if (!sock.__cierreRegistrado) {
          sock.__cierreRegistrado = true;
          sock.once("close", () => {
            const hh = hist(ip);
            const ahoraCierre = Date.now();
            const seg = sock.__connAt
              ? Math.round((ahoraCierre - sock.__connAt) / 1000)
              : "?";
            const lastActivityAt = sock.__lastActivityAt || sock.__connAt || ahoraCierre;
            const idleSeg = Math.max(0, Math.round((ahoraCierre - lastActivityAt) / 1000));
            const reason = sock.__disconnectReason || "socket_close";
            hh.ultimaDesconexion = tsLocal();
            if (hh.lastSock === sock) hh.lastSock = null;
            hh.heartbeatStatus = null;
            logHistorial(
              `DESCONECTADO ${ip} (reason=${reason}, conectado=${seg}s, inactivo=${idleSeg}s, puerto ${sock.remotePort || "?"})`,
            );
            setTimeout(() => refrescarTcpCount(() => writeDevices()), 60);
          });
        }
      }

      if (!sock.__connAt) sock.__connAt = ahora;

      const lastHeartbeatAt = info.lastHeartbeatAt || sock.__lastHeartbeatAt || null;
      const lastActivityAt = info.lastActivityAt || sock.__lastActivityAt || sock.__connAt || null;
      const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;
      const hb = heartbeatHealth(lastHeartbeatAt, sock.__connAt, ahora);
      const idleMs = lastActivityAt ? Math.max(0, ahora - lastActivityAt) : 0;

      if (h.heartbeatStatus !== hb.status) {
        const anterior = h.heartbeatStatus;
        h.heartbeatStatus = hb.status;
        if (anterior !== null) {
          logHistorial(
            `HEARTBEAT ${ip} ${anterior}->${hb.status} ` +
            `(edad=${Math.round(hb.ageMs / 1000)}s)`,
          );
        }
      }

      list.push({
        name: devices.deviceLabels[ip] || ip,
        ip: ip,
        serial: info.serial || null,
        terminalId: info.terminalId || null,
        identificado: !!(info.serial && info.terminalId),
        configurado: Object.prototype.hasOwnProperty.call(devices.devicesConfig, ip),
        remotePort: sock.remotePort || null,
        conectadoDesde: tsLocal(sock.__connAt),
        segundosConectado: Math.round((ahora - sock.__connAt) / 1000),
        reconexiones: h.reconexiones,
        reemplazos: h.reemplazos,
        ultimaDesconexion: h.ultimaDesconexion,
        ultimoHeartbeat: lastHeartbeatAt ? tsLocal(lastHeartbeatAt) : null,
        proximoHeartbeatEstimado: lastHeartbeatAt
          ? tsLocal(lastHeartbeatAt + HEARTBEAT_INTERVAL_MS)
          : null,
        heartbeatIntervaloSegundos: 120,
        heartbeatRecibidos: info.heartbeatCount || 0,
        heartbeatEstado: hb.status,
        heartbeatEdadSegundos: Math.round(hb.ageMs / 1000),
        ultimaActividadPOS: lastActivityAt ? tsLocal(lastActivityAt) : null,
        segundosInactivo: Math.round(idleMs / 1000),
      });
    });
  }

  list.sort((a, b) => {
    const oa = Object.prototype.hasOwnProperty.call(devices.deviceOrder, a.ip) ? devices.deviceOrder[a.ip] : Number.MAX_SAFE_INTEGER;
    const ob = Object.prototype.hasOwnProperty.call(devices.deviceOrder, b.ip) ? devices.deviceOrder[b.ip] : Number.MAX_SAFE_INTEGER;
    return oa - ob || a.ip.localeCompare(b.ip);
  });

  return {
    actualizado: tsLocal(),
    total: list.length,
    conexionesTCP: ultimoTcpCount,
    dispositivos: list,
  };
}

function writeDevices() {
  const snap = buildSnapshot();
  const cuerpo = JSON.stringify(
    snap.dispositivos.map((d) => {
      const {
        segundosConectado,
        ultimoHeartbeat,
        proximoHeartbeatEstimado,
        heartbeatRecibidos,
        heartbeatEdadSegundos,
        ultimaActividadPOS,
        segundosInactivo,
        ...resto
      } = d;
      return resto;
    }),
  );
  const huboCambio = cuerpo !== lastSnapshot;
  lastSnapshot = cuerpo;

  const tmp = DEVICES_STATUS_FILE + ".tmp";
  try {
    fs.writeFileSync(tmp, JSON.stringify(snap, null, 2));
    fs.renameSync(tmp, DEVICES_STATUS_FILE);
    if (huboCambio) {
      console.log(`devices_status.json | ${snap.total} equipo(s) conectado(s)`);
    }
  } catch (e) {
    console.error("devices_status.json | error al escribir:", e.message);
  }
}

function onDeviceEvent(evt) {
  setTimeout(() => refrescarTcpCount(() => writeDevices()), 50);
}

function refrescarTcpCount(cb) {
  try {
    const NetServer = getNetServer();
    NetServer.server.getConnections((err, count) => {
      if (!err) ultimoTcpCount = count;
      if (cb) cb();
    });
  } catch (e) {
    if (cb) cb();
  }
}

function vaciarYSalir() {
  try {
    fs.writeFileSync(
      DEVICES_STATUS_FILE,
      JSON.stringify(
        {
          actualizado: tsLocal(),
          total: 0,
          conexionesTCP: 0,
          dispositivos: [],
        },
        null,
        2,
      ),
    );
  } catch (e) {}
  process.exit(0);
}

function startMonitoring() {
  refrescarTcpCount(() => writeDevices());
  setInterval(() => refrescarTcpCount(() => writeDevices()), RESYNC_MS);
  process.on("SIGINT", vaciarYSalir);
  process.on("SIGTERM", vaciarYSalir);
}

module.exports = {
  tsLocal,
  onDeviceEvent,
  writeDevices,
  startMonitoring,
};
