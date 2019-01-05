/* jslint node: true */
"use strict";

import { logger } from "@dojot/dojot-module-logger";
import crypto = require("crypto");
import fs = require("fs");
import redis = require("redis");

export interface IAssignedScheme {
  replica_assigment: {
    [partition: string]: number[];
  };
}

export interface IAutoScheme {
  num_partitions: number;
  replication_factor: number;
}
export interface ITopicProfile {
  [name: string]: IAssignedScheme | IAutoScheme;
}

/**
 * Client for REDIS database
 */
class ClientWrapper {
  public client: redis.RedisClient;

  constructor(client: redis.RedisClient) {
    this.client = client;
  }

  /**
   * Gets profile configs for a given subject
   * @param subject
   */
  public getConfig(subject: string): Promise<ITopicProfile | undefined> {
    return new Promise<ITopicProfile | undefined>((resolve, reject) => {
      this.client.select(1);
      logger.debug(`subject: ${subject}`);
      const pattern: string = "*:" + subject;
      // let cursor: string = '0';
      let keys: any = [];
      const configs: ITopicProfile = {};

      /**
       * Gets configs given an array of keys
       * @param keys array of keys found
       * @param cursor cursor to iterate the keys' array (this isn't the same cursor of scanKeys)
       * @param client redis client
       */
      function getConfigs(keysFound: string[], cursor: number, client: redis.RedisClient) {
        client.select(1);

        const insertConfig = (key: any, err: any, reply: any) => {
          if (err) {
            reject(err);
            return;
          }
          if (key.length > 0) {
            configs[key.split(":")[0]] = JSON.parse(reply);
          }

          if (cursor === 0) {
            resolve(configs);
            return;
          }
          cursor--;
          return getConfigs(keysFound, cursor, client);
        };

        client.get(keysFound[cursor], (err, reply) => {
          insertConfig(keysFound[cursor], err, reply);
        });
      }
      /**
       * Scans all keys that math the pattern *:subject on redis, then, it calls getConfigs to get the value
       * of these keys, if they exist.
       * @param client redis client
       * @param cursor initial cursor to start scanning in redis
       */
      function scanKeys(client: redis.RedisClient, cursor: string) {
        client.scan(cursor, "MATCH", pattern, (err, res) => {
          if (err) {
            reject(err);
            return;
          }
          cursor = res[0];
          if (res[1].length > 0) {
            keys = keys.concat(res[1]);
          }
          if (cursor === "0") {
            if (keys.length === 0) {
              resolve(configs);
              return;
            }
            return getConfigs(keys, keys.length - 1, client);
          }
          return scanKeys(client, cursor);
        });

      }
      scanKeys(this.client, "0");
    });

  }
  /**
   * Sets data into redis[1]
   *
   * @param key key 'tenant:subject' to be fetched
   * @param val value of the key
   */

  public setConfig(key: string, val: any) {
    this.client.select(1);
    this.client.set(key, val);
  }
  /**
   * Run a simple script to fetch or update data in REDIS.
   *
   * @param path Where the script is located
   * @param keys Keys to be fetched
   * @param vals If defined, the values to be updated in REDIS
   * @param callback Callback invoked when the request finishes.
   */

  public runScript(path: string, keys: string[], vals: string[], callback: (error: any, data: any) => void) {
    const script = fs.readFileSync(path, { encoding: "utf-8" });
    const sha1 = crypto.createHash("sha1").update(script).digest("hex");

    const evalshaCallback = (err: any, data: any) => {
      if (err) {
        callback(err, undefined);
      } else {
        callback(undefined, data);
      }
    };

    const evalOrLoadCallback = (err: any, data: any) => {
      if (err) {
        if (err.code === "NOSCRIPT") {
          this.client.script("load", script, () => {
            if (vals && (vals.length > 0)) {
              this.client.select(0);
              this.client.evalsha(sha1, keys.length, keys[0], vals[0], evalshaCallback);
            } else {
              this.client.evalsha(sha1, keys.length, keys[0], evalshaCallback);
            }
          });
        }
      } else {
        callback(undefined, data);
      }
    };

    if (vals && (vals.length > 0)) {
      this.client.select(0);
      this.client.evalsha(sha1, keys.length, keys[0], vals[0], evalOrLoadCallback);
    } else {
      this.client.evalsha(sha1, keys.length, keys[0], evalOrLoadCallback);
    }
  }
}

export { ClientWrapper };
