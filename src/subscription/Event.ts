/* jslint node: true */
"use strict";

class Event {
  // Metadata might be "any" as well.
  public metadata: {
    deviceid: string;
    tenant: string;
    templates: number[];
    notif_receiver: any;
  };
  public attrs: any;

  constructor(data: any) {
    this.metadata = {
      deviceid: data.metadata.deviceid,
      notif_receiver: {},
      templates: data.metadata.templates,
      tenant: data.metadata.tenant,
    };
    this.attrs = data.attrs;
  }
}

export { Event };
