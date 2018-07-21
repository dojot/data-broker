/* jslint node: true */
"use strict";

// import engine = require("./subscription-engine");

import { addLoggerEndpoint, logger } from "@dojot/dojot-module-logger";
import bodyParser = require("body-parser");
import express = require("express");
import http = require("http");
import morgan = require("morgan");
import util = require("util");
import { authEnforce, authParse, IAuthRequest} from "./api/authMiddleware";
import * as config from "./config";
import { ITopicProfile } from "./RedisClientWrapper";
import { SocketIOSingleton } from "./socketIo";
import { SubscriptionEngine, SubscriptionType } from "./subscription-engine";
import { TopicManagerBuilder } from "./TopicBuilder";

// For now, express is not so well supported in TypeScript.
// A quick workaround, which apparently does not have any side effects is to
// set app with type "any".
// https://github.com/DefinitelyTyped/DefinitelyTyped/issues/21371#issuecomment-344958250
const app: any = express();
app.use(authParse);
app.use(authEnforce);
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(morgan("short"));

const engine = new SubscriptionEngine();

const httpServer = http.createServer(app);
// make sure singleton is instantiated
SocketIOSingleton.getInstance(httpServer);

/*
 *setting log debug route to app
 */
addLoggerEndpoint(app);

/*
 * Subscription management endpoints
 */
app.post("/subscription", (request: IAuthRequest, response: express.Response) => {
  const subscription = request.body;
  logger.debug("Received new subscription request.", {filename: "sub-mng"});
  logger.debug(`Subscription body is: ${util.inspect(subscription, { depth: null })}`, {filename: "sub-mng"});
  if ("id" in subscription.subject.entities) {
    engine.addSubscription(SubscriptionType.id, subscription.subject.entities.id, subscription);
  } else if ("model" in subscription.subject.entities) {
    engine.addSubscription(SubscriptionType.model, subscription.subject.entities.model, subscription);
  } else if ("type" in subscription.subject.entities) {
    engine.addSubscription(SubscriptionType.type, subscription.subject.entities.type, subscription);
  }
  response.send("Ok!");
});

/*
 * Topic registry endpoints
 */
app.get("/topic/:subject", (req: IAuthRequest, response: express.Response) => {
  logger.debug("Received a topic GET request.", {filename: "sub-mng"});

  if (req.service === undefined) {
    logger.error("Service is not defined in GET request headers.", {filename: "sub-mng"});
    response.status(401);
    response.send({ error: "missing mandatory authorization header in get request" });
  } else {
    const topics = TopicManagerBuilder.get(req.service);
    logger.debug(`Topic for service ${req.service} and subject ${req.params.subject}.`, {filename: "sub-mng"});
    topics.getCreateTopic(req.params.subject, (error: any, data: any) => {
      if (error) {
        logger.error(`Failed to retrieve topic. Error is ${error}`, {filename: "sub-mng"});
        response.status(500);
        response.send({ error: "failed to process topic" });
      } else {
        response.status(200).send({ topic: data });
      }
    });
  }
});
/**
 * Getting profiles end point
 */
app.get("/topic/:subject/profile", (req: IAuthRequest, response: express.Response) => {

  logger.debug("Received a profile GET request.");

  if (req.service === undefined) {
    response.status(401).send({ error: "Missing mandatory authorization header in profile request" });
  } else {
    const topics = TopicManagerBuilder.get(req.service);
    topics.getConfigTopics(req.params.subject).then((data: ITopicProfile | undefined) => {
      if (data === undefined) {
        response.status(404).send({ message: "Could not find profiles for this subject" });
      }
      response.status(200).send(data);
    }).catch((error: any) => {
      response.status(500).send({ message: "error", details: `${util.inspect(error, { depth: null })}` });
    });
  }

});

/**
 * Setting profiles end point
 */
app.post("/topic/:subject/profile", (req: IAuthRequest, response: express.Response) => {
  logger.debug("Received a profile POST request.");
  if (req.service === undefined) {
    response.status(401).send({ error: "Missing mandatory authorization header in profile request" });
  } else {
    const topics = TopicManagerBuilder.get(req.service);
    topics.setConfigTopics(req.params.subject, req.body);
  }

  response.status(200).send({ message: "Set configs successfully" });
});

/**
 * Editing profiles end point
 */
app.put("/topic/:subject/profile/:tenant", (req: IAuthRequest, response: express.Response) => {
  logger.debug(`Received a profile PUT request for tenant ${req.params.tenant}`);

  if (req.service === undefined) {
    response.status(401).send({ error: "Missing mandatory authorization header in profile request" });
  } else {
    const topics = TopicManagerBuilder.get(req.service);
    topics.setConfigTopics(req.params.subject, req.body);
  }

  response.status(200).send({ message: "Configs edited/created successfully" });

});

/**
 * SocketIO endpoint
 */
app.get("/socketio", (req: IAuthRequest, response: express.Response) => {
  logger.debug("Received a request for a new socketIO connection.", {filename: "sub-mng"});
  if (req.service === undefined) {
    logger.error("Service is not defined in SocketIO connection request headers.", {filename: "sub-mng"});
    response.status(401);
    response.send({ error: "missing mandatory authorization header in socketio request" });
  } else {
    const token = SocketIOSingleton.getInstance().getToken(req.service);
    response.status(200).send({ token });
  }
});

httpServer.listen(config.broker.port, () => {
  logger.debug("Subscription manager listening on port " + config.broker.port, {filename: "sub-mng"});
});
