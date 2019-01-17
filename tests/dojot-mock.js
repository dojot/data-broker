"using strict";
const express = require("express");
const logger = require("@dojot/dojot-module-logger").logger;
const app = express();

const APP_PORT = 5002;
const TAG = {filename: "mocks"};
function initExpressApp() {
  logger.debug("Initializing mocks", TAG);
  app.use((req, res, next) => {
    const rawToken = req.header("authorization");
    if (rawToken !== undefined) {
      const token = rawToken.split(".");
      const tokenData = JSON.parse(new Buffer(token[1], "base64").toString());
      req.service = tokenData.service;
    }
    next();
  });

  app.get("/topic/:subject", (req, res) => {
    res.json({topic: "topic-" + req.params.subject + "-" + req.service});
  });

  app.get("/admin/tenants", (req, res) => {
    res.json({"tenants" : ["admin"]});
  });

  app.listen(APP_PORT, "0.0.0.0", () => {
    logger.debug("started", TAG);
  });
}

initExpressApp();
