/* jslint node: true */
"use strict";

import { Messenger } from "@dojot/dojot-module";
import { logger } from "@dojot/dojot-module-logger";
import sio = require("socket.io");
import uuid = require("uuid/v4");
import { RedisManager } from "./redisManager";
import { TopicManagerBuilder } from "./TopicBuilder";

const TAG = { filename: "socket-io" };

function getKey(token: string): string {
  return "si:" + token;
}

/**
 * Class used to handle SocketIO operations
 */
class SocketIOHandler {
  private ioServer: SocketIO.Server;
  private messenger: Messenger;

  /**
   * Constructor.
   * @param httpServer HTTP server as a basis to offer SocketIO connection
   */
  constructor(httpServer: any) {
    logger.debug("Creating new SocketIO handler...", {filename: "SocketIOHandler"});

    logger.debug("Creating sio server...", {filename: "SocketIOHandler"});
    this.ioServer = sio(httpServer);
    logger.debug("... sio server was created.", {filename: "SocketIOHandler"});

    this.ioServer.use(this.checkSocket);

    logger.debug("Registering SocketIO server callbacks...", {filename: "SocketIOHandler"});

    this.messenger = new Messenger("data-broker-socketio");
    this.messenger.init().then(() => {
      this.messenger.on("device-data", "message", (tenant: string, data: any) => {
        logger.debug(`Handling message for tenant ${tenant}`, TAG);
        this.handleMessage(tenant, data);
      });
    }).catch((error) => {
      logger.error(`Failed to initialize kafka-messenger (${error})`, {filename: "SocketIOHandler"});
      process.kill(process.pid, "SIGTERM");
    });

    this.ioServer.on("connection", (socket) => {
      logger.debug("Got new SocketIO connection.", {filename: "SocketIOHandler"});
      const redis = RedisManager.getClient();
      const givenToken = socket.handshake.query.token;

      logger.debug(`Received token is ${givenToken}.`, {filename: "SocketIOHandler"});

      redis.runScript(
        __dirname + "/lua/setDel.lua",
        [getKey(givenToken)],
        [],
        (error: any, tenant) => {
          if (error || !tenant) {
            logger.error(
              `Failed to find suitable context for socket: ${socket.id}.`, {filename: "SocketIOHandler"});
            logger.error("Disconnecting socket.", {filename: "SocketIOHandler"});
            socket.disconnect();
            return;
          }

          logger.debug(
            `Will assign client [${givenToken}] to namespace: (${tenant}): ${
              socket.id
            }`, {filename: "SocketIOHandler"});
          socket.join(tenant);
        });
    });
    logger.debug("... SocketIO server callbacks were registered.", {filename: "SocketIOHandler"});
    logger.debug("... SocketIO handler was created.", {filename: "SocketIOHandler"});
  }

  /**
   * Generate a new token to be used in SocketIO connection.
   * @param tenant The tenant related to this new token
   */
  public getToken(tenant: string): string {
    logger.debug(`Generating new token for tenant ${tenant}...`, {filename: "SocketIOHandler"});

    logger.debug("Creating new topic/retrieving current for tenant", {filename: "SocketIOHandler"});
    const topicManager = TopicManagerBuilder.get(tenant);
    topicManager.getCreateTopic(
      "device-data",
      (error?: any, topic?: string) => {
        if (error || !topic) {
          logger.error(
            `Failed to find appropriate topic for tenant: ${
              error ? error : "Unknown topic"
            }`, {filename: "SocketIOHandler"});
          return;
        }
      });
    logger.debug("... Kafka topic creation/retrieval was requested.", {filename: "SocketIOHandler"});

    logger.debug("Associating tenant and SocketIO token...", {filename: "SocketIOHandler"});
    const token = uuid();
    const redis = RedisManager.getClient();
    redis.client.setex(getKey(token), 60, tenant);
    logger.debug("... token and tenant were associated.", {filename: "SocketIOHandler"});

    logger.debug(`... token for tenant ${tenant} was created: ${token}.`, {filename: "SocketIOHandler"});
    return token;
  }

  /**
   * Callback function used to process messages received from Kafka library.
   * @param nsp SocketIO namespace to send out messages to all subscribers. These are tenants.
   * @param error Error received from Kafka library.
   * @param message The message received from Kafka Library
   */
  private handleMessage(nsp: string, message: string) {
    logger.debug("Processing message just received...", {filename: "SocketIOHandler"});

    let data: any;
    logger.debug("Trying to parse received message payload...", {filename: "SocketIOHandler"});
    try {
      data = JSON.parse(message);
    } catch (err) {
      if (err instanceof TypeError) {
        logger.debug("... message payload was not successfully parsed.", {filename: "SocketIOHandler"});
        logger.error(`Received data is not a valid event: ${message}`, {filename: "SocketIOHandler"});
      } else if (err instanceof SyntaxError) {
        logger.debug("... message payload was not successfully parsed.", {filename: "SocketIOHandler"});
        logger.error(`Failed to parse event as JSON: ${message}`, {filename: "SocketIOHandler"});
      }
      return;
    }
    logger.debug("... message payload was successfully parsed.", {filename: "SocketIOHandler"});

    if (data.hasOwnProperty("metadata")) {
      if (!data.metadata.hasOwnProperty("deviceid")) {
        logger.debug("... received message was not successfully processed.", {filename: "SocketIOHandler"});
        logger.error("Received data is not a valid dojot event - has no deviceid", {filename: "SocketIOHandler"});
        return;
      }
    } else {
      logger.debug("... received message was not successfully processed.", {filename: "SocketIOHandler"});
      logger.error("Received data is not a valid dojot event - has no metadata", {filename: "SocketIOHandler"});
      return;
    }

    logger.debug(`Will publish event to namespace ${nsp} from device ${data.metadata.deviceid}`,
      {filename: "SocketIOHandler"});
    this.ioServer.to(nsp).emit(data.metadata.deviceid, data);
    this.ioServer.to(nsp).emit("all", data);
    logger.debug("... received message was successfully processed.", {filename: "SocketIOHandler"});
  }

  /**
   *
   * @param socket The socket to be checked
   * @param next Next verification callback. Used by SocketIO library.
   */
  private checkSocket(socket: SocketIO.Socket, next: (error?: Error) => void) {
    const givenToken = socket.handshake.query.token;
    if (givenToken) {
      const redis = RedisManager.getClient();
      redis.client.select(0);
      redis.client.get(getKey(givenToken), (error, value) => {
        if (error) {
          return next(new Error("Failed to verify token"));
        }
        if (value) {
          return next();
        } else {
          return next(new Error("Authentication error: unknown token"));
        }
      });
    } else {
      return next(new Error("Authentication error: missing token"));
    }
  }
}

export { SocketIOHandler };
