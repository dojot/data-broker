/* jslint node: true */
"use strict";

import redis = require('redis');

class RedisManager {
  redis: redis.RedisClient

  constructor() {
    // TODO redis params should be configurable
    this.redis = redis.createClient({'host': 'data-broker-redis'})
  }

  getClient(service: string): redis.RedisClient {
    return this.redis;
  }
}

var redisSingleton = new RedisManager();
export {redisSingleton as RedisManager};
