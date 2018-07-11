/* jslint node: true */
"use strict";

import kafka = require("kafka-node");
import sio = require("socket.io");
import uuid = require("uuid/v4");
import {KafkaConsumer} from "./consumer";
import { logger } from "./logger";
import {RedisManager} from "./redisManager";
import { TopicManagerBuilder } from "./TopicBuilder";

function getKey(token: string): string {
  return "si:" + token;
}

/**
 * Class used to handle SocketIO operations
 */
class SocketIOHandler {
  private ioServer: SocketIO.Server;
  private consumers: { [key: string]: KafkaConsumer };

  /**
   * Constructor.
   * @param httpServer HTTP server as a basis to offer SocketIO connection
   */
  constructor(httpServer: any) {
    logger.debug("Creating new SocketIO handler...");

    this.consumers = {};

    logger.debug("Creating sio server...");
    this.ioServer = sio(httpServer);
    logger.debug("... sio server was created.");

    this.ioServer.use(this.checkSocket);

    logger.debug("Registering SocketIO server callbacks...");
    this.ioServer.on("connection", (socket) => {
      logger.debug("Got new SocketIO connection.");
      const redis = RedisManager.getClient();
      const givenToken = socket.handshake.query.token;

      logger.debug(`Received token is ${givenToken}.`);

      redis.runScript(
        __dirname + "/lua/setDel.lua",
        [getKey(givenToken)],
        [],
        (error: any, tenant) => {
          if (error || !tenant) {
            logger.error(
              `Failed to find suitable context for socket: ${socket.id}.`);
            logger.error("Disconnecting socket.");
            socket.disconnect();
            return;
          }

          logger.debug(
            `Will assign client [${givenToken}] to namespace: (${tenant}): ${
              socket.id
            }`);
          socket.join(tenant);
        });
    });
    logger.debug("... SocketIO server callbacks were registered.");
    logger.debug("... SocketIO handler was created.");
  }

  /**
   * Generate a new token to be used in SocketIO connection.
   * @param tenant The tenant related to this new token
   */
  public getToken(tenant: string): string {
    logger.debug(`Generating new token for tenant ${tenant}...`);

    logger.debug("Creating new topic/retrieving current topic in Kafka for this tenant...");
    const topicManager = TopicManagerBuilder.get(tenant);
    topicManager.getCreateTopic(
      "device-data",
      (error?: any, topic?: string) => {
        if (error || !topic) {
          logger.error(
            `Failed to find appropriate topic for tenant: ${
              error ? error : "Unknown topic"
            }`);
          return;
        }
        this.subscribeTopic(topic, tenant);
      });
    logger.debug("... Kafka topic creation/retrieval was requested.");

    logger.debug("Associating tenant and SocketIO token...");
    const token = uuid();
    const redis = RedisManager.getClient();
    redis.client.setex(getKey(token), 60, tenant);
    logger.debug("... token and tenant were associated.");

    logger.debug(`... token for tenant ${tenant} was created: ${token}.`);
    return token;
  }

  /**
   * Callback function used to process messages received from Kafka library.
   * @param nsp SocketIO namespace to send out messages to all subscribers. These are tenants.
   * @param error Error received from Kafka library.
   * @param message The message received from Kafka Library
   */
  private handleMessage(nsp: string, error?: any, message?: kafka.Message) {
    logger.debug("Processing message just received...");
    if (error || message === undefined) {
      logger.error("Invalid event received. Ignoring.");
      logger.error(`Error is ${error}`);
      logger.error(`Message is ${message}`);
      return;
    }

    let data: any;
    logger.debug("Trying to parse received message payload...");
    try {
      data = JSON.parse(message.value);
    } catch (err) {
      if (err instanceof TypeError) {
        logger.debug("... message payload was not successfully parsed.");
        logger.error(`Received data is not a valid event: ${message.value}`);
      } else if (err instanceof SyntaxError) {
        logger.debug("... message payload was not successfully parsed.");
        logger.error(`Failed to parse event as JSON: ${message.value}`);
      }
      return;
    }
    logger.debug("... message payload was successfully parsed.");

    if (data.hasOwnProperty("metadata")) {
      if (!data.metadata.hasOwnProperty("deviceid")) {
        logger.debug("... received message was not successfully processed.");
        logger.error(
          "Received data is not a valid dojot event - has no deviceid");
        return;
      }
    } else {
      logger.debug("... received message was not successfully processed.");
      logger.error(
        "Received data is not a valid dojot event - has no metadata");
      return;
    }

    logger.debug(`Will publish event to namespace ${nsp}: ${message.value}`);
    this.ioServer.to(nsp).emit(data.metadata.deviceid, data);
    this.ioServer.to(nsp).emit("all", data);
    logger.debug("... received message was successfully processed.");
  }

  /**
   * Subscribe to a particular topic in Kafka.
   * @param topic The topic to be subscribed
   * @param tenant The tenant related to the topic being subscribed.
   * @returns A new KafkaConsumer
   */
  private subscribeTopic(topic: string, tenant: string): KafkaConsumer {
    logger.debug(`Subscribing to topic ${topic}...`);
    if (this.consumers.hasOwnProperty(topic)) {
      logger.debug("Topic already had a subscription. Returning it.");
      return this.consumers[topic];
    }

    logger.debug("Will subscribe to topic [%s]", topic);
    const subscriber = new KafkaConsumer();
    this.consumers[topic] = subscriber;
    subscriber.subscribe(
      [{ topic }],
      (error?: any, message?: kafka.Message) => {
        this.handleMessage(tenant, error, message);
      });

    logger.debug("... topic was successfully subscribed.");
    return subscriber;
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
