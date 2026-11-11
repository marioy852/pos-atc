const express = require("express");
const path = require("path");
const posRoutes = require("./routes/pos.routes");
const { cors } = require("./middlewares/cors");

function createApp() {
  const app = express();
  app.use(cors);
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  app.use(express.static(path.join(__dirname, "views/public")));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.set("trust proxy", true);

  app.use("/", posRoutes);

  return app;
}

module.exports = createApp;
