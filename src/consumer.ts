import { logger } from "@dojot/dojot-module-logger";
import kafka = require("kafka-node");
import util = require("util");
import uuid = require("uuid/v4");
import config = require("./config");

const TAG = { filename: "consumer"};
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

    logger.debug("New Kafka consumer config:", TAG);
    logger.debug(`Host: ${this.host}`, TAG);
    logger.debug(`Client ID: ${this.id}`, TAG);
    logger.debug(`Consumer options: ${util.inspect(this.info, {depth: null})}`, TAG);
  }

  /**
   * Subscribe to a list of Kafka topics.
   *
   * @param topics The topics to which subscriptions will be created.
   * @param onMessage Callback for processing messages received by these subscriptions.
   */
  public subscribe(topics: kafka.Topic[], onMessage?: (error?: any, data?: kafka.Message) => void): void {
    logger.debug("Subscribing to Kafka topics...", TAG);
    logger.debug(`Topics: ${topics}`, TAG);
    const consumerOpt = {
      groupId: "databroker-" + uuid(),
      kafkaHost: this.host,
      sessionTimeout: 15000,
    };

    logger.debug("Creating Kafka consumer group...", TAG);
    this.consumer = new kafka.ConsumerGroup(consumerOpt, topics[0].topic);
    logger.debug("... consumer group was created.", TAG);

    logger.debug("Registering consumer group callbacks...", TAG);
    this.consumer.on("message", (data: kafka.Message) => {
      if (onMessage) {
        onMessage(undefined, data);
      }
    });

    this.consumer.on("error", (error: any) => {
      logger.error(`Consumer [${this.info.groupId}] has errored: ${error}`, TAG);
      if (onMessage) {
        onMessage(error);
      }
    });

    logger.debug("... consumer group callbacks were registered.", TAG);
    logger.debug("... subscriptions to Kafka topics were created successfully.", TAG);
  }
}

export { KafkaConsumer };
