import kafkaDojot = require("@dojot/adminkafka");
import { logger } from "@dojot/dojot-module-logger";
import kafka = require("kafka-node");
import config = require("./config");
import { IAutoScheme } from "./RedisClientWrapper";
import { TopicCallback } from "./topicManager";

/**
 * Class for producing data to be sent through Kafka
 */
class KafkaProducer {

  /** The producer object used by Kafka library */
  private producer: kafka.HighLevelProducer;
  private producerDojot: kafkaDojot.Admin;
  /**
   * Constructor.
   * @param host The host used to send messages. If not set it will be retrieved from configuration object.
   * @param init Callback executed when the producer indicates that it is ready to use.
   */
  constructor(host?: string, init?: () => void) {
    logger.debug("Creating new Kafka producer...", {filename: "producer"});
    const kafkaHost = host ? host : config.kafka.zookeeper;
    logger.debug("Creating Kafka client...", {filename: "producer"});
    const client = new kafka.Client(kafkaHost);
    logger.debug("... Kafka client was created.", {filename: "producer"});
    logger.debug("Creating Kafka HighLevenProducer...", {filename: "producer"});
    this.producerDojot = new kafkaDojot.Admin(config.kafka.kafkaAddress, Number(config.kafka.kafkaPort));
    this.producer = new kafka.HighLevelProducer(client, { requireAcks: 1 });
    logger.debug("... HighLevelProducer was created.", {filename: "producer"});
    this.producer.on("ready", () => {
      if (init) {
        init();
      }
    });

    logger.debug("... Kafka producer was created.", {filename: "producer"});
  }

  /**
   * Send a message to Kafka through a topic.
   *
   * @param message The message to be sent
   * @param topic Topic through which the message will be sent
   * @param key If defined, it sends a keyed message. Check Kafka docs for more information on that.
   */
  public send(message: string, topic: string, key?: string) {
    logger.debug("Sending message through Kafka...", {filename: "producer"});
    let msgPayload;
    if (key) {
      logger.debug("Sending a keyed message.", {filename: "producer"});
      msgPayload = new kafka.KeyedMessage(key, message);
    } else {
      logger.debug("Sending a plain message.", {filename: "producer"});
      msgPayload = message;
    }

    const contextMessage = {
      messages: [msgPayload],
      topic,
    };

    logger.debug("Invoking message transmission...", {filename: "producer"});
    this.producer.send([contextMessage], (err, result) => {
      if (err !== undefined) {
        logger.debug(`Message transmission failed: ${err}`, {filename: "producer"});
      } else {
        logger.debug("Message transmission succeeded.", {filename: "producer"});
      }
      if (result !== undefined) {
        logger.debug(`Result is: ${result}`, {filename: "producer"});
      }
    });
    logger.debug("... message transmission was requested.", {filename: "producer"});
  }

  /**
   * Create a list of topics.
   * @param topics The topics to be created.
   * @param callback The callback that will be invoked when the topics are created.
   */
  public createTopics(topics: string[], callback?: (err: any, data: any) => void) {
    logger.debug("Creating topics...", {filename: "producer"});
    if (callback) {
      this.producer.createTopics(topics, callback);
    } else {
      this.producer.createTopics(topics, () => {
        logger.debug("No callback defined for topic creation.", {filename: "producer"});
      });
    }

    logger.debug("... topics creation was requested.", {filename: "producer"});
  }

  public createTopic(topics: string, profile: IAutoScheme, callback: TopicCallback | undefined) {
    logger.debug(`Creating topics with ${profile.num_partitions} partition(s)`);
    logger.debug(`and ${profile.replication_factor} replication factor...`);
    const creationCode = this.producerDojot.createTopic(topics, profile.num_partitions, profile.replication_factor);
    logger.debug("... topics creation was requested.");
    if (callback) {
      callback(creationCode, topics);
    }
  }

  /**
   * Close this producer.
   * No more messages will be sent by it.
   */
  public close() {
    logger.debug("Closing producer...", {filename: "producer"});
    this.producer.close();
    logger.debug("... producer was closed.", {filename: "producer"});
  }
}

export { KafkaProducer };
