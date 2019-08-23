"use strict";
import { Messenger } from "@dojot/dojot-module";
import "jest";
import { RedisClient } from "redis";
import { AgentHealthChecker } from "../src/Healthcheck";

/**
 * Variables
 */
const mockConfig = {
  HealthCheck: {
    registerMonitor: jest.fn(),
  },
  RedisClient: {
    on: jest.fn(),
  },
  Router: jest.fn(),
};

/**
 * Mocks
 */
jest.mock("@dojot/dojot-module", () => ({
  Messenger: jest.fn(),
}));

jest.mock("redis", () => ({
  RedisClient: jest.fn(() => mockConfig.RedisClient),
}));

jest.mock("@dojot/healthcheck", () => ({
  HealthChecker: jest.fn(() => mockConfig.HealthCheck),
  Router: jest.fn(),
  getHTTPRouter: jest.fn(() => ({})),
}));

describe("AgentHealthCheck", () => {
  let messenger: Messenger;
  let redisClient: RedisClient;
  let hc: AgentHealthChecker;
  let stripped: any;

  beforeEach(() => {
    messenger = new Messenger("testMessenger");
    redisClient = new RedisClient({});
    hc = new AgentHealthChecker(messenger, redisClient);
    stripped = (hc as any);
  });

  it("should build an AgentHealthCheck", () => {
    expect(hc).toBeDefined();
    expect(hc.router).toBeDefined();

    expect(stripped.healthChecker).toBeDefined();
    expect(stripped.kafkaMessenger).toBeDefined();
    expect(stripped.kafkaMessenger).toBe(messenger);
    expect(stripped.redisClient).toBeDefined();
    expect(stripped.redisClient).toBe(redisClient);
  });

  it("should register monitors", () => {
    hc.init();
    expect(mockConfig.HealthCheck.registerMonitor).toHaveBeenCalledTimes(5);
  });
});
