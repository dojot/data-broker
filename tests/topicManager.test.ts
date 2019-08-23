/* jslint node: true */
"use strict";

import "jest";
import { KafkaFactory } from "../src/KafkaFactory";
import { TopicManager } from "../src/topicManager";

/**
 * Mocks
 */
jest.mock("../src/KafkaFactory", () => ({
  KafkaFactory: jest.fn(() => mockConfig.KafkaFactory),
}));

jest.mock("../src/producer", () => ({
  KafkaProducer: jest.fn((kafkaFactory: KafkaFactory, init: () => void) => {
    init();
    return mockConfig.KafkaProducer;
  }),
}));

jest.mock("../src/RedisClientWrapper", () => ({
  ClientWrapper: jest.fn(() => mockConfig.ClientWrapper),
}));

jest.mock("redis", () => ({
  createClient: jest.fn(() => {
    return {};
  }),
}));

/**
 * Variables used in the tests
 */
// Mock configuration
const mockConfig = {
  ClientWrapper: {
    getConfig: jest.fn(() => new Promise((resolve, reject) => {
      resolve(sampleConfig);
    })),
    runScript: jest.fn(
      (path: string, keys: string[], vals: string[], callback: (error: any, data: any) => void) => {
        callback(callbackError, callbackData);
    }),
    setConfig: jest.fn(),
  },

  KafkaFactory: {
    client: jest.fn(),
    dojotProducer: jest.fn(),
    kafkaProducer: jest.fn(),
  },

  KafkaProducer: {
    close: jest.fn(),
    createTopic: jest.fn(),
    createTopics: jest.fn(),
    send: jest.fn(),
  },
};

let sampleConfig: object | undefined = {
  testService: {
    replica_assignment: {
      1: [ 1, 2, 3 ],
      2: [ 4, 5, 6 ],
    },
  },
};
// Variables to modify ClientWrapper.runScript callback behaviour
// This is kinda ugly, but I could not find another way to modify the callback parameters
let callbackError: string | undefined;
let callbackData: string | undefined;

/**
 * TopicManager tests
 */
describe("TopicManager", () => {
  let topicManager: TopicManager;
  let stripped: any;
  const testService: string = "testService";

  beforeEach(() => {
    topicManager = new TopicManager(testService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    topicManager.destroy();
  });

  describe("constructor", () => {
    it("should create a TopicManager - valid service", () => {
      expect(topicManager).toBeDefined();
    });

    it("should not create a TopicManager - invalid service", () => {
      expect(() => new TopicManager("")).toThrow();
    });
  });

  describe("getConfigTopics", () => {
    it("should get config - valid subject", () => {
      expect.assertions(1);

      topicManager.getConfigTopics("test").then((data) => {
        expect(data).toBeDefined();
      });
    });

    it("should not get config - invalid subject", () => {
      expect(() => topicManager.getConfigTopics("")).toThrow();
    });
  });

  describe("setConfigTopics", () => {
    it("should set a topic config - valid subject", () => {
      expect(() => topicManager.setConfigTopics("test", sampleConfig)).not.toThrow();
    });

    it("should not set a topic config - invalid subject", () => {
      expect(() => topicManager.setConfigTopics("", sampleConfig)).toThrow();
    });
  });

  describe("editConfigTopics", () => {
    it("should edit a topic config", () => {
      expect(() => topicManager.editConfigTopics("test", "special-user", sampleConfig)).not.toThrow();
    });

    it("should not edit a topic config - invalid subject", () => {
      expect(() => topicManager.editConfigTopics("", "special-user", sampleConfig)).toThrow();
    });

    it("should not edit a topic config - invalid tenant", () => {
      expect(() => topicManager.editConfigTopics("test", "", sampleConfig)).toThrow();
    });
  });

  describe("getCreateTopic", () => {
    const testCallback = jest.fn((error?: any, topic?: string | undefined) => {
      if (error) {
        throw new Error(error);
      }
    });
    const testSubject: string = "testSubject";

    it("should create a topic", async () => {
      callbackError = undefined;
      callbackData = "testData";
      expect(() => topicManager.getCreateTopic(testSubject, testCallback)).not.toThrow();
    });

    it("should add a pending request to the queue", () => {
      callbackError = undefined;
      callbackData = "testData";

      stripped = (topicManager as any);
      stripped.producerReady = false;
      const beforeLength = stripped.topicQueue.length;
      expect(() => stripped.getCreateTopic(testSubject, testCallback)).not.toThrow();
      const afterLength = stripped.topicQueue.length;
      // If producer is not ready, it will queue the requests, so we need to check whether
      // the length of the list has changed by one
      expect(beforeLength).toEqual(afterLength - 1);
    });

    it("should not create a topic - callback receives an error", async () => {
      callbackError = "testError";
      callbackData = undefined;
      expect(() => topicManager.getCreateTopic(testSubject, testCallback)).toThrow();
    });
  });

  describe("assertTopic", () => {
    beforeEach(() => {
      stripped = (topicManager as any);
    });

    it("should assert the topic", () => {
      expect(() => stripped.assertTopic("testTopic", "testErrorMessage")).not.toThrow();
    });

    it("should not assert the topic", () => {
      expect(() => stripped.assertTopic("", "testErrorMessage")).toThrow();
    });
  });

  describe("parseKey", () => {
    beforeEach(() => {
      stripped = (topicManager as any);
    });

    it("should create the key", () => {
      const testSubject = "testSubject";
      expect(stripped.parseKey(testSubject)).toEqual(`ti:${testService}:${testSubject}`);
    });

    it("should not create the key", () => {
      expect(() => stripped.parseKey("")).toThrow();
    });
  });

  describe("handleRequest", () => {
    const testCallback = jest.fn();
    const testRequest = {
      callback: testCallback,
      subject: "testSubject",
      topic: "testTopic",
    };
    const testConfig: object = {
      "*": {
        replica_assignment: {
          1: [ 1, 2, 3 ],
          2: [ 4, 5, 6 ],
        },
      },
    };

    let originalSampleConfig: object;

    beforeEach(() => {
      originalSampleConfig = Object.assign({}, sampleConfig);
      stripped = (topicManager as any);
    });

    afterEach(() => {
      sampleConfig = originalSampleConfig;
    });

    it("should handle a request - data with service name", async () => {
      await stripped.handleRequest(testRequest);
      expect(mockConfig.KafkaProducer.createTopic).toHaveBeenCalledTimes(1);
    });

    it("should handle a request - data with generic service name", async () => {
      sampleConfig = Object.assign({}, testConfig);
      await stripped.handleRequest(testRequest);
      expect(mockConfig.KafkaProducer.createTopic).toHaveBeenCalledTimes(1);
    });

    it("should not handle a request - without data", async () => {
      sampleConfig = undefined;
      await stripped.handleRequest(testRequest);
      expect(mockConfig.KafkaProducer.createTopic).not.toHaveBeenCalled();
    });
  });
});
