import kafka = require("kafka-node");
import util = require("util");
import uuid = require("uuid/v4");
import config = require("./config");
import { logger } from "./logger";

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
    this.host = host ? host : config.kafka.kafka;
    this.info = info ? info : config.kafka.consumer;
    this.id = clientid;

    logger.debug("New Kafka consumer config:");
    logger.debug(`Host: ${this.host}`);
    logger.debug(`Client ID: ${this.id}`);
    logger.debug(`Consumer options: ${util.inspect(this.info, {depth: null})}`);
  }

  /**
   * Subscribe to a list of Kafka topics.
   *
   * @param topics The topics to which subscriptions will be created.
   * @param onMessage Callback for processing messages received by these subscriptions.
   */
  public subscribe(topics: kafka.Topic[], onMessage?: (error?: any, data?: kafka.Message) => void): void {
    logger.debug("Subscribing to Kafka topics...");
    logger.debug(`Topics: ${topics}`);
    const consumerOpt = {
      groupId: "databroker-" + uuid(),
      kafkaHost: this.host,
      sessionTimeout: 15000,
    };

    logger.debug("Creating Kafka consumer group...");
    this.consumer = new kafka.ConsumerGroup(consumerOpt, topics[0].topic);
    logger.debug("... consumer group was created.");

    logger.debug("Registering consumer group callbacks...");
    this.consumer.on("message", (data: kafka.Message) => {
      if (onMessage) {
        onMessage(undefined, data);
      }
    });

    this.consumer.on("error", (error: any) => {
      logger.error(`Consumer [${this.info.groupId}] has errored: ${error}`);
      if (onMessage) {
        onMessage(error);
      }
    });

    logger.debug("... consumer group callbacks were registered.");
    logger.debug("... subscriptions to Kafka topics were created successfully.");
  }
}

export { KafkaConsumer };
