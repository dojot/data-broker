/* jslint node: true */
"use strict";

import { logger } from "@dojot/dojot-module-logger";
import uuid = require("uuid/v4");
import { KafkaProducer } from "./producer";
import { QueuedTopic } from "./QueuedTopic";
import { ClientWrapper, IAutoScheme } from "./RedisClientWrapper";
import { RedisManager } from "./redisManager";

const TAG = { filename: "topicManager"};

type TopicCallback = (error?: any, topic?: string) => void;

// TODO this should also handle kafka ACL configuration
class TopicManager {
  private redis: ClientWrapper;
  private service: string;
  private getSet: string;
  private producer: KafkaProducer;
  private producerReady: boolean;
  private topicQueue: QueuedTopic[];

  constructor(service: string) {
    if ((service === undefined) || service.length === 0) {
      throw new Error("a valid service id must be supplied");
    }

    this.service = service;
    this.redis = RedisManager.getClient();
    this.getSet = __dirname + "/lua/setGet.lua";
    this.producerReady = false;
    this.topicQueue = [];
    this.producer = new KafkaProducer(undefined, () => {
      this.producerReady = true;
      if (this.topicQueue.length) {
        for (const request of this.topicQueue) {
          this.handleRequest(request);
        }
      }
    });
  }
  public getConfigTopics(subject: string): Promise<any> {
    return this.redis.getConfig(subject);
  }

  public setConfigTopics(subject: string, body: any) {
    try {
      const configs: any = body;
      let ten: any;
      for (ten in configs) {
        if (configs.hasOwnProperty(ten)) {
          const key: string = ten + ":" + subject;
          const val: string = JSON.stringify(configs[ten]);
          this.redis.setConfig(key, val);
        }
      }
    } catch (error) {
      logger.debug("Profiles could not be config", TAG);
    }
  }

  public editConfigTopics(subject: string, tenant: string, body: any) {
    const key: string = tenant + ":" + subject;
    this.redis.setConfig(key, JSON.stringify(body[tenant]));
  }

  public getCreateTopic(subject: string, callback: TopicCallback | undefined): void {
    logger.debug("Retrieving/creating new topic...", TAG);
    logger.debug(`Subject: ${subject}`, TAG);
    try {
      const key: string = this.parseKey(subject);
      const tid: string = uuid();
      this.redis.runScript(this.getSet, [key], [tid], (err: any, topic: string) => {
        if (err && callback) {
          logger.debug("... topic could not be created/retrieved.", TAG);
          logger.error(`Error while calling REDIS: ${err}`, TAG);
          callback(err);
        }

        logger.debug("... topic was properly created/retrievied.", TAG);
        const request = { topic, subject, callback };
        if (this.producerReady) {
          logger.debug("Handling all pending requests...", TAG);
          this.handleRequest(request);
          logger.debug("... all pending requests were handled.", TAG);
        } else {
          logger.debug("Producer is not yet ready.", TAG);
          logger.debug("Adding to the pending requests queue...", TAG);
          this.topicQueue.push(request);
          logger.debug("... topic was added to queue.", TAG);
        }
      });
    } catch (error) {
      logger.debug("... topic could not be created/retrieved.", TAG);
      logger.error(`An exception was thrown: ${error}`, TAG);
      if (callback) {
        callback(error);
      }
    }
  }

  public destroy() {
    logger.debug("Closing down this topic manager...", TAG);
    this.producer.close();
    logger.debug("... topic manager was closed.", TAG);
  }

  private assertTopic(topicid: string, message: string): void {
    if ((topicid === undefined) || topicid.length === 0) {
      throw new Error(message);
    }
  }

  private parseKey(subject: string) {
    this.assertTopic(subject, "a valid subject must be provided");
    return "ti:" + this.service + ":" + subject;
  }

  private handleRequest(request: QueuedTopic) {
    const profileConfigs: IAutoScheme = { num_partitions: 1, replication_factor: 1 };
    const genericService: string = "*";
    this.redis.getConfig(request.subject).then((data: any) => {
      if (data !== undefined) {
        if (data.hasOwnProperty(this.service)) {
          profileConfigs.num_partitions = data[this.service].num_partitions;
          profileConfigs.replication_factor = data[this.service].replication_factor;
        } else if (data.hasOwnProperty("*")) {
          profileConfigs.num_partitions = data[genericService].num_partitions;
          profileConfigs.replication_factor = data[genericService].replication_factor;
        }
        this.producer.createTopic(request.topic, profileConfigs, request.callback);
      }
    });
  }
}

export { TopicCallback, TopicManager };
