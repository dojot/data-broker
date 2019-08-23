/* jslint node: true */
"use strict";

import "jest";
import { TopicManagerBuilder } from "../src/TopicBuilder";

jest.mock("../src/topicManager", () => ({
  TopicManager: jest.fn((service: string) => {
    // part of default TopicManager execution flow
    if ((service === undefined) || service.length === 0) {
      throw new Error();
    }
  }),
}));

describe("TopicBuilder", () => {
  const topicBuilder = TopicManagerBuilder;

  describe("get", () => {
    it("should build a new service - valid name", () => {
      expect(topicBuilder.get("testService1")).toBeDefined();
    });

    it("should not build a new service - invalid name", () => {
      expect(() => topicBuilder.get("")).toThrow();
    });

    it("should retrieve an already created service", () => {
      const manager = topicBuilder.get("testService2");
      expect(manager).toBeDefined();

      const retrievedManager = topicBuilder.get("testService2");
      expect(retrievedManager).toBeDefined();

      expect(manager).toBe(retrievedManager);
    });
  });
});
