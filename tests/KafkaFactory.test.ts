import "jest";

import kafkaDojot = require("@dojot/adminkafka");
import kafka = require("kafka-node");

import { KafkaFactory } from "../src/KafkaFactory";

jest.mock("@dojot/adminkafka");
jest.mock("kafka-node");

describe("KafkaFactory", () => {

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("should a create kafka client", (done) => {
    const factory = new KafkaFactory("host");
    const client = factory.client();
    expect(client).not.toBeUndefined();
    expect(kafka.KafkaClient).toHaveBeenCalledTimes(1);
    done();
  });

  it("should a create kafka client when there is not a host", (done) => {
    const factory = new KafkaFactory();
    const client = factory.client();
    expect(client).not.toBeUndefined();
    expect(kafka.KafkaClient).toHaveBeenCalledTimes(1);
    done();
  });

  it("should create a dojot producer", (done) => {
    const factory = new KafkaFactory("host");
    const producer = factory.dojotProducer();
    expect(producer).not.toBeUndefined();
    expect(kafkaDojot.Admin).toHaveBeenCalledTimes(1);
    done();
  });
  it("should create a kafka producer", (done) => {
    const factory = new KafkaFactory("host");
    const client = factory.client();
    const producer = factory.kafkaProducer(client, () => { return; });
    expect(producer).not.toBeUndefined();
    expect(kafka.HighLevelProducer).toHaveBeenCalledTimes(1);
    expect(producer.on).toHaveBeenCalledTimes(1);
    done();
  });
});
