import kafkaDojot = require("@dojot/adminkafka");
import { logger } from "@dojot/dojot-module-logger";
import kafka = require("kafka-node");
import util = require("util");
import config = require("./config");
import { IAutoScheme } from "./RedisClientWrapper";
import { TopicCallback } from "./topicManager";

const TAG = { filename: "producer" };

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
    logger.debug("Creating new Kafka producer...", TAG);
    const kafkaHost = host ? host : `${config.kafka.zookeeperAddress}:${config.kafka.zookeeperPort}`;
    logger.debug("Creating Kafka client...", TAG);
    const client = new kafka.Client(kafkaHost);
    logger.debug("... Kafka client was created.", TAG);
    logger.debug("Creating Kafka HighLevenProducer...", TAG);
    this.producerDojot = new kafkaDojot.Admin(config.kafka.kafkaAddress, Number(config.kafka.kafkaPort));
    this.producer = new kafka.HighLevelProducer(client, { requireAcks: 1 });
    logger.debug("... HighLevelProducer was created.", TAG);
    this.producer.on("ready", () => {
      if (init) {
        init();
      }
    });

    logger.debug("... Kafka producer was created.", TAG);
  }

  /**
   * Send a message to Kafka through a topic.
   *
   * @param message The message to be sent
   * @param topic Topic through which the message will be sent
   * @param key If defined, it sends a keyed message. Check Kafka docs for more information on that.
   */
  public send(message: string, topic: string, key?: string) {
    logger.debug("Sending message through Kafka...", TAG);
    let msgPayload;
    if (key) {
      logger.debug("Sending a keyed message.", TAG);
      msgPayload = new kafka.KeyedMessage(key, message);
    } else {
      logger.debug("Sending a plain message.", TAG);
      msgPayload = message;
    }

    const contextMessage = {
      messages: [msgPayload],
      topic,
    };

    logger.debug("Invoking message transmission...", TAG);
    this.producer.send([contextMessage], (err, result) => {
      if (err !== undefined) {
        logger.debug(`Message transmission failed: ${err}`, TAG);
      } else {
        logger.debug("Message transmission succeeded.", TAG);
      }
      if (result !== undefined) {
        logger.debug(`Result is: ${util.inspect(result, { depth: null })}`, TAG);
      }
    });
    logger.debug("... message transmission was requested.", TAG);
  }

  /**
   * Create a list of topics.
   * @param topics The topics to be created.
   * @param callback The callback that will be invoked when the topics are created.
   */
  public createTopics(topics: string[], callback?: (err: any, data: any) => void) {
    logger.debug("Creating topics...", TAG);
    if (callback) {
      this.producer.createTopics(topics, callback);
    } else {
      this.producer.createTopics(topics, () => {
        logger.debug("No callback defined for topic creation.", TAG);
      });
    }

    logger.debug("... topics creation was requested.", TAG);
  }

  public createTopic(topics: string, profile: IAutoScheme, callback: TopicCallback | undefined) {
    logger.debug(`Creating topics with ${profile.num_partitions} partition(s)`, TAG);
    logger.debug(`and ${profile.replication_factor} replication factor...`, TAG);
    const creationCode = this.producerDojot.createTopic(topics, profile.num_partitions, profile.replication_factor);
    logger.debug("... topics creation was requested.", TAG);
    if (callback) {
      callback(creationCode, topics);
    }
  }

  /**
   * Close this producer.
   * No more messages will be sent by it.
   */
  public close() {
    logger.debug("Closing producer...", TAG);
    this.producer.close();
    logger.debug("... producer was closed.", TAG);
  }
}

export { KafkaProducer };
