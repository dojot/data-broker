/* jslint node: true */
"use strict";

export interface Attr {
  created?: string;
  id: string;
  label: string;
  template_id: string;
  type: string;
  value_type: string;
}

export interface Device {
  created?: string;
  id: string;
  label: string;
  templates: string[];
  attrs: {[template_id: string]: Attr[]}
}

export function findAttrValueType(device: Device, attribute: string): string | null {
  for (let template in device.attrs) {
    for (let attr of device.attrs[template]) {
      if (attribute === attr.label) {
        return attr.value_type;
      }
    }
  }

  return null;
}
