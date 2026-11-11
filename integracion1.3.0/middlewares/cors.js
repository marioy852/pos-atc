const { CORS_ORIGINS, API_PORT } = require("../config/env");

// Origenes que pueden llamar a la API desde un navegador: los configurados y la propia
// pagina del kiosk, que se sirve desde esta misma API.
const allowed = new Set([
  ...CORS_ORIGINS,
  `http://localhost:${API_PORT}`,
  `http://127.0.0.1:${API_PORT}`,
]);

// Una peticion con un Origin ajeno se rechaza aunque no lleve preflight (por ejemplo, un
// formulario enviado desde otra pagina abierta en el navegador del cajero).
function cors(req, res, next) {
  const origin = req.get("Origin");
  if (!origin) return next();
  if (!allowed.has(origin)) return res.status(403).json({ error: "Origen no permitido" });

  res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  if (req.method !== "OPTIONS") return next();

  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", req.get("Access-Control-Request-Headers") || "Content-Type");
  // Chrome exige este permiso cuando una pagina HTTPS llama a localhost.
  if (req.get("Access-Control-Request-Private-Network") === "true") {
    res.set("Access-Control-Allow-Private-Network", "true");
  }
  res.set("Access-Control-Max-Age", "600");
  res.sendStatus(204);
}

module.exports = { cors };
