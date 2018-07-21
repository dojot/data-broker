import { logger } from "@dojot/dojot-module-logger";
import kafka = require("kafka-node");
import util = require("util");
import uuid = require("uuid/v4");
import config = require("./config");

/**
 * Class for consuming data from Kafka.
 */
class KafkaConsumer {
  /** Kafka hostname and port */
  private host: string;

  /** Kafka client ID for this consumer */
  private id: string | undefined;

  /** Consumer options */
  private info: kafka.ConsumerOptions;

  /** The actual consumer object - used by kafka library */
  private consumer: kafka.HighLevelConsumer | undefined;

  constructor(clientid?: string, host?: string, info?: kafka.ConsumerOptions) {
    this.host = host ? host : `${config.kafka.kafkaAddress}:${config.kafka.kafkaPort}`;
    this.info = info ? info : config.kafka.consumer;
    this.id = clientid;

    logger.debug("New Kafka consumer config:", {filename: "consumer"});
    logger.debug(`Host: ${this.host}`, {filename: "consumer"});
    logger.debug(`Client ID: ${this.id}`, {filename: "consumer"});
    logger.debug(`Consumer options: ${util.inspect(this.info, {depth: null})}`, {filename: "consumer"});
  }

  /**
   * Subscribe to a list of Kafka topics.
   *
   * @param topics The topics to which subscriptions will be created.
   * @param onMessage Callback for processing messages received by these subscriptions.
   */
  public subscribe(topics: kafka.Topic[], onMessage?: (error?: any, data?: kafka.Message) => void): void {
    logger.debug("Subscribing to Kafka topics...", {filename: "consumer"});
    logger.debug(`Topics: ${topics}`, {filename: "consumer"});
    const consumerOpt = {
      groupId: "databroker-" + uuid(),
      kafkaHost: this.host,
      sessionTimeout: 15000,
    };

    logger.debug("Creating Kafka consumer group...", {filename: "consumer"});
    this.consumer = new kafka.ConsumerGroup(consumerOpt, topics[0].topic);
    logger.debug("... consumer group was created.", {filename: "consumer"});

    logger.debug("Registering consumer group callbacks...", {filename: "consumer"});
    this.consumer.on("message", (data: kafka.Message) => {
      if (onMessage) {
        onMessage(undefined, data);
      }
    });

    this.consumer.on("error", (error: any) => {
      logger.error(`Consumer [${this.info.groupId}] has errored: ${error}`, {filename: "consumer"});
      if (onMessage) {
        onMessage(error);
      }
    });

    logger.debug("... consumer group callbacks were registered.", {filename: "consumer"});
    logger.debug("... subscriptions to Kafka topics were created successfully.", {filename: "consumer"});
  }
}

export { KafkaConsumer };
