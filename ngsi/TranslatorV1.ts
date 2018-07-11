/* jslint node: true */
"use strict";

import * as device from "./deviceManager";
import * as NGSIv1 from "./v1Types";

class TranslatorV1 {

  /**
   * Translates to NGSIv1 format
   * @param  {any}           deviceData Current values to be embedded in the event
   * @param  {device.Device} deviceInfo Device information model, as configured in device-manager
   * @param  {string}        topic      Topic in which the event has been received
   * @return {NGSIv1.IEvent}             Object containing event in NGSI format
   */
  public translate(deviceData: any, deviceInfo: device.IDevice, topic: string): NGSIv1.IEvent | null {
    const status: NGSIv1.IStatus = {code: "200", reasonPhrase: "OK"};
    const element: NGSIv1.IContextElement = {
      attributes: [],
      id: deviceInfo.id,
      isPattern: "false",
      type: "device",
    };

    for (const attr in deviceData) {
      if (deviceData.hasOwnProperty(attr)) {
        const type = device.findAttrValueType(deviceInfo, attr);
        if (type == null) {
          return null;
        }
        const newAttr: NGSIv1.IAttribute = {
          name: attr,
          type,
          value: deviceData[attr],
        };
        element.attributes.push(newAttr);
      }
    }

    const response: NGSIv1.IContextResponse = {contextElement: [element], statusCode: status};
    return {
      contextResponses: [response],
      originator: "localhost",
      subscriptionId: topic,
    };
  }
}

export { TranslatorV1 };
