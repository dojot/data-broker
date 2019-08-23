"use strict";

import "jest";
import { RedisManager } from "../src/redisManager";

jest.mock("redis", () => ({
  createClient: jest.fn(() => {
    return {};
  }),
}));

jest.mock("../src/RedisClientWrapper", () => ({
  ClientWrapper: jest.fn(() => {
    return {};
  }),
}));

describe("RedisManager", () => {
  it("should be defined", () => {
    expect(RedisManager).toBeDefined();

    const rm = (RedisManager as any);
    expect(rm.redis).toBeDefined();
  });

  it("should retrieve clientWrapper", () => {
    const client = RedisManager.getClient();
    expect(client).toBeDefined();
  });
});
