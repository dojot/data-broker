/* jslint node: true */
"use strict";

import { logger } from "@dojot/dojot-module-logger";
import redis = require("redis");
import util = require("util");
import config = require("./config");
import { ClientWrapper } from "./RedisClientWrapper";

class RedisManager {
  private redis: redis.RedisClient;

  constructor() {
    logger.debug(`Redis configuration is:`);
    logger.debug(`${util.inspect(config.cache, { depth: null })}`);
    const cacheUser = config.cache.user;
    const cachePwd = config.cache.pwd;
    const cacheHost = `${config.cache.address}:${config.cache.port}`;
    const cacheDatabase = config.cache.database;
    const url = `redis://${cacheUser}:${cachePwd}@${cacheHost}/${cacheDatabase}`;
    this.redis = redis.createClient({ url });
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
export { redisSingleton as RedisManager };
