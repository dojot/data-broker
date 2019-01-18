/* jslint node: true */
"use strict";

import { Messenger } from "@dojot/dojot-module";
import { logger } from "@dojot/dojot-module-logger";
import sio = require("socket.io");
import uuid = require("uuid/v4");
import { RedisManager } from "./redisManager";
import { TopicManagerBuilder } from "./TopicBuilder";

const TAG = { filename: "socketio"};

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
    logger.debug("Creating new SocketIO handler...", TAG);

    logger.debug("Creating sio server...", TAG);
    this.ioServer = sio(httpServer);
    logger.debug("... sio server was created.", TAG);

    this.ioServer.use(this.checkSocket);

    logger.debug("Registering SocketIO server callbacks...", TAG);

    this.messenger = new Messenger("data-broker-socketio");
    this.messenger.init();
    this.messenger.on("device-data", "message", (tenant: string, data: any) => {
      logger.debug(`Handling message for tenant ${tenant}`, TAG);
      this.handleMessage(tenant, data);
    });

    this.ioServer.on("connection", (socket) => {
      logger.debug("Got new SocketIO connection.", TAG);
      const redis = RedisManager.getClient();
      const givenToken = socket.handshake.query.token;

      logger.debug(`Received token is ${givenToken}.`, TAG);

      redis.runScript(
        __dirname + "/lua/setDel.lua",
        [getKey(givenToken)],
        [],
        (error: any, tenant) => {
          if (error || !tenant) {
            logger.error(
              `Failed to find suitable context for socket: ${socket.id}.`, TAG);
            logger.error("Disconnecting socket.", TAG);
            socket.disconnect();
            return;
          }

          logger.debug(
            `Will assign client [${givenToken}] to namespace: (${tenant}): ${
              socket.id
            }`, TAG);
          socket.join(tenant);
        });
    });
    logger.debug("... SocketIO server callbacks were registered.", TAG);
    logger.debug("... SocketIO handler was created.", TAG);
  }

  /**
   * Generate a new token to be used in SocketIO connection.
   * @param tenant The tenant related to this new token
   */
  public getToken(tenant: string): string {
    logger.debug(`Generating new token for tenant ${tenant}...`, TAG);

    logger.debug("Creating new topic/retrieving current for tenant", TAG);
    const topicManager = TopicManagerBuilder.get(tenant);
    topicManager.getCreateTopic(
      "device-data",
      (error?: any, topic?: string) => {
        if (error || !topic) {
          logger.error(
            `Failed to find appropriate topic for tenant: ${
              error ? error : "Unknown topic"
            }`, TAG);
          return;
        }
      });
    logger.debug("... Kafka topic creation/retrieval was requested.", TAG);

    logger.debug("Associating tenant and SocketIO token...", TAG);
    const token = uuid();
    const redis = RedisManager.getClient();
    redis.client.setex(getKey(token), 60, tenant);
    logger.debug("... token and tenant were associated.", TAG);

    logger.debug(`... token for tenant ${tenant} was created: ${token}.`, TAG);
    return token;
  }

  /**
   * Callback function used to process messages received from Kafka library.
   * @param nsp SocketIO namespace to send out messages to all subscribers. These are tenants.
   * @param error Error received from Kafka library.
   * @param message The message received from Kafka Library
   */
  private handleMessage(nsp: string, message: string) {
    logger.debug("Processing message just received...", TAG);

    let data: any;
    logger.debug("Trying to parse received message payload...", TAG);
    try {
      data = JSON.parse(message);
    } catch (err) {
      if (err instanceof TypeError) {
        logger.debug("... message payload was not successfully parsed.", TAG);
        logger.error(`Received data is not a valid event: ${message}`, TAG);
      } else if (err instanceof SyntaxError) {
        logger.debug("... message payload was not successfully parsed.", TAG);
        logger.error(`Failed to parse event as JSON: ${message}`, TAG);
      }
      return;
    }
    logger.debug("... message payload was successfully parsed.", TAG);

    if (data.hasOwnProperty("metadata")) {
      if (!data.metadata.hasOwnProperty("deviceid")) {
        logger.debug("... received message was not successfully processed.", TAG);
        logger.error("Received data is not a valid dojot event - has no deviceid", TAG);
        return;
      }
    } else {
      logger.debug("... received message was not successfully processed.", TAG);
      logger.error("Received data is not a valid dojot event - has no metadata", TAG);
      return;
    }

    logger.debug(`Will publish event to namespace ${nsp} from device ${data.metadata.deviceid}`,
      {filename: "SocketIOHandler"});
    this.ioServer.to(nsp).emit(data.metadata.deviceid, data);
    this.ioServer.to(nsp).emit("all", data);
    logger.debug("... received message was successfully processed.", TAG);
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
