/* jslint node: true */
"use strict";

import {SubscriptionEngine, SubscriptionType} from "./subscription-engine";

import bodyParser = require("body-parser");
import express = require("express");
import http = require("http");
import morgan = require("morgan");
import util = require("util");
import uuid = require("uuid");
import { authEnforce, authParse, IAuthRequest} from "./api/authMiddleware";
import { logger } from "./logger";
import {SocketIOSingleton} from "./socketIo";
import { assertSubscription, ISubscription } from "./subscription/Types";
import { TopicManagerBuilder } from "./TopicBuilder";

// For now, http is not so well supported in TypeScript.
// A quick workaround, which apparently does not have any side effects is to
// set app with type "any".
// Thus we can create a new http server using it.
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
 * Subscription management endpoints
 */
app.post("/subscription", (request: IAuthRequest, response: express.Response) => {
  const subscription: ISubscription = request.body;
  subscription.id = uuid.v4();
  const service = request.service;
  if (service === undefined) {
    logger.error("Service is not defined in subscription request headers.");
    response.status(401);
    response.send({error: "missing mandatory authorization header in subscription creation request"});
  } else {
    logger.debug("Received new subscription request.");
    logger.debug(`Subscription body is: ${util.inspect(subscription, {depth: null})}`);

    const [ret, msg] = assertSubscription(subscription);
    if (ret !== 0) {
      logger.debug(`Request is not valid: ${msg}`);
      response.status(400);
      response.send(`invalid request: ${msg}`);
    } else {
      if (subscription.subject.entities.id !== undefined) {
        engine.addSubscription(SubscriptionType.id, service, subscription.subject.entities.id, subscription);
      } else if (subscription.subject.entities.template !== undefined) {
        engine.addSubscription(SubscriptionType.template, service,
          subscription.subject.entities.template, subscription);
      }
      response.status(200);
      response.send("Ok!");
    }
  }
});

/*
 * Topic registry endpoints
 */
app.get("/topic/:subject", (req: IAuthRequest, response: express.Response) => {
  logger.debug("Received a topic GET request.");
  if (req.service === undefined) {
    logger.error("Service is not defined in GET request headers.");
    response.status(401);
    response.send({error: "missing mandatory authorization header in get request"});
  } else {
    const topics = TopicManagerBuilder.get(req.service);
    logger.debug(`Topic for service ${req.service} and subject ${req.params.subject}.`);
    topics.getCreateTopic(req.params.subject, (error: any, data: any) => {
      if (error) {
        logger.error(`Failed to retrieve topic. Error is ${error}`);
        response.status(500);
        response.send({error: "failed to process topic"});
      } else {
        response.status(200).send({topic: data});
      }
    });
  }
});

/**
 * SocketIO endpoint
 */
app.get("/socketio", (req: IAuthRequest, response: express.Response) => {
  logger.debug("Received a request for a new socketIO connection.");
  if (req.service === undefined) {
    logger.error("Service is not defined in SocketIO connection request headers.");
    response.status(401);
    response.send({ error: "missing mandatory authorization header in socketio request" });
  } else {
    const token = SocketIOSingleton.getInstance().getToken(req.service);
    response.status(200).send({ token });
  }
});

httpServer.listen(80, () => {
  logger.debug("Subscription manager listening on port 80");
});
