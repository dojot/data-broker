import "jest";
import { KafkaFactory } from "../src/KafkaFactory";
import { KafkaProducer } from "../src/producer";
import { IAutoScheme } from "../src/RedisClientWrapper";

jest.mock("kafka-node", () => ({
  HighLevelProducer: jest.fn(),
  KeyedMessage: jest.fn((key: string, value: string | Buffer) => {
    return { key, value };
  }),
}));

jest.mock("@dojot/adminkafka", () => ({
  Admin: jest.fn(() => {
    return {
      createTopic: jest.fn(),
    };
  }),
}));

jest.mock("../src/KafkaFactory", () => ({
  KafkaFactory: jest.fn(() => ({
    client: jest.fn(),
    dojotProducer: jest.fn(() => ({
      createTopic: jest.fn(),
    })),
    kafkaProducer: jest.fn(() => ({
      close: jest.fn(),
      createTopic: jest.fn(),
      createTopics: jest.fn((topics, callback) => callback()),
      send: jest.fn((payload, callback) => callback()),
    })),
  })),
}));

jest.mock("../src/RedisClientWrapper");

describe("Producer", () => {
  const callbackFn: () => void = jest.fn(() => { return; });
  const topics: string[] = ["testTopic1", "testTopic2"];

  let kafkaFactory: KafkaFactory;
  let producer: KafkaProducer;
  let stripped: any;

  beforeEach(() => {
    kafkaFactory = new KafkaFactory("test");
    producer = new KafkaProducer(kafkaFactory, () => { return; });
    stripped = (producer as any);
  });

  afterEach(() => {
    producer.close();
  });

  describe("constructor", () => {
    it("should create a producer", (done) => {
      expect(kafkaFactory.client).toHaveBeenCalled();
      expect(kafkaFactory.dojotProducer).toHaveBeenCalled();
      expect(kafkaFactory.kafkaProducer).toHaveBeenCalled();
      expect(stripped.producer).toBeDefined();
      expect(stripped.producerDojot).toBeDefined();

      done();
    });
  });

  describe("send", () => {
    const message: string = "testMessage";
    const topic: string = "testTopic";
    const key: string = "testKey";

    it("should send message - with key", () => {
      stripped.producer.send = jest.fn();
      producer.send(message, topic, key);
      expect(stripped.producer.send).toHaveBeenCalledTimes(1);
    });

    it("should send message - without key", () => {
      producer.send(message, topic);
      expect(stripped.producer.send).toHaveBeenCalledTimes(1);
    });
  });

  describe("createTopics", () => {
    it("should create one topic - without callback", (done) => {
      producer.createTopics([topics[0]], undefined);
      expect(stripped.producer.createTopics).toHaveBeenCalledTimes(1);
      expect(stripped.producer.createTopics).toHaveBeenCalledWith([topics[0]], expect.any(Function));
      done();
    });

    it("should create one topic - with callback", (done) => {
      producer.createTopics([topics[0]], callbackFn);
      expect(stripped.producer.createTopics).toHaveBeenCalledTimes(1);
      expect(stripped.producer.createTopics).toHaveBeenCalledWith([topics[0]], callbackFn);
      done();
    });

    it("should create two topics - without callback", (done) => {
      producer.createTopics(topics, undefined);
      expect(stripped.producer.createTopics).toHaveBeenCalledTimes(1);
      expect(stripped.producer.createTopics).toHaveBeenCalledWith(topics, expect.any(Function));
      done();
    });

    it("should create two topics - with callback", (done) => {
      producer.createTopics(topics, callbackFn);
      expect(stripped.producer.createTopics).toHaveBeenCalledTimes(1);
      expect(stripped.producer.createTopics).toHaveBeenCalledWith(topics, callbackFn);
      done();
    });
  });

  describe("createTopic", () => {
    const profile: IAutoScheme = {
      num_partitions: 1,
      replication_factor: 1,
    };

    it("should create a topic - without callback", (done) => {
      producer.createTopic(topics[0], profile, undefined);
      expect(stripped.producerDojot.createTopic).toHaveBeenCalledTimes(1);
      expect(stripped.producerDojot.createTopic).toHaveBeenCalledWith(
        topics[0], profile.num_partitions, profile.replication_factor);
      done();
    });

    it("should create a topic - with callback", (done) => {
      producer.createTopic(topics[0], profile, callbackFn);
      expect(stripped.producerDojot.createTopic).toHaveBeenCalledTimes(1);
      expect(stripped.producerDojot.createTopic).toHaveBeenCalledWith(
        topics[0], profile.num_partitions, profile.replication_factor);
      done();
    });
  });

  describe("close", () => {
    it("should close the connection", (done) => {
      const producerClose = new KafkaProducer(kafkaFactory, () => { return; });
      const strippedClose = (producerClose as any);
      producerClose.close();
      expect(strippedClose.producer.close).toHaveBeenCalledTimes(1);
      done();
    });
  });
});
