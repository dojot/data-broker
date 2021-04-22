/* jslint node: true */
"use strict";

import { logger } from "@dojot/dojot-module-logger";
import axios, { AxiosError, AxiosResponse } from "axios";
import util = require("util");
import * as device from "./deviceManager";

const TAG = { filename: "device-cache" };

type DeviceRequestCallback = (err: any, data: device.IDevice | undefined) => void;

function generateJWT(service: string) {
  //"iss": "http://localhost:8000/auth/realms/admin",
  return (new Buffer("dummy jwt schema").toString("base64")) + "."
    // + (new Buffer(JSON.stringify({ service })).toString("base64")) + "."
    + (new Buffer(JSON.stringify({ iss: "http://localhost:8000/auth/realms/" + service })).toString("base64")) + "."
    + (new Buffer("dummy signature").toString("base64"));
}

class DeviceCache {
  private deviceInfo: { [id: string]: device.IDevice };
  private deviceManager: string;

  constructor(deviceManager: string) {
    this.deviceInfo = {};
    this.deviceManager = deviceManager;
  }
  public getDeviceInfo(service: string, deviceId: string, cb: DeviceRequestCallback): void {
    logger.debug("Got a request for device info...", TAG);
    const data = this.deviceInfo[this.parseKey(service, deviceId)];
    if (data === undefined) {
      logger.debug("No data in cache.", TAG);
      this.requestDeviceInfo(service, deviceId, cb);
    } else {
      cb(null, data);
    }
  }

  private requestDeviceInfo(service: string, deviceId: string, cb: DeviceRequestCallback): void {
    logger.debug("Retrieving device info from DeviceManager...", TAG);
    axios({
      headers: { authorization: "Bearer " + generateJWT(service) },
      method: "get",
      url: this.deviceManager + "/device/" + deviceId,
    })
      .then((response: AxiosResponse) => {
        logger.debug("... device info was retrieved.", TAG);
        logger.debug(`Data is: ${util.inspect(response.data, { depth: null })}`, TAG);
        this.deviceInfo[this.parseKey(service, deviceId)] = response.data;
        cb(null, response.data);
      })
      .catch((error: AxiosError) => {
        logger.debug("... device info was not retrieved.", TAG);
        logger.error(`Error is: ${error}`, TAG);
        cb(error, undefined);
      });
    logger.debug("... request for DeviceManager was sent.", TAG);
  }

  private parseKey(service: string, deviceId: string): string {
    return service + "::" + deviceId;
  }
}

export { DeviceCache };
