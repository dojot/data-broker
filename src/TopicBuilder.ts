/* jslint node: true */
"use strict";

import { TopicManager } from "./topicManager";

class Builder {
  private managers: {[key: string]: TopicManager};
  constructor() {
    this.managers = {};
  }

  public get(service: string): TopicManager {
    if (!this.managers.hasOwnProperty(service)) {
      this.managers[service] = new TopicManager(service);
    }

    return this.managers[service];
  }
}

export let TopicManagerBuilder = new Builder();
