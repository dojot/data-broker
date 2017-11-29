/* jslint node: true */
"use strict";

import entities = require('./entities');
import redis = require('redis');
import {RedisManager} from './redisManager';

// var reval = require('redis-eval');
var uuid = require('uuid/v4');

// TODO this should also handle kafka ACL configuration
export class TopicManager {
  redis: redis.RedisClient
  service: string
  get_set: string

  constructor(service: string) {
    if ((service === undefined) || service.length == 0) {
      throw new Error('a valid service id must be supplied');
    }

    this.service = service;
    this.redis = RedisManager.getClient(this.service);
    this.get_set = __dirname + "/lua/setGet.lua";
  }

  assertTopic(topicid: string, message: string): void {
    if ((topicid === undefined) || topicid.length == 0) {
      throw new Error(message);
    }
  }

  parseKey(subject: string) {
    this.assertTopic(subject, 'a valid subject must be provided');
    return 'ti:' + this.service + ':' + subject;
  }

  getCreateTopic(subject: string, callback: (error: any, data: any) => any): void {
    try {
      const key: string = this.parseKey(subject);
      console.log('key parsed', key);
      const tid: string = uuid();
      console.log('will reval with', key, tid);
      // reval(this.redis, this.get_set, [key], [uuid()], (err: any, data: any) => {
      //   if (err) { callback(err, undefined); }
      //   console.log(data);
      //   callback(undefined, data);
      // })
    } catch (e) {
      callback(e, undefined);
    }
  }
}
