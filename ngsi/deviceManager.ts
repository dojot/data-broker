/* jslint node: true */
"use strict";

export interface IAttr {
  created?: string;
  id: string;
  label: string;
  template_id: string;
  type: string;
  value_type: string;
}

export interface IDevice {
  created?: string;
  id: string;
  label: string;
  templates: string[];
  attrs: { [templateId: string]: IAttr[] };
}

export function findAttrValueType(device: IDevice, attribute: string): string | null {
  for (const template in device.attrs) {
    if (device.attrs.hasOwnProperty(template)) {
      for (const attr of device.attrs[template]) {
        if (attribute === attr.label) {
          return attr.value_type;
        }
      }
    }
  }

  return null;
}
