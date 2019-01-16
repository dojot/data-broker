const dojot = require("@dojot/dojot-module");
const express = require("express");
const app = express();
const uuid = require("uuid");

const messages = {
  subjectA: {},
  subjectB: {},
  serviceStatus: {}
};

const APP_PORT = 5002;
var messenger;


function initExpressApp() {
  console.log("Initializing mocks");
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
    console.log("started");
  });
}


initExpressApp();