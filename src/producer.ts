import kafka = require("kafka-node");
import util = require("util");
import config = require("./config");
import { logger } from "./logger";

/**
 * Class for producing data to be sent through Kafka
 */
class KafkaProducer {

  /** The producer object used by Kafka library */
  private producer: kafka.HighLevelProducer;

  /**
   * Constructor.
   * @param host The host used to send messages. If not set it will be retrieved from configuration object.
   * @param init Callback executed when the producer indicates that it is ready to use.
   */
  constructor(host?: string, init?: () => void) {
    logger.debug("Creating new Kafka producer...");
    const kafkaHost = host ? host : config.kafka.zookeeper;
    logger.debug("Creating Kafka client...");
    const client = new kafka.Client(kafkaHost);
    logger.debug("... Kafka client was created.");
    logger.debug("Creating Kafka HighLevenProducer...");
    this.producer = new kafka.HighLevelProducer(client, {requireAcks: 1});
    logger.debug("... HighLevelProducer was created.");
    this.producer.on("ready", () => {
      if (init) {
        init();
      }
    });

    logger.debug("... Kafka producer was created.");
  }

  /**
   * Send a message to Kafka through a topic.
   *
   * @param message The message to be sent
   * @param topic Topic through which the message will be sent
   * @param key If defined, it sends a keyed message. Check Kafka docs for more information on that.
   */
  public send(message: string, topic: string, key?: string) {
    logger.debug("Sending message through Kafka...");
    let msgPayload;
    if (key) {
      logger.debug("Sending a keyed message.");
      msgPayload = new kafka.KeyedMessage(key, message);
    } else {
      logger.debug("Sending a plain message.");
      msgPayload = message;
    }

    const contextMessage = {
      messages: [msgPayload],
      topic,
    };

    logger.debug("Invoking message transmission...");
    this.producer.send([contextMessage], (err, result) => {
      if (err !== undefined && err !== null) {
        logger.debug(`Message transmission failed: ${err}`);
      } else {
        logger.debug("Message transmission succeeded.");
      }
      if (result !== undefined) {
        logger.debug(`Result is: ${util.inspect(result, {depth: null})}`);
      }
    });
    logger.debug("... message transmission was requested.");
  }

  /**
   * Create a list of topics.
   * @param topics The topics to be created.
   * @param callback The callback that will be invoked when the topics are created.
   */
  public createTopics(topics: string[], callback?: (err: any, data: any) => void) {
    logger.debug("Creating topics...");
    if (callback) {
      this.producer.createTopics(topics, callback);
    } else {
      this.producer.createTopics(topics, () => {
        logger.debug("No callback defined for topic creation.");
      });
    }

    logger.debug("... topics creation was requested.");
  }

  /**
   * Close this producer.
   * No more messages will be sent by it.
   */
  public close() {
    logger.debug("Closing producer...");
    this.producer.close();
    logger.debug("... producer was closed.");
  }
}

export { KafkaProducer };
