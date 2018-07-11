/* jslint node: true */
"use strict";

import * as device from "./deviceManager";

class TranslatorV2 {
  /**
   * Translates to NGSIv1 format
   * @param  {any}           deviceData Current values to be embedded in the event
   * @param  {device.Device} deviceInfo Device information model, as configured in device-manager
   * @param  {string}        topic      Topic in which the event has been received
   * @return {string}                   Object containing event in NGSI format
   */
  public translate(deviceData: any, deviceInfo: device.IDevice): any {
    const data: any = {
      id: deviceInfo.id,
      type: "device",
    };

    for (const attr in deviceData) {
      if (deviceData.hasOwnProperty(attr)) {
        const type = device.findAttrValueType(deviceInfo, attr);
        if (type == null) {
          return null;
        }

        data[attr] = {
          type,
          value: deviceData[attr],
        };
      }
    }

    return {data: [data]};
  }
}

export { TranslatorV2 };
