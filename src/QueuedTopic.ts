/* jslint node: true */
"use strict";

import { TopicCallback } from "./topicManager";

class QueuedTopic {
  public subject: string;
  public topic: string;
  public callback: TopicCallback | undefined;

  constructor() {
    this.subject = "";
    this.topic = "";
  }
}

export { QueuedTopic };
