/* jslint node: true */
"use strict";

import axios, {AxiosResponse, AxiosError} from 'axios';
import * as device from './deviceManager';

function generateJWT(service: string) {
  return (new Buffer('dummy jwt schema').toString('base64')) + '.'
         + (new Buffer(JSON.stringify({'service':service})).toString('base64')) + '.'
         + (new Buffer('dummy signature').toString('base64'));

}

export class DeviceCache {
  deviceInfo: {[id: string]: device.Device};
  deviceManager: string;

  constructor(deviceManager: string) {
    this.deviceInfo = {};
    this.deviceManager = deviceManager;
  }

  parseKey(service: string, device_id: string): string {
    return service + '::' + device_id;
  }

  requestDeviceInfo(service: string, device_id: string,cb: (err:any, data: device.Device | undefined) => void): void {
    axios({
      'url': this.deviceManager + '/device/' + device_id,
      'method': 'get',
      'headers': {'authorization': 'Bearer ' + generateJWT(service)}
    })
    .then((response: AxiosResponse) => {
      console.log('got device data', response.data);
      this.deviceInfo[this.parseKey(service, device_id)] = response.data;
      cb(null, response.data);
    })
    .catch((error: AxiosError) => {
      cb(error, undefined);
    })
  }

  getDeviceInfo(service: string, device_id: string, cb: (err:any, data: device.Device | undefined) => void): void {
    let data = this.deviceInfo[this.parseKey(service, device_id)];
    if (data == undefined) {
      console.log('cache missed');
      this.requestDeviceInfo(service, device_id, cb);
    } else {
      cb(null, data);
    }
  }
}
