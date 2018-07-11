/* jslint node: true */
"use strict";

import redis = require("redis");
import config = require("./config");
import { ClientWrapper } from "./RedisClientWrapper";

class RedisManager {
  private redis: redis.RedisClient;

  constructor() {
    this.redis = redis.createClient({host: config.cache.redis});
  }

  /**
   * Build a new client wrapper based on the already created REDIS connection.
   * @returns A new client wrapper.
   */
  public getClient(): ClientWrapper {
    return new ClientWrapper(this.redis);
  }
}

const redisSingleton = new RedisManager();
export {redisSingleton as RedisManager};
