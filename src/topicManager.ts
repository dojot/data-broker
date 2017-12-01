/* jslint node: true */
"use strict";

import redis = require('redis');
import {ClientWrapper, RedisManager} from './redisManager';

var uuid = require('uuid/v4');

// TODO this should also handle kafka ACL configuration
export class TopicManager {
  redis: ClientWrapper
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
      const tid: string = uuid();
      this.redis.runScript(this.get_set, [key], [tid], callback);
    } catch (e) {
      callback(e, undefined);
    }
  }
}
