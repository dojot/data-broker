import kafkaDojot = require("@dojot/adminkafka");
import { logger } from "@dojot/dojot-module-logger";
import kafka = require("kafka-node");
import config = require("./config");

export class KafkaFactory {
    private host?: string;

    constructor(theHost?: string) {
        this.host = theHost;
    }

    public client(): kafka.KafkaClient {
        logger.debug("Creating new Kafka producer...", {filename: "producer"});
        const kafkaHost = this.host ? this.host : config.kafka.kafkaAddress + ":" + config.kafka.kafkaPort.toString();
        logger.debug("Creating Kafka client...", {filename: "producer"});
        return new kafka.KafkaClient({kafkaHost});
    }

    public dojotProducer(): kafkaDojot.Admin {
        logger.debug("Creating Kafka HighLevelProducer...", {filename: "producer"});
        return new kafkaDojot.Admin(config.kafka.kafkaAddress, Number(config.kafka.kafkaPort));
    }

    public kafkaProducer(client: kafka.KafkaClient, init: () => void): kafka.HighLevelProducer {
        const producer = new kafka.HighLevelProducer(client, { requireAcks: 1 });
        logger.debug("... HighLevelProducer was created.", {filename: "producer"});
        producer.on("ready", init);
        logger.debug("... Kafka producer was created.", {filename: "producer"});
        return producer;
    }
}
