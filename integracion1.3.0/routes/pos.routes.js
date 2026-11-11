const express = require("express");
const fs = require("fs");
const { DEVICES_STATUS_FILE } = require("../config/env");
const { validateBody } = require("../middlewares/validate");
const { anularSchema, cerrarSchema, pagoSchema } = require("../validations/schemas");
const { handlePOSRequest } = require("../services/posOperations");

const router = express.Router();

router.get("/", (req, res) => {
  res.render("kiosk");
});

router.post("/anular", validateBody(anularSchema), (req, res) => {
  const { reference } = req.body;
  const device = req.posDevice.ip;
  console.log(`API device resolved | requested=${req.posDevice.requested} name=${req.posDevice.name} ip=${device}`);
  handlePOSRequest("handleAnnulment", { device, reference: parseInt(reference) }, res);
});

router.post("/cerrar", validateBody(cerrarSchema), (req, res) => {
  const device = req.posDevice.ip;
  console.log(`API device resolved | requested=${req.posDevice.requested} name=${req.posDevice.name} ip=${device}`);
  handlePOSRequest("handleLotClosuret", { device }, res);
});

router.get("/dispositivos", (req, res) => {
  try {
    const data = fs.readFileSync(DEVICES_STATUS_FILE, "utf8");
    res.type("application/json").send(data);
  } catch (e) {
    res.status(500).json({ error: "No se pudo leer devices_status.json", detalle: e.message });
  }
});

router.post("/pago/", validateBody(pagoSchema), (req, res) => {
  const { typePay, importe } = req.body;
  const device = req.posDevice.ip;
  const handlers = {
    chip: "handleChip",
    ctl: "handleCtl",
  };
  console.log(`API device resolved | device=${device}`);
  handlePOSRequest(handlers[typePay], { device, importe }, res);
});

module.exports = router;
