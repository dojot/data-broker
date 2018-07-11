/* jslint node: true */
"use strict";

import axios, { AxiosError, AxiosResponse } from "axios";
import util = require("util");
import { logger } from "../src/logger";
import * as device from "./deviceManager";

type DeviceRequestCallback = (err: any, data: device.IDevice | undefined) => void;

function generateJWT(service: string) {
  return (new Buffer("dummy jwt schema").toString("base64")) + "."
         + (new Buffer(JSON.stringify({service})).toString("base64")) + "."
         + (new Buffer("dummy signature").toString("base64"));
}

class DeviceCache {
  private deviceInfo: {[id: string]: device.IDevice};
  private deviceManager: string;

  /**
   * Constructor
   * @param deviceManager DeviceManager host
   */
  constructor(deviceManager: string) {
    this.deviceInfo = {};
    this.deviceManager = deviceManager;
  }

  public getDeviceInfo(service: string, deviceId: string, cb: DeviceRequestCallback): void {
    logger.debug("Got a request for device info...");
    const data = this.deviceInfo[this.parseKey(service, deviceId)];
    if (data === undefined) {
      logger.debug("No data in cache.");
      this.requestDeviceInfo(service, deviceId, cb);
    } else {
      cb(null, data);
    }
  }

  private requestDeviceInfo(service: string, deviceId: string, cb: DeviceRequestCallback): void {
    logger.debug("Retrieving device info from DeviceManager...");
    logger.debug(this.deviceManager);
    logger.debug(`service: ${service}`);
    axios({
      headers: {authorization: "Bearer " + generateJWT(service)},
      method: "get",
      url: this.deviceManager + "/device/" + deviceId,
    })
    .then((response: AxiosResponse) => {
      logger.debug("... device info was retrieved.");
      logger.debug(`Data is: ${util.inspect(response.data, {depth: null})}`);
      this.deviceInfo[this.parseKey(service, deviceId)] = response.data;
      cb(null, response.data);
    })
    .catch((error: AxiosError) => {
      logger.debug("... device info was not retrieved.");
      logger.error(`Error is: ${error}`);
      cb(error, undefined);
    });
    logger.debug("... request for DeviceManager was sent.");
  }

  private parseKey(service: string, deviceId: string): string {
    return service + "::" + deviceId;
  }
}

export { DeviceCache };
