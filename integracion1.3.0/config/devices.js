const fs = require("fs");
const net = require("net");
const { DEVICES_CONFIG_FILE } = require("./env");

let devicesConfig = {};
let deviceLabels = {};
let deviceByName = Object.create(null);
let deviceOrder = {};

function cargarDispositivosDesdeArchivo() {
  if (!fs.existsSync(DEVICES_CONFIG_FILE)) {
    throw new Error("No se encontro " + DEVICES_CONFIG_FILE);
  }
  let obj;
  try {
    obj = JSON.parse(fs.readFileSync(DEVICES_CONFIG_FILE, "utf8"));
  } catch (e) {
    throw new Error("devices.json no contiene JSON valido: " + e.message);
  }
  if (!obj || Array.isArray(obj) || typeof obj !== "object") {
    throw new Error("devices.json debe ser un objeto { nombre: ip }");
  }
  const entries = Object.entries(obj);
  if (entries.length === 0) throw new Error("devices.json no puede estar vacio");

  const nuevo = {};
  const labels = {};
  const byName = Object.create(null);
  const order = {};
  const ips = new Set();
  const names = new Set();

  entries.forEach(function ([rawName, rawIp], index) {
    const name = String(rawName || "").trim();
    const ip = String(rawIp || "").trim();
    if (!name) throw new Error("Nombre de terminal vacio");
    if (net.isIP(name)) throw new Error("La etiqueta del POS no puede tener formato de IP: " + name);
    if (names.has(name)) throw new Error("Etiqueta duplicada en devices.json: " + name);
    if (net.isIP(ip) !== 4) throw new Error("IP invalida para " + name + ": " + ip);
    if (ips.has(ip)) throw new Error("IP duplicada en devices.json: " + ip);
    names.add(name);
    ips.add(ip);
    nuevo[ip] = ip;
    labels[ip] = name;
    byName[name] = ip;
    order[ip] = index;
  });

  devicesConfig = nuevo;
  deviceLabels = labels;
  deviceByName = byName;
  deviceOrder = order;
  console.log("devices.json aplicado: " + entries.length + " dispositivo(s) configurado(s)");
}

function resolveConfiguredDevice(identifier) {
  const value = String(identifier || "").trim();
  if (!value) return null;

  if (Object.prototype.hasOwnProperty.call(deviceByName, value)) {
    const ip = deviceByName[value];
    return { requested: value, name: value, ip: ip, mode: "tag" };
  }

  if (Object.prototype.hasOwnProperty.call(devicesConfig, value)) {
    return {
      requested: value,
      name: deviceLabels[value] || value,
      ip: value,
      mode: "ip",
    };
  }
  return null;
}

module.exports = {
  cargarDispositivosDesdeArchivo,
  resolveConfiguredDevice,
  // getters para siempre exponer el valor vigente, ya que estas
  // variables se reasignan al cargar/recargar devices.json
  get devicesConfig() {
    return devicesConfig;
  },
  get deviceLabels() {
    return deviceLabels;
  },
  get deviceByName() {
    return deviceByName;
  },
  get deviceOrder() {
    return deviceOrder;
  },
};
