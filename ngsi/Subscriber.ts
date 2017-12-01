/* jslint node: true */
"use strict";

import {ArgumentParser} from 'argparse';
import kafka = require('kafka-node');
var uuid = require('uuid/v4');
import axios, {AxiosResponse, AxiosError} from 'axios';

import * as NGSIv1 from './v1Types';
import * as device from './deviceManager';
import {DeviceCache} from './DeviceCache';


let parser = new ArgumentParser();
parser.addArgument(['-t', '--topic']);
parser.addArgument(['-k', '--kafka']);
parser.addArgument(['-o', '--target']);
parser.addArgument(['--deviceManager'], {'defaultValue': 'http://device-manager:5000'})
parser.addArgument(['--group'], {'defaultValue': uuid()});
parser.addArgument(['--version'], {'defaultValue': 'v1'});
const args = parser.parseArgs();

let cache = new DeviceCache(args.deviceManager);

interface Translator {
  /**
  * Translates to NGSI format
  * @param  {any}            deviceData Current values to be embedded in the event
  * @param  {device.Device}  deviceInfo Device information model, as configured in device-manager
  * @param  {string}         topic      Topic in which the event has been received
  * @return {any}                       Object containing event in NGSI format
  */
  translate(deviceData: any, deviceInfo: device.Device, topic: string): any;
}

class Translator_v1 {

  /**
   * Translates to NGSIv1 format
   * @param  {any}           deviceData Current values to be embedded in the event
   * @param  {device.Device} deviceInfo Device information model, as configured in device-manager
   * @param  {string}        topic      Topic in which the event has been received
   * @return {NGSIv1.Event}             Object containing event in NGSI format
   */
  translate(deviceData: any, deviceInfo: device.Device, topic: string): NGSIv1.Event | null {
    const status: NGSIv1.Status = {'code': '200', 'reasonPhrase': 'OK'};
    let element: NGSIv1.ContextElement = {
      'attributes': [],
      'type': 'device',
      'isPattern': 'false',
      'id': deviceInfo.id
    }

    for (let attr in deviceData) {
      const type = device.findAttrValueType(deviceInfo, attr);
      if (type == null) {
        return null;
      }
      let newAttr: NGSIv1.Attribute = {
        'name': attr,
        'value': deviceData[attr],
        'type': type
      };
      element.attributes.push(newAttr);
    }

    let response: NGSIv1.ContextResponse = {'contextElement':[element], 'statusCode': status};
    return {
      'subscriptionId': topic,
      'originator': 'localhost',
      'contextResponses': [response]
    };
  }
}

class Translator_v2 {

  /**
   * Translates to NGSIv1 format
   * @param  {any}           deviceData Current values to be embedded in the event
   * @param  {device.Device} deviceInfo Device information model, as configured in device-manager
   * @param  {string}        topic      Topic in which the event has been received
   * @return {string}                   Object containing event in NGSI format
   */
  translate(deviceData: any, deviceInfo: device.Device, topic: string): any {
    let data: any = {
      id: deviceInfo.id,
      type: 'device'
    };

    for (let attr in deviceData) {
      const type = device.findAttrValueType(deviceInfo, attr);
      if (type == null) {
        return null;
      }

      data[attr] = {
        'type': type,
        'value': deviceData[attr]
      }
    }

    return {'data': [data]};
  }
}

let translator: Translator;
if (args.version === 'v1'){
  translator = new Translator_v1();
} else if (args.version === 'v2') {
  translator = new Translator_v2();
} else {
  console.error('Unknown version ' + args.version + ' requested.');
  process.exit(1);
}

function handleMessage(data:kafka.Message) {

  let event = JSON.parse(data.value);
  let meta = event.metadata;
  cache.getDeviceInfo(meta.service, meta.deviceid, (err: any, deviceInfo: device.Device | undefined) => {
    if (err || (deviceInfo == undefined)) {
      console.error('Failed to process received event', err);
      return;
    }

    const translated = translator.translate(event.attrs, deviceInfo, data.topic);
    if (translated == null) {
      console.error('Failed to parse event', event);
    }

    axios({
      'url': args.target,
      'method': 'post',
      'headers': {'content-type': 'application/json'},
      'data': translated
    })
    .then((response:AxiosResponse) => { console.log('event sent'); })
    .catch((error:AxiosError) => { console.log('failed to send request'); })
  });

}

const options = { 'kafkaHost': args.kafka, 'groupId': args.group};
let consumer = new kafka.ConsumerGroup(options, args.topic);
consumer.on('message', handleMessage);
consumer.on('error', (err) => { console.error('kafka consumer error', err); });
