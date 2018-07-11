"use strict";

import {ArgumentParser} from "argparse";
import axios, {AxiosError} from "axios";
import kafka = require("kafka-node");
import uuid = require("uuid/v4");
import { logger } from "../src/logger";
import { Event } from "../src/subscription/Event";
import { DeviceCache } from "./DeviceCache";
import * as device from "./deviceManager";
import { TranslatorV1 } from "./TranslatorV1";
import { TranslatorV2 } from "./TranslatorV2";

const parser = new ArgumentParser();
parser.addArgument(["-t", "--topic"]);
parser.addArgument(["-k", "--kafka"]);
// parser.addArgument(["-o", "--target"]);
parser.addArgument(["--deviceManager"], {defaultValue: "http://device-manager:5000"});
parser.addArgument(["--group"], {defaultValue: uuid()});
parser.addArgument(["--version"], {defaultValue: "v1"});
const args = parser.parseArgs();

const cache = new DeviceCache(args.deviceManager);

interface ITranslator {
  /**
   * Translates to NGSI format
   * @param  {any}            deviceData Current values to be embedded in the event
   * @param  {device.Device}  deviceInfo Device information model, as configured in device-manager
   * @param  {string}         topic      Topic in which the event has been received
   * @return {any}                       Object containing event in NGSI format
   */
  translate(deviceData: any, deviceInfo: device.IDevice, topic: string): any;
}

let translator: ITranslator | null;
if (args.version === "v1") {
  translator = new TranslatorV1();
} else if (args.version === "v2") {
  translator = new TranslatorV2();
} else if (args.version === "plain") {
  translator = null;
} else {
  logger.error("Unknown version " + args.version + " requested.");
  process.exit(1);
}

function handleMessage(data: kafka.Message) {
  logger.debug("Handling new message...");
  const event: Event = JSON.parse(data.value);
  const meta = event.metadata;
  const receiver: string = event.metadata.notif_receiver;

  logger.debug(`Message is: ${event}.`);
  logger.debug(`Notification receiver is ${receiver}`);

  cache.getDeviceInfo(meta.tenant, meta.deviceid, (err: any, deviceInfo: device.IDevice | undefined) => {
    if (err || (deviceInfo === undefined)) {
      logger.error("Failed to process received event", err);
      return;
    }

    let translated: any;
    if (translator !== null) {
      translated = translator.translate(event.attrs, deviceInfo, data.topic);
      if (translated == null) {
        logger.error("Failed to parse event", event);
      }
    } else {
      translated = event.attrs;
    }

    logger.debug(`Sending POST to ${receiver}`);
    axios({
      data: translated,
      headers: {"content-type": "application/json"},
      method: "post",
      url: receiver,
    })
    .then(() => { logger.debug("event sent"); })
    .catch((error: AxiosError) => {
      logger.debug("... event was not sent.");
      logger.error(`Error is: ${error}`);
    });
  });

}

const options = { kafkaHost: args.kafka, groupId: args.group};
logger.debug("Initializing Kafka consumer...");
const consumer = new kafka.ConsumerGroup(options, args.topic);
logger.debug("... kafka consumer was initialized.");
consumer.on("message", handleMessage);
consumer.on("error", (err) => { logger.error("kafka consumer error", err); });
