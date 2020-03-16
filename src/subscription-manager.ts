import { Messenger } from "@dojot/dojot-module";
import { getHTTPRouter as getLoggerRouter, logger } from "@dojot/dojot-module-logger";

import bodyParser = require("body-parser");
import express = require("express");
import http = require("http");
import morgan = require("morgan");
import util = require("util");

import { authEnforce, authParse, IAuthRequest } from "./api/authMiddleware";
import config = require("./config");
import { AgentHealthChecker } from "./Healthcheck";
import { ITopicProfile } from "./RedisClientWrapper";
import { RedisManager } from "./redisManager";
import { SocketIOHandler } from "./SocketIOHandler";
import { TopicManagerBuilder } from "./TopicBuilder";

const TAG = { filename: "SubscriptionManager" };

class DataBroker {
  private app: express.Application;
  private sioHandler: SocketIOHandler | undefined;

  constructor(app: express.Application) {
    this.app = app;
    this.sioHandler = undefined;
  }

  public start() {
    logger.info("Starting DataBroker...", TAG);
    logger.debug("Configuring Express app...", TAG);
    this.app.use(authParse);
    this.app.use(authEnforce);
    this.app.use(bodyParser.json()); // for parsing application/json
    this.app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
    this.app.use(morgan("short"));
    this.app.use(getLoggerRouter());
    logger.debug("... Express app was configured.", TAG);

    const httpServer = http.createServer(this.app);

    // Kafka Messenger
    logger.debug("Initializing Kafka messenger...", TAG);
    this.initializeMessenger("data-broker")
      .then((messenger: Messenger) => {
        logger.debug("... Kafka messenger successfully initialized.", TAG);
        this.initializeHealthChecker(messenger);
        this.sioHandler = new SocketIOHandler(httpServer, messenger);
        this.registerSocketIOEndpoints();
      })
      .catch((error: any) => {
        logger.error(`... Kafka messenger initialization failed. Error: ${error}`, TAG);
        process.kill(process.pid, "SIGTERM");
      });
    logger.debug("... Kafka messenger initialization requested.", TAG);

    this.registerTopicEndpoints();

    logger.debug("Starting HTTP server...", TAG);
    httpServer.listen(config.service.port, () => {
      logger.debug(`Subscription manager listening on port ${config.service.port}`, TAG);
    });
    logger.debug("... HTTP server startup requested.", TAG);
  }

  private async initializeMessenger(name: string) {
    const messenger = new Messenger(name);
    await messenger.init();
    return messenger;
  }

  private initializeHealthChecker(messenger: Messenger) {
    logger.debug("Initializing Healthcheck...", TAG);
    const redis = RedisManager.getClient().client;
    const healthChecker = new AgentHealthChecker(messenger, redis);
    healthChecker.init();
    this.app.use(healthChecker.router);
    logger.debug("... healthcheck was successfully initialized.", TAG);
  }

  private registerTopicEndpoints() {
    logger.debug("Registering common endpoints...", TAG);

    /*
     * Topic registry endpoints
     */
    this.app.get("/topic/:subject", (req: IAuthRequest, response: express.Response) => {
      logger.debug(`Received a GET request in /topic/${req.params.subject}.`, TAG);

      if (req.service === undefined) {
        logger.error("Service is not defined in GET request headers.", TAG);
        response.status(401);
        response.send({ error: "Missing service in GET request header" });
      } else {
        const topics = TopicManagerBuilder.get(req.service);
        logger.debug(`Topic for service ${req.service} and subject ${req.params.subject}.`, TAG);
        topics.getCreateTopic(req.params.subject, (error: any, data: any) => {
          if (error) {
            logger.error(`Failed to process topic. Error is ${error}`, TAG);
            response.status(500);
            response.send({ error: "Failed to process topic" });
          } else {
            response.status(200).send({ topic: data });
          }
        });
      }
    });

    /**
     * Getting profiles end point
     */
    this.app.get("/topic/:subject/profile", (req: IAuthRequest, response: express.Response) => {
      logger.debug(`Received a GET request in /topic/${req.params.subject}/profile.`, TAG);

      if (req.service === undefined) {
        logger.error("Service is not defined in GET request headers.", TAG);
        response.status(401).send({ error: "Missing service in GET request header" });
      } else {
        const topics = TopicManagerBuilder.get(req.service);
        topics.getConfigTopics(req.params.subject).then((data: ITopicProfile | undefined) => {
          if (data === undefined) {
            logger.debug("Could not find profiles for this subject", TAG);
            response.status(404).send({ message: "Could not find profiles for this subject" });
          }
          response.status(200).send(data);
        }).catch((error: any) => {
          logger.error(`Could not proccess the request. Error: ${error}`, TAG);
          response.status(500).send({ message: "error", details: `${util.inspect(error, { depth: null })}` });
        });
      }

    });

    /**
     * Setting profiles end point
     */
    this.app.post("/topic/:subject/profile", (req: IAuthRequest, response: express.Response) => {
      logger.debug(`Received a POST request in /topic/${req.params.subject}/profile.`, TAG);
      if (req.service === undefined) {
        logger.error("Service is not defined in POST request headers.", TAG);
        response.status(401).send({ error: "Missing service in POST request header" });
      } else {
        const topics = TopicManagerBuilder.get(req.service);
        topics.setConfigTopics(req.params.subject, req.body);
      }

      response.status(200).send({ message: "Configs set successfully" });
    });

    /**
     * Editing profiles end point
     */
    this.app.put("/topic/:subject/profile/:tenant", (req: IAuthRequest, response: express.Response) => {
      logger.debug(`Received a PUT request in /topic/${req.params.subject}/profile/${req.params.tenant}`, TAG);

      if (req.service === undefined) {
        logger.error("Service is not defined in PUT request headers.", TAG);
        response.status(401).send({ error: "Missing service in PUT request header" });
      } else {
        const topics = TopicManagerBuilder.get(req.service);
        topics.setConfigTopics(req.params.subject, req.body);
      }

      response.status(200).send({ message: "Configs edited/created successfully" });

    });
  }

  private registerSocketIOEndpoints() {
    logger.debug("Registering socket.io endpoints...", TAG);

    /**
     * SocketIO endpoint
     */
    this.app.get("/socketio", (req: IAuthRequest, response: express.Response) => {
      logger.debug("Received a request for a new socketIO connection in /socketio.", TAG);
      if (req.service === undefined) {
        logger.error("Service is not defined in SocketIO connection request headers.", TAG);
        response.status(401);
        response.send({ error: "Missing service in GET request header" });
      } else {
        const token = SocketIOSingleton.getInstance().getToken(req.service);
        response.status(200).send({ token });
      }
    });

    logger.debug("... socket.io endpoints were successfully registered.", TAG);
  }
}

function main() {
  // in case the environment variable is undefined, we set the default value
  logger.setLevel(config.logging.level);

  const app = express();
  const dataBroker = new DataBroker(app);
  dataBroker.start();
}

process.on("unhandledRejection", (reason) => {
  if (reason) {
    logger.error(`Unhandled Rejection at: ${util.inspect(reason)}. Bailing out!!`, TAG);
  } else {
    logger.error("Unhandled Rejection detected. Bailing out!!", TAG);
  }
  process.kill(process.pid, "SIGTERM");
});

main();
